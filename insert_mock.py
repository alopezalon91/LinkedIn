import json
import uuid
import datetime
import urllib.request

db_url = "http://127.0.0.1:8787/api/check-duplicates" # Not this.

# Just print the exact SQL command to run, and I will run it with wrangler
prompt_text = """
Eres Alberto López. Gestor fiscal...
[TEXTO DE NOTICIA]
Hacienda va a multar a los autónomos con 3000 euros si no presentan el modelo 303 a tiempo este trimestre, debido a un nuevo fallo en la plataforma online que no van a perdonar.
=== [BRANDING_RULES] — IDENTIDAD VISUAL Y COPY (OBLIGATORIO) ===
1. FIRMA CORPORATIVA UNIFICADA: ...
Usa muchos emojis, sé directo, párrafos cortos.
=== FORMATO DE SALIDA (CRÍTICO) ===
Responde con un JSON que tenga 'post', 'first_comment', y 'carousel'.
"""

draft_data = {
    "title": "Multas de Hacienda por el Modelo 303",
    "summary": "Hacienda no perdonará retrasos por fallos de su propia plataforma y multará con 3.000€.",
    "prompt": prompt_text
}

content_json = json.dumps(draft_data).replace("'", "''")

sql = f"INSERT INTO posts (id, type, sector, status, content, source_name, urgency, ai_score, created_at, updated_at) VALUES ('{str(uuid.uuid4())}', 'actualidad', 'fiscal', 'draft', '{content_json}', 'El Confidencial', 'alta', 9.5, datetime('now'), datetime('now'));"

print(sql)
