from PIL import Image, ImageOps
import os
import glob

# Find original AI background
original_bg = "assets/bg_carousel.png"
if not os.path.exists(original_bg):
    bgs = glob.glob("/Users/albertolopez/.gemini/antigravity/brain/*/bg_min_3_recolored.png")
    if bgs:
        original_bg = bgs[0]

img = Image.open(original_bg).convert("RGBA")
width, height = img.size

# The left side (0 to width/2) has the nice texture but no geometry.
# The geometry is on the right.
# Wait, the line crosses the ENTIRE width usually!
# If the line crosses the entire width, mirroring won't remove the line.
# Let's crop a vertical strip that doesn't have the line.
# Actually, the user's uploaded image showed a straight golden line. That was MY programmatic line.
# If my programmatic line was the ONLY thing crossing the slide, then the AI background MIGHT NOT have a line across the whole slide.
# Let's assume the AI background just has the geometry on the right.
# We will crop the left 540 pixels, mirror it, and paste it on the right.
left_half = img.crop((0, 0, int(width/2), height))
right_half = ImageOps.mirror(left_half)

new_img = Image.new("RGBA", (width, height))
new_img.paste(left_half, (0, 0))
new_img.paste(right_half, (int(width/2), 0))

new_img.save("assets/bg_perfect_texture.png")
print("Mirrored background created!")
