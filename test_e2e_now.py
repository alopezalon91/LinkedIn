import os, json, base64, dotenv
from ai.relevance_scorer import score_news_article
from ai.content_generator import generate_actualidad_post

dotenv.load_dotenv()

article = {
    "id": "noticia-1234",
    "title": "Hacienda pone el foco en los pequeños autónomos: multas de 3.000 euros si no se digitaliza la facturación",
    "summary": "La Agencia Tributaria (AEAT) acaba de endurecer su plan de control tributario para 2026. Tras la reciente entrada en vigor del reglamento de facturación de la Ley Crea y Crece, la AEAT iniciará un barrido telemático masivo para verificar si las pymes y autónomos han implementado sistemas de facturación electrónica verificables. Según el último boletín oficial, mantener la facturación en papel, Excel o en un Word básico sin un software certificado será considerado una infracción grave, acarreando multas que oscilan entre los 1.000 y los 3.000 euros. Esta medida busca combatir la economía sumergida y evitar el fraude del 'software de doble uso'. Los profesionales tienen hasta el último trimestre del año para adaptarse, momento en el que comenzarán las sanciones automáticas.",
    "url": "https://www.eleconomista.es/autonomos",
    "source": "el economista",
    "published": "hoy",
    "sector": "fiscal"
}

print("Scoring article...")
score_data = score_news_article(article)
print("Score:", score_data)

print("\nGenerating post...")
post_data = generate_actualidad_post(article, score_data)

print("POST TEXT:\n", post_data.get("content"))

b64 = post_data.get("media_base64")
if b64:
    pdf_bytes = base64.b64decode(b64)
    with open("temp_post.pdf", "wb") as f:
        f.write(pdf_bytes)
    
    import fitz
    doc = fitz.open("temp_post.pdf")
    base_dir = "/Users/albertolopez/.gemini/antigravity/brain/4d7336fd-e6c4-4c47-9c64-84a087a629cb"
    
    pix = doc[0].get_pixmap(dpi=150)
    pix.save(os.path.join(base_dir, "test_cover.png"))
    
    if len(doc) > 1:
        for i in range(1, len(doc)):
            pix2 = doc[i].get_pixmap(dpi=150)
            pix2.save(os.path.join(base_dir, f"test_slide{i+1}.png"))
        
    print("Saved preview images!")
