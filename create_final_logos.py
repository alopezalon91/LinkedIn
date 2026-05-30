from PIL import Image, ImageDraw, ImageFont

def create_logo(bg_color, text_color, output_filename):
    # Load the HIGH QUALITY transparent AL mark
    al_mark = Image.open('assets/al_mark_transparent_high_quality.png')
    mark_w, mark_h = al_mark.size
    
    # We will use the native size of the mark to prevent any pixelation from resizing
    canvas_w = 800
    canvas_h = int(mark_h + 200) # Give enough room for text below
    
    img = Image.new('RGBA', (canvas_w, canvas_h), bg_color)
    
    # Calculate positions
    mark_x = (canvas_w - mark_w) // 2
    mark_y = 50
    
    # Paste mark using alpha compositing
    img.alpha_composite(al_mark, (mark_x, mark_y))
    
    # Draw Text
    draw = ImageDraw.Draw(img)
    try:
        # Avenir Next is a very sleek, modern, tech-friendly geometric font on macOS
        font = ImageFont.truetype("/System/Library/Fonts/Avenir Next.ttc", 45, index=5)
    except:
        font = ImageFont.load_default()
            
    text = "ALBERTO LÓPEZ"
    
    # Text bounding box
    bbox = draw.textbbox((0,0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_x = (canvas_w - text_w) // 2
    text_y = mark_y + mark_h + 40
    
    # Draw text
    draw.text((text_x, text_y), text, fill=text_color, font=font)
    
    # Save image (opaque background version)
    img_rgb = Image.new("RGB", img.size, bg_color[:3])
    img_rgb.paste(img, mask=img.split()[3]) # paste using alpha channel
    img_rgb.save(f"assets/{output_filename}.png")
    
    # For transparent background version
    transparent = Image.new('RGBA', (canvas_w, canvas_h), (0,0,0,0))
    transparent.alpha_composite(al_mark, (mark_x, mark_y))
    draw_trans = ImageDraw.Draw(transparent)
    draw_trans.text((text_x, text_y), text, fill=text_color, font=font)
    
    # Crop transparent version to tight bbox
    bbox_trans = transparent.getbbox()
    if bbox_trans:
        transparent = transparent.crop(bbox_trans)
        
    transparent.save(f"assets/{output_filename}_transparent.png")
    print(f"Created {output_filename}")

# Dark Version
create_logo(bg_color=(8, 14, 20, 255), text_color=(255, 255, 255, 255), output_filename="logo_final_dark")
# Light Version
create_logo(bg_color=(245, 240, 232, 255), text_color=(8, 14, 20, 255), output_filename="logo_final_light")
