from PIL import Image, ImageDraw, ImageFilter

def remove_geometry(image_path, output_path):
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # We want to replace the right side (where geometry is) with the texture from the left side,
    # but we don't want a mirrored look. We'll take a patch from x=100 to x=500.
    patch = img.crop((100, 0, 500, height))
    
    # We will paste this patch starting at x=500, then another at x=900 (if needed).
    # To blend it, we'll use an alpha mask with a horizontal gradient.
    
    mask = Image.new("L", (400, height))
    draw = ImageDraw.Draw(mask)
    # create a gradient mask from left (transparent) to right (opaque)
    # wait, if we are pasting OVER the geometry, we want the patch to be opaque where the geometry is,
    # and transparent at the edges so it blends smoothly.
    
    for x in range(400):
        # 0 to 100: fade in (0 to 255)
        # 100 to 300: opaque (255)
        # 300 to 400: fade out (255 to 0)
        if x < 100:
            alpha = int((x / 100) * 255)
        elif x > 300:
            alpha = int(((400 - x) / 100) * 255)
        else:
            alpha = 255
            
        for y in range(height):
            mask.putpixel((x, y), alpha)
            
    # Paste the patch over x=500
    img.paste(patch, (500, 0), mask)
    
    # Do it again for x=700 to 1080 to cover everything
    mask2 = Image.new("L", (400, height))
    for x in range(400):
        if x < 50:
            alpha = int((x / 50) * 255)
        else:
            alpha = 255
        for y in range(height):
            mask2.putpixel((x, y), alpha)
            
    img.paste(patch, (680, 0), mask2)
    
    img = img.convert("RGB")
    img.save(output_path)
    print("Geometry removed via clone stamping!")

import glob
bgs = glob.glob("/Users/albertolopez/.gemini/antigravity/brain/*/bg_min_3_recolored.png")
if bgs:
    remove_geometry(bgs[0], "assets/bg_no_geometry.png")
