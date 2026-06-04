"""
scrapers/news_scraper.py
------------------------
RSS news scraper for press and official agency feeds.

Fetches articles from NEWS_RSS + OFFICIAL_SOURCES, deduplicates, checks
credibility, and applies MyTaxBot keyword pre-filtering.

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
from utils.text_cleaner import clean_news_text

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
def normalize_title(title: str, article_url: str) -> str:
    """
    Normalizes a title to generate a stable, readable slug for duplicate checking.
    """
    import unicodedata
    # 1. Lowercase
    t = title.lower()
    # 2. Remove accents and diacritics
    t = "".join(
        c for c in unicodedata.normalize("NFD", t)
        if unicodedata.category(c) != "Mn"
    )
    # 3. Replace non-alphanumeric characters with spaces
    t = "".join(c if c.isalnum() else " " for c in t)
    # 4. Remove common Spanish stopwords
    stopwords = {
        "el", "la", "los", "las", "un", "una", "unos", "unas",
        "de", "del", "en", "para", "por", "con", "sin", "sobre",
        "y", "o", "u", "a", "al", "que", "se", "su", "sus", "como"
    }
    words = [w for w in t.split() if w not in stopwords]
    # 5. Join words with hyphens
    slug = "-".join(words)
    # 6. Fallback to URL hash if slug is empty
    if not slug:
        slug = hashlib.md5(article_url.encode()).hexdigest()[:12]
    return slug[:100]


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

        # Generate stable ID from normalized title slug
        article_id = normalize_title(title, article_url)

        # Filter out articles older than 24 hours to save API processing time
        from datetime import timedelta
        if published:
            try:
                # published is ISO format e.g. '2026-05-28T10:00:00+00:00'
                pub_dt = datetime.fromisoformat(published.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                if now - pub_dt > timedelta(hours=24):
                    continue
            except Exception:
                pass

        # Keyword-based sector detection
        combined = f"{title} {summary}"
        sector = get_sector_from_text(combined)

        # To prevent hitting the 1500 requests/day Gemini Free API limit,
        # aggressively discard news that don't trigger any sector keywords
        # unless they come from an official/specialized source.
        if sector == "general" and not is_official and source_name not in ["supercontable", "infoautonomos", "pymes_y_autonomos", "iberley", "cef", "expansion", "cinco_dias", "eleconomista_autonomos"]:
            continue

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

    log.info("  → %d articles from %s (recent and relevant only)", len(articles), source_name)
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
    Skipped check_credibility to allow general news to pass.
    """
    return articles


import re

FISCAL_KEYWORDS = [
    "Autónomo", "Autónomos", "Pyme", "Pymes", "Sociedades", "SL", "SA", "IVA", "IRPF", 
    "Impuesto", "Tasa", "Arbitrio", "Contribución", "Hacienda", "AEAT", "Sanción", 
    "Multa", "Inspección", "Recargo", "Deducción", "Bonificación", "Exención", "Tributo", 
    "Tributario", "Tributaria", "Fiscal", "Fiscalidad", "Contable", "Contabilidad", 
    "Factura", "Facturación", "Crea y Crece", "BOE", "Subvención", "Cotización", "RETA", 
    "Seguridad Social", "Base Imponible", "Retención", "Modelos", "Modelo 100", 
    "Modelo 300", "Modelo 111", "Modelo 115", "Modelo 303", "Modelo 347", "Modelo 390", 
    "Modelo 200", "Amortización", "Gasto Deducible", "Patrimonio", "Sucesiones", 
    "Donaciones", "Plusvalía", "IBI", "IAE", "ITP", "AJD", "Catastro", "Renta", 
    "Declaración", "Campaña de la Renta", "Ganancia Patrimonial", "Pérdida Patrimonial", 
    "Criptomonedas", "Criptoactivos", "Dividendos", "Acciones", "Rendimiento del Capital", 
    "Rendimiento del Trabajo", "Módulos", "Estimación Directa", "Estimación Objetiva", 
    "Cese de Actividad", "Inspección Fiscal", "Plan de Control Fiscal", 
    "Jurisprudencia Fiscal", "Supremo Fiscal", "TEAC", "Derivación de Responsabilidad", 
    "Sociedad Patrimonial", "Transparencia Fiscal", "Optimización Fiscal"
]
# Compile the regex pattern for fast case-insensitive search
FISCAL_PATTERN = re.compile(r'\b(' + '|'.join(re.escape(kw) for kw in FISCAL_KEYWORDS) + r')\b', re.IGNORECASE)

def keyword_prefilter(articles: list[dict]) -> list[dict]:
    """
    Applies a strict local heuristic regex filter using the extended fiscal dictionary.
    Articles that do not match at least one keyword are discarded to save API costs.
    The remaining articles are then sent to the AI batch pre-filter.
    """
    log.info("Applying local heuristic filter to %d articles...", len(articles))
    heuristic_filtered = []
    
    for article in articles:
        # Check against both title and summary
        text_to_check = f"{article['title']} {article['summary']}"
        if FISCAL_PATTERN.search(text_to_check):
            heuristic_filtered.append(article)
        elif article["is_official"]:
            # Always pass official sources (BOE)
            heuristic_filtered.append(article)
            
    log.info("Local heuristic filter passed %d/%d articles", len(heuristic_filtered), len(articles))

    if not heuristic_filtered:
        return []

    from ai.relevance_scorer import batch_prefilter
    log.info("Sending %d articles to AI Batch pre-filter...", len(heuristic_filtered))
    filtered = batch_prefilter(heuristic_filtered)
    
    log.info(
        "Final AI pre-filter: %d/%d articles passed",
        len(filtered),
        len(heuristic_filtered),
    )
    return filtered


def get_article_text(url: str, max_chars: int = 10000) -> str:
    """
    Fetches the HTML of the news article page and extracts clean text content.
    """
    try:
        from bs4 import BeautifulSoup
        import re
        resp = requests.get(
            url,
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.content, "lxml")
            
            # Remove scripts, styles, header, footer, nav, aside elements
            for element in soup(["script", "style", "nav", "header", "footer", "aside"]):
                element.decompose()
                
            # Extract paragraphs
            paragraphs = soup.find_all("p")
            text = " ".join([p.get_text(strip=True) for p in paragraphs])
            
            # Clean up extra spacing
            text = re.sub(r'\s+', ' ', text).strip()
            
            if len(text) > 150:
                return text[:max_chars]
    except Exception as exc:
        log.warning("Error fetching full article text for %s: %s", url, exc)
    return ""


def run(query: Optional[str] = None) -> list[dict]:
    """
    Main entry point for the news scraper.

    Pipeline:
        1. Fetch all RSS feeds, or query Google News if a query string is provided.
        2. Deduplicate fuzzy-similar stories.
        3. Credibility check (official OR ≥2 sources) - bypassed if query is set.
        4. Keyword pre-filter (MyTaxBot focus keywords) - bypassed if query is set.
        5. Fetch full article body text (enrichment).
        6. Return final list ready for AI relevance scoring.

    Returns:
        List of article dicts ready for ai/relevance_scorer.py.
    """
    if query:
        log.info("=== News Search started for query: %s ===", query)
        import urllib.parse
        encoded_query = urllib.parse.quote(query)
        search_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=es&gl=ES&ceid=ES:es"
        all_articles = fetch_rss_feed(search_url, "Google News Search")
        if not all_articles:
            log.warning("No articles retrieved for query: %s", query)
            return []
        
        # Step 2 – deduplicate
        relevant_articles = deduplicate(all_articles)
        # Note: we bypass credibility filter and keyword pre-filter for user-initiated search queries
    else:
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

    # Step 5 – enrich with full article text (only for relevant ones to save time/resources)
    log.info("Enriching %d relevant articles with full text...", len(relevant_articles))
    enriched_articles = []
    for article in relevant_articles:
        url = article["url"]
        log.info("Scraping full text for: %s", url)
        texto = get_article_text(url)
        
        # We need substantial text to generate a 2500-char high-quality post.
        # Fallback to summary usually results in < 400 chars, which causes generic AI outputs.
        final_text = texto if texto else article.get("summary", "")
        
        if len(final_text) >= 600:
            article["texto"] = final_text
            article["short_text"] = final_text[:1000]
            log.info("  → Successfully kept article with %d characters of text", len(final_text))
            enriched_articles.append(article)
        else:
            log.warning("  → Discarding article %s: text too short (%d chars). Not enough info for a deep post.", url, len(final_text))

    # Convert sources_covering set to list for JSON serialisation
    for article in enriched_articles:
        article["sources_covering"] = list(article.get("sources_covering", []))

    log.info("=== News Scraper finished: %d relevant articles ===", len(enriched_articles))
    return enriched_articles


# ---------------------------------------------------------------------------
# CLI quick-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json as _json
    results = run()
    print(_json.dumps(results, ensure_ascii=False, indent=2))
