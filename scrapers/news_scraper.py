"""
scrapers/news_scraper.py
------------------------
RSS news scraper for press and official agency feeds.

Fetches articles from NEWS_RSS + OFFICIAL_SOURCES, deduplicates, checks
credibility, and applies Liberfy keyword pre-filtering.

Main entry point: run() → list[dict]
"""

from __future__ import annotations

import hashlib
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Optional
from difflib import SequenceMatcher

import feedparser
import requests

from config.sectors import text_matches_any_keyword, get_sector_from_text
from config.sources import (
    NEWS_RSS,
    OFFICIAL_SOURCES,
    OFFICIAL_SOURCE_KEYS,
    REQUEST_TIMEOUT,
    REQUEST_MAX_RETRIES,
    REQUEST_RETRY_BACKOFF,
    HEADERS,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [NEWS] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("news_scraper")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEDUPE_SIMILARITY_THRESHOLD = 0.85   # Jaccard-like title similarity
MIN_SOURCES_FOR_CREDIBILITY = 2       # Articles not from official sources need ≥2 sources


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _fetch_feed_raw(url: str) -> Optional[feedparser.FeedParserDict]:
    """
    Fetches and parses an RSS/Atom feed via feedparser with retry logic.

    Args:
        url: RSS feed URL.

    Returns:
        feedparser.FeedParserDict on success, None on failure.
    """
    delay = REQUEST_RETRY_BACKOFF
    for attempt in range(1, REQUEST_MAX_RETRIES + 1):
        try:
            # feedparser can parse from a URL directly, but we use requests
            # first to benefit from our retry logic and custom headers.
            resp = requests.get(
                url,
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            if resp.status_code == 200:
                feed = feedparser.parse(resp.content)
                return feed
            log.warning(
                "HTTP %s fetching feed %s (attempt %d/%d)",
                resp.status_code, url, attempt, REQUEST_MAX_RETRIES,
            )
        except requests.exceptions.RequestException as exc:
            log.warning(
                "Request error fetching %s (attempt %d/%d): %s",
                url, attempt, REQUEST_MAX_RETRIES, exc,
            )
        if attempt < REQUEST_MAX_RETRIES:
            log.info("Retrying in %.1fs…", delay)
            time.sleep(delay)
            delay *= 2

    log.error("All retries exhausted for feed: %s", url)
    return None


# ---------------------------------------------------------------------------
# Core scraper functions
# ---------------------------------------------------------------------------

def fetch_rss_feed(url: str, source_name: str) -> list[dict]:
    """
    Fetches and parses a single RSS/Atom feed.

    Args:
        url:         Feed URL.
        source_name: Human-readable source name (e.g. 'expansion').

    Returns:
        List of article dicts, each with keys:
            id, title, summary, url, published, source, is_official
    """
    log.info("Fetching feed: %s → %s", source_name, url)
    feed = _fetch_feed_raw(url)
    if feed is None:
        return []

    articles: list[dict] = []
    is_official = source_name in OFFICIAL_SOURCE_KEYS

    for entry in feed.entries:
        title = getattr(entry, "title", "").strip()
        if not title:
            continue  # skip items without a title

        # Extract summary / description
        summary = ""
        if hasattr(entry, "summary"):
            summary = entry.summary
        elif hasattr(entry, "description"):
            summary = entry.description
        # Strip HTML tags from summary
        from bs4 import BeautifulSoup
        summary = BeautifulSoup(summary, "lxml").get_text(separator=" ", strip=True)
        summary = summary[:500]  # cap at 500 chars

        # Extract URL
        article_url = getattr(entry, "link", "")

        # Extract publication date
        published = ""
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                published = dt.isoformat()
            except Exception:
                published = getattr(entry, "published", "")
        else:
            published = getattr(entry, "published", "")

        # Generate stable ID from URL hash
        article_id = hashlib.md5(article_url.encode()).hexdigest()[:12]

        # Keyword-based sector detection
        combined = f"{title} {summary}"
        sector = get_sector_from_text(combined)

        articles.append(
            {
                "id": article_id,
                "title": title,
                "summary": summary,
                "url": article_url,
                "published": published,
                "source": source_name,
                "is_official": is_official,
                "sector": sector,
            }
        )

    log.info("  → %d articles from %s", len(articles), source_name)
    return articles


def fetch_all_sources() -> list[dict]:
    """
    Fetches articles from ALL configured NEWS_RSS and OFFICIAL_SOURCES feeds.

    Returns:
        Combined flat list of article dicts from every feed.
    """
    all_articles: list[dict] = []

    # News RSS feeds
    for source_name, url in NEWS_RSS.items():
        articles = fetch_rss_feed(url, source_name)
        all_articles.extend(articles)
        time.sleep(0.5)  # polite delay between requests

    # Official agency feeds
    for source_name, url in OFFICIAL_SOURCES.items():
        articles = fetch_rss_feed(url, source_name)
        all_articles.extend(articles)
        time.sleep(0.5)

    log.info("Total articles fetched before dedup: %d", len(all_articles))
    return all_articles


def _title_similarity(title_a: str, title_b: str) -> float:
    """
    Computes similarity ratio between two titles using SequenceMatcher.
    Returns a value between 0.0 (no similarity) and 1.0 (identical).
    """
    return SequenceMatcher(
        None,
        title_a.lower().strip(),
        title_b.lower().strip(),
    ).ratio()


def deduplicate(articles: list[dict]) -> list[dict]:
    """
    Removes duplicate articles based on fuzzy title similarity (>85%).

    When two articles are considered duplicates, the one from the official
    source is kept; if both/neither are official, the earlier one is kept.

    Also tracks which source names covered each surviving story (used later
    for multi-source credibility check).

    Args:
        articles: Raw combined article list.

    Returns:
        Deduplicated list. Each article gains a 'sources_covering' set field.
    """
    unique: list[dict] = []

    for article in articles:
        merged = False
        for existing in unique:
            sim = _title_similarity(article["title"], existing["title"])
            if sim >= DEDUPE_SIMILARITY_THRESHOLD:
                # Merge: track covering sources
                existing.setdefault("sources_covering", {existing["source"]})
                existing["sources_covering"].add(article["source"])
                # Prefer the official source version
                if article["is_official"] and not existing["is_official"]:
                    # Replace the stored entry with the official version but keep sources_covering
                    sources_covering = existing["sources_covering"]
                    existing.update(article)
                    existing["sources_covering"] = sources_covering
                merged = True
                break

        if not merged:
            article_copy = dict(article)
            article_copy["sources_covering"] = {article["source"]}
            unique.append(article_copy)

    log.info(
        "Deduplication: %d → %d articles (removed %d duplicates)",
        len(articles),
        len(unique),
        len(articles) - len(unique),
    )
    return unique


def check_credibility(articles: list[dict]) -> list[dict]:
    """
    Keeps only credible articles:
    - Official source articles always pass.
    - Non-official articles must be covered by ≥2 different sources.

    Args:
        articles: Deduplicated article list (must have 'sources_covering' field).

    Returns:
        Filtered list of credible articles.
    """
    credible: list[dict] = []
    for article in articles:
        sources_covering = article.get("sources_covering", {article["source"]})
        if article["is_official"] or len(sources_covering) >= MIN_SOURCES_FOR_CREDIBILITY:
            credible.append(article)
        else:
            log.debug(
                "Dropped (single-source, non-official): %s [%s]",
                article["title"][:60],
                article["source"],
            )

    log.info(
        "Credibility filter: %d/%d articles passed",
        len(credible),
        len(articles),
    )
    return credible


def keyword_prefilter(articles: list[dict]) -> list[dict]:
    """
    Keeps only articles that contain at least one LIBERFY_FOCUS_KEYWORDS term
    in their title or summary.

    Args:
        articles: Credibility-checked article list.

    Returns:
        Filtered list relevant to Liberfy's niche.
    """
    filtered: list[dict] = []
    for article in articles:
        combined = f"{article.get('title', '')} {article.get('summary', '')}"
        if text_matches_any_keyword(combined):
            filtered.append(article)

    log.info(
        "Keyword pre-filter: %d/%d articles passed",
        len(filtered),
        len(articles),
    )
    return filtered


def run() -> list[dict]:
    """
    Main entry point for the news scraper.

    Pipeline:
        1. Fetch all RSS feeds.
        2. Deduplicate fuzzy-similar stories.
        3. Credibility check (official OR ≥2 sources).
        4. Keyword pre-filter (Liberfy focus keywords).
        5. Return final list ready for AI relevance scoring.

    Returns:
        List of article dicts ready for ai/relevance_scorer.py.
    """
    log.info("=== News Scraper started ===")

    # Step 1 – fetch all feeds
    all_articles = fetch_all_sources()
    if not all_articles:
        log.warning("No articles retrieved from any feed.")
        return []

    # Step 2 – deduplicate
    unique_articles = deduplicate(all_articles)

    # Step 3 – credibility check
    credible_articles = check_credibility(unique_articles)

    # Step 4 – keyword pre-filter
    relevant_articles = keyword_prefilter(credible_articles)

    # Convert sources_covering set to list for JSON serialisation
    for article in relevant_articles:
        article["sources_covering"] = list(article.get("sources_covering", []))

    log.info("=== News Scraper finished: %d relevant articles ===", len(relevant_articles))
    return relevant_articles


# ---------------------------------------------------------------------------
# CLI quick-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json as _json
    results = run()
    print(_json.dumps(results, ensure_ascii=False, indent=2))
