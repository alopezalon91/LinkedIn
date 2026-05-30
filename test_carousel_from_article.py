import os, json, base64
from ai.pdf_generator import create_carousel_pdf

# Example slide data (cover + 2 interior slides) using correct branding
slides = [
    {
        "slide_type": "cover",
        "pre_title": "ACTUALIDAD",
        "title": "Alberto López: Cambios claves en la normativa de IRPF 2024",
        "subtitle": "Todo lo que necesitas saber para no pagar de más y aprovechar deducciones.",
        "bullets": []
    },
    {
        "slide_type": "interior",
        "pre_title": "CONSEJO",
        "title": "1️⃣ Deducción del móvil y la conexión",
        "subtitle": "Si lo usas para tu actividad, puedes deducir hasta el 50 % de la factura.",
        "bullets": [
            "Conserva siempre la factura a nombre de tu negocio.",
            "Incluye también la línea de internet de casa si trabajas desde allí."
        ]
    },
    {
        "slide_type": "interior",
        "pre_title": "CONSEJO",
        "title": "2️⃣ Gastos del coche",
        "subtitle": "Sólo deducibles si el vehículo está afecto exclusivamente a tu actividad.",
        "bullets": [
            "Gasolina, seguro, ITV y reparaciones.",
            "Si lo usas también de forma privada, deberás prorratear y podría ser rechazado."
        ]
    }
]

b64 = create_carousel_pdf(slides)
pdf_bytes = base64.b64decode(b64)
output_path = "example_carousel.pdf"
with open(output_path, "wb") as f:
    f.write(pdf_bytes)
print(f"✅ PDF creado: {output_path}")

# Convert to PNG pages (requires PyMuPDF)
import fitz
doc = fitz.open(output_path)
out_dir = "carousel_pngs"
os.makedirs(out_dir, exist_ok=True)
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=150)
    png_path = os.path.join(out_dir, f"slide_{i+1}.png")
    pix.save(png_path)
    print(f"📸 {png_path}")

