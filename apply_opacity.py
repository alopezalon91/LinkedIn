from PIL import Image

path = "assets/logo_inner_trimmed.png"
img = Image.open(path).convert("RGBA")

# Apply 15% opacity
alpha = img.split()[3]
alpha = alpha.point(lambda p: p * 0.15)
img.putalpha(alpha)

img.save("assets/logo_watermark_final.png")
print("Watermark ready with 15% opacity.")
