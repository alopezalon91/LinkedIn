import hashlib
import unicodedata

def normalize_title(title: str, article_url: str) -> str:
    """
    Normalizes a title to generate a stable, readable slug for duplicate checking.
    """
    # 1. Lowercase
    t = title.lower()
    # 2. Remove accents and diacritics
    t = "".join(
        c for c in unicodedata.normalize("NFD", t)
        if unicodedata.category(c) != "Mn"
    )
    # 3. Replace non-alphanumeric characters with spaces
    t = "".join(c if c.isalnum() else " " for c in t)
    # 4. Remove common Spanish stopwords
    stopwords = {
        "el", "la", "los", "las", "un", "una", "unos", "unas",
        "de", "del", "en", "para", "por", "con", "sin", "sobre",
        "y", "o", "u", "a", "al", "que", "se", "su", "sus", "como"
    }
    words = [w for w in t.split() if w not in stopwords]
    # 5. Join words with hyphens
    slug = "-".join(words)
    # 6. Fallback to URL hash if slug is empty
    if not slug:
        slug = hashlib.md5(article_url.encode()).hexdigest()[:12]
    return slug[:100]

def levenshtein_distance(a: str, b: str) -> int:
    if a == b: return 0
    if len(a) == 0: return len(b)
    if len(b) == 0: return len(a)
    
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        curr = [i]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            curr.append(min(
                curr[j - 1] + 1,      # insertion
                prev[j] + 1,          # deletion
                prev[j - 1] + cost    # substitution
            ))
        prev = curr
    return prev[len(b)]

def levenshtein_ratio(a: str, b: str) -> float:
    if a == b: return 0.0
    max_len = max(len(a), len(b))
    if max_len == 0: return 0.0
    return round(levenshtein_distance(a, b) / max_len, 4)

# Test cases
titles = [
    ("Hacienda lanzará una inspección masiva de autónomos en junio", "https://url1.com"),
    ("Hacienda lanza inspección masiva a los autónomos en junio", "https://url2.com"),
    ("La Agencia Tributaria inspeccionará masivamente a autónomos el mes que viene", "https://url3.com"),
    ("Hacienda aprueba ayudas de 200 euros para pymes", "https://url4.com"),
    ("Ayudas de 200 euros de Hacienda para pymes y autónomos", "https://url5.com"),
]

print("--- Slugs generated ---")
slugs = []
for t, url in titles:
    slug = normalize_title(t, url)
    slugs.append(slug)
    print(f"Title: {t}\nSlug : {slug}\n")

print("--- Similarity checking ---")
for i in range(len(slugs)):
    for j in range(i + 1, len(slugs)):
        ratio = levenshtein_ratio(slugs[i], slugs[j])
        is_dup = ratio <= 0.18
        print(f"Slug A: {slugs[i]}")
        print(f"Slug B: {slugs[j]}")
        print(f"Levenshtein ratio: {ratio:.4f} (Similarity: {(1 - ratio) * 100:.1f}%) | Duplicate: {is_dup}")
        print("-" * 40)
