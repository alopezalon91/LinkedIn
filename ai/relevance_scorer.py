"""
ai/relevance_scorer.py
----------------------
Gemini Flash relevance scoring for BOE entries and news articles.

Uses RELEVANCE_PROMPT to get structured JSON from the model and returns
only items with should_post=True, sorted by score descending.

Main entry points:
    score_boe_entry(entry_dict)  → dict
    score_news_article(article_dict) → dict
    score_batch(items, item_type) → list[dict]
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import sqlite3
from typing import Any, Literal

import google.generativeai as genai

from config.prompts import RELEVANCE_PROMPT, SYSTEM_CONTEXT

# ---------------------------------------------------------------------------
# Logging & SQLite Cache Setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCORER] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("relevance_scorer")

CACHE_DB = os.path.join(os.path.dirname(__file__), "..", "cache.db")

def _init_db():
    with sqlite3.connect(CACHE_DB) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS score_cache (
                item_id TEXT PRIMARY KEY,
                score_data TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
_init_db()

def _get_cached_score(item_id: str) -> dict | None:
    with sqlite3.connect(CACHE_DB) as conn:
        cur = conn.execute("SELECT score_data FROM score_cache WHERE item_id = ?", (item_id,))
        row = cur.fetchone()
        if row:
            return json.loads(row[0])
    return None

def _set_cached_score(item_id: str, data: dict):
    with sqlite3.connect(CACHE_DB) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO score_cache (item_id, score_data) VALUES (?, ?)",
            (item_id, json.dumps(data))
        )

# ---------------------------------------------------------------------------
# Gemini client initialisation
# ---------------------------------------------------------------------------
# AI parameters
_MODEL_NAME = "gemini-2.0-flash"
_model: genai.GenerativeModel | None = None

def _get_model() -> genai.GenerativeModel:
    """
    Lazily initialises and returns the Gemini GenerativeModel singleton.
    Reads GEMINI_API_KEY from environment.
    """
    global _model
    if _model is None:
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY environment variable is not set."
            )
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            model_name=_MODEL_NAME,
            system_instruction=SYSTEM_CONTEXT,
        )
        log.info("Gemini model '%s' initialised.", _MODEL_NAME)
    return _model


# ---------------------------------------------------------------------------
# In-process cache (avoids re-scoring the same BOE ID within one run)
# ---------------------------------------------------------------------------

_score_cache: dict[str, dict] = {}


def batch_prefilter(articles: list[dict], batch_size: int = 50) -> list[dict]:
    """
    Takes a list of raw articles and uses Gemini Flash to quickly identify which ones
    might be relevant to business, economy, taxes, or politics that affect business.
    Returns the filtered list of articles.
    """
    model = _get_model()
    relevant_ids = set()
    
    for i in range(0, len(articles), batch_size):
        batch = articles[i:i+batch_size]
        prompt = (
            "Eres un filtro rápido. A continuación tienes una lista de titulares de noticias con un ID.\n"
            "Devuelve ÚNICAMENTE un array JSON con los IDs de las noticias que estén relacionadas con economía, "
            "política (que pueda afectar a leyes o impuestos), empresas, autónomos, tecnología o deducciones. "
            "Ante la duda, INCLUYE el ID.\n\n"
        )
        for article in batch:
            prompt += f"- ID: {article['id']} | Titular: {article['title']}\n"
            
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            if isinstance(data, list):
                for item in data:
                    relevant_ids.add(str(item))
        except Exception as e:
            log.error("Batch prefilter error: %s", e)
            # If error, fail open (keep all) to avoid losing news
            for article in batch:
                relevant_ids.add(str(article['id']))
                
        time.sleep(1) # Prevent rate limits
        
    return [a for a in articles if str(a['id']) in relevant_ids]

# ---------------------------------------------------------------------------
# Individual Scoring (Gemini)
# ---------------------------------------------------------------------------

def _call_gemini_score(item_id: str, tipo: str, titulo: str, texto: str) -> dict:
    """
    Calls Gemini Flash with RELEVANCE_PROMPT and parses the JSON response.
    """
    # Cache hit
    cached = _get_cached_score(item_id)
    if cached:
        log.debug("Cache hit for %s", item_id)
        return cached

    rejection_instructions = ""
    try:
        from ai.learning_model import LearningModel
        learning = LearningModel()
        rejections = learning.get_recent_rejection_reasons(limit=5)
        edits = learning.get_recent_edit_reasons(limit=5)
        if rejections or edits:
            rejection_instructions = "\n=== APRENDIZAJE DE DECISIONES DEL USUARIO ===\n"
            if rejections:
                rejection_instructions += "El usuario ha RECHAZADO recientemente los siguientes posts. Evita puntuar alto contenidos similares:\n"
                for r in rejections:
                    snippet = r['content'][:150].replace('\n', ' ')
                    rejection_instructions += f"- Post rechazado: \"{snippet}...\"\n"
                    rejection_instructions += f"  Motivo del rechazo: {r['reason']}\n\n"
            if edits:
                rejection_instructions += "El usuario ha EDITADO recientemente los siguientes posts por los siguientes motivos:\n"
                for e in edits:
                    snippet = e['content'][:150].replace('\n', ' ')
                    rejection_instructions += f"- Post original: \"{snippet}...\"\n"
                    rejection_instructions += f"  Corrección y motivo: {e['reason']}\n\n"
    except Exception as e:
        log.warning("Could not append user preferences to relevance scorer: %s", e)

    prompt = RELEVANCE_PROMPT.format(
        tipo=tipo,
        titulo=titulo,
        texto=texto[:1000],  # limit to 1 000 chars to save tokens
    )
    if rejection_instructions:
        prompt += "\n" + rejection_instructions


    default_result = {
        "score": 0,
        "sector": "general",
        "should_post": False,
        "reason": "Error al procesar con IA.",
        "urgency": "baja",
    }

    try:
        model = _get_model()
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Strip markdown fences if the model added them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        result = json.loads(raw)

        # Validate required fields
        required = {"score", "sector", "should_post", "reason", "urgency"}
        if not required.issubset(result.keys()):
            log.warning(
                "Gemini response missing fields for %s. Got: %s",
                item_id, list(result.keys()),
            )
            return default_result

        # Coerce types
        result["score"] = int(result["score"])
        result["should_post"] = bool(result["should_post"])
        result["urgency"] = result["urgency"].lower()

        # Enforce should_post logic (score >= 6)
        result["should_post"] = result["score"] >= 6

        _set_cached_score(item_id, result)
        log.info(
            "Scored %s → score=%d sector=%s urgency=%s should_post=%s",
            item_id, result["score"], result["sector"],
            result["urgency"], result["should_post"],
        )
        return result

    except json.JSONDecodeError as exc:
        log.error("JSON parse error for %s: %s | raw: %r", item_id, exc, raw[:200])
        return default_result
    except Exception as exc:
        log.error("Gemini API error for %s: %s", item_id, exc)
        return default_result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def score_boe_entry(entry: dict) -> dict:
    """
    Scores a single BOE entry for relevance to the audience.

    Args:
        entry: Dict with at least 'id', 'titulo', and optionally 'texto'.

    Returns:
        Score dict: {score, sector, should_post, reason, urgency}.
        The input entry is NOT mutated.
    """
    item_id = entry.get("id", "unknown")
    titulo = entry.get("titulo", "")
    texto = entry.get("texto", "")

    return _call_gemini_score(
        item_id=item_id,
        tipo="norma_boe",
        titulo=titulo,
        texto=texto,
    )


def score_news_article(article: dict) -> dict:
    """
    Scores a single news article for relevance to the audience.

    Args:
        article: Dict with at least 'id', 'title', and optionally 'summary'.

    Returns:
        Score dict: {score, sector, should_post, reason, urgency}.
    """
    item_id = article.get("id", "unknown")
    titulo = article.get("title", "")
    texto = article.get("texto") or article.get("summary", "")

    return _call_gemini_score(
        item_id=item_id,
        tipo="noticia_prensa",
        titulo=titulo,
        texto=texto,
    )


def score_batch(
    items: list[dict],
    item_type: Literal["boe", "news"],
    rate_limit_sleep: float = 0.5,
    force_keep_all: bool = False,
) -> list[dict]:
    """
    Scores a batch of items in parallel using ThreadPoolExecutor.
    """
    if not items:
        return []

    score_fn = score_boe_entry if item_type == "boe" else score_news_article
    scored: list[dict] = []

    def _process_item(item):
        score_data = score_fn(item)
        if score_data["should_post"] or force_keep_all:
            enriched = dict(item)
            enriched["_score_data"] = score_data
            enriched["ai_score"] = score_data["score"]
            enriched["ai_sector"] = score_data["sector"]
            enriched["ai_urgency"] = score_data["urgency"]
            enriched["ai_reason"] = score_data["reason"]
            return enriched
        return None

    import concurrent.futures
    log.info("Scoring %d items with concurrency...", len(items))
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(_process_item, item): item for item in items}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                scored.append(res)
            # Sleep slightly to avoid spamming the free API too fast
            time.sleep(rate_limit_sleep)

    # Sort by score descending (highest relevance first)
    scored.sort(key=lambda x: x["ai_score"], reverse=True)

    log.info(
        "Batch scoring complete: %d/%d items passed",
        len(scored), len(items),
    )
    return scored
