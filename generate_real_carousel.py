"""
generate_real_carousel.py
--------------------------
Genera un carrusel real de 6 páginas con contenido fiscal/contable
usando Gemini y el nuevo sistema de diseño.
"""

import os
import sys
import json
import base64
import fitz  # PyMuPDF
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Inicializar Gemini
api_key = os.environ.get("GEMINI_API_KEY", "")
if not api_key:
    print("ERROR: GEMINI_API_KEY no configurada en .env")
    sys.exit(1)

slides = [
    {
        "pre_title": "CONSEJO",
        "title": "Deducciones que olvidas declarar en el IRPF como autónomo",
        "subtitle": "Recupera dinero que ya es tuyo. Aquí están las más olvidadas.",
        "bullets": []
    },
    {
        "pre_title": "CONSEJO",
        "title": "1. El móvil y el internet de casa",
        "subtitle": "Son deducibles si los usas para tu actividad.",
        "bullets": [
            "Deducible al 50% si lo usas para trabajo y uso personal.",
            "Guarda siempre la factura a nombre de tu actividad.",
            "Internet fijo también computa si trabajas desde casa."
        ]
    },
    {
        "pre_title": "CONSEJO",
        "title": "2. Los gastos del coche",
        "subtitle": "Solo si está afecto exclusivamente a tu actividad.",
        "bullets": [
            "Gasolina, seguro, ITV y reparaciones son deducibles.",
            "Si también lo usas en privado, Hacienda puede rechazarlo.",
            "La afectación exclusiva es clave para que pase el control."
        ]
    },
    {
        "pre_title": "CONSEJO",
        "title": "3. Cuotas de formación y suscripciones",
        "subtitle": "Invertir en tu conocimiento también tiene ventaja fiscal.",
        "bullets": [
            "Cursos, libros, suscripciones a herramientas profesionales.",
            "Plataformas como LinkedIn Premium o software de gestión.",
            "Todo lo que mejore tu actividad es gasto deducible."
        ]
    },
    {
        "pre_title": "CONSEJO",
        "title": "4. La deducción por oficina en casa",
        "subtitle": "Trabaja desde casa y aplica el porcentaje correcto.",
        "bullets": [
            "Calcula el % de m² de tu despacho sobre el total.",
            "Aplica ese % a luz, agua, calefacción e hipoteca/alquiler.",
            "Es una deducción real pero debes poder justificarla."
        ]
    },
    {
        "pre_title": "CONSEJO",
        "title": "¿Estás dejando dinero sobre la mesa?",
        "subtitle": "Revisa tu última declaración con un profesional.",
        "bullets": []
    }
]

print(f"Contenido listo: {len(slides)} diapositivas sobre deducciones IRPF 2024")
for i, s in enumerate(slides):
    print(f"  [{i+1}] {s.get('pre_title','')} | {s.get('title','')[:60]}")


# Generar PDF con el nuevo diseño
from ai.pdf_generator import create_carousel_pdf

print("\nGenerando PDF con el nuevo diseño...")
try:
    b64_str = create_carousel_pdf(slides)
    pdf_bytes = base64.b64decode(b64_str)
    pdf_path = "real_carousel.pdf"
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"✅ PDF generado: {pdf_path}")
except Exception as e:
    print(f"ERROR PDF: {e}")
    sys.exit(1)

# Convertir a PNG
out_dir = "/Users/albertolopez/.gemini/antigravity/brain/4d7336fd-e6c4-4c47-9c64-84a087a629cb/"
print(f"\nConvirtiendo a PNG en {out_dir}")
doc = fitz.open(pdf_path)
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    pix = page.get_pixmap(dpi=150)
    out_path = os.path.join(out_dir, f"real_slide_{page_num+1}.png")
    pix.save(out_path)
    print(f"  Guardado: real_slide_{page_num+1}.png")

print(f"\n🎉 Carrusel real de {len(doc)} páginas generado correctamente.")
