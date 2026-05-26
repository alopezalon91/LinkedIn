"""
scrapers/boe_scraper.py
-----------------------
Scraper for Spain's BOE (Boletín Oficial del Estado) Open Data API.

Official API docs: https://www.boe.es/datosabiertos/api/
The API returns JSON responses. No API key required.

Main entry point: run(date=None) → list[dict]
"""

from __future__ import annotations

import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

from config.sectors import text_matches_any_keyword, MYTAXBOT_FOCUS_KEYWORDS, get_sector_from_text
from config.sources import (
    BOE_SUMARIO_URL,
    BOE_DOCUMENTO_URL,
    BOE_RELEVANT_SECTIONS,
    BOE_SECTION_PRIORITY,
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
    format="%(asctime)s [BOE] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("boe_scraper")


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get_with_retry(url: str, params: dict | None = None) -> Optional[requests.Response]:
    """
    Performs a GET request with exponential-backoff retries.

    Args:
        url:    Target URL.
        params: Optional query parameters dict.

    Returns:
        requests.Response on success, None on all retries exhausted.
    """
    delay = REQUEST_RETRY_BACKOFF
    for attempt in range(1, REQUEST_MAX_RETRIES + 1):
        try:
            resp = requests.get(
                url,
                params=params,
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code == 200:
                return resp
            log.warning(
                "HTTP %s from %s (attempt %d/%d)",
                resp.status_code, url, attempt, REQUEST_MAX_RETRIES,
            )
        except requests.exceptions.RequestException as exc:
            log.warning(
                "Request error on %s (attempt %d/%d): %s",
                url, attempt, REQUEST_MAX_RETRIES, exc,
            )
        if attempt < REQUEST_MAX_RETRIES:
            log.info("Retrying in %.1fs…", delay)
            time.sleep(delay)
            delay *= 2
    log.error("All %d attempts failed for %s", REQUEST_MAX_RETRIES, url)
    return None


# ---------------------------------------------------------------------------
# Core scraper functions
# ---------------------------------------------------------------------------

def get_today_sumario(date: Optional[str] = None) -> list[dict]:
    """
    Fetches the daily BOE summary for a given date.

    Args:
        date: Date string in YYYYMMDD format. Defaults to today (UTC).

    Returns:
        List of raw BOE entry dicts as parsed from the API sumario response.
        Returns empty list on error.
    """
    if date is None:
        date = datetime.now(timezone.utc).strftime("%Y%m%d")

    url = BOE_SUMARIO_URL.format(date=date)
    log.info("Fetching BOE sumario for date=%s → %s", date, url)

    resp = _get_with_retry(url)
    if resp is None:
        log.error("Could not fetch BOE sumario for %s", date)
        return []

    try:
        data = resp.json()
    except json.JSONDecodeError as exc:
        log.error("Invalid JSON in BOE sumario response: %s", exc)
        return []

    entries = parse_sumario(data)
    log.info("BOE sumario %s: %d entries parsed", date, len(entries))
    return entries


def parse_sumario(data: dict) -> list[dict]:
    """
    Extracts relevant items from the raw BOE sumario JSON.

    The BOE API returns a nested structure under data['sumario']['diario'].
    We navigate sections I, II, III and extract each 'item' node.

    Args:
        data: Parsed JSON dict from the BOE sumario API endpoint.

    Returns:
        List of entry dicts with keys:
            id, titulo, url_pdf, url_html, seccion, rango,
            departamento, fecha
    """
    entries: list[dict] = []

    try:
        # API structure: data → sumario → diario → secciones → departamentos → items
        sumario = data.get("data", {}).get("sumario", {})
        fecha_pub = sumario.get("metadatos", {}).get("fecha_publicacion", "")
        diario_sections = (
            sumario.get("diario", {})
            .get("sumario_napi", {})
            .get("seccion", [])
        )

        # Normalise to list if the API returned a single dict
        if isinstance(diario_sections, dict):
            diario_sections = [diario_sections]

    except (AttributeError, TypeError) as exc:
        log.error("Unexpected BOE sumario structure: %s", exc)
        return []

    for section in diario_sections:
        sec_id = section.get("@id", "")          # e.g. "1", "2", "3"
        sec_num = section.get("@num", sec_id)    # Roman numeral label

        # Only process sections we care about
        if sec_num not in BOE_RELEVANT_SECTIONS and sec_id not in BOE_RELEVANT_SECTIONS:
            continue

        # Departments are nested inside each section
        departamentos = section.get("departamento", [])
        if isinstance(departamentos, dict):
            departamentos = [departamentos]

        for dept in departamentos:
            dept_nombre = dept.get("@nombre", "Desconocido")
            items = dept.get("item", [])
            if isinstance(items, dict):
                items = [items]

            for item in items:
                boe_id = item.get("@id", "")
                titulo = item.get("titulo", "Sin título")
                rango = item.get("rango", "Otro")
                url_pdf = item.get("urlPdf", {}).get("#text", "") if isinstance(item.get("urlPdf"), dict) else item.get("urlPdf", "")
                url_html = item.get("urlHtml", "")
                url_xml = item.get("urlXml", "")

                if not boe_id:
                    continue

                entry = {
                    "id": boe_id,
                    "titulo": titulo,
                    "url_pdf": f"https://www.boe.es{url_pdf}" if url_pdf.startswith("/") else url_pdf,
                    "url_html": f"https://www.boe.es{url_html}" if url_html.startswith("/") else url_html,
                    "url_xml": f"https://www.boe.es{url_xml}" if url_xml.startswith("/") else url_xml,
                    "seccion": sec_num,
                    "rango": rango,
                    "departamento": dept_nombre,
                    "fecha": fecha_pub,
                    # Priority for sorting (lower = more important)
                    "_priority": BOE_SECTION_PRIORITY.get(rango, 8),
                }
                entries.append(entry)

    # Sort by document priority (Leyes first, Resoluciones last)
    entries.sort(key=lambda e: e["_priority"])
    return entries


def get_document_text(boe_id: str, max_chars: int = 2000) -> str:
    """
    Fetches the text content of a specific BOE document for AI context.

    Tries the JSON document API first; falls back to the HTML version.

    Args:
        boe_id:    BOE document identifier (e.g. 'BOE-A-2024-12345').
        max_chars: Maximum characters to return (default 2 000 for AI context).

    Returns:
        Extracted text string. Empty string on failure.
    """
    # Try JSON API endpoint first
    api_url = BOE_DOCUMENTO_URL.format(id=boe_id)
    resp = _get_with_retry(api_url)

    if resp is not None:
        try:
            doc_data = resp.json()
            # Navigate to the text field in the API response
            texto = (
                doc_data.get("data", {})
                .get("documento", {})
                .get("texto", "")
            )
            if texto:
                # Strip HTML tags if present
                soup = BeautifulSoup(texto, "lxml")
                plain = soup.get_text(separator=" ", strip=True)
                return plain[:max_chars]
        except (json.JSONDecodeError, AttributeError):
            pass

    # Fallback: fetch HTML version directly from boe.es
    html_url = f"https://www.boe.es/diario_boe/txt.php?id={boe_id}"
    resp_html = _get_with_retry(html_url)
    if resp_html is not None:
        try:
            soup = BeautifulSoup(resp_html.text, "lxml")
            # The article text lives inside <div class="texto_legal">
            container = soup.find("div", class_="texto_legal") or soup.find("article")
            if container:
                plain = container.get_text(separator=" ", strip=True)
                return plain[:max_chars]
        except Exception as exc:
            log.warning("HTML fallback parse error for %s: %s", boe_id, exc)

    log.warning("Could not retrieve text for BOE document %s", boe_id)
    return ""


def filter_by_keywords(entries: list[dict], keywords: list[str] | None = None) -> list[dict]:
    """
    Quick keyword pre-filter. Returns only entries whose title contains at
    least one of the given keywords (case-insensitive).

    Uses MYTAXBOT_FOCUS_KEYWORDS by default so we don't send irrelevant
    documents to the AI relevance scorer.

    Args:
        entries:  List of parsed BOE entry dicts.
        keywords: Optional override keyword list. Defaults to MYTAXBOT_FOCUS_KEYWORDS.

    Returns:
        Filtered list of entries.
    """
    if keywords is None:
        keywords = MYTAXBOT_FOCUS_KEYWORDS

    filtered: list[dict] = []
    for entry in entries:
        searchable = f"{entry.get('titulo', '')} {entry.get('departamento', '')}".lower()
        if any(kw in searchable for kw in keywords):
            filtered.append(entry)

    log.info(
        "Keyword filter: %d/%d entries passed",
        len(filtered), len(entries),
    )
    return filtered


def run(date: Optional[str] = None) -> list[dict]:
    """
    Main entry point for the BOE scraper.

    Pipeline:
        1. Fetch today's (or a given date's) BOE summary.
        2. Pre-filter by MyTaxBot focus keywords.
        3. Enrich each surviving entry with its full document text.
        4. Add a detected sector tag.
        5. Return the enriched, filtered list.

    Args:
        date: Optional YYYYMMDD date string. Defaults to today.

    Returns:
        List of enriched BOE entry dicts ready for AI scoring.
        Each dict contains all fields from parse_sumario PLUS:
            texto     - first 2 000 chars of the document body
            sector    - keyword-detected sector (pre-AI classification)
    """
    log.info("=== BOE Scraper started ===")

    # Step 1 – fetch sumario
    all_entries = get_today_sumario(date)
    if not all_entries:
        log.warning("No BOE entries retrieved. Exiting.")
        return []

    # Step 2 – keyword pre-filter (cheap, no API cost)
    relevant = filter_by_keywords(all_entries)
    if not relevant:
        log.info("No entries matched MyTaxBot keywords for this date.")
        return []

    # Step 3 & 4 – enrich with text and sector
    enriched: list[dict] = []
    for entry in relevant:
        boe_id = entry["id"]
        log.info("Fetching document text for %s…", boe_id)
        texto = get_document_text(boe_id)
        entry["texto"] = texto

        # Keyword-based sector detection (AI will refine this later)
        combined_text = f"{entry['titulo']} {texto}"
        entry["sector"] = get_sector_from_text(combined_text)

        enriched.append(entry)
        time.sleep(0.3)  # be polite to BOE servers

    log.info("=== BOE Scraper finished: %d enriched entries ===", len(enriched))
    return enriched


# ---------------------------------------------------------------------------
# CLI quick-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json as _json
    results = run()
    print(_json.dumps(results, ensure_ascii=False, indent=2))
