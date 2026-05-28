import io
import re
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor

# 1. Clean emojis because they crash reportlab
def remove_emojis(text):
    return re.sub(r'[^\w\s.,!?;:\'\"()\[\]\-+*/=€$£%@#&áéíóúÁÉÍÓÚñÑüÜ]', '', text)

c = canvas.Canvas("test.pdf", pagesize=(1080, 1080))
c.setFillColor(HexColor('#0B132B'))
c.rect(0, 0, 1080, 1080, fill=True, stroke=False)

style = ParagraphStyle(
    name='Normal',
    fontName='Helvetica',
    fontSize=40,
    leading=55, # Line height
    textColor=HexColor('#FFFFFF'),
)

text = "Este es un texto largo que debería saltar de línea automáticamente. Y 🔗 aquí hay algo más."
text = remove_emojis(text)

p = Paragraph(text, style)
w, h = p.wrap(900, 900)
p.drawOn(c, 90, 1080 - 90 - h)

c.showPage()
c.save()
print("Success")
