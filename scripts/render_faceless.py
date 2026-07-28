import json
import asyncio
import edge_tts
from moviepy.editor import *
import os
import requests
import urllib.parse
from PIL import Image

# CONFIGURACIÓN
JSON_FILE = "video_payload.json"
OUTPUT_VIDEO = "reel_final_linkedin.mp4"

async def generate_voice(text, output_audio, voice="es-ES-AlvaroNeural"):
    print(f"🎙️ Generando voz con Edge-TTS ({voice})...")
    # Otras opciones: es-ES-ElviraNeural (Mujer)
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_audio)
    print("✅ Voz generada.")

def generate_avatar_image(prompt, output_file):
    print(f"🎨 Generando avatar estático con Pollinations AI: {prompt}")
    if not prompt:
        prompt = "hyper realistic professional corporate business portrait, looking directly at camera, dark studio lighting, 8k resolution, photorealistic"
    
    # Enhance the prompt for hyper realism
    enhanced_prompt = f"{prompt}, high detail, 8k, photorealistic, professional lighting, corporate, dslr"
    encoded_prompt = urllib.parse.quote(enhanced_prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1080&height=1920&nologo=true"
    
    try:
        response = requests.get(url, stream=True, timeout=30)
        if response.status_code == 200:
            with open(output_file, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            print("✅ Imagen de avatar generada y descargada.")
            return True
        else:
            print(f"❌ Error al generar imagen: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Excepción al generar imagen: {e}")
        return False

def zoom_in_effect(clip, zoom_ratio=0.04):
    def effect(get_frame, t):
        img = Image.fromarray(get_frame(t))
        base_size = img.size
        # Calculate new crop size
        new_size = [
            int(img.size[0] * (1 - (zoom_ratio * (t / clip.duration)))),
            int(img.size[1] * (1 - (zoom_ratio * (t / clip.duration))))
        ]
        
        x1 = int((img.size[0] - new_size[0]) / 2)
        y1 = int((img.size[1] - new_size[1]) / 2)
        x2 = int((img.size[0] + new_size[0]) / 2)
        y2 = int((img.size[1] + new_size[1]) / 2)
        
        img = img.crop((x1, y1, x2, y2)).resize(base_size, Image.Resampling.LANCZOS)
        import numpy as np
        return np.array(img)

    return clip.fl(effect)

def create_video(json_data, audio_file, avatar_img):
    print("🎬 Ensamblando el Reel...")
    
    # 1. Cargar el audio
    audio = AudioFileClip(audio_file)
    
    # 2. Cargar la imagen del avatar y aplicar Ken Burns
    if os.path.exists(avatar_img):
        background = ImageClip(avatar_img).set_duration(audio.duration)
        # Aplicamos zoom lento + oscurecer un poco para que destaquen los textos
        background = zoom_in_effect(background, zoom_ratio=0.05).colorx(0.6)
    else:
        # Fallback a fondo gris
        background = ColorClip(size=(1080, 1920), color=(20, 20, 25), duration=audio.duration)
    
    # 3. Dibujar los subtítulos
    subtitles = json_data.get("subtitles", [])
    text_clips = []
    
    for sub in subtitles:
        start_time = sub["start_time"]
        end_time = sub["end_time"]
        text = sub["text"].upper()
        
        try:
            txt_clip = TextClip(text, fontsize=85, color='white', font='Arial-Bold', method='caption', size=(900, None))
        except:
            txt_clip = TextClip(text, fontsize=85, color='white', method='caption', size=(900, None))
        
        # Sombra/Borde para el texto
        try:
            txt_bg = TextClip(text, fontsize=85, color='black', font='Arial-Bold', method='caption', size=(900, None))
            txt_bg = txt_bg.set_position(('center', 'center')).set_start(start_time).set_end(end_time)
            txt_bg = txt_bg.margin(top=5, left=5, opacity=0) # Shadow offset
            text_clips.append(txt_bg)
        except:
            pass
            
        txt_clip = txt_clip.set_position('center').set_start(start_time).set_end(end_time)
        txt_clip = txt_clip.crossfadein(0.2).crossfadeout(0.2)
        text_clips.append(txt_clip)
        
    # 4. Juntar el fondo con los textos superpuestos
    video_final = CompositeVideoClip([background] + text_clips)
    
    # 5. Ponerle la pista de voz
    video_final = video_final.set_audio(audio)
    
    # 6. Exportar
    print("🚀 Renderizando .mp4 final...")
    video_final.write_videofile(OUTPUT_VIDEO, fps=24, codec="libx264", audio_codec="aac")
    print("🎉 ¡VÍDEO TERMINADO Y LISTO PARA SUBIR!")

async def main():
    if not os.path.exists(JSON_FILE):
        print(f"❌ Error: No se encontró el archivo {JSON_FILE}")
        return
        
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    audio_file = "temp_voice.mp3"
    avatar_file = "temp_avatar.jpg"
    
    video_data = data.get("video_data", data)
    
    # Adaptación del JSON de escenas a audio_script
    if "scenes" in video_data and "audio_script" not in video_data:
        audio_parts = []
        subs = []
        current_time = 0.0
        for scene in video_data.get("scenes", []):
            dur = scene.get("duration_seconds", 5)
            text = scene.get("on_screen_text", "")
            voice = scene.get("voice_over_script", "")
            if voice:
                audio_parts.append(voice)
            if text:
                subs.append({
                    "start_time": current_time,
                    "end_time": current_time + dur,
                    "text": text
                })
            current_time += dur
            
        video_data["audio_script"] = " ".join(audio_parts)
        video_data["subtitles"] = subs
    
    if "audio_script" not in video_data:
        print("❌ Error: No hay audio_script en el JSON")
        return
        
    # 1. Extraer el prompt del avatar del config
    avatar_prompt = None
    config = video_data.get("config", {})
    if isinstance(config, dict):
        avatar_prompt = config.get("avatar_prompt")
        
    # Generar avatar
    generate_avatar_image(avatar_prompt, avatar_file)
    
    # 2. Generar voz (usamos Alvaro pero se puede cambiar a Elvira)
    voice_tone = config.get("voice_tone", "es-ES-AlvaroNeural") if isinstance(config, dict) else "es-ES-AlvaroNeural"
    await generate_voice(video_data["audio_script"], audio_file, voice=voice_tone)
    
    # 3. Componer video
    create_video(video_data, audio_file, avatar_file)
    
    # Limpieza
    if os.path.exists(audio_file):
        os.remove(audio_file)
    if os.path.exists(avatar_file):
        os.remove(avatar_file)

if __name__ == "__main__":
    asyncio.run(main())
