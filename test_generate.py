import requests, os, json
from dotenv import load_dotenv

load_dotenv(".env")
CF_WORKER_URL = os.getenv("CF_WORKER_URL")
CF_WORKER_TOKEN = os.getenv("CF_WORKER_TOKEN")

# Get a draft post
resp = requests.get(f"{CF_WORKER_URL}/api/posts?limit=100&status=all", headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
posts = resp.json().get("posts", [])

draft = next((p for p in posts if p["status"] == "draft"), None)
if not draft:
    print("No draft posts found")
    exit()

print(f"Testing with draft: {draft['id']}")
print(f"Title: {json.loads(draft['content'])['title'][:60]}")

# Call generate
gen_resp = requests.post(
    f"{CF_WORKER_URL}/api/posts/{draft['id']}/generate",
    headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"}
)
print(f"Generate status: {gen_resp.status_code}")
result = gen_resp.json()
if gen_resp.ok:
    print(f"New status: {result.get('status')}")
    print(f"Content preview: {(result.get('content') or '')[:200]}")
else:
    print(f"Error: {result}")
