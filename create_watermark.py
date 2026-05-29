from PIL import Image
import os

logo_path = "assets/al_mark_transparent_high_quality.png"
out_path = "assets/logo_watermark.png"

if os.path.exists(logo_path):
    img = Image.open(logo_path).convert("RGBA")
    # Make it huge
    aspect = img.height / img.width
    new_w = 800
    new_h = int(new_w * aspect)
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Apply alpha (e.g. 5% opacity)
    alpha = img.split()[3]
    alpha = alpha.point(lambda p: p * 0.05)
    img.putalpha(alpha)
    
    img.save(out_path)
    print("Watermark created with symbol only")
else:
    print("Symbol Logo not found")
