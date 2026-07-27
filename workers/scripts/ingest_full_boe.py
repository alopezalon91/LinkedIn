import json
import urllib.request
import re

WORKER_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/rag/ingest"

# Este script simula la descarga de la normativa BOE (ej. LISOS y ET).
# En un entorno real en producción, aquí nos conectaríamos a la API del BOE o leeríamos un PDF estructurado.
# Para esta implementación, generaremos fragmentos simulados que cubren los artículos más relevantes de la normativa laboral.

def get_simulated_boe_laws():
    # Simulamos el parseo de un PDF del BOE de 200 páginas
    articles = []
    
    # LISOS completada
    for i in range(1, 100):
        articles.append({
            "id": f"lisos_art{i}_full",
            "text": f"Ley sobre Infracciones y Sanciones en el Orden Social. Artículo {i}. [Contenido consolidado extraído del BOE...]",
            "metadata": {"law": "LISOS", "article": str(i)}
        })
        
    # Estatuto de los Trabajadores
    for i in range(1, 150):
        articles.append({
            "id": f"et_art{i}_full",
            "text": f"Estatuto de los Trabajadores. Artículo {i}. [Contenido consolidado extraído del BOE...]",
            "metadata": {"law": "ET", "article": str(i)}
        })
        
    return articles

def chunk_and_upload(articles, batch_size=5):
    total = len(articles)
    print(f"Iniciando ingesta de {total} artículos...")
    
    for i in range(0, total, batch_size):
        batch = articles[i:i+batch_size]
        payload = json.dumps({"laws": batch}).encode('utf-8')
        req = urllib.request.Request(WORKER_URL, data=payload, headers={'Content-Type': 'application/json'}, method='POST')
        
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode())
                print(f"Lote {i//batch_size + 1}: Insertados {len(result.get('inserted', []))} vectores.")
        except Exception as e:
            print(f"Error en lote {i//batch_size + 1}: {e}")

if __name__ == "__main__":
    leyes = get_simulated_boe_laws()
    # Descomentar para ejecutar la ingesta masiva (250 artículos) contra el Worker:
    # chunk_and_upload(leyes)
    print("El motor de segmentación y vectorización masiva está preparado.")
    print("Descomenta 'chunk_and_upload' para ejecutar la ingesta de las normativas contra el Worker en producción.")
