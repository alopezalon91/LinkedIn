import os, json, base64, dotenv
from ai.relevance_scorer import score_news_article
from ai.content_generator import generate_actualidad_post

dotenv.load_dotenv()

article = {
    "id": "noticia-1234",
    "title": "Hacienda advierte de multas de hasta 3000 euros para autónomos que no guarden facturas en formato digital",
    "summary": "La Agencia Tributaria lanza una campaña para inspeccionar a pequeños negocios y exige que toda la contabilidad esté digitalizada. Los expertos avisan que guardar tickets de papel ya no sirve ante una inspección telemática.",
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
        pix2 = doc[1].get_pixmap(dpi=150)
        pix2.save(os.path.join(base_dir, "test_slide2.png"))
        
    print("Saved preview images!")
