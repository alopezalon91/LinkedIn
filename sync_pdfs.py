import os
import json
import base64
import urllib.parse
import httpx
from dotenv import load_dotenv

# Ensure we import the PDF generator
try:
    from ai.pdf_generator import create_carousel_pdf
except ImportError:
    print("Error: Asegúrate de ejecutar este script desde el directorio raíz del proyecto.")
    exit(1)

def decode_carousel_json(media_b64: str) -> list:
    """
    Decodes the base64 media string and returns the slides array if it's a JSON carousel.
    Returns None if it's already a PDF or something else.
    """
    if not media_b64:
        return None
        
    try:
        # Decode base64
        decoded_bytes = base64.b64decode(media_b64)
        decoded_str = urllib.parse.unquote(decoded_bytes.decode('utf-8'))
        
        if decoded_str.startswith('CAROUSEL:'):
            json_str = decoded_str[len('CAROUSEL:'):]
            data = json.loads(json_str)
            # Support both format keys used by AI
            return data if isinstance(data, list) else data.get('carousel', data.get('carrusel', []))
    except Exception:
        pass
        
    return None

def main():
    load_dotenv()
    worker_url = os.getenv("CF_WORKER_URL", "").rstrip("/")
    worker_token = os.getenv("CF_WORKER_TOKEN", "")
    
    if not worker_url or not worker_token:
        print("Error: CF_WORKER_URL o CF_WORKER_TOKEN no están configurados en .env")
        return

    headers = {
        "Authorization": f"Bearer {worker_token}",
        "Content-Type": "application/json"
    }

    print("Buscando posts que necesiten renderizar su carrusel...")
    
    # We check pending, reviewed, and scheduled
    statuses_to_check = ["pending", "reviewed", "scheduled"]
    posts_to_process = []
    
    with httpx.Client(timeout=30) as client:
        for status in statuses_to_check:
            try:
                resp = client.get(f"{worker_url}/api/posts?limit=100&status={status}", headers=headers)
                resp.raise_for_status()
                data = resp.json()
                posts = data.get("posts", [])
                posts_to_process.extend(posts)
            except Exception as e:
                print(f"Error obteniendo posts con status {status}: {e}")

        if not posts_to_process:
            print("No se encontraron posts para revisar.")
            return

        processed = 0
        for post in posts_to_process:
            media_b64 = post.get("media_base64")
            slides = decode_carousel_json(media_b64)
            
            if slides:
                post_id = post["id"]
                print(f"[{post_id}] Detectado JSON de carrusel. Renderizando PDF...")
                try:
                    # Generate the real PDF using the local Python logic
                    new_pdf_b64 = create_carousel_pdf(slides)
                    
                    # Update the post via API
                    update_resp = client.patch(
                        f"{worker_url}/api/posts/{post_id}",
                        headers=headers,
                        json={"action": "update", "media_base64": new_pdf_b64}
                    )
                    
                    if update_resp.status_code == 200:
                        print(f"[{post_id}] ✅ PDF renderizado y subido correctamente a la base de datos.")
                        processed += 1
                    else:
                        print(f"[{post_id}] ❌ Error al actualizar el post: {update_resp.text}")
                except Exception as e:
                    print(f"[{post_id}] ❌ Fallo al generar el PDF: {e}")

        print(f"\nProceso finalizado. {processed} PDFs generados y sincronizados.")

if __name__ == "__main__":
    main()
