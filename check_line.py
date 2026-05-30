from PIL import Image

def has_horizontal_line(image_path):
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    pixels = img.load()
    
    # We look for a horizontal row of pixels that are mostly gold (around R=200, G=170, B=100)
    # The line was at width-160 wide.
    for y in range(height):
        gold_pixels = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            if r > 150 and g > 120 and b < 150: # roughly yellowish/gold
                gold_pixels += 1
        if gold_pixels > width * 0.5:
            print(f"Found a horizontal gold line at y={y} with {gold_pixels} gold pixels!")
            return
            
    print("No horizontal line found in the image!")

has_horizontal_line("/Users/albertolopez/.gemini/antigravity/brain/4d7336fd-e6c4-4c47-9c64-84a087a629cb/mock_slide_1.png")
