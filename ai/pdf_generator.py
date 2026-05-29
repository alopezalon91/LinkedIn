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
from reportlab.lib.enums import TA_LEFT

# Brand Colors
BG_DARK = HexColor('#080e14')
ACCENT_GOLD = HexColor('#b39562')
TEXT_LIGHT = HexColor('#ffffff')
MUTED_LIGHT = HexColor('#cccccc')

def strip_emojis(text: str) -> str:
    if not text: return ""
    return emoji.replace_emoji(text, replace='')

def draw_clean_background(c, width, height, current_slide, total_slides, is_cover=False):
    # 1. Fondo texturizado original (sin figuras ni rayas)
    bg_filename = 'bg_carousel_texture.png'
    bg_path = os.path.join(os.path.dirname(__file__), '..', 'assets', bg_filename)
    if os.path.exists(bg_path):
        c.drawImage(bg_path, 0, 0, width=width, height=height, preserveAspectRatio=False)
    else:
        c.setFillColor(BG_DARK)
        c.rect(0, 0, width, height, fill=True, stroke=False)
    
    # 2. Marca de agua gigante (Solo el símbolo A L, 15% opacidad) en el centro
    wm_filename = 'logo_watermark_final.png'
    wm_path = os.path.join(os.path.dirname(__file__), '..', 'assets', wm_filename)
    if os.path.exists(wm_path):
        # We know it's 800px wide from the script
        wm_w = 800
        # Calculate aspect ratio dynamically if possible, or just estimate (cover logo is ~3:1)
        # Let's open it to check sizes
        try:
            with Image.open(wm_path) as img:
                img_w, img_h = img.size
                wm_h = int(wm_w * (img_h / img_w))
        except:
            wm_h = 266 # fallback
            
        c.drawImage(wm_path, (width - wm_w)/2, (height - wm_h)/2 + 50, width=wm_w, height=wm_h, mask='auto', preserveAspectRatio=True)

    # 3. Footer (Línea dorada fina)
    footer_y = 150
    c.setFillColor(ACCENT_GOLD)
    c.rect(80, footer_y, width - 160, 2, fill=True, stroke=False)
    
    # 4. Logo alineado PERFECTAMENTE a la izquierda debajo de la línea
    logo_filename = 'logo_cover_trimmed.png'
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'assets', logo_filename)
    if os.path.exists(logo_path):
        try:
            with Image.open(logo_path) as img:
                img_w, img_h = img.size
                logo_h = 75  # 75px de alto para un logo sin márgenes transparentes es ENORME y muy notorio
                logo_w = int(logo_h * (img_w / img_h))
        except:
            logo_h = 75
            logo_w = 225
            
        # Pegado a x=80, centrado verticalmente en el footer de 150px
        logo_y = (150 - logo_h) / 2
        c.drawImage(logo_path, 80, logo_y, width=logo_w, height=logo_h, preserveAspectRatio=True, mask='auto')

    # 5. Numeración de página (Minimalista)
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
        
        # === ANCLAJE SUPERIOR FIJO (COHERENCIA ENTRE SLIDES) ===
        # Siempre empezamos a escribir a 120px del techo.
        y_cursor = height - 120
        spacing = 40
        
        # 1. Píldora (Badge) - Igual que antes pero siempre en la misma coordenada Y
        if pre_title:
            pre_title_upper = pre_title.upper()
            c.setFont("Helvetica-Bold", 30)
            text_width = c.stringWidth(pre_title_upper, "Helvetica-Bold", 30)
            pill_width = text_width + 60
            
            # Dibujamos el rectángulo anclado arriba
            c.setFillColor(ACCENT_GOLD)
            c.roundRect(80, y_cursor - 60, pill_width, 60, 30, fill=True, stroke=False)
            
            # Texto dentro
            c.setFillColor(BG_DARK)
            c.drawString(80 + 30, y_cursor - 42, pre_title_upper)
            
            y_cursor -= (60 + spacing)

        # 2. Título Principal
        if title:
            t_style = ParagraphStyle(
                name='Title',
                fontName='Helvetica-Bold', 
                fontSize=80 if is_cover else 70,
                leading=95 if is_cover else 85,
                textColor=TEXT_LIGHT, 
                alignment=TA_LEFT,
            )
            title_p = Paragraph(title, t_style)
            w, h_title = title_p.wrapOn(c, width - 160, height)
            title_p.drawOn(c, 80, y_cursor - h_title)
            y_cursor -= (h_title + spacing)
            
        # 3. Subtítulo (Más fino y limpio)
        if subtitle:
            st_style = ParagraphStyle(
                name='Subtitle',
                fontName='Helvetica', 
                fontSize=40 if is_cover else 32,
                leading=55 if is_cover else 45,
                textColor=ACCENT_GOLD,
                alignment=TA_LEFT,
            )
            st_p = Paragraph(subtitle, st_style)
            w, h_st = st_p.wrapOn(c, width - 160, height)
            st_p.drawOn(c, 80, y_cursor - h_st)
            y_cursor -= (h_st + spacing)
            
        # 4. Bullets (Rediseñados: sin viñetas gigantes, guiones dorados elegantes)
        if bullets:
            b_style = ParagraphStyle(
                name='Bullet',
                fontName='Helvetica', 
                fontSize=34, # Letra más grande y legible
                leading=50,  # Mucho aire entre líneas
                textColor=MUTED_LIGHT, # Gris muy clarito
                alignment=TA_LEFT,
                spaceAfter=20, # Espacio entre cada bullet point
            )
            
            list_items = []
            for b in bullets:
                # Viñeta ultra-minimalista: Una fina raya horizontal o simplemente texto sangrado.
                # Vamos a usar un simple guión dorado "—"
                item = ListItem(Paragraph(b, b_style), leftIndent=40, bulletColor=ACCENT_GOLD, bulletType='bullet', bulletFontName='Helvetica', bulletFontSize=34)
                # Overriding the default reportlab bullet character is tricky, so we'll just add the dash manually if we use standard strings,
                # BUT reportlab allows bulletText='—'. Let's do that!
                list_items.append(item)
                
            # ReportLab trick for custom bullet strings
            for item in list_items:
                item.bulletText = '—'
                
            bullets_f = ListFlowable(list_items, bulletType='bullet', bulletFontName='Helvetica', bulletFontSize=34, bulletOffsetY=0)
            w, h_bull = bullets_f.wrapOn(c, width - 160, height)
            bullets_f.drawOn(c, 80, y_cursor - h_bull)

        c.showPage()
        
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    return base64.b64encode(pdf_bytes).decode('utf-8')
