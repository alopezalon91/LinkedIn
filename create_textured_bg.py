from PIL import Image

bg_path = "assets/bg_carousel_corner.png" # Let's use corner since we know what it looks like
# Wait, I overwrote assets/bg_carousel.png in the previous step with create_premium_bg!
# Let's check if we still have the original bg_min_3_final.png or bg_min_3_recolored.png
# Yes, they should be in the artifact directory or assets directory.
import os
import glob

# Try to find the original texture
original_bg = "assets/bg_min_3_recolored.png"
if not os.path.exists(original_bg):
    # try the artifact directory
    artifact_bgs = glob.glob("/Users/albertolopez/.gemini/antigravity/brain/*/bg_min_3_recolored.png")
    if artifact_bgs:
        original_bg = artifact_bgs[0]

if os.path.exists(original_bg):
    print(f"Found original background at {original_bg}")
    img = Image.open(original_bg).convert("RGB")
    width, height = img.size
    
    # We want the texture, so let's crop the bottom left corner where there are no shapes
    # The shapes were on the right and a line across the center.
    # Bottom left (0, height-400) to (400, height) should be safe.
    patch_size = 400
    box = (0, height - patch_size, patch_size, height)
    patch = img.crop(box)
    
    # Create new 1080x1080 image by tiling the patch
    new_bg = Image.new("RGB", (1080, 1080))
    for x in range(0, 1080, patch_size):
        for y in range(0, 1080, patch_size):
            new_bg.paste(patch, (x, y))
            
    # To avoid obvious tiling seams, let's just resize a slightly larger patch to 1080x1080
    # Actually, scaling a 400x400 patch up to 1080x1080 with BICUBIC looks great and keeps texture.
    smooth_bg = patch.resize((1080, 1080), Image.Resampling.BICUBIC)
    
    smooth_bg.save("assets/bg_carousel_texture.png")
    print("Created pure textured background from original!")
else:
    print("Could not find original background.")
