import io
import os
import base64
import emoji
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, portrait
from reportlab.platypus import Paragraph, ListFlowable, ListItem, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

# Brand Colors (Modern & Elegant Identity)
BG_DARK = HexColor('#080e14')       # Very Dark Navy (Almost black)
ACCENT_GOLD = HexColor('#b39562')   # Elegant Muted Gold/Bronze
TEXT_LIGHT = HexColor('#ffffff')    # White text for dark bg
MUTED_LIGHT = HexColor('#a0b2b8')   # Muted grey for dark bg

def strip_emojis(text: str) -> str:
    """Elimina emojis para evitar que reportlab se rompa con fuentes estándar."""
    if not text: return ""
    return emoji.replace_emoji(text, replace='')

def draw_clean_background(c, width, height, current_slide, total_slides, is_cover=False):
    """Fondo ultra limpio, sin pngs molestos, estructurado y alineado."""
    # 1. Fondo sólido azul marino oscuro
    c.setFillColor(BG_DARK)
    c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # 2. Footer
    footer_y = 160
    
    # Línea dorada separadora (limpia y fina)
    c.setFillColor(ACCENT_GOLD)
    c.rect(80, footer_y, width - 160, 2, fill=True, stroke=False)
    
    # Logo abajo a la izquierda (MUY GRANDE)
    logo_filename = 'logo_cover.png'
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', logo_filename)

    if os.path.exists(logo_path):
        # Aumentamos el ancho a 450px (casi el 45% del ancho total del slide)
        logo_w = 450
        logo_h = 135
        # Centrado verticalmente dentro del footer
        logo_y = (footer_y - logo_h) / 2
        c.drawImage(logo_path, 80, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')

    # Número de diapositiva abajo a la derecha
    if not is_cover:
        c.setFillColor(MUTED_LIGHT)
        c.setFont("Helvetica-Bold", 35)
        # Alineado con la línea dorada a la derecha
        c.drawRightString(width - 80, (footer_y - 35) / 2 + 10, f"{current_slide} / {total_slides}")

def create_carousel_pdf(slides: list[dict]) -> str:
    """
    Genera un PDF de carrusel 1080x1080 hiper limpio y ordenado.
    """
    if not slides:
        slides = [{"pre_title": "INFO", "title": "Sin contenido", "subtitle": "", "bullets": []}]

    buffer = io.BytesIO()
    width, height = (1080, 1080)
    c = canvas.Canvas(buffer, pagesize=(width, height))
    
    total_slides = len(slides)
    
    for i, slide in enumerate(slides):
        is_cover = (i == 0)
        draw_clean_background(c, width, height, i + 1, total_slides, is_cover)
        
        pre_title = strip_emojis(slide.get("pre_title", ""))
        title = strip_emojis(slide.get("title", ""))
        subtitle = strip_emojis(slide.get("subtitle", ""))
        bullets = [strip_emojis(b) for b in slide.get("bullets", [])]
        
        # === CALCULAR ALTURAS (Para alinear todo de forma estructurada) ===
        content_items = []
        total_height = 0
        spacing = 40  # Espacio consistente entre elementos
        
        if pre_title:
            total_height += 70 + spacing  # 70 es la altura de la píldora
            
        if title:
            t_style = ParagraphStyle(
                name='Title',
                fontName='Helvetica-Bold', # Todo en sans-serif moderna
                fontSize=80 if is_cover else 70,
                leading=95 if is_cover else 85,
                textColor=TEXT_LIGHT, # Titulo principal en blanco para que destaque limpio
                alignment=TA_LEFT,
            )
            title_p = Paragraph(title, t_style)
            w, h_title = title_p.wrapOn(c, width - 160, height)
            content_items.append(('title', title_p, h_title))
            total_height += h_title + spacing
            
        if subtitle:
            st_style = ParagraphStyle(
                name='Subtitle',
                fontName='Helvetica',
                fontSize=40 if is_cover else 35,
                leading=55,
                textColor=ACCENT_GOLD, # Subtítulo en dorado
                alignment=TA_LEFT,
            )
            st_p = Paragraph(subtitle, st_style)
            w, h_st = st_p.wrapOn(c, width - 160, height)
            content_items.append(('subtitle', st_p, h_st))
            total_height += h_st + spacing
            
        if bullets:
            b_style = ParagraphStyle(
                name='Bullet',
                fontName='Helvetica',
                fontSize=38,
                leading=55,
                textColor=MUTED_LIGHT,
                alignment=TA_LEFT,
            )
            # Viñetas minimalistas: un pequeño cuadrado dorado
            bullet_char = "<font color='#b39562'>■</font>"
            list_items = [ListItem(Paragraph(b, b_style), leftIndent=50, bulletColor=ACCENT_GOLD, bulletType='bullet') for b in bullets]
            # Usamos custom bullet pero reportlab ya lo soporta. Mejor usar el string directamente en el Paragraph o el param de ListItem.
            # Lo más limpio es el bulletColor.
            bullets_f = ListFlowable(list_items, bulletType='bullet', bulletFontName='Helvetica', bulletFontSize=38, bulletOffsetY=-5)
            w, h_bull = bullets_f.wrapOn(c, width - 160, height)
            content_items.append(('bullets', bullets_f, h_bull))
            total_height += h_bull + spacing
            
        # === DIBUJAR TODO ALINEADO ===
        # Restamos el último spacing
        total_height -= spacing
        
        # Centrado perfecto en el espacio superior al footer (y=160 a y=1080)
        usable_height = height - 160
        y_cursor = 160 + (usable_height / 2) + (total_height / 2)
        
        # 1. Píldora (Badge)
        if pre_title:
            pre_title_upper = pre_title.upper()
            c.setFont("Helvetica-Bold", 32)
            text_width = c.stringWidth(pre_title_upper, "Helvetica-Bold", 32)
            pill_width = text_width + 80
            
            c.setFillColor(ACCENT_GOLD)
            c.roundRect(80, y_cursor - 70, pill_width, 70, 35, fill=True, stroke=False)
            
            c.setFillColor(BG_DARK)
            # Centrar el texto vertical y horizontalmente en la píldora
            c.drawString(80 + 40, y_cursor - 48, pre_title_upper)
            
            y_cursor -= (70 + spacing)

        # 2. Resto de elementos
        for item_type, flowable, h in content_items:
            flowable.drawOn(c, 80, y_cursor - h)
            y_cursor -= (h + spacing)

        c.showPage()
        
    c.save()
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')
