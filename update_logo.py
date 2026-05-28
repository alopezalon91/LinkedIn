import json
import os
import subprocess
import google.generativeai as genai
from ai.pdf_generator import create_carousel_pdf

def fetch_recent_posts():
    worker_url = os.environ.get("CF_WORKER_URL", "https://mytaxbot-linkedin.a-lopezalon91.workers.dev")
    token = os.environ.get("CF_WORKER_TOKEN", "d5a8fb21e7d97b0a790518d6bc1f9b3e")
    import httpx
    with httpx.Client() as client:
        resp = client.get(f"{worker_url}/api/posts?limit=5", headers={"Authorization": f"Bearer {token}"})
        return resp.json().get("posts", [])

def rewrite_and_save():
    posts = fetch_recent_posts()
    sql_statements = []
    
    for p in posts:
        content = p.get("content_edited") or p.get("content")
        print(f"Generating for {p['id']}...")
        try:
            # We don't want to call gemini again if we can just parse the content manually, but we need slides.
            # We don't have the original slides, so we can't easily recreate the pdf unless we parse the markdown.
            # Let's just make a dummy slide for testing the logo.
            slides = [
                {"pre_title": "TEST", "title": "Prueba de nuevo logo", "subtitle": "Visualiza el footer", "bullets": ["A", "B", "C"]},
                {"pre_title": "", "title": "Slide 2", "subtitle": "Contenido", "bullets": ["1", "2"]}
            ]
            pdf_b64 = create_carousel_pdf(slides)
            sql_statements.append(f"UPDATE posts SET media_base64 = '{pdf_b64}' WHERE id = '{p['id']}';")
        except Exception as e:
            print(f"Failed {p['id']}: {e}")
            
    with open("update_logo.sql", "w") as f:
        f.write("\n".join(sql_statements))

if __name__ == "__main__":
    rewrite_and_save()
