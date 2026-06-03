import requests, os, json
from dotenv import load_dotenv

load_dotenv(".env")
CF = os.getenv("CF_WORKER_URL")
TOKEN = os.getenv("CF_WORKER_TOKEN")

# Get all posts
resp = requests.get(f"{CF}/api/posts?limit=100", headers={"Authorization": f"Bearer {TOKEN}"})
posts = resp.json().get("posts", [])

statuses = {}
for p in posts:
    statuses[p["status"]] = statuses.get(p["status"], 0) + 1
print("Statuses:", statuses)

draft = next((p for p in posts if p["status"] == "draft"), None)
if not draft:
    print("No drafts found yet")
    exit()

parsed = json.loads(draft["content"])
print(f"Draft: {parsed['title'][:70]}")

# Call generate endpoint
print("Calling /generate...")
gen = requests.post(f"{CF}/api/posts/{draft['id']}/generate", headers={"Authorization": f"Bearer {TOKEN}"})
print(f"HTTP {gen.status_code}")

if gen.ok:
    r = gen.json()
    content = r.get("content","")
    print(f"Status now: {r.get('status')}")
    print(f"Content starts with: {content[:100]}")
    if content.startswith('{"title"'):
        print("FAIL: content still draft JSON")
    else:
        print("SUCCESS: content is real post text!")
else:
    err = gen.json() if gen.headers.get("content-type","").startswith("application/json") else gen.text
    print(f"ERROR: {str(err)[:400]}")
