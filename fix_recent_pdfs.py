import json
import os
import subprocess
import google.generativeai as genai
from ai.pdf_generator import create_carousel_pdf

api_key = os.environ.get("GEMINI_API_KEY", "")
genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-1.0-pro")

# Solo posts PENDIENTES (status=pending) — no tocamos los rechazados ni publicados
res = subprocess.run([
    "curl", "-s", "-H", "Authorization: Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e",
    "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/posts?limit=50&status=pending"
], capture_output=True, text=True)
data = json.loads(res.stdout)
posts = data.get("posts", [])

if not posts:
    print("No hay posts pendientes. Nada que hacer.")
    exit(0)

print(f"Encontrados {len(posts)} post(s) pendientes.")

sql_statements = []

for p in posts:
    content = p.get("content_edited") or p.get("content")
    if not content: continue

    prompt = f"""
    Lee este post de LinkedIn y extrae un resumen para un carrusel de imágenes (PDF).
    Devuelve ÚNICAMENTE un JSON válido con esta estructura (lista de objetos):
    {{
      "carousel": [
        {{ 
          "pre_title": "Newsletter", 
          "title": "Titular principal", 
          "subtitle": "Referencia o subtítulo", 
          "bullets": [] 
        }},
        {{ 
          "pre_title": "", 
          "title": "Idea principal 1", 
          "subtitle": "Información complementaria", 
          "bullets": ["Punto clave 1", "Punto clave 2"] 
        }}
      ]
    }}
    Reglas:
    - 3 a 5 diapositivas máximo.
    - El slide 1 no suele tener bullets.
    - bullets: array de strings, cortos.
    
    Post:
    {content}
    """

    import time
    import requests
    time.sleep(15)
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    
    try:
        resp = requests.post(url, json=payload)
        resp_data = resp.json()
        if "error" in resp_data:
            print(f"API Error for {p['id']}: {resp_data['error']}")
            continue
            
        text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
        resp_data = json.loads(text.strip())
        slides = resp_data.get("carousel", [])
        if slides:
            print(f"Generated slides for {p['id']}")
            new_pdf = create_carousel_pdf(slides)
            sql = f"UPDATE posts SET media_base64 = '{new_pdf}' WHERE id = '{p['id']}';"
            sql_statements.append(sql)
    except Exception as e:
        print(f"Failed to process {p['id']}: {e}")

if sql_statements:
    with open("update_pdfs_recent.sql", "w") as f:
        f.write("\n".join(sql_statements))
    print(f"Generated SQL for {len(sql_statements)} posts.")
else:
    print("No se generó SQL. Todos los posts pendientes ya tienen PDF o fallaron.")
