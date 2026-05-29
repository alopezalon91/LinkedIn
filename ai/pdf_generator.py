import io
import base64
import emoji
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.pagesizes import landscape, portrait
from reportlab.platypus import Paragraph, ListFlowable, ListItem, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Brand Colors (Modern & Elegant Identity)
BG_DARK = HexColor('#080e14')       # Very Dark Navy (Almost black)
BG_LIGHT = HexColor('#ffffff')      # Pure White (Content)
ACCENT_GOLD = HexColor('#b39562')   # Elegant Muted Gold/Bronze
ACCENT_DEEP_NAVY = HexColor('#172a3a') # Deep Professional Navy

TEXT_DARK = HexColor('#1a1a1a')     # Dark text for light bg
TEXT_LIGHT = HexColor('#ffffff')    # White text for dark bg
MUTED_DARK = HexColor('#888888')    # Muted grey for light bg
MUTED_LIGHT = HexColor('#a0b2b8')   # Muted grey for dark bg

def strip_emojis(text: str) -> str:
    """Elimina emojis para evitar que reportlab se rompa con fuentes estándar."""
    if not text: return ""
    return emoji.replace_emoji(text, replace='')

def draw_slide_background(c, width, height, current_slide, total_slides, is_cover=False):
    """Dibuja el fondo y la geometría minimalista digital."""
    # ----------------------------------------------------
    # Fondo Minimal 3 Esquinado
    # ----------------------------------------------------
    import os
    bg_filename = 'bg_carousel_corner.png'
    bg_path = os.path.join(os.path.dirname(__file__), '..', 'assets', bg_filename)
    
    if os.path.exists(bg_path):
        c.drawImage(bg_path, 0, 0, width=width, height=height, preserveAspectRatio=False)
    else:
        # Fallback dark navy
        c.setFillColor(HexColor('#080e14'))
        c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # ----------------------------------------------------
    # Footer (Línea dorada + Logo + Numeración)
    # ----------------------------------------------------
    footer_y = 140
    
    # Línea dorada separadora
    c.setFillColor(ACCENT_GOLD)
    c.rect(80, footer_y, width - 160, 3, fill=True, stroke=False)
    
    # Logo abajo a la izquierda
    logo_filename = 'logo_cover.png'
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', logo_filename)

    if os.path.exists(logo_path):
        logo_w = 200
        logo_h = 60
        # Dibujar logo justo debajo de la línea dorada
        c.drawImage(logo_path, 80, footer_y - logo_h - 30, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')

    # Número de diapositiva abajo a la derecha
    if not is_cover:
        c.setFillColor(HexColor('#ffffff'))
        c.setFont("Times-Roman", 28)
        c.drawRightString(width - 80, footer_y - 65, f"{current_slide} / {total_slides}")

def create_carousel_pdf(slides: list[dict]) -> str:
    """
    Genera un PDF de carrusel 1080x1080 con identidad corporativa digital.
    Acepta un listado de diccionarios: [{'pre_title', 'title', 'subtitle', 'bullets'}]
    """
    if not slides:
        slides = [{"pre_title": "INFO", "title": "Sin contenido", "subtitle": "", "bullets": []}]

    buffer = io.BytesIO()
    width, height = (1080, 1080)
    c = canvas.Canvas(buffer, pagesize=(width, height))
    
    total_slides = len(slides)
    
    for i, slide in enumerate(slides):
        is_cover = (i == 0)
        draw_slide_background(c, width, height, i + 1, total_slides, is_cover)
        
        pre_title = strip_emojis(slide.get("pre_title", ""))
        title = strip_emojis(slide.get("title", ""))
        subtitle = strip_emojis(slide.get("subtitle", ""))
        bullets = [strip_emojis(b) for b in slide.get("bullets", [])]
        
        # Calcular altura total del contenido para centrarlo verticalmente
        total_content_height = 0
        
        if pre_title:
            total_content_height += 100 # Espacio aprox de la píldora
        
        title_p = None
        if title:
            t_style = ParagraphStyle(
                name='Title',
                fontName='Times-Roman' if is_cover else 'Helvetica-Bold',
                fontSize=80 if is_cover else 65,
                leading=95 if is_cover else 80,
                textColor=ACCENT_GOLD,
                alignment=TA_LEFT,
            )
            title_p = Paragraph(title, t_style)
            w, h_title = title_p.wrapOn(c, width - 160, height)
            total_content_height += h_title + 30
            
        st_p = None
        if subtitle:
            st_style = ParagraphStyle(
                name='Subtitle',
                fontName='Helvetica',
                fontSize=35 if is_cover else 30,
                leading=45,
                textColor=TEXT_LIGHT,
                alignment=TA_LEFT,
            )
            st_p = Paragraph(subtitle, st_style)
            w, h_st = st_p.wrapOn(c, width - 160, height)
            total_content_height += h_st + 40
            
        bullets_f = None
        if bullets:
            b_style = ParagraphStyle(
                name='Bullet',
                fontName='Helvetica',
                fontSize=30,
                leading=45,
                textColor=MUTED_LIGHT,
                alignment=TA_LEFT,
            )
            list_items = [ListItem(Paragraph(b, b_style), leftIndent=35, bulletColor=ACCENT_GOLD) for b in bullets]
            bullets_f = ListFlowable(list_items, bulletType='bullet', bulletFontName='Helvetica', bulletFontSize=30, bulletOffsetY=0)
            w, h_bull = bullets_f.wrapOn(c, width - 160, height)
            total_content_height += h_bull + 20
            
        # Calcular y_pos inicial para que el bloque quede centrado entre y=1080 y y=140
        # Espacio central es 940. Mitad es 470.
        y_pos = 140 + ((1080 - 140) / 2) + (total_content_height / 2)
        
        # Si se pasa por arriba, forzamos un tope
        if y_pos > height - 100:
            y_pos = height - 100

        # 1. Píldora (Badge)
        if pre_title:
            pre_title_upper = pre_title.upper()
            c.setFont("Helvetica-Bold", 30)
            text_width = c.stringWidth(pre_title_upper, "Helvetica-Bold", 30)
            pill_width = text_width + 60
            
            c.setFillColor(ACCENT_GOLD)
            c.roundRect(80, y_pos - 50, pill_width, 50, 25, fill=True, stroke=False)
            
            c.setFillColor(HexColor('#080e14'))
            c.drawString(80 + 30, y_pos - 36, pre_title_upper)
            y_pos -= 100

        # 2. Título Principal
        if title_p:
            title_p.drawOn(c, 80, y_pos - h_title)
            y_pos -= (h_title + 30)
            
        # 3. Subtítulo
        if st_p:
            st_p.drawOn(c, 80, y_pos - h_st)
            y_pos -= (h_st + 40)

        # 4. Bullets
        if bullets_f:
            bullets_f.drawOn(c, 80, y_pos - h_bull)
            y_pos -= (h_bull + 20)

        c.showPage()
        
    c.save()
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')
