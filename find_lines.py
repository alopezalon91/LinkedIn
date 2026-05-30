from PIL import Image

def find_horizontal_lines(image_path):
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    pixels = img.load()
    
    found_lines = []
    
    for y in range(height):
        gold_pixels = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            if r > 150 and g > 120 and b < 150:
                gold_pixels += 1
        if gold_pixels > width * 0.5:
            found_lines.append((y, gold_pixels))
            
    print(f"Found {len(found_lines)} horizontal line(s) in {image_path}:")
    for y, count in found_lines:
        print(f" - Line at y={y} with {count} gold pixels")

find_horizontal_lines("/Users/albertolopez/.gemini/antigravity/brain/4d7336fd-e6c4-4c47-9c64-84a087a629cb/mock_slide_1.png")
