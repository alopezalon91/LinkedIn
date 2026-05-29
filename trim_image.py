from PIL import Image

def trim(im):
    bg = Image.new(im.mode, im.size, (0,0,0,0))
    diff = Image.composite(im, bg, im)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

# 1. Trim Footer Logo
logo_path = "assets/logo_cover.png"
if __name__ == '__main__':
    img = Image.open(logo_path).convert("RGBA")
    trimmed = trim(img)
    trimmed.save("assets/logo_cover_trimmed.png")
    print(f"Trimmed logo_cover: {img.size} -> {trimmed.size}")

# 2. Trim Watermark Logo (And remove text at the bottom if it exists)
mark_path = "assets/al_mark_transparent_high_quality.png"
if __name__ == '__main__':
    img2 = Image.open(mark_path).convert("RGBA")
    # Let's crop the bottom 30% first in case it contains text, then trim.
    # Actually, we can just crop the top square part.
    w, h = img2.size
    # Assuming monogram is at the top. Let's crop top half or so.
    # To be safe, we'll crop a square from the top center.
    crop_size = min(w, h * 0.7) # estimate
    left = (w - crop_size)/2
    top = 0
    right = left + crop_size
    bottom = crop_size
    img2_cropped = img2.crop((left, top, right, bottom))
    
    trimmed2 = trim(img2_cropped)
    trimmed2.save("assets/logo_inner_trimmed.png")
    print(f"Cropped and trimmed watermark: {img2.size} -> {trimmed2.size}")
