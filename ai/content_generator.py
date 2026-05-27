"""
ai/content_generator.py
------------------------
Generates LinkedIn posts from BOE entries and news articles using Gemini Flash.

Handles prompt building, post validation, smart truncation, and structured
output packaging.

Main entry points:
    generate_normativa_post(boe_entry, score_data)   → dict
    generate_actualidad_post(article, score_data)    → dict
"""

from __future__ import annotations

import logging
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any

import google.generativeai as genai

from config.prompts import NORMATIVA_PROMPT, ACTUALIDAD_PROMPT, SYSTEM_CONTEXT
from config.sectors import get_hashtags_for_sector

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [GENERATOR] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("content_generator")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_POST_CHARS = 2500
_MODEL_NAME = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# Gemini client
# ---------------------------------------------------------------------------

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
            raise EnvironmentError("GEMINI_API_KEY environment variable is not set.")
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            model_name=_MODEL_NAME,
            system_instruction=SYSTEM_CONTEXT,
        )
        log.info("Gemini model '%s' initialised (content generator).", _MODEL_NAME)
    return _model


# ---------------------------------------------------------------------------
# Validation & truncation utilities
# ---------------------------------------------------------------------------

def validate_post(text: str) -> dict:
    """
    Validates a generated LinkedIn post against content requirements.

    Checks:
        - Total character count ≤ MAX_POST_CHARS (1 300)
        - Contains at least one hashtag (#Word)
        - Contains at least one emoji
        # No brand mention required

    Args:
        text: Raw post text to validate.

    Returns:
        Dict with keys:
            valid  (bool)  – True if all checks pass
            issues (list)  – Human-readable list of failed checks
            char_count (int)
    """
    issues: list[str] = []
    char_count = len(text)

    if char_count > MAX_POST_CHARS:
        issues.append(
            f"Demasiado largo: {char_count} chars (máximo {MAX_POST_CHARS})."
        )

    # Simple emoji detection: any character in the emoji Unicode ranges
    has_emoji = any(
        "\U0001f300" <= ch <= "\U0001faff"
        or "\u2600" <= ch <= "\u26ff"
        or "\u2700" <= ch <= "\u27bf"
        for ch in text
    )
    if not has_emoji:
        issues.append("No contiene emojis.")



    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "char_count": char_count,
    }


def truncate_if_needed(text: str, max_chars: int = MAX_POST_CHARS) -> str:
    """
    Smartly truncates a post to max_chars if needed.

    Strategy:
        1. If the post fits, return as-is.
        2. Find the last sentence boundary ('. ', '! ', '? ', '.\n') before
           max_chars and cut there.
        3. Ensure the hashtag line is preserved by appending it back if it
           was cut off.
        4. Hard-cut as last resort.

    Args:
        text:      Post text.
        max_chars: Maximum allowed character count (default 1 300).

    Returns:
        Truncated (or original) post text.
    """
    if len(text) <= max_chars:
        return text

    # Separate hashtag line (usually the last line)
    lines = text.rstrip().split("\n")
    hashtag_line = ""
    body_lines = lines

    # Detect hashtag-only line (all tokens start with #)
    if lines and all(token.startswith("#") for token in lines[-1].split()):
        hashtag_line = "\n" + lines[-1]
        body_lines = lines[:-1]

    body = "\n".join(body_lines)
    budget = max_chars - len(hashtag_line)

    # Try to cut at a sentence boundary
    sentence_endings = [". ", "! ", "? ", ".\n", "!\n", "?\n"]
    cut_pos = -1
    for end in sentence_endings:
        pos = body.rfind(end, 0, budget)
        if pos != -1:
            cut_pos = max(cut_pos, pos + len(end))

    if cut_pos == -1:
        cut_pos = budget

    truncated_body = body[:cut_pos].rstrip()


    # Append ellipsis + hashtag line
    result = truncated_body + "…" + hashtag_line
    if len(result) > max_chars:
        # Hard cut as absolute last resort
        result = text[:max_chars - 1] + "…"

    log.info(
        "Post truncated: %d → %d chars", len(text), len(result)
    )
    return result


def _extract_hashtags(text: str) -> list[str]:
    """Returns all hashtag strings found in the post text."""
    return re.findall(r"#\w+", text)


# ---------------------------------------------------------------------------
# Internal post generator
# ---------------------------------------------------------------------------

def _generate_post(prompt: str, source_id: str) -> str:
    """
    Sends the prompt to Gemini and returns the raw text response.
    Raises RuntimeError on failure.

    Args:
        prompt:    Fully-formatted prompt string.
        source_id: Identifier used for logging.

    Returns:
        Raw post text from Gemini.
    """
    try:
        model = _get_model()
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Strip any accidental markdown fencing
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("text") or text.startswith("markdown"):
                text = text.split("\n", 1)[1] if "\n" in text else text

        log.info("Generated post for %s (%d chars)", source_id, len(text))
        return text

    except Exception as exc:
        log.error("Gemini generation error for %s: %s", source_id, exc)
        raise RuntimeError(f"Gemini generation failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_normativa_post(boe_entry: dict, score_data: dict) -> dict:
    """
    Generates a LinkedIn post for a BOE/regulatory entry.

    Args:
        boe_entry:  Enriched BOE entry dict (from boe_scraper.run()).
        score_data: Relevance score dict (from relevance_scorer).

    Returns:
        Dict with keys:
            content       – Final post text (≤1 300 chars)
            type          – 'normativa'
            sector        – AI-detected sector
            source_id     – BOE document ID
            source_url    – BOE HTML URL
            generated_at  – ISO timestamp
            char_count    – Final character count
            hashtags_used – List of hashtags in the post
            valid         – Whether the post passed validation
            issues        – List of validation issues (empty if valid)
    """
    source_id = boe_entry.get("id", "UNKNOWN")
    sector = score_data.get("sector", boe_entry.get("sector", "general"))
    sector_hashtags = get_hashtags_for_sector(sector)

    rejection_instructions = ""
    try:
        from ai.learning_model import LearningModel
        learning = LearningModel()
        rejections = learning.get_recent_rejection_reasons(limit=5)
        edits = learning.get_recent_edit_reasons(limit=5)
        if rejections or edits:
            rejection_instructions = "\n=== APRENDIZAJE DE DECISIONES DEL USUARIO ===\n"
            if rejections:
                rejection_instructions += "El usuario ha RECHAZADO recientemente los siguientes posts. Evita cometer los mismos errores o escribir con un estilo/enfoque similar:\n"
                for r in rejections:
                    snippet = r['content'][:200].replace('\n', ' ')
                    rejection_instructions += f"- Post rechazado: \"{snippet}...\"\n"
                    rejection_instructions += f"  Motivo del rechazo: {r['reason']}\n\n"
            if edits:
                rejection_instructions += "El usuario ha EDITADO recientemente los siguientes posts. Aprende de lo que corrigió y por qué para adaptarte a sus preferencias de estilo:\n"
                for e in edits:
                    snippet = e['content'][:200].replace('\n', ' ')
                    rejection_instructions += f"- Post original: \"{snippet}...\"\n"
                    rejection_instructions += f"  Corrección y motivo: {e['reason']}\n\n"
    except Exception as e:
        log.warning("Could not append user preference instructions to content generator: %s", e)

    prompt = NORMATIVA_PROMPT.format(
        titulo=boe_entry.get("titulo", ""),
        seccion=boe_entry.get("seccion", ""),
        departamento=boe_entry.get("departamento", ""),
        fecha=boe_entry.get("fecha", ""),
        boe_id=source_id,
        texto=boe_entry.get("texto", "Sin texto disponible"),
        sector=sector,
        sector_hashtags=sector_hashtags,
    )
    if rejection_instructions:
        prompt += "\n" + rejection_instructions

    raw_content = _generate_post(prompt, source_id)
    final_content = truncate_if_needed(raw_content)
    validation = validate_post(final_content)

    return {
        "content": final_content,
        "type": "normativa",
        "sector": sector,
        "source_id": source_id,
        "source_url": boe_entry.get("url_html", ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "char_count": len(final_content),
        "hashtags_used": _extract_hashtags(final_content),
        "valid": validation["valid"],
        "issues": validation["issues"],
        "ai_score": score_data.get("score", 0),
        "ai_urgency": score_data.get("urgency", "baja"),
        "ai_reason": score_data.get("reason", ""),
    }


def generate_actualidad_post(article: dict, score_data: dict) -> dict:
    """
    Generates a LinkedIn post for a news/actualidad article.

    Args:
        article:    Enriched news article dict (from news_scraper.run()).
        score_data: Relevance score dict (from relevance_scorer).

    Returns:
        Dict with same structure as generate_normativa_post() but type='actualidad'.
    """
    source_id = article.get("id", "UNKNOWN")
    sector = score_data.get("sector", article.get("sector", "general"))
    sector_hashtags = get_hashtags_for_sector(sector)

    rejection_instructions = ""
    try:
        from ai.learning_model import LearningModel
        learning = LearningModel()
        rejections = learning.get_recent_rejection_reasons(limit=5)
        edits = learning.get_recent_edit_reasons(limit=5)
        if rejections or edits:
            rejection_instructions = "\n=== APRENDIZAJE DE DECISIONES DEL USUARIO ===\n"
            if rejections:
                rejection_instructions += "El usuario ha RECHAZADO recientemente los siguientes posts. Evita cometer los mismos errores o escribir con un estilo/enfoque similar:\n"
                for r in rejections:
                    snippet = r['content'][:200].replace('\n', ' ')
                    rejection_instructions += f"- Post rechazado: \"{snippet}...\"\n"
                    rejection_instructions += f"  Motivo del rechazo: {r['reason']}\n\n"
            if edits:
                rejection_instructions += "El usuario ha EDITADO recientemente los siguientes posts. Aprende de lo que corrigió y por qué para adaptarte a sus preferencias de estilo:\n"
                for e in edits:
                    snippet = e['content'][:200].replace('\n', ' ')
                    rejection_instructions += f"- Post original: \"{snippet}...\"\n"
                    rejection_instructions += f"  Corrección y motivo: {e['reason']}\n\n"
    except Exception as e:
        log.warning("Could not append user preference instructions to content generator: %s", e)

    prompt = ACTUALIDAD_PROMPT.format(
        titulo=article.get("title", ""),
        resumen=article.get("texto") or article.get("summary", "Sin resumen disponible"),
        url=article.get("url", ""),
        fuente=article.get("source", "Fuente desconocida").replace("_", " ").title(),
        fecha=article.get("published", ""),
        sector=sector,
        sector_hashtags=sector_hashtags,
    )
    if rejection_instructions:
        prompt += "\n" + rejection_instructions

    raw_content = _generate_post(prompt, source_id)
    final_content = truncate_if_needed(raw_content)
    validation = validate_post(final_content)

    return {
        "content": final_content,
        "type": "actualidad",
        "sector": sector,
        "source_id": source_id,
        "source_url": article.get("url", ""),
        "source_name": article.get("source", ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "char_count": len(final_content),
        "hashtags_used": _extract_hashtags(final_content),
        "valid": validation["valid"],
        "issues": validation["issues"],
        "ai_score": score_data.get("score", 0),
        "ai_urgency": score_data.get("urgency", "baja"),
        "ai_reason": score_data.get("reason", ""),
    }
