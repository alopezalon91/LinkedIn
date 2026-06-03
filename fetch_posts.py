import requests, os
from dotenv import load_dotenv

load_dotenv("config/.env")
CF_WORKER_URL = os.getenv("CF_WORKER_URL")
CF_WORKER_TOKEN = os.getenv("CF_WORKER_TOKEN")

resp = requests.get(f"{CF_WORKER_URL}/api/posts", headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
posts = resp.json()
for p in posts[:3]:
    print(f"ID: {p['id']}, Status: {p['status']}, Type: {p['type']}")
    print(f"Content preview: {p['content'][:100]}")
