from PIL import Image, ImageDraw
import random
import os

width, height = 1080, 1080
# Colors
dark_navy = (5, 10, 16)
light_navy = (15, 28, 43)

img = Image.new("RGB", (width, height))
draw = ImageDraw.Draw(img)

# 1. Radial gradient from center to edges
center_x, center_y = width / 2, height / 2
max_dist = (center_x**2 + center_y**2) ** 0.5

for y in range(height):
    for x in range(width):
        dist = ((x - center_x)**2 + (y - center_y)**2) ** 0.5
        ratio = dist / max_dist
        
        r = int(light_navy[0] * (1 - ratio) + dark_navy[0] * ratio)
        g = int(light_navy[1] * (1 - ratio) + dark_navy[1] * ratio)
        b = int(light_navy[2] * (1 - ratio) + dark_navy[2] * ratio)
        
        # 2. Add very subtle noise for texture
        noise = random.randint(-2, 2)
        r = max(0, min(255, r + noise))
        g = max(0, min(255, g + noise))
        b = max(0, min(255, b + noise))
        
        img.putpixel((x, y), (r, g, b))

out_path = "assets/bg_carousel.png" # Overwrite the old one!
img.save(out_path)
print("Created premium textured background without shapes.")
