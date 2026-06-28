import json
import asyncio
import edge_tts
from moviepy.editor import *
import os
import requests
import random

# CONFIGURACIÓN
JSON_FILE = "video_payload.json"
OUTPUT_VIDEO = "reel_final_linkedin.mp4"
BACKGROUND_DIR = "scripts/backgrounds"

async def generate_voice(text, output_audio):
    print("🎙️ Generando voz hiperrealista con Edge-TTS (Gratis)...")
    # Voz de consultor español (Álvaro). Es muy natural y corporativa.
    communicate = edge_tts.Communicate(text, "es-ES-AlvaroNeural")
    await communicate.save(output_audio)
    print("✅ Voz generada.")

def get_random_background():
    # En un entorno real, aquí podríamos descargar de Pexels usando la API y keywords,
    # pero para GitHub Actions, si no tenemos backgrounds pre-descargados, 
    # generaremos un fondo negro por defecto si no existe ninguno.
    if os.path.exists(BACKGROUND_DIR) and len(os.listdir(BACKGROUND_DIR)) > 0:
        bg_files = [os.path.join(BACKGROUND_DIR, f) for f in os.listdir(BACKGROUND_DIR) if f.endswith('.mp4')]
        if bg_files:
            return random.choice(bg_files)
    return None

def create_video(json_data, audio_file):
    print("🎬 Ensamblando el Reel Faceless...")
    
    # 1. Cargar el audio
    audio = AudioFileClip(audio_file)
    
    # 2. Cargar el vídeo de fondo
    bg_path = get_random_background()
    if bg_path:
        background = VideoFileClip(bg_path).loop(duration=audio.duration)
        # Redimensionar y oscurecer el fondo para que el texto destaque
        background = background.resize((1080, 1920)).colorx(0.5)
    else:
        # Si no hay fondo, usar un fondo gris oscuro
        background = ColorClip(size=(1080, 1920), color=(20, 20, 25), duration=audio.duration)
    
    # 3. Dibujar los subtítulos gigantes
    subtitles = json_data.get("subtitles", [])
    text_clips = []
    
    for sub in subtitles:
        start_time = sub["start_time"]
        end_time = sub["end_time"]
        text = sub["text"].upper()
        
        # Crear el texto (Blanco puro, fuente gruesa, tamaño grande)
        try:
            txt_clip = TextClip(text, fontsize=80, color='white', font='Arial-Bold', method='caption', size=(900, None))
        except:
            txt_clip = TextClip(text, fontsize=80, color='white', method='caption', size=(900, None))
        
        # Centrar el texto en la pantalla y decirle en qué segundo aparece y desaparece
        txt_clip = txt_clip.set_position('center').set_start(start_time).set_end(end_time)
        
        # Añadir un pequeño fundido para que la entrada y salida sea elegante
        txt_clip = txt_clip.crossfadein(0.2).crossfadeout(0.2)
        text_clips.append(txt_clip)
        
    # 4. Juntar el fondo con los textos superpuestos
    video_final = CompositeVideoClip([background] + text_clips)
    
    # 5. Ponerle la pista de voz
    video_final = video_final.set_audio(audio)
    
    # 6. Exportar
    print("🚀 Renderizando .mp4 final...")
    video_final.write_videofile(OUTPUT_VIDEO, fps=30, codec="libx264", audio_codec="aac")
    print("🎉 ¡VÍDEO TERMINADO Y LISTO PARA SUBIR!")

async def main():
    if not os.path.exists(JSON_FILE):
        print(f"❌ Error: No se encontró el archivo {JSON_FILE}")
        return
        
    # Leer los datos que ha inyectado GitHub Actions
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    audio_file = "temp_voice.mp3"
    
    # Paso A: Generar el audio
    # Si viene desde Cloudflare, los datos están en data["video_data"]
    video_data = data.get("video_data", data)
    
    if "audio_script" not in video_data:
        print("❌ Error: No hay audio_script en el JSON")
        return
        
    await generate_voice(video_data["audio_script"], audio_file)
    
    # Paso B: Juntar Audio + Fondo + Subtítulos
    create_video(video_data, audio_file)
    
    # Limpieza
    if os.path.exists(audio_file):
        os.remove(audio_file)

if __name__ == "__main__":
    asyncio.run(main())
