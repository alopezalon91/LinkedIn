import requests, os
from dotenv import load_dotenv

load_dotenv(".env")
CF_WORKER_URL = os.getenv("CF_WORKER_URL")
CF_WORKER_TOKEN = os.getenv("CF_WORKER_TOKEN")

resp = requests.get(f"{CF_WORKER_URL}/api/posts?limit=100", headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
data = resp.json()
posts = data.get("posts", []) if isinstance(data, dict) else data
for p in posts:
    if p["status"] in ["pending", "draft"]:
        requests.patch(f"{CF_WORKER_URL}/api/posts/{p['id']}", json={"status": "rejected"}, headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
        print(f"Rejected post {p['id']}")
