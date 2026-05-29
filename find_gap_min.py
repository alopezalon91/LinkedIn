from PIL import Image, ImageChops

def find_gap_and_crop(image_path):
    img = Image.open(image_path).convert("RGBA")
    
    bg = Image.new(img.mode, img.size, (0,0,0,0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if not bbox: return
    img = img.crop(bbox)
    width, height = img.size
    pixels = img.load()
    
    # Calculate row density (sum of alpha)
    row_densities = []
    for y in range(height):
        density = sum(pixels[x, y][3] for x in range(width))
        row_densities.append(density)
        
    # Find the minimum density row in the bottom half of the image
    # (assuming the text is in the bottom 30%)
    start_y = int(height * 0.6)
    end_y = int(height * 0.9)
    min_density = min(row_densities[start_y:end_y])
    
    # Find the first row that matches this min density
    gap_y = start_y + row_densities[start_y:end_y].index(min_density)
    
    print(f"Found minimum density {min_density} at y={gap_y} (height={height})")
    
    monogram = img.crop((0, 0, width, gap_y))
    
    # Trim again to get tight bounds
    bg2 = Image.new(monogram.mode, monogram.size, (0,0,0,0))
    diff2 = ImageChops.difference(monogram, bg2)
    bbox2 = diff2.getbbox()
    if bbox2:
        monogram = monogram.crop(bbox2)
        
    monogram.thumbnail((900, 900), Image.Resampling.LANCZOS)
    
    # Apply 15% opacity
    alpha = monogram.split()[3]
    alpha = alpha.point(lambda p: p * 0.15)
    monogram.putalpha(alpha)
    
    monogram.save("assets/logo_watermark_final.png")
    print("Perfectly cropped watermark saved using density gap!")

if __name__ == "__main__":
    find_gap_and_crop("assets/al_mark_transparent_high_quality.png")
