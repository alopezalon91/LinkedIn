import os
import urllib.request
import zipfile
import io

def download_fonts():
    font_dir = "assets/fonts"
    os.makedirs(font_dir, exist_ok=True)
    
    # Download Montserrat and Lora from Google Fonts
    families = {
        "Montserrat": "https://fonts.google.com/download?family=Montserrat",
        "Lora": "https://fonts.google.com/download?family=Lora"
    }
    
    for family, url in families.items():
        print(f"Downloading {family}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                with zipfile.ZipFile(io.BytesIO(response.read())) as z:
                    for info in z.infolist():
                        if info.filename.endswith('.ttf') and not info.filename.startswith('__MACOSX'):
                            # Only extract static fonts (ignore variable font folder if present)
                            if 'static/' in info.filename or '/' not in info.filename:
                                z.extract(info, font_dir)
                                # Move to root of font_dir if it was in a subfolder
                                if '/' in info.filename:
                                    old_path = os.path.join(font_dir, info.filename)
                                    new_path = os.path.join(font_dir, os.path.basename(info.filename))
                                    os.rename(old_path, new_path)
            print(f"Success: {family}")
        except Exception as e:
            print(f"Failed completely for {family}: {e}")

if __name__ == "__main__":
    download_fonts()
