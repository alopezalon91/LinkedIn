import os
import urllib.request

def download_fonts():
    font_dir = "assets/fonts"
    os.makedirs(font_dir, exist_ok=True)
    
    weights = {
        "Inter-Regular.ttf": "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Regular.ttf",
        "Inter-Medium.ttf": "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Medium.ttf",
        "Inter-Bold.ttf": "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Bold.ttf"
    }
    
    for font, url in weights.items():
        dest = os.path.join(font_dir, font)
        print(f"Trying {url}")
        try:
            urllib.request.urlretrieve(url, dest)
            print(f"Success: {dest}")
        except:
            print(f"Failed completely for {font}")

if __name__ == "__main__":
    download_fonts()
