from PIL import Image

def erase_horizontal_line(image_path, output_path):
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # The line is around y=782 on a 1024 height image. 
    # Let's find exactly where it is.
    pixels = img.load()
    
    line_y_start = None
    line_y_end = None
    
    for y in range(int(height * 0.7), int(height * 0.9)):
        gold_pixels = sum(1 for x in range(width) if pixels[x, y][0] > 150 and pixels[x, y][1] > 120 and pixels[x, y][2] < 150)
        if gold_pixels > width * 0.5:
            if line_y_start is None:
                line_y_start = y
            line_y_end = y
            
    if line_y_start is not None:
        print(f"Found line from y={line_y_start} to {line_y_end}. Erasing it...")
        # Clone a patch from directly ABOVE the line to cover the line
        patch_height = (line_y_end - line_y_start) + 20
        patch = img.crop((0, line_y_start - patch_height, width, line_y_start))
        
        # Paste it over the line and slightly below to ensure it's gone
        img.paste(patch, (0, line_y_start))
        # Do a second paste just to blend it down
        img.paste(patch, (0, line_y_start + patch_height))
        
        img = img.convert("RGB")
        img.save(output_path)
        print("Line erased successfully!")
    else:
        print("Line not found!")

erase_horizontal_line("assets/bg_no_geometry.png", "assets/bg_clean_final.png")
