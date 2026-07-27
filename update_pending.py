import os
import requests

API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api"

def main():
    print("Fetching pending posts...")
    res = requests.get(f"{API_URL}/posts/pending")
    if not res.ok:
        print(f"Error fetching posts: {res.text}")
        return
    
    posts = res.json()
    if not posts:
        print("No pending posts found.")
        return
        
    print(f"Found {len(posts)} pending posts. Regenerating...")
    for p in posts:
        print(f"Regenerating post {p['id']}...")
        action_res = requests.post(f"{API_URL}/posts/{p['id']}/action", json={"action": "generate"})
        if action_res.ok:
            print(f"Post {p['id']} regenerated successfully.")
        else:
            print(f"Error regenerating post {p['id']}: {action_res.text}")

if __name__ == '__main__':
    main()
