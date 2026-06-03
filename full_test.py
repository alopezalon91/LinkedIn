import requests, os, json
from dotenv import load_dotenv

load_dotenv(".env")
CF_WORKER_URL = os.getenv("CF_WORKER_URL")
CF_WORKER_TOKEN = os.getenv("CF_WORKER_TOKEN")

# 1. Limpiar posts corruptos (pending con JSON en content)
resp = requests.get(f"{CF_WORKER_URL}/api/posts?limit=100", headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
posts = resp.json().get("posts", [])
print(f"Total posts: {len(posts)}")
statuses = {}
for p in posts:
    statuses[p["status"]] = statuses.get(p["status"], 0) + 1
print(f"Statuses: {statuses}")

# Limpiar pending corruptos (que tienen JSON en content en vez de texto de post)
corrupted = 0
for p in posts:
    if p["status"] == "pending":
        content = p.get("content", "")
        if content.startswith('{"title"'):
            requests.patch(f"{CF_WORKER_URL}/api/posts/{p['id']}", 
                         json={"status": "rejected"}, 
                         headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"})
            corrupted += 1
            print(f"  Cleaned corrupted post: {p['id'][:8]}...")

print(f"Cleaned {corrupted} corrupted posts")

# 2. Buscar un borrador para testar
draft = next((p for p in posts if p["status"] == "draft"), None)
if not draft:
    print("\nNo draft posts yet — still generating...")
else:
    print(f"\nFound draft: {draft['id'][:8]}...")
    parsed = json.loads(draft["content"])
    print(f"Title: {parsed['title'][:60]}")
    
    # 3. Llamar al endpoint de generación
    print("\nCalling /generate endpoint...")
    gen = requests.post(
        f"{CF_WORKER_URL}/api/posts/{draft['id']}/generate",
        headers={"Authorization": f"Bearer {CF_WORKER_TOKEN}"}
    )
    print(f"Status: {gen.status_code}")
    if gen.ok:
        result = gen.json()
        print(f"New status: {result.get('status')}")
        content = result.get('content', '')
        print(f"Content preview: {content[:200]}")
        print("\n✅ GENERACIÓN FUNCIONA CORRECTAMENTE")
    else:
        print(f"Error: {gen.text[:300]}")
        print("\n❌ GENERACIÓN FALLA")
