import subprocess
import json
import sqlite3
from ai.pdf_generator import create_carousel_pdf

# Get pending posts via curl
res = subprocess.run(["curl", "-s", "-H", "Authorization: Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e", "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api/posts?status=pending"], capture_output=True, text=True)
data = json.loads(res.stdout)
posts = data.get("posts", [])

sql_statements = []
for p in posts:
    content = p.get("content_edited") or p.get("content")
    if not content: continue
    
    new_pdf = create_carousel_pdf(content)
    sql = f"UPDATE posts SET media_base64 = '{new_pdf}' WHERE id = '{p['id']}';"
    sql_statements.append(sql)

with open("update_pdfs.sql", "w") as f:
    f.write("\n".join(sql_statements))

print(f"Generated SQL for {len(sql_statements)} posts.")
