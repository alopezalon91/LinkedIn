import os
import time
import requests
import json
import edge_tts
import asyncio
from dotenv import load_dotenv

load_dotenv()

WORKER_URL = os.getenv("WORKER_URL", "https://mytaxbot-linkedin.a-lopezalon91.workers.dev")
# AUTH_TOKEN if needed, or we might need it since worker routes are protected.
# Wait, /api/videos/pending is protected by Bearer. 
# We need to send DASHBOARD_SECRET.
DASHBOARD_SECRET = os.getenv("DASHBOARD_SECRET", "1234")

HEADERS = {
    "Authorization": f"Bearer {DASHBOARD_SECRET}",
    "Content-Type": "application/json"
}

async def generate_audio(text, output_file):
    # Using Alvaro (ES-ES) for a professional tone
    voice = "es-ES-AlvaroNeural"
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)

def generate_subtitles(audio_file):
    # Call OpenAI Whisper to generate SRT (Mocked for now, assumes whisper is installed via CLI or python lib)
    # import whisper
    # model = whisper.load_model("base")
    # result = model.transcribe(audio_file, word_timestamps=True)
    pass

def animate_avatar(audio_file, image_file, output_video):
    # Call SadTalker or MuseTalk here
    pass

def render_final_video(avatar_video, subtitle_file, output_file):
    # Use ffmpeg-python to overlay avatar and subtitles on a background
    pass

def upload_to_r2(file_path):
    # Use boto3 to upload to Cloudflare R2
    # Returns the public URL
    return "https://pub-xxxxx.r2.dev/video.mp4"

async def process_video(post):
    post_id = post["id"]
    try:
        video_data = json.loads(post["video_flow_json"])
    except:
        print(f"[{post_id}] Invalid video_flow_json")
        return

    print(f"[{post_id}] Iniciando renderizado...")
    script_text = video_data.get("script", "Texto de prueba")
    
    # 1. TTS
    audio_path = f"tmp_{post_id}.mp3"
    await generate_audio(script_text, audio_path)
    print(f"[{post_id}] Audio generado.")

    # 2. Upload (Mocking full pipeline for now)
    final_video_url = upload_to_r2(audio_path) # Mock
    
    # 3. Notify Worker
    resp = requests.post(
        f"{WORKER_URL}/api/videos/complete", 
        headers=HEADERS,
        json={"postId": post_id, "mediaUrl": final_video_url}
    )
    if resp.status_code == 200:
        print(f"[{post_id}] Completado y notificado.")
    else:
        print(f"[{post_id}] Error al notificar: {resp.text}")

    # Cleanup
    if os.path.exists(audio_path):
        os.remove(audio_path)

async def main():
    print("Iniciando Motor de Vídeo (Polling)...")
    while True:
        try:
            resp = requests.get(f"{WORKER_URL}/api/videos/pending", headers=HEADERS)
            if resp.status_code == 200:
                posts = resp.json()
                if posts:
                    print(f"Encontrados {len(posts)} vídeos pendientes.")
                    for post in posts:
                        await process_video(post)
                else:
                    pass # Silencioso si no hay nada
            else:
                print(f"Error HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"Error de conexión: {e}")
            
        # Esperar 30 segundos antes del siguiente ciclo
        time.sleep(30)

if __name__ == "__main__":
    asyncio.run(main())
