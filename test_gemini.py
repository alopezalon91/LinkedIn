import requests, json

API_KEY = "AIzaSyD9yDRfpfeNDR-byIDRbJR0jqdQoCnLAuA"

# Simulated prompt (short version to test)
prompt = """Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente noticia de actualidad.

=== DATOS DE LA NOTICIA ===
Titular: Bruselas alienta a España a revisar el IVA reducido a hoteles y restaurantes
Resumen: La Comisión Europea recomienda a España que limite el uso del IVA reducido. El IVA del 10% para hostelería está costando a España un 0,4% del PIB.
Fuente: La Vanguardia
Fecha: 2026-06-03

Responde SIEMPRE con un objeto JSON válido con esta estructura exacta:
{
  "post": "texto completo del post de LinkedIn aquí",
  "first_comment": "primer comentario con hashtags",
  "carrusel": {"slides": [{"titulo": "...", "contenido": "..."}]}
}"""

resp = requests.post(
    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}",
    headers={"Content-Type": "application/json"},
    json={
        "systemInstruction": {"parts": [{"text": "Eres un experto en copywriting de LinkedIn especializado en fiscalidad. Responde SIEMPRE con JSON válido."}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 1.0, "responseMimeType": "application/json"}
    }
)

print(f"Status: {resp.status_code}")
if resp.ok:
    result = resp.json()
    text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    print(f"Response length: {len(text)}")
    try:
        parsed = json.loads(text)
        print("JSON parse: OK")
        print(f"Keys: {list(parsed.keys())}")
        print(f"Post preview: {parsed.get('post','')[:150]}")
    except Exception as e:
        print(f"JSON parse FAILED: {e}")
        print(f"Raw: {text[:200]}")
else:
    print(f"Error: {resp.text[:300]}")
