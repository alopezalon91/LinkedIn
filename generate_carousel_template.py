import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm

# Paths
logo_path = os.path.abspath('/Users/albertolopez/.gemini/antigravity/brain/4d7336fd-e6c4-4c47-9c64-84a087a629cb/logo_final_dark.png')
output_pdf = os.path.abspath('/Users/albertolopez/.gemini/antigravity/scratch/linkedin/carousel_template.pdf')

# Ensure logo exists
if not os.path.exists(logo_path):
    raise FileNotFoundError(f"Logo not found at {logo_path}")

c = canvas.Canvas(output_pdf, pagesize=A4)
width, height = A4

TOTAL_PAGES = 6

for page_num in range(1, TOTAL_PAGES + 1):
    # ---------------------------------------------------------------------
    # 1. Fondo arena claro
    # ---------------------------------------------------------------------
    c.setFillColor(HexColor('#F9F6F0'))
    c.rect(0, 0, width, height, stroke=0, fill=1)

    # ---------------------------------------------------------------------
    # 2. Marca de agua (logo entrelazado) con opacidad 9%
    # ---------------------------------------------------------------------
    logo_w = 120  # tamaño del watermark
    logo_h = 120
    c.saveState()
    c.setFillAlpha(0.09)
    c.drawImage(logo_path, (width - logo_w) / 2, (height - logo_h) / 2, width=logo_w, height=logo_h, mask='auto')
    c.restoreState()

    # ---------------------------------------------------------------------
    # 3. Bloque unificado de firma (anagrama + nombre)
    # ---------------------------------------------------------------------
    # Tamaño del logo dentro del bloque de firma
    sig_logo_w = 40
    sig_logo_h = 40
    name_text = 'Alberto López'  # con tilde obligatoria
    name_font = 'Times-Bold'  # fuente serif premium simulada
    name_size = 14 if page_num == 1 else 12
    name_color = HexColor('#2B2D2F')

    if page_num == 1:
        # Portada: bloque centrado horizontalmente en la parte inferior, 20% mayor que interior
        sig_logo_w = int(sig_logo_w * 1.2)
        sig_logo_h = int(sig_logo_h * 1.2)
        sig_x = (width - sig_logo_w) / 2
        sig_y = 30 * mm
        c.drawImage(logo_path, sig_x, sig_y, width=sig_logo_w, height=sig_logo_h, mask='auto')
        # Nombre debajo del logo
        c.setFillColor(name_color)
        c.setFont(name_font, name_size)
        text_width = c.stringWidth(name_text, name_font, name_size)
        c.drawString((width - text_width) / 2, sig_y - 12, name_text)
    else:
        # Interiores: bloque en esquina inferior izquierda
        sig_x = 20 * mm
        sig_y = 30 * mm
        c.drawImage(logo_path, sig_x, sig_y, width=sig_logo_w, height=sig_logo_h, mask='auto')
        c.setFillColor(name_color)
        c.setFont(name_font, name_size)
        c.drawString(sig_x, sig_y - 12, name_text)

        # -----------------------------------------------------------------
        # 4. Paginación en esquina inferior derecha con línea divisor sage
        # -----------------------------------------------------------------
        pag_text = f"{page_num} / {TOTAL_PAGES}"  # ejemplo: "2 / 6"
        pag_font = 'Times-Roman'
        pag_size = 10
        pag_color = HexColor('#7A8B7B')
        c.setFillColor(pag_color)
        c.setFont(pag_font, pag_size)
        pag_width = c.stringWidth(pag_text, pag_font, pag_size)
        pag_x = width - 20 * mm - pag_width
        pag_y = 30 * mm
        c.drawString(pag_x, pag_y, pag_text)

        # Línea divisoria entre firma y paginación (sage)
        line_y = sig_y + sig_logo_h + 5 * mm
        c.setStrokeColor(pag_color)
        c.setLineWidth(0.5)
        c.line(sig_x, line_y, width - 20 * mm, line_y)

    # ---------------------------------------------------------------------
    # 5. Contenido de la diapositiva (placeholder – el diseñador rellenará)
    # ---------------------------------------------------------------------
    # Se deja espacio libre para textos, imágenes, etc. No se añaden ahora.

    c.showPage()

c.save()
print(f"PDF generado en {output_pdf}")
