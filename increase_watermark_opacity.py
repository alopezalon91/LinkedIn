from PIL import Image, ImageChops

def remake_watermark():
    img = Image.open("assets/al_mark_transparent_high_quality.png").convert("RGBA")
    
    bg = Image.new(img.mode, img.size, (0,0,0,0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if not bbox: return
    img = img.crop(bbox)
    width, height = img.size
    
    # We know the gap is at y=593 from previous density scan
    monogram = img.crop((0, 0, width, 593))
    
    # Trim again
    bg2 = Image.new(monogram.mode, monogram.size, (0,0,0,0))
    diff2 = ImageChops.difference(monogram, bg2)
    bbox2 = diff2.getbbox()
    if bbox2:
        monogram = monogram.crop(bbox2)
        
    monogram.thumbnail((900, 900), Image.Resampling.LANCZOS)
    
    # User wants +15% opacity. The original was 15%.
    # 15% + 15% = 30% opacity.
    alpha = monogram.split()[3]
    alpha = alpha.point(lambda p: p * 0.30)
    monogram.putalpha(alpha)
    
    monogram.save("assets/logo_watermark_final.png")
    print("Watermark remade with 30% opacity!")

remake_watermark()
