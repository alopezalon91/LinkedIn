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
import json
from datetime import datetime, timezone
from typing import Any

import google.generativeai as genai
import groq
from groq import Groq

from config.prompts import NORMATIVA_PROMPT, ACTUALIDAD_PROMPT, SYSTEM_CONTEXT
from config.sectors import get_hashtags_for_sector
from ai.pdf_generator import create_carousel_pdf

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

MAX_POST_CHARS = 3000
_MODEL_NAME = "gemini-2.0-flash"

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

_groq_client: Groq | None = None

def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY", "")
        if not api_key:
            raise EnvironmentError("GROQ_API_KEY not set")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

def _call_groq_json(prompt: str, system_context: str = SYSTEM_CONTEXT, temperature: float = 1.0) -> str:
    client = _get_groq_client()
    # Add explicit instructions to guarantee JSON for Llama 3
    system_instruction = system_context + "\n\nIMPORTANTE: Responde SIEMPRE con un objeto JSON válido según el esquema solicitado."
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=temperature
    )
    return response.choices[0].message.content.strip()


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

def _generate_post(prompt: str, source_id: str) -> dict:
    """
    Sends the prompt to Gemini, requests JSON output, and returns the parsed dict.
    Raises RuntimeError on failure.

    Args:
        prompt:    Fully-formatted prompt string.
        source_id: Identifier used for logging.

    Returns:
        Dict with keys: "post" (str) and "carousel" (list[str]).
    """
    try:
        model = _get_model()
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(response_mime_type="application/json")
        )
        text = response.text.strip()
        
        # Sometimes the model still outputs markdown fences despite mime type config
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text.split("\n", 1)[1] if "\n" in text else text
                
        data = json.loads(text)
        log.info("Generated post & carousel for %s", source_id)
        return data

    except Exception as exc:
        log.warning("Gemini generation failed for %s (%s). Falling back to Groq...", source_id, exc)
        try:
            text = _call_groq_json(prompt)
            if text.startswith("```"):
                parts = text.split("```")
                text = parts[1] if len(parts) > 1 else text
                if text.startswith("json"):
                    text = text.split("\n", 1)[1] if "\n" in text else text
            
            data = json.loads(text)
            log.info("Generated post & carousel using GROQ for %s", source_id)
            return data
        except Exception as groq_exc:
            log.error("Groq fallback generation error for %s: %s", source_id, groq_exc)
            raise RuntimeError(f"Both Gemini and Groq generation failed: {exc} | {groq_exc}") from groq_exc

def _verify_and_correct_post(original_text: str, generated_json: dict, source_id: str) -> dict:
    """
    Second-pass AI validation. Checks for hallucinations by strictly comparing
    the generated content with the original text.
    """
    prompt = f"""
Actúa como un auditor legal estricto y corrector de estilo editorial.
Tu único objetivo es realizar una revisión exhaustiva del JSON generado. Ejecuta esta revisión como un CHECKLIST SECUENCIAL estricto:

PASO 01: COMPROBACIÓN LEGAL Y DE DATOS (PRIORIDAD MÁXIMA CERO ALUCINACIONES)
- Compara el 'post' y el 'carousel' con el texto original de la noticia.
- Detecta y elimina CUALQUIER dato, fecha, porcentaje, sanción o nombre de tribunal que NO aparezca en el texto original.
- Si el texto original no incluye la sanción exacta, elimina la sanción del JSON. No inventes.

PASO 02: AUDITORÍA DE IDENTIDAD
- El nombre del profesional debe ser exactamente 'Alberto López' (con tilde en la 'ó' y la 'L' mayúscula).
- Asegura que el campo 'slide_type' esté correctamente asignado como 'cover' para la primera diapositiva y como 'interior' para el resto.

PASO 03: REVISIÓN DE FORMATO Y ESTILO (JSON RULES)
- Comprueba que NINGÚN bullet (viñeta) del carrusel termine en punto final (.). Elimínalos si existen.
- Asegúrate de que el gancho del post no sea una pregunta genérica ("¿Sabías que...?").
- Verifica que ningún párrafo del post supere las 3 líneas.
- Máximo 3 emojis en todo el post. Elimina los sobrantes.

    === TEXTO ORIGINAL ===
    {original_text}
    
    === POST GENERADO (JSON) ===
    {json.dumps(generated_json, ensure_ascii=False)}
    
    Devuelve ÚNICAMENTE el objeto JSON corregido con la misma estructura exacta ("post" y "carousel").
    Si no hay alucinaciones ni errores de formato, devuelve el JSON tal cual.
    """
    
    try:
        model = _get_model()
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(response_mime_type="application/json", temperature=0.0)
        )
        text = response.text.strip()
        
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text.split("\n", 1)[1] if "\n" in text else text
                
        corrected_data = json.loads(text)
        log.info("Post verified & corrected for %s", source_id)
        return corrected_data

    except Exception as exc:
        log.warning("Gemini verification failed for %s (%s). Falling back to Groq...", source_id, exc)
        try:
            text = _call_groq_json(prompt, system_context="Eres un corrector estricto que responde solo en JSON", temperature=0.0)
            if text.startswith("```"):
                parts = text.split("```")
                text = parts[1] if len(parts) > 1 else text
                if text.startswith("json"):
                    text = text.split("\n", 1)[1] if "\n" in text else text
            corrected_data = json.loads(text)
            log.info("Post verified & corrected using GROQ for %s", source_id)
            return corrected_data
        except Exception as groq_exc:
            log.error("Groq fallback verification error for %s: %s", source_id, groq_exc)
            return generated_json

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

    meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    hoy_date = datetime.now()
    hoy_str = f"{hoy_date.day} de {meses[hoy_date.month]} de {hoy_date.year}"

    prompt = NORMATIVA_PROMPT.format(
        titulo=boe_entry.get("titulo", ""),
        seccion=boe_entry.get("seccion", ""),
        departamento=boe_entry.get("departamento", ""),
        fecha=boe_entry.get("fecha", ""),
        boe_id=source_id,
        texto=boe_entry.get("texto", "Sin texto disponible"),
        sector=sector,
        sector_hashtags=sector_hashtags,
        hoy=hoy_str,
    )
    if rejection_instructions:
        prompt += "\n" + rejection_instructions

    raw_content = _generate_post(prompt, source_id)
    # Double validation pass
    original_text = boe_entry.get("texto", "Sin texto disponible")
    verified_content = _verify_and_correct_post(original_text, raw_content, source_id)
    
    post_text = verified_content.get("post", raw_content.get("post", ""))
    carousel_slides = verified_content.get("carousel", raw_content.get("carousel", []))
    
    final_content = truncate_if_needed(post_text)
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
        "first_comment": verified_content.get("first_comment", raw_content.get("first_comment", "")),
        "media_base64": create_carousel_pdf(carousel_slides) if carousel_slides else "",
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

    meses = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    hoy_date = datetime.now()
    hoy_str = f"{hoy_date.day} de {meses[hoy_date.month]} de {hoy_date.year}"

    prompt = ACTUALIDAD_PROMPT.format(
        titulo=article.get("title", ""),
        resumen=article.get("texto") or article.get("summary", "Sin resumen disponible"),
        url=article.get("url", ""),
        fuente=article.get("source", "Fuente desconocida").replace("_", " ").title(),
        fecha=article.get("published", ""),
        sector=sector,
        sector_hashtags=sector_hashtags,
        hoy=hoy_str,
    )
    if rejection_instructions:
        prompt += "\n" + rejection_instructions

    raw_content = _generate_post(prompt, source_id)
    # Double validation pass
    original_text = article.get("texto") or article.get("summary", "Sin resumen disponible")
    verified_content = _verify_and_correct_post(original_text, raw_content, source_id)
    
    post_text = verified_content.get("post", raw_content.get("post", ""))
    carousel_slides = verified_content.get("carousel", raw_content.get("carousel", []))
    
    final_content = truncate_if_needed(post_text)
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
        "first_comment": verified_content.get("first_comment", raw_content.get("first_comment", "")),
        "media_base64": create_carousel_pdf(carousel_slides) if carousel_slides else "",
    }
