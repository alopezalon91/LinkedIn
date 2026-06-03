import requests, os
from dotenv import load_dotenv

load_dotenv(".env")
CF_WORKER_URL = os.getenv("CF_WORKER_URL")
CF_WORKER_TOKEN = os.getenv("CF_WORKER_TOKEN")

resp = requests.get(f"{CF_WORKER_URL}/api/posts?limit=50", headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
data = resp.json()
posts = data.get("posts", []) if isinstance(data, dict) else data
for p in posts:
    if "sumario" in p["content"] or "Los mensajes" in p["content"]:
        print(f"ID: {p['id']} | Status: {p['status']} | Content: {p['content'][:150]}")
