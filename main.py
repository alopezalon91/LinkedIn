"""
main.py
-------
Main orchestrator for the LinkedIn automation system.

Usage (called by GitHub Actions):
    python main.py --module boe
    python main.py --module news
    python main.py --module boe --date 20240601   # specific date for BOE

Environment variables required:
    GEMINI_API_KEY      – Google Gemini API key
    CF_WORKER_URL       – Cloudflare Worker base URL (e.g. https://bot.example.workers.dev)
    CF_WORKER_TOKEN     – Bearer token for the Worker API

Environment variables optional:
    LOG_LEVEL           – DEBUG | INFO | WARNING (default: INFO)
    BOE_DATE            – Override date for BOE scraping (YYYYMMDD)
    DRY_RUN             – Set to '1' to skip POSTing to Cloudflare (prints posts to stdout)

Exit codes:
    0 – Success (≥1 post generated)
    1 – Failure (no posts generated or fatal error)
    2 – Configuration error (missing env vars)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load .env file (for local development; GitHub Actions uses repo secrets)
# ---------------------------------------------------------------------------

load_dotenv()

# ---------------------------------------------------------------------------
# Logging – configured before any module imports so all loggers inherit it
# ---------------------------------------------------------------------------

_log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _log_level, logging.INFO),
    format="%(asctime)s [MAIN] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("main")

# ---------------------------------------------------------------------------
# Local module imports (after logging setup)
# ---------------------------------------------------------------------------

from scrapers.boe_scraper import run as boe_run
from scrapers.news_scraper import run as news_run
from ai.relevance_scorer import score_batch
from ai.content_generator import generate_normativa_post, generate_actualidad_post
from ai.learning_model import LearningModel

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DRY_RUN = os.environ.get("DRY_RUN", "false").strip().lower() in ("1", "true", "yes")
# Support both WORKER_URL (GitHub Actions secret name) and CF_WORKER_URL (legacy .env name)
CF_WORKER_URL = (
    os.environ.get("CF_WORKER_URL")
    or os.environ.get("WORKER_URL", "")
).rstrip("/")
# Support both WORKER_SECRET (GitHub Actions secret name) and CF_WORKER_TOKEN (legacy .env name)
CF_WORKER_TOKEN = (
    os.environ.get("CF_WORKER_TOKEN")
    or os.environ.get("WORKER_SECRET", "")
)
MAX_POSTS_PER_RUN = 5  # Cap to avoid spamming; queue the rest


# ---------------------------------------------------------------------------
# Cloudflare posting
# ---------------------------------------------------------------------------

def _post_to_cloudflare(post: dict) -> bool:
    """
    POSTs a generated post payload to the Cloudflare Workers API.

    The Worker stores the post in D1 and queues it for Alberto's review
    in the approval dashboard.

    Args:
        post: Dict from generate_normativa_post() or generate_actualidad_post().

    Returns:
        True on success, False on failure.
    """
    if not CF_WORKER_URL:
        log.warning("CF_WORKER_URL not set – cannot POST to Cloudflare.")
        return False

    endpoint = f"{CF_WORKER_URL}/api/posts"
    headers = {"Content-Type": "application/json"}
    if CF_WORKER_TOKEN:
        headers["Authorization"] = f"Bearer {CF_WORKER_TOKEN}"

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(endpoint, json=post, headers=headers)
            if resp.status_code in (200, 201):
                log.info(
                    "Post queued in Cloudflare D1 (post_id=%s, type=%s, sector=%s).",
                    post["post_id"], post["type"], post["sector"],
                )
                return True
            else:
                log.error(
                    "Cloudflare API returned HTTP %d for post_id=%s: %s",
                    resp.status_code, post.get("post_id"), resp.text[:200],
                )
                return False
    except httpx.RequestError as exc:
        log.error("Network error posting to Cloudflare: %s", exc)
        return False

def _filter_existing_posts(entries: list[dict]) -> list[dict]:
    """
    Asks the Cloudflare Worker which source_ids already exist in the dashboard
    (pending, approved, rejected, published) and filters them out.
    """
    if not CF_WORKER_URL or not entries:
        return entries
        
    source_ids = [str(e.get("id")) for e in entries if e.get("id")]
    if not source_ids:
        return entries
        
    endpoint = f"{CF_WORKER_URL}/api/posts/check-sources"
    headers = {"Content-Type": "application/json"}
    if CF_WORKER_TOKEN:
        headers["Authorization"] = f"Bearer {CF_WORKER_TOKEN}"
        
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(endpoint, json={"source_ids": source_ids}, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                existing = set(data.get("existing_source_ids", []))
                if existing:
                    log.info("Anti-duplicate filter: Cloudflare reported %d items already exist in the dashboard. Discarding them.", len(existing))
                return [e for e in entries if str(e.get("id")) not in existing]
            else:
                log.warning("Could not check duplicate source IDs (HTTP %d). Proceeding without duplicate filter.", resp.status_code)
                return entries
    except Exception as exc:
        log.warning("Error checking duplicate source IDs: %s. Proceeding without filter.", exc)
        return entries


# ---------------------------------------------------------------------------
# Module runners
# ---------------------------------------------------------------------------

def run_boe_module(date: str | None = None) -> list[dict]:
    """
    Full pipeline for the BOE/Normativa module.

        1. Scrape BOE (today or given date).
        2. AI relevance scoring → keep only should_post=True.
        3. Generate LinkedIn posts.
        4. Return list of post dicts (ready to POST to Cloudflare).

    Args:
        date: Optional YYYYMMDD date string. Defaults to today.

    Returns:
        List of generated post dicts (capped at MAX_POSTS_PER_RUN).
    """
    log.info("▶ Running BOE module (date=%s)…", date or "today")

    # Step 1 – Scrape
    entries = boe_run(date=date)
    if not entries:
        log.info("No BOE entries to process.")
        return []

    # Step 2 – AI relevance scoring
    scored_entries = score_batch(entries, item_type="boe")
    if not scored_entries:
        log.info("No BOE entries passed relevance threshold.")
        return []

    # Step 2.5 – Discard items already in the Cloudflare dashboard
    scored_entries = _filter_existing_posts(scored_entries)
    if not scored_entries:
        log.info("All relevant BOE entries were already processed previously.")
        return []

    # Step 3 – Generate posts (cap to MAX_POSTS_PER_RUN)
    posts: list[dict] = []
    
    def _gen_post(entry):
        score_data = entry.get("_score_data", {})
        try:
            post = generate_normativa_post(entry, score_data)
            post["post_id"] = str(uuid.uuid4())
            log.info(
                "Generated normativa post: %s (score=%d urgency=%s chars=%d valid=%s)",
                post["post_id"][:8], post["ai_score"], post["ai_urgency"],
                post["char_count"], post["valid"],
            )
            return post
        except RuntimeError as exc:
            log.error("Post generation failed for BOE entry %s: %s", entry.get("id"), exc)
            return None

    import concurrent.futures
    items_to_generate = scored_entries[:MAX_POSTS_PER_RUN]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(_gen_post, entry) for entry in items_to_generate]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                posts.append(res)

    return posts


def run_news_module(query: Optional[str] = None) -> list[dict]:
    """
    Full pipeline for the News/Actualidad module.

        1. Scrape all RSS feeds + official sources, or search keyword if query provided.
        2. Deduplicate + credibility filter.
        3. AI relevance scoring.
        4. Generate LinkedIn posts.
        5. Return list of post dicts.

    Returns:
        List of generated post dicts (capped at MAX_POSTS_PER_RUN).
    """
    log.info("▶ Running News module…")

    # Step 1+2 – Scrape, dedupe, filter
    articles = news_run(query=query)
    if not articles:
        log.info("No news articles to process.")
        return []

    # Step 3 – AI relevance scoring
    scored_articles = score_batch(articles, item_type="news", force_keep_all=bool(query))
    if not scored_articles:
        log.info("No news articles passed relevance threshold.")
        return []

    # Step 3.5 – Discard items already in the Cloudflare dashboard
    scored_articles = _filter_existing_posts(scored_articles)
    if not scored_articles:
        log.info("All relevant news articles were already processed previously.")
        return []

    # Step 4 – Generate posts
    posts: list[dict] = []
    
    def _gen_post(article):
        score_data = article.get("_score_data", {})
        try:
            from ai.researcher import verify_news_facts
            title = article.get("title", "")
            full_text = article.get("texto", "") or article.get("summary", "")
            log.info("Running fact-check research for: %s", title)
            fact_check_report = verify_news_facts(title, full_text)
            if fact_check_report:
                article["fact_check_report"] = fact_check_report
                if "ALERTA ROJA" in fact_check_report.upper():
                    article["title"] = f"🚨 ALERTA FAKE/CLICKBAIT: {title}"

            post = generate_actualidad_post(article, score_data)
            post["post_id"] = str(uuid.uuid4())
            log.info(
                "Generated actualidad post: %s (score=%d source=%s chars=%d valid=%s)",
                post["post_id"][:8], post["ai_score"],
                post.get("source_name", "?"), post["char_count"], post["valid"],
            )
            return post
        except RuntimeError as exc:
            log.error(
                "Post generation failed for article %s: %s",
                article.get("id"), exc,
            )
            return None

    import concurrent.futures
    items_to_generate = scored_articles[:MAX_POSTS_PER_RUN]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(_gen_post, article) for article in items_to_generate]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                posts.append(res)

    return posts


# ---------------------------------------------------------------------------
# Environment validation
# ---------------------------------------------------------------------------

def _validate_env() -> bool:
    """
    Checks that required environment variables are present.

    Returns:
        True if all required vars are set, False otherwise.
    """
    missing = []
    if not os.environ.get("GEMINI_API_KEY"):
        missing.append("GEMINI_API_KEY")
    if missing:
        log.critical(
            "Missing required environment variables: %s",
            ", ".join(missing),
        )
        return False
    if DRY_RUN:
        log.info("DRY_RUN=1 – posts will be printed to stdout, not POSTed to Cloudflare.")
    elif not CF_WORKER_URL:
        log.warning(
            "CF_WORKER_URL not set – posts will be generated but NOT queued."
        )
    return True


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> int:
    """
    Parses CLI arguments, runs the appropriate module pipeline, sends
    generated posts to Cloudflare, and returns an exit code.

    Returns:
        0 on success, 1 on failure, 2 on config error.
    """
    parser = argparse.ArgumentParser(
        description="LinkedIn automation system for MyTaxBot (Alberto López).",
    )
    parser.add_argument(
        "--module",
        choices=["boe", "news"],
        required=True,
        help="Which scraping module to run: 'boe' for BOE/normativa, 'news' for press/actualidad.",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="(BOE only) Date to scrape in YYYYMMDD format. Defaults to today.",
    )
    parser.add_argument(
        "--query",
        default=None,
        help="(News only) Search query/keywords to search news for.",
    )
    args = parser.parse_args()

    # Override date from env var if CLI arg not given
    date = args.date or os.environ.get("BOE_DATE")

    log.info(
        "="*60 + "\n"
        "  LinkedIn Automation — MyTaxBot\n"
        "  Module: %s | Date: %s | Query: %s | DryRun: %s\n"
        "  %s\n" + "="*60,
        args.module.upper(),
        date or "today",
        args.query or "none",
        DRY_RUN,
        datetime.now(timezone.utc).isoformat(),
    )

    # Validate environment
    if not _validate_env():
        return 2

    # Run the appropriate module
    if args.module == "boe":
        posts = run_boe_module(date=date)
    else:
        posts = run_news_module(query=args.query)

    if not posts:
        log.warning("No posts generated for this run. Exiting normally.")
        return 0

    # Dispatch posts to Cloudflare / stdout
    learning = LearningModel()
    success_count = 0

    for post in posts:
        # Check autopublish eligibility
        post["autopublish"] = learning.should_autopublish(post)

        if DRY_RUN:
            # Print to stdout (visible in GitHub Actions logs)
            print("\n" + "─" * 60)
            print(f"[DRY RUN] Post ID: {post['post_id']}")
            print(f"Type: {post['type']} | Sector: {post['sector']}")
            print(f"Score: {post['ai_score']} | Urgency: {post['ai_urgency']}")
            print(f"Chars: {post['char_count']} | Valid: {post['valid']}")
            print(f"Autopublish: {post['autopublish']}")
            print("─" * 60)
            print(post["content"])
            print("─" * 60)
            success_count += 1
        else:
            ok = _post_to_cloudflare(post)
            if ok:
                success_count += 1

    # Print summary
    summary = learning.get_improvement_summary()
    log.info(
        "\n%s\nRun Summary\n%s\n"
        "  Module       : %s\n"
        "  Posts generated : %d\n"
        "  Posts queued    : %d\n"
        "  Total decisions : %d\n"
        "  Approval rate   : %.1f%%\n"
        "  Est. weeks to autopublish: %s\n%s",
        "="*60, "="*60,
        args.module.upper(),
        len(posts),
        success_count,
        summary["total_decisions"],
        summary["approval_rate"] * 100,
        summary["estimated_weeks_to_autopublish"],
        "="*60,
    )

    # Return success if posts were generated (even if worker URL missing)
    return 0 if (success_count > 0 or (len(posts) > 0 and not CF_WORKER_URL and not DRY_RUN)) else 1


if __name__ == "__main__":
    sys.exit(main())
