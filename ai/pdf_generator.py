import json
import os
import io
import textwrap
import emoji
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image

# ---------------------------------------------------------
# NEW DESIGN SYSTEM (Minimalist, Accessible, Professional)
# ---------------------------------------------------------

# Palette
BG_COLOR = HexColor('#F9F6F0')     # Alabastro / Arena Claro
TEXT_MAIN = HexColor('#2B2D2F')    # Gris Grafito Oscuro (Titulos y Texto)
ACCENT_PRIMARY = HexColor('#C2593F') # Terracota Mate (Pastillas/Alertas)
ACCENT_SECONDARY = HexColor('#7A8B7B') # Verde Sage / Sabio (Subtítulos, Iconos, Líneas)
WHITE = HexColor('#FFFFFF')

# Geometry & Margins
WIDTH = 1080
HEIGHT = 1080
MARGIN = 108 # 10% margin on all sides
DRAW_WIDTH = WIDTH - (MARGIN * 2)

# Helper function
def strip_emojis(text: str) -> str:
    return emoji.replace_emoji(text, replace='')

def draw_background(c, current_slide, total_slides, is_cover=False):
    # 1. Fondo sólido Alabastro
    c.setFillColor(BG_COLOR)
    c.rect(0, 0, WIDTH, HEIGHT, fill=True, stroke=False)
    
    # 2. Marca de agua
    wm_filename = 'logo_watermark_rebrand.png'
    wm_path = os.path.join(os.path.dirname(__file__), '..', 'assets', wm_filename)
    if os.path.exists(wm_path):
        wm_w = 600
        wm_h = 600
        # Centered optically in the content area (above footer)
        # Footer line is at y=150. Space is 150 to 1080. Center is 615.
        c.drawImage(wm_path, (WIDTH - wm_w)/2, 315, width=wm_w, height=wm_h, mask='auto', preserveAspectRatio=True)

    # 3. Footer Logo
    logo_filename = 'logo_rebrand.png'
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', logo_filename)
    
    logo_y = MARGIN / 2  # Around 54
    logo_h = 90
    if os.path.exists(logo_path):
        try:
            with Image.open(logo_path) as img:
                img_w, img_h = img.size
                logo_w = int(logo_h * (img_w / img_h))
        except:
            logo_w = 270
            
        if is_cover:
            # Centered at bottom
            c.drawImage(logo_path, (WIDTH - logo_w)/2, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')
        else:
            # Left aligned at footer
            c.drawImage(logo_path, MARGIN, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')

    # Línea separadora Verde Sage
    c.setFillColor(ACCENT_SECONDARY)
    # The line separates the footer area (y=150)
    c.rect(MARGIN, 150, DRAW_WIDTH, 2, fill=True, stroke=False)

    # 4. Numeración
    if not is_cover:
        c.setFillColor(ACCENT_SECONDARY)
        c.setFont("Helvetica", 24)
        c.drawRightString(WIDTH - MARGIN, logo_y + 30, f"{current_slide} / {total_slides} →")

def create_carousel_pdf(slides: list[dict]) -> str:
    if not slides:
        slides = [{"pre_title": "INFO", "title": "Sin contenido", "subtitle": "", "bullets": []}]

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(WIDTH, HEIGHT))
    total_slides = len(slides)
    
    for i, slide in enumerate(slides):
        is_cover = (i == 0)
        draw_background(c, i + 1, total_slides, is_cover)
        
        pre_title = strip_emojis(slide.get("pre_title", ""))
        title = strip_emojis(slide.get("title", ""))
        subtitle = strip_emojis(slide.get("subtitle", ""))
        bullets = [strip_emojis(b) for b in slide.get("bullets", [])]
        
        spacing = 40
        
        if is_cover:
            # === PORTADA: Diseño Centrado ===
            total_h = 0
            t_style = ParagraphStyle(
                name='TitleCover', fontName='Helvetica-Bold', fontSize=80,
                leading=95, textColor=TEXT_MAIN, alignment=TA_CENTER
            )
            st_style = ParagraphStyle(
                name='SubtitleCover', fontName='Helvetica', fontSize=40,
                leading=55, textColor=ACCENT_SECONDARY, alignment=TA_CENTER
            )
            
            p_title = Paragraph(title, t_style) if title else None
            p_st = Paragraph(subtitle, st_style) if subtitle else None
            
            h_title = h_st = 0
            if p_title:
                w, h_title = p_title.wrapOn(c, DRAW_WIDTH, HEIGHT)
                total_h += h_title + spacing
            if p_st:
                w, h_st = p_st.wrapOn(c, DRAW_WIDTH, HEIGHT)
                total_h += h_st + spacing
                
            if pre_title:
                total_h += 60 + spacing
                
            if total_h > 0: total_h -= spacing
            
            # Y start
            y_cursor = ((HEIGHT + total_h) / 2) + 80
            
            # Dibujar píldora centrada
            if pre_title:
                c.setFont("Helvetica-Bold", 30)
                text_width = c.stringWidth(pre_title, "Helvetica-Bold", 30)
                pill_width = text_width + 80
                pill_x = (WIDTH - pill_width) / 2
                
                c.setFillColor(ACCENT_PRIMARY)
                c.roundRect(pill_x, y_cursor - 60, pill_width, 60, 30, fill=True, stroke=False)
                c.setFillColor(WHITE)
                c.drawCentredString(WIDTH / 2, y_cursor - 42, pre_title)
                y_cursor -= (60 + spacing)
                
            if p_title:
                p_title.drawOn(c, MARGIN, y_cursor - h_title)
                y_cursor -= (h_title + spacing)
                
            if p_st:
                p_st.drawOn(c, MARGIN, y_cursor - h_st)
                
        else:
            # === INTERIOR ===
            y_cursor = HEIGHT - MARGIN
            
            # Píldora
            if pre_title:
                c.setFont("Helvetica-Bold", 26)
                text_width = c.stringWidth(pre_title, "Helvetica-Bold", 26)
                pill_width = text_width + 60
                
                c.setFillColor(ACCENT_PRIMARY)
                c.roundRect(MARGIN, y_cursor - 50, pill_width, 50, 25, fill=True, stroke=False)
                c.setFillColor(WHITE)
                c.drawString(MARGIN + 30, y_cursor - 35, pre_title)
                y_cursor -= (50 + 40)
            
            # Título
            if title:
                t_style = ParagraphStyle(
                    name='TitleInner', fontName='Helvetica-Bold', fontSize=60,
                    leading=70, textColor=TEXT_MAIN, alignment=TA_LEFT
                )
                p_title = Paragraph(title, t_style)
                w, h = p_title.wrapOn(c, DRAW_WIDTH, HEIGHT)
                p_title.drawOn(c, MARGIN, y_cursor - h)
                y_cursor -= (h + 30)
                
            # Subtítulo
            if subtitle:
                st_style = ParagraphStyle(
                    name='SubtitleInner', fontName='Helvetica', fontSize=36,
                    leading=46, textColor=ACCENT_SECONDARY, alignment=TA_LEFT
                )
                p_st = Paragraph(subtitle, st_style)
                w, h = p_st.wrapOn(c, DRAW_WIDTH, HEIGHT)
                p_st.drawOn(c, MARGIN, y_cursor - h)
                y_cursor -= (h + 60)
                
            # Bullets
            if bullets:
                b_style = ParagraphStyle(
                    name='BulletInner', fontName='Helvetica-Bold', fontSize=32,
                    leading=45, textColor=TEXT_MAIN, alignment=TA_LEFT
                )
                
                for b in bullets:
                    bullet_text = f"•  {b}"
                    p_b = Paragraph(bullet_text, b_style)
                    w, h = p_b.wrapOn(c, DRAW_WIDTH - 20, HEIGHT)
                    p_b.drawOn(c, MARGIN + 20, y_cursor - h)
                    y_cursor -= (h + 40)
                    
        c.showPage()
        
    c.save()
    pdf_bytes = buffer.getvalue()
    import base64
    b64_str = base64.b64encode(pdf_bytes).decode('utf-8')
    return b64_str
