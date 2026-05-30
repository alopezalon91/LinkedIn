import os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color

width, height = 1080, 1080
ACCENT_GOLD = HexColor('#b39562')

def _draw_background(c, current_slide=1, total_slides=5, is_cover=False):
    # Fondo con Gradiente Elegante (Oscuro unificado)
    steps = 80
    rect_h = height / steps
    c1, c2 = (5, 10, 16), (30, 56, 81)
        
    for i in range(steps):
        ratio = i / float(steps)
        r = c1[0] + (c2[0] - c1[0]) * ratio
        g = c1[1] + (c2[1] - c1[1]) * ratio
        b = c1[2] + (c2[2] - c1[2]) * ratio
        c.setFillColor(Color(r/255.0, g/255.0, b/255.0))
        c.rect(0, height - (i + 1) * rect_h, width, rect_h + 1.5, fill=True, stroke=False)
    
    # ----------------------------------------------------
    # Geometría Identidad Elegante (Estilo Minimal 3)
    # ----------------------------------------------------
    c.setLineWidth(0.6)
    
    # En ReportLab no hay alpha directo para lineas sin usar colores rgba si la version lo soporta
    # Usaremos el ACCENT_GOLD directo pero muy fino.
    c.setStrokeColor(ACCENT_GOLD)
    
    c.saveState()
    # Origen esquina inferior derecha, arriba de los botones
    c.translate(width - 250, 300)
    
    # Constelación de polígonos
    points = [
        (0, 0), (120, 60), (60, -60),
        (30, 45), (135, -15), (75, 75)
    ]
    
    c.line(points[0][0], points[0][1], points[1][0], points[1][1])
    c.line(points[1][0], points[1][1], points[2][0], points[2][1])
    c.line(points[2][0], points[2][1], points[0][0], points[0][1])
    
    c.line(points[3][0], points[3][1], points[4][0], points[4][1])
    c.line(points[4][0], points[4][1], points[5][0], points[5][1])
    c.line(points[5][0], points[5][1], points[3][0], points[3][1])
    
    # Conexiones extra
    c.line(points[0][0], points[0][1], points[3][0], points[3][1])
    c.line(points[1][0], points[1][1], points[5][0], points[5][1])
    c.line(points[2][0], points[2][1], points[4][0], points[4][1])

    # Lineas que se fugan
    c.line(points[1][0], points[1][1], 250, 120)
    c.line(points[2][0], points[2][1], 150, -200)

    c.setFillColor(ACCENT_GOLD)
    for p in points:
        c.circle(p[0], p[1], 3, fill=True, stroke=False)
        
    c.restoreState()
    
    # Barra lateral
    c.setFillColor(ACCENT_GOLD)
    c.rect(0, 0, 10, height, fill=True, stroke=False)
    
    # Simular texto central
    c.setFillColor(HexColor('#ffffff'))
    c.setFont("Helvetica-Bold", 40)
    c.drawString(100, 800, "Texto de ejemplo para ver el espacio libre")

c = canvas.Canvas("test_minimal3.pdf", pagesize=(width, height))
_draw_background(c)
c.save()
os.system("sips -s format png test_minimal3.pdf --out test_minimal3.png >/dev/null")
