from PIL import Image, ImageDraw, ImageEnhance
import os

bg_path = "assets/bg_carousel.png"
if not os.path.exists(bg_path):
    print("Background not found")
    exit()

img = Image.open(bg_path).convert("RGBA")
width, height = img.size

# We want to keep the geometry but push it to the right and top, and remove the harsh line if possible.
# Easiest way: Create a new image with pure navy background.
# Paste the scaled-down and shifted original image with a gradient mask so it fades in.

navy = (8, 14, 20, 255) # #080e14
new_bg = Image.new("RGBA", (width, height), navy)

# Scale the original image down to 70% and put it in the top right
scale = 0.8
new_w, new_h = int(width * scale), int(height * scale)
resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Create a gradient mask for the resized image (fade out on the left and bottom)
mask = Image.new("L", (new_w, new_h), 0)
draw = ImageDraw.Draw(mask)
for x in range(new_w):
    for y in range(new_h):
        # alpha based on x (more opaque on right) and y (more opaque on top)
        # x goes from 0 to new_w.
        alpha_x = int(255 * (x / new_w))
        alpha_y = int(255 * (1 - (y / new_h)**2)) # fade out at bottom
        alpha = min(alpha_x, alpha_y, 200) # max opacity 200 for subtlety
        mask.putpixel((x, y), alpha)

# Paste into the top right corner
offset_x = width - new_w
offset_y = 0
new_bg.paste(resized_img, (offset_x, offset_y), mask)

new_bg.save("assets/bg_carousel_corner.png")
print("Saved assets/bg_carousel_corner.png")
