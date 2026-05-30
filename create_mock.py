import os
import sys
import base64
import fitz  # PyMuPDF
from ai.pdf_generator import create_carousel_pdf

slides = [
    {
      "pre_title": "ACTUALIDAD",
      "title": "Adiós al papel: Llega la Factura Electrónica Obligatoria",
      "subtitle": "Todo lo que debes saber sobre el nuevo reglamento de la Ley Crea y Crece.",
      "bullets": []
    },
    {
      "pre_title": "ACTUALIDAD",
      "title": "¿A quién afecta realmente?",
      "subtitle": "Solo a operaciones B2B (entre empresas y autónomos).",
      "bullets": [
        "Si tienes un e-commerce y vendes a particulares, de momento te libras.",
        "Si eres autónomo y trabajas para agencias u otras pymes, es obligatorio."
      ]
    },
    {
      "pre_title": "ACTUALIDAD",
      "title": "Los Plazos Clave",
      "subtitle": "El reloj ya ha empezado a contar.",
      "bullets": [
        "Empresas que facturan >8 millones: Tienen 1 año para adaptarse.",
        "Resto de pymes y autónomos: Tienen 2 años desde la aprobación.",
        "Sanciones de hasta 10.000€ por no cumplir la normativa."
      ]
    }
]

pdf_path = "mock_carousel.pdf"
try:
    b64_str = create_carousel_pdf(slides)
    pdf_bytes = base64.b64decode(b64_str)
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"PDF generated at {pdf_path}")
except Exception as e:
    print(f"Error generating PDF: {e}")
    sys.exit(1)

out_dir = "/Users/albertolopez/.gemini/antigravity/brain/4d7336fd-e6c4-4c47-9c64-84a087a629cb/"
doc = fitz.open(pdf_path)
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    pix = page.get_pixmap(dpi=150)
    out_path = os.path.join(out_dir, f"mock_slide_{page_num+1}.png")
    pix.save(out_path)
    print(f"Saved {out_path}")
