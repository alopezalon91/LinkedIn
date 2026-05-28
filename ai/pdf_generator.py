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
    # Fondo con Gradiente Elegante
    # ----------------------------------------------------
    steps = 80
    rect_h = height / steps
    
    if is_cover:
        # De un Navy nocturno muy oscuro a un Azul Navy medio-brillante
        c1, c2 = (5, 10, 16), (30, 56, 81) # #050a10 to #1e3851
    else:
        # De blanco puro a un gris azulado sutil pero claramente visible
        c1, c2 = (255, 255, 255), (218, 227, 236) # pure white to #dae3ec
        
    for i in range(steps):
        ratio = i / float(steps)
        r = c1[0] + (c2[0] - c1[0]) * ratio
        g = c1[1] + (c2[1] - c1[1]) * ratio
        b = c1[2] + (c2[2] - c1[2]) * ratio
        c.setFillColor(Color(r/255.0, g/255.0, b/255.0))
        # Se dibuja desde arriba hacia abajo invirtiendo el índice
        c.rect(0, height - (i + 1) * rect_h, width, rect_h + 1.5, fill=True, stroke=False)
    
    # ----------------------------------------------------
    # Geometría Identidad Elegante
    # ----------------------------------------------------
    if is_cover:
        # Detalles luminosos sutiles
        c.setFillColor(HexColor('#0b141d')) # Un azul marino ligerísimamente más claro
        c.circle(width - 100, height - 100, 400, fill=True, stroke=False)
        
        # Barra de acento fina Gold en la izquierda
        c.setFillColor(ACCENT_GOLD)
        c.rect(0, 0, 10, height, fill=True, stroke=False)
    else:
        # Contenido: minimalismo puro.
        # Barra lateral finísima Navy para anclar visualmente
        c.setFillColor(ACCENT_DEEP_NAVY)
        c.rect(0, 0, 6, height, fill=True, stroke=False)
        
        # Número de diapositiva (Círculo sutil superior derecha)
        c.setFillColor(HexColor('#f8f9fa')) # Gris extra claro
        c.circle(width - 100, height - 100, 35, fill=True, stroke=False)
        c.setFillColor(ACCENT_GOLD)
        c.setFont("Times-Roman", 32)
        c.drawCentredString(width - 100, height - 110, str(current_slide))

    # ----------------------------------------------------
    # Footer (Logo Variante A · Marco rectangular + Monograma entrelazado)
    # ----------------------------------------------------
    text_color = TEXT_LIGHT if is_cover else TEXT_DARK
    ivory = HexColor('#f5f0e8') if is_cover else HexColor('#1a2a3a')

    logo_x = 60   # margen izquierdo
    logo_y = 40   # altura base desde el fondo
    box_w  = 115  # ancho marco — más grande para dar presencia
    box_h  = 110  # alto marco

    # Marco rectangular fino dorado (sello boutique)
    c.setLineWidth(0.9)
    c.setStrokeColor(ACCENT_GOLD)
    c.rect(logo_x, logo_y, box_w, box_h, fill=False, stroke=True)

    # A enorme en dorado serif — ocupa casi todo el marco
    c.setFillColor(ACCENT_GOLD)
    c.setFont("Times-Roman", 100)
    c.drawString(logo_x + 6, logo_y + 8, "A")

    # L en ivory serif — grande, superpuesta sobre la pata derecha de la A (solapado dramático)
    c.setFillColor(ivory)
    c.setFont("Times-Roman", 82)
    c.drawString(logo_x + 52, logo_y + 18, "L")

    # Línea horizontal fina dorada bajo el marco
    c.setFillColor(ACCENT_GOLD)
    c.rect(logo_x, logo_y - 4, box_w, 0.8, fill=True, stroke=False)

    # Nombre "Alberto López" centrado bajo la línea
    c.setFillColor(text_color)
    c.setFont("Times-Roman", 22)
    name_text = "Alberto López"
    name_w = c.stringWidth(name_text, "Times-Roman", 22)
    c.drawString(logo_x + (box_w - name_w) / 2, logo_y - 22, name_text)

    # ----------------------------------------------------
    # Footer Derecho (Botón circular elegante)
    # ----------------------------------------------------
    if current_slide < total_slides:
        cx = width - 100
        cy = logo_y + box_h // 2

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
        
        text_color = TEXT_LIGHT if is_cover else TEXT_DARK
        muted_color = MUTED_LIGHT if is_cover else MUTED_DARK
        
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
                textColor=text_color,
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
