"""
ai/researcher.py
----------------
Agentic Fact-Checking Module.
Uses DuckDuckGo Search to find actual sources and verifies news articles using Groq.
"""

import logging
import json
import os
from duckduckgo_search import DDGS

log = logging.getLogger("researcher")

def verify_news_facts(title: str, full_text: str) -> str:
    """
    Agentic flow:
    1. Generate search query using Groq
    2. Search DDG
    3. Analyze results using Groq
    """
    if not full_text or len(full_text) < 200:
        return "No hay suficiente texto para verificar."

    from ai.content_generator import _get_groq_client
    client = _get_groq_client()
    if client is None:
        log.warning("Groq not available for research.")
        return ""

    # Step 1: Generate Search Query
    query_prompt = f"""You are a legal news researcher. Based on the following news article, generate a precise 3-6 word search query to find the official source, ruling, or original facts. Output ONLY the query string, nothing else.
Title: {title}
Article: {full_text[:1000]}"""

    try:
        query_response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": query_prompt}],
            temperature=0.1,
            max_tokens=20
        )
        search_query = query_response.choices[0].message.content.strip()
        search_query = search_query.strip('"').strip("'")
        log.info(f"Generated search query: {search_query}")
    except Exception as e:
        log.error(f"Failed to generate search query: {e}")
        return ""

    # Step 2: Search DuckDuckGo
    try:
        results = DDGS().text(search_query, max_results=5)
        search_context = "\n".join([f"- {r['title']}: {r['body']}" for r in results])
    except Exception as e:
        log.error(f"Search failed: {e}")
        return ""

    if not search_context:
        return "No se encontraron resultados de búsqueda para verificar esta noticia."

    # Step 3: Analyze and Verify
    verify_prompt = f"""Eres un investigador legal antifraude y analista de datos.
Se te proporciona una noticia original y los resultados de una búsqueda en internet sobre el mismo tema.
Tu objetivo es realizar un "Fact-Check Report" (Reporte de Veracidad).

Noticia original:
Titular: {title}
Contenido: {full_text[:3000]}

Resultados de búsqueda web (para verificar la noticia):
{search_context}

Instrucciones:
Compara la noticia con los resultados de búsqueda.
1. ¿Es la noticia veraz y correcta? Si detectas que es clickbait, falsa o engañosa, debes indicarlo CLARAMENTE.
2. Extrae los datos exactos que faltaban en la noticia original (por ejemplo: la fecha exacta de la sentencia, el número de resolución, el tribunal exacto, el enlace al BOE, etc.).

IMPORTANTE: Responde en español con un breve reporte de 2 o 3 párrafos. 
Si la noticia es CLICKBAIT o FALSA, tu reporte DEBE empezar EXACTAMENTE con: "🚨 ALERTA ROJA: FAKE NEWS O CLICKBAIT."
"""

    try:
        verify_response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": verify_prompt}],
            temperature=0.2,
            max_tokens=600
        )
        fact_check = verify_response.choices[0].message.content.strip()
        log.info("Fact-check completed.")
        return fact_check
    except Exception as e:
        log.error(f"Verification failed: {e}")
        return ""
