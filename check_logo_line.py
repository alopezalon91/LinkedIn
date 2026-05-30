from PIL import Image

def has_horizontal_line(image_path):
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    pixels = img.load()
    
    for y in range(height):
        gold_pixels = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            if r > 150 and g > 120 and b < 150:
                gold_pixels += 1
        if gold_pixels > width * 0.5:
            print(f"Found a horizontal gold line at y={y} with {gold_pixels} gold pixels! Height: {height}")
            return
            
    print("No horizontal line found in the logo!")

has_horizontal_line("assets/logo_cover_trimmed.png")
