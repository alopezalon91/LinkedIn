import requests
import json

url = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/posts?limit=10"
headers = {"Authorization": "Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e"}

try:
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    data = resp.json()
    posts = data.get("posts", [])
    if not posts:
        print("No posts found.")
    for p in posts:
        print(f"ID: {p.get('id')} | Status: {p.get('status')} | Created: {p.get('created_at')} | Type: {p.get('type')}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(e.response.text)
