import os
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

def generate_options():
    c = canvas.Canvas("logo_options.pdf", pagesize=(1000, 400))
    c.setFillColor(HexColor('#080e14')) # Fondo Navy
    c.rect(0, 0, 1000, 400, fill=True, stroke=False)
    
    ACCENT_GOLD = HexColor('#b39562')
    TEXT_LIGHT = HexColor('#ffffff')
    
    # Título
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, 340, "Opciones de Monograma AL (Entrelazados)")
    
    y_center = 200
    
    # ----------------------------------------------------
    # Opción 1: Clásico Elegante (Overlap Serif)
    # ----------------------------------------------------
    x1 = 100
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 14)
    c.drawString(x1, 100, "Opción 1: Clásico Overlap")
    
    c.setFillColor(ACCENT_GOLD)
    c.setFont("Times-Roman", 80)
    c.drawString(x1, y_center, "A")
    c.setFillColor(HexColor('#6b8096')) # Gris acero
    c.setFont("Times-Italic", 90)
    c.drawString(x1 + 35, y_center - 5, "L")
    
    # ----------------------------------------------------
    # Opción 2: Minimalista Geométrico (Corte)
    # ----------------------------------------------------
    x2 = 300
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 14)
    c.drawString(x2, 100, "Opción 2: Geométrico")
    
    c.setLineWidth(3)
    c.setStrokeColor(ACCENT_GOLD)
    # A (Triángulo abierto)
    c.line(x2+20, y_center, x2+40, y_center+70)
    c.line(x2+40, y_center+70, x2+60, y_center)
    c.line(x2+28, y_center+25, x2+52, y_center+25)
    # L entrelazada
    c.setStrokeColor(HexColor('#6b8096'))
    c.line(x2+45, y_center+80, x2+45, y_center-10)
    c.line(x2+45, y_center-10, x2+80, y_center-10)
    
    # ----------------------------------------------------
    # Opción 3: Emblema Circular
    # ----------------------------------------------------
    x3 = 500
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 14)
    c.drawString(x3, 100, "Opción 3: Emblema")
    
    c.setStrokeColor(ACCENT_GOLD)
    c.setLineWidth(2)
    c.circle(x3+40, y_center+30, 45, fill=False, stroke=True)
    c.circle(x3+40, y_center+30, 40, fill=False, stroke=True)
    
    c.setFillColor(ACCENT_GOLD)
    c.setFont("Times-Italic", 55)
    c.drawString(x3+15, y_center+15, "A")
    c.setFillColor(HexColor('#ffffff'))
    c.setFont("Times-Roman", 55)
    c.drawString(x3+38, y_center+10, "L")
    
    # ----------------------------------------------------
    # Opción 4: Contínuo (Line-art)
    # ----------------------------------------------------
    x4 = 700
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 14)
    c.drawString(x4, 100, "Opción 4: Monolínea")
    
    c.setStrokeColor(ACCENT_GOLD)
    c.setLineWidth(2.5)
    c.setLineJoin(1)
    
    path = c.beginPath()
    path.moveTo(x4+10, y_center)
    path.lineTo(x4+35, y_center+60) # A sube
    path.lineTo(x4+60, y_center)    # A baja
    path.lineTo(x4+45, y_center)    # Retrocede
    path.lineTo(x4+45, y_center+25) # Cruce A
    path.lineTo(x4+25, y_center+25) # Cruce A
    path.moveTo(x4+45, y_center+25)
    path.lineTo(x4+45, y_center-15) # Baja L
    path.lineTo(x4+75, y_center-15) # Derecha L
    c.drawPath(path, stroke=True, fill=False)
    
    # ----------------------------------------------------
    # Opción 5: Sello Cuadrado Elegante
    # ----------------------------------------------------
    x5 = 900
    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 14)
    c.drawString(x5-20, 100, "Opción 5: Sello")
    
    c.setStrokeColor(ACCENT_GOLD)
    c.setLineWidth(1.5)
    c.rect(x5-20, y_center-10, 80, 80, fill=False, stroke=True)
    
    c.setFillColor(ACCENT_GOLD)
    c.setFont("Helvetica-Bold", 45)
    c.drawString(x5-10, y_center+15, "A")
    c.setFillColor(HexColor('#ffffff'))
    c.drawString(x5+15, y_center+5, "L")
    
    c.save()

if __name__ == "__main__":
    generate_options()
