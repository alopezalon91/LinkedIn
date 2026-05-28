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
    # ----------------------------------------------------
    # Fondo Minimal 3 (Generado por IA, Recoloreado)
    # ----------------------------------------------------
    import os
    bg_filename = 'bg_carousel.png'
    bg_path = os.path.join(os.path.dirname(__file__), '..', 'assets', bg_filename)
    
    if os.path.exists(bg_path):
        c.drawImage(bg_path, 0, 0, width=width, height=height, preserveAspectRatio=False)
    else:
        # Fallback dark navy
        c.setFillColor(HexColor('#050a10'))
        c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # Sin geometría programada (ya viene en la imagen)
    
    if not is_cover:
        # Número de diapositiva (Círculo sutil superior derecha)
        c.setFillColor(HexColor('#0b141d'))
        c.circle(width - 100, height - 100, 35, fill=True, stroke=False)
        c.setFillColor(ACCENT_GOLD)
        c.setFont("Times-Roman", 32)
        c.drawCentredString(width - 100, height - 110, str(current_slide))

    # ----------------------------------------------------
    # Footer (Logo Variante A · Marco rectangular + Monograma entrelazado)
    # ----------------------------------------------------
    import os
    logo_filename = 'logo_cover.png'
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', logo_filename)

    box_x = 50
    box_y = 40
    box_w = 160
    box_h = 160

    if os.path.exists(logo_path):
        # Insertar la imagen exacta original, manteniendo proporciones
        c.drawImage(logo_path, box_x, box_y, width=box_w, height=box_h, mask='auto', preserveAspectRatio=True, anchor='sw')
    else:
        # Fallback temporal
        c.setLineWidth(1.0)
        c.setStrokeColor(ACCENT_GOLD)
        c.rect(box_x, box_y, box_w, box_h, fill=False, stroke=True)

    # ----------------------------------------------------
    # Footer Derecho (Botón circular elegante)
    # ----------------------------------------------------
    if current_slide < total_slides:
        cx = width - 100
        cy = box_y + box_h // 2

        # Anillo exterior
        c.setStrokeColor(ACCENT_GOLD)
        c.setLineWidth(0.9)
        c.circle(cx, cy, 24, fill=False, stroke=True)

        # Chevron interno (>)
        c.setStrokeColor(ACCENT_GOLD)
        c.setLineWidth(1.8)
        c.line(cx - 5, cy + 9, cx + 6, cy)
        c.line(cx + 6, cy, cx - 5, cy - 9)

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
        
        y_pos = height - 300 if is_cover else height - 300
        
        text_color = TEXT_LIGHT
        muted_color = MUTED_LIGHT
        
        # 1. Píldora (Badge) - En la portada, o también en contenido
        if pre_title:
            pre_title_upper = pre_title.upper()
            c.setFont("Helvetica-Bold", 30)
            text_width = c.stringWidth(pre_title_upper, "Helvetica-Bold", 30)
            pill_width = text_width + 60
            
            c.setFillColor(ACCENT_GOLD)
            c.roundRect(80, y_pos + 40, pill_width, 50, 25, fill=True, stroke=False)
            
            c.setFillColor(HexColor('#080e14')) # Dark text for gold background
            c.drawString(80 + 30, y_pos + 54, pre_title_upper)

        # 2. Título Principal
        if title:
            # En contenido, ponemos una rayita Gold vertical para anclar el titulo
            if not is_cover:
                c.setFillColor(ACCENT_GOLD)
                c.rect(60, y_pos - 100, 3, 120, fill=True, stroke=False)
                
            t_style = ParagraphStyle(
                name='Title',
                fontName='Times-Roman' if is_cover else 'Helvetica-Bold',
                fontSize=85 if is_cover else 70,
                leading=105 if is_cover else 90,
                textColor=ACCENT_GOLD,
                alignment=TA_LEFT,
            )
            p = Paragraph(title, t_style)
            w, h = p.wrapOn(c, width - 200, height)
            p.drawOn(c, 80, y_pos - h)
            y_pos -= (h + 30)
            
        # 3. Subtítulo (Fecha o Referencia)
        if subtitle:
            st_style = ParagraphStyle(
                name='Subtitle',
                fontName='Helvetica',
                fontSize=40 if is_cover else 35,
                leading=50,
                textColor=muted_color,
                alignment=TA_LEFT,
            )
            p = Paragraph(subtitle, st_style)
            w, h = p.wrapOn(c, width - 200, height)
            p.drawOn(c, 80, y_pos - h)
            y_pos -= (h + 60)

        # 4. Bullets (Lista con viñetas)
        if bullets and not is_cover:
            list_items = []
            bullet_style = ParagraphStyle(
                name='BulletStyle',
                fontName='Helvetica',
                fontSize=38,
                leading=55,
                textColor=text_color,
                alignment=TA_LEFT,
            )
            
            for bullet_text in bullets:
                # Custom bullet: un guión Gold o punto sutil
                bullet_char = Paragraph("<font color='#b39562'>—</font>", bullet_style)
                item = ListItem(Paragraph(bullet_text, bullet_style), bulletColor=ACCENT_GOLD, bulletType='bullet')
                list_items.append(item)
                
            lf = ListFlowable(
                list_items,
                bulletType='bullet',
                start=None,
                bulletFontSize=40,
                bulletOffsetY=-5,
                leftIndent=40,
                spaceBefore=0,
                spaceAfter=40
            )
            
            # Frame para dibujar flowables correctamente en Platypus
            frame_height = y_pos - 150
            if frame_height > 0:
                f = Frame(80, 150, width - 160, frame_height, showBoundary=0, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
                f.addFromList([lf], c)

        c.showPage()
        
    c.save()
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')
