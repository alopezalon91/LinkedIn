import json
import os
import subprocess
import google.generativeai as genai
from ai.pdf_generator import create_carousel_pdf

api_key = os.environ.get("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.5-flash")

res = subprocess.run(["curl", "-s", "-H", "Authorization: Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e", "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/posts?status=pending"], capture_output=True, text=True)
data = json.loads(res.stdout)
posts = data.get("posts", [])

sql_statements = []

for p in posts:
    content = p.get("content_edited") or p.get("content")
    if not content: continue
    
    prompt = f"""
    Lee este post de LinkedIn y extrae un resumen para un carrusel de imágenes (PDF).
    Devuelve ÚNICAMENTE un JSON válido con esta estructura (lista de objetos):
    {{
      "carousel": [
        {{ "pre_title": "TIPO (EJ: NOTICIA)", "title": "Titular corto", "content": "Detalle breve" }}
      ]
    }}
    Reglas:
    - 3 a 5 diapositivas máximo.
    - pre_title es en mayúsculas, 1-2 palabras.
    - title es la frase principal.
    - content es opcional o breve.
    
    Post:
    {content}
    """
    
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(response_mime_type="application/json")
    )
    
    try:
        data = json.loads(response.text.strip())
        slides = data.get("carousel", [])
        if slides:
            print(f"Generated {len(slides)} complex slides for {p['id']}")
            new_pdf = create_carousel_pdf(slides)
            sql = f"UPDATE posts SET media_base64 = '{new_pdf}' WHERE id = '{p['id']}';"
            sql_statements.append(sql)
    except Exception as e:
        print(f"Failed to process {p['id']}: {e}")

with open("update_pdfs3.sql", "w") as f:
    f.write("\n".join(sql_statements))

print(f"Generated SQL for {len(sql_statements)} posts.")
