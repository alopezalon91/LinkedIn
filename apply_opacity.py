from PIL import Image

path = "assets/logo_inner.png"
img = Image.open(path).convert("RGBA")

# Resize to huge for watermark
img = img.resize((600, 600), Image.Resampling.LANCZOS)

# Apply 10% opacity
alpha = img.split()[3]
alpha = alpha.point(lambda p: p * 0.10)
img.putalpha(alpha)

img.save("assets/logo_watermark_final.png")
print("Correct watermark ready.")
