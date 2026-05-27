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
from typing import Any, Literal

import google.generativeai as genai

from config.prompts import RELEVANCE_PROMPT, SYSTEM_CONTEXT

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SCORER] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("relevance_scorer")

# ---------------------------------------------------------------------------
# Gemini client initialisation
# ---------------------------------------------------------------------------

_MODEL_NAME = "gemini-2.5-flash"
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


# ---------------------------------------------------------------------------
# Internal scoring function
# ---------------------------------------------------------------------------

def _call_gemini_score(item_id: str, tipo: str, titulo: str, texto: str) -> dict:
    """
    Calls Gemini Flash with RELEVANCE_PROMPT and parses the JSON response.

    Args:
        item_id: Unique identifier for caching (BOE id or article URL hash).
        tipo:    'norma_boe' or 'noticia_prensa'.
        titulo:  Title/headline of the item.
        texto:   First ~1 000 chars of the content body.

    Returns:
        Dict with keys: score, sector, should_post, reason, urgency.
        On failure returns a safe default (score=0, should_post=False).
    """
    # Cache hit
    if item_id in _score_cache:
        log.debug("Cache hit for %s", item_id)
        return _score_cache[item_id]

    rejection_instructions = ""
    try:
        from ai.learning_model import LearningModel
        learning = LearningModel()
        rejections = learning.get_recent_rejection_reasons(limit=5)
        if rejections:
            rejection_instructions = "\n=== RECHAZOS RECIENTES A EVITAR ===\n"
            rejection_instructions += "El usuario ha rechazado recientemente los siguientes posts. Evita cometer los mismos errores o puntuar alto contenidos similares:\n"
            for r in rejections:
                snippet = r['content'][:150].replace('\n', ' ')
                rejection_instructions += f"- Post rechazado: \"{snippet}...\"\n"
                rejection_instructions += f"  Motivo del rechazo: {r['reason']}\n\n"
    except Exception as e:
        log.warning("Could not append rejection instructions to relevance scorer: %s", e)

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

        _score_cache[item_id] = result
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
) -> list[dict]:
    """
    Scores a batch of items (BOE entries or news articles), applies rate
    limiting, and returns only those that should be posted, sorted by
    score descending.

    Args:
        items:             List of BOE entry or news article dicts.
        item_type:         'boe' to use score_boe_entry,
                           'news' to use score_news_article.
        rate_limit_sleep:  Seconds to sleep between API calls (default 0.5s).

    Returns:
        Filtered and sorted list of dicts. Each item gets a '_score_data'
        field containing the full scoring result, plus top-level fields:
        ai_score, ai_sector, ai_urgency, ai_reason merged in.
    """
    if not items:
        return []

    score_fn = score_boe_entry if item_type == "boe" else score_news_article

    scored: list[dict] = []
    for i, item in enumerate(items):
        log.info(
            "Scoring item %d/%d (%s)…",
            i + 1, len(items),
            item.get("id", item.get("title", "?"))[:60],
        )

        score_data = score_fn(item)

        if score_data["should_post"]:
            enriched = dict(item)
            enriched["_score_data"] = score_data
            enriched["ai_score"] = score_data["score"]
            enriched["ai_sector"] = score_data["sector"]
            enriched["ai_urgency"] = score_data["urgency"]
            enriched["ai_reason"] = score_data["reason"]
            scored.append(enriched)

        # Rate limiting to stay within Gemini free-tier limits
        if i < len(items) - 1:
            time.sleep(rate_limit_sleep)

    # Sort by score descending (highest relevance first)
    scored.sort(key=lambda x: x["ai_score"], reverse=True)

    log.info(
        "Batch scoring complete: %d/%d items passed (should_post=True)",
        len(scored), len(items),
    )
    return scored
