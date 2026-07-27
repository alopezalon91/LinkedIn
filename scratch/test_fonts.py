import os
import sys

# add parent dir to path so we can import ai.pdf_generator
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    font_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'fonts')
    
    print("Testing Montserrat-Regular...")
    pdfmetrics.registerFont(TTFont('Montserrat-Regular', os.path.join(font_dir, 'Montserrat-Regular.ttf')))
    print("Testing Montserrat-Medium...")
    pdfmetrics.registerFont(TTFont('Montserrat-Medium', os.path.join(font_dir, 'Montserrat-Medium.ttf')))
    print("Testing Montserrat-Bold...")
    pdfmetrics.registerFont(TTFont('Montserrat-Bold', os.path.join(font_dir, 'Montserrat-Bold.ttf')))
    print("Testing Lora-Medium...")
    pdfmetrics.registerFont(TTFont('Lora-Medium', os.path.join(font_dir, 'Lora-Medium.ttf')))
    print("All fonts registered successfully!")
    
except Exception as e:
    print(f"Error registering fonts: {e}")
