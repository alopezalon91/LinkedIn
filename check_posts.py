import requests, os, json
from dotenv import load_dotenv

load_dotenv(".env")
CF_WORKER_URL = os.getenv("CF_WORKER_URL")
CF_WORKER_TOKEN = os.getenv("CF_WORKER_TOKEN")

# Check all possible statuses
resp = requests.get(f"{CF_WORKER_URL}/api/posts?limit=100&status=all", headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
data = resp.json()
posts = data.get("posts", []) if isinstance(data, dict) else data
statuses = {}
for p in posts:
    statuses[p["status"]] = statuses.get(p["status"], 0) + 1
print("Status counts:", statuses)
