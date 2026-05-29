import io
import os
import base64
import emoji
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, portrait
from reportlab.platypus import Paragraph, ListFlowable, ListItem, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# Brand Colors
BG_DARK = HexColor('#080e14')
ACCENT_GOLD = HexColor('#b39562')
TEXT_LIGHT = HexColor('#ffffff')
MUTED_LIGHT = HexColor('#cccccc')

def strip_emojis(text: str) -> str:
    if not text: return ""
    return emoji.replace_emoji(text, replace='')

def draw_clean_background(c, width, height, current_slide, total_slides, is_cover=False):
    # 1. Fondo original (textura + figuras)
    bg_filename = 'bg_carousel.png'
    bg_path = os.path.join(os.path.dirname(__file__), '..', 'assets', bg_filename)
    if os.path.exists(bg_path):
        c.drawImage(bg_path, 0, 0, width=width, height=height, preserveAspectRatio=False)
    else:
        c.setFillColor(BG_DARK)
        c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # 2. Marca de agua (Solo monograma)
    wm_filename = 'logo_watermark_final.png'
    wm_path = os.path.join(os.path.dirname(__file__), '..', 'assets', wm_filename)
    if os.path.exists(wm_path):
        wm_w = 600
        wm_h = 600
        # Centrado en la diapositiva
        c.drawImage(wm_path, (width - wm_w)/2, (height - wm_h)/2, width=wm_w, height=wm_h, mask='auto', preserveAspectRatio=True)

    # 3. Footer Logo
    # Si es portada, quizás el logo va centrado abajo, o lo dejamos igual. El usuario dijo: 
    # "todo debería estar más centrado y dispuesto de otra manera" para la portada.
    # Así que para la portada, el logo grande centrado abajo. Para el interior, a la izquierda.
    logo_filename = 'logo_cover_trimmed.png'
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', logo_filename)
    if os.path.exists(logo_path):
        logo_h = 110 # 46% bigger than 75
        try:
            with Image.open(logo_path) as img:
                img_w, img_h = img.size
                logo_w = int(logo_h * (img_w / img_h))
        except:
            logo_w = 330
            
        logo_y = 35
        if is_cover:
            # Centrado
            c.drawImage(logo_path, (width - logo_w)/2, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')
        else:
            # Izquierda
            c.drawImage(logo_path, 80, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')

    # 4. Numeración
    if not is_cover:
        c.setFillColor(MUTED_LIGHT)
        c.setFont("Helvetica", 28)
        c.drawRightString(width - 80, 65, f"{current_slide} / {total_slides}")

def create_carousel_pdf(slides: list[dict]) -> str:
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
        
        spacing = 40
        
        if is_cover:
            # === PORTADA: Diseño Centrado ===
            # Calculamos altura total para centrarlo verticalmente
            total_h = 0
            t_style = ParagraphStyle(
                name='TitleCover', fontName='Helvetica-Bold', fontSize=80,
                leading=95, textColor=TEXT_LIGHT, alignment=TA_CENTER
            )
            st_style = ParagraphStyle(
                name='SubtitleCover', fontName='Helvetica', fontSize=40,
                leading=55, textColor=ACCENT_GOLD, alignment=TA_CENTER
            )
            
            p_title = Paragraph(title, t_style) if title else None
            p_st = Paragraph(subtitle, st_style) if subtitle else None
            
            h_title = h_st = 0
            if p_title:
                w, h_title = p_title.wrapOn(c, width - 160, height)
                total_h += h_title + spacing
            if p_st:
                w, h_st = p_st.wrapOn(c, width - 160, height)
                total_h += h_st + spacing
                
            if pre_title:
                total_h += 60 + spacing
                
            # Restamos el último spacing extra
            if total_h > 0: total_h -= spacing
            
            # Y de inicio
            y_cursor = (height + total_h) / 2
            
            # Dibujar píldora centrada
            if pre_title:
                pre_title_upper = pre_title.upper()
                c.setFont("Helvetica-Bold", 30)
                text_width = c.stringWidth(pre_title_upper, "Helvetica-Bold", 30)
                pill_width = text_width + 60
                
                pill_x = (width - pill_width) / 2
                c.setFillColor(ACCENT_GOLD)
                c.roundRect(pill_x, y_cursor - 60, pill_width, 60, 30, fill=True, stroke=False)
                
                c.setFillColor(BG_DARK)
                c.drawString(pill_x + 30, y_cursor - 42, pre_title_upper)
                y_cursor -= (60 + spacing)
                
            if p_title:
                p_title.drawOn(c, 80, y_cursor - h_title)
                y_cursor -= (h_title + spacing)
                
            if p_st:
                p_st.drawOn(c, 80, y_cursor - h_st)
                y_cursor -= (h_st + spacing)

        else:
            # === INTERIOR: Alineado a la izquierda, posición fija superior ===
            y_cursor = height - 120
            
            if pre_title:
                pre_title_upper = pre_title.upper()
                c.setFont("Helvetica-Bold", 30)
                text_width = c.stringWidth(pre_title_upper, "Helvetica-Bold", 30)
                pill_width = text_width + 60
                
                c.setFillColor(ACCENT_GOLD)
                c.roundRect(80, y_cursor - 60, pill_width, 60, 30, fill=True, stroke=False)
                
                c.setFillColor(BG_DARK)
                c.drawString(80 + 30, y_cursor - 42, pre_title_upper)
                y_cursor -= (60 + spacing)
                
            if title:
                t_style = ParagraphStyle(
                    name='Title', fontName='Helvetica-Bold', fontSize=62,
                    leading=75, textColor=TEXT_LIGHT, alignment=TA_LEFT
                )
                title_p = Paragraph(title, t_style)
                w, h_title = title_p.wrapOn(c, width - 160, height)
                title_p.drawOn(c, 80, y_cursor - h_title)
                y_cursor -= (h_title + spacing)
                
            if subtitle:
                st_style = ParagraphStyle(
                    name='Subtitle', fontName='Helvetica', fontSize=32,
                    leading=45, textColor=ACCENT_GOLD, alignment=TA_LEFT
                )
                st_p = Paragraph(subtitle, st_style)
                w, h_st = st_p.wrapOn(c, width - 160, height)
                st_p.drawOn(c, 80, y_cursor - h_st)
                y_cursor -= (h_st + spacing)
                
            if bullets:
                b_style = ParagraphStyle(
                    name='Bullet', fontName='Helvetica', fontSize=32,
                    leading=45, textColor=MUTED_LIGHT, alignment=TA_LEFT, spaceAfter=15
                )
                list_items = []
                for b in bullets:
                    item = ListItem(Paragraph(b, b_style), leftIndent=40, bulletColor=ACCENT_GOLD, bulletType='bullet', bulletFontName='Helvetica', bulletFontSize=32)
                    item.bulletText = '—'
                    list_items.append(item)
                    
                bullets_f = ListFlowable(list_items, bulletType='bullet', bulletFontName='Helvetica', bulletFontSize=32, bulletOffsetY=0)
                w, h_bull = bullets_f.wrapOn(c, width - 160, height)
                bullets_f.drawOn(c, 80, y_cursor - h_bull)

        c.showPage()
        
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')
