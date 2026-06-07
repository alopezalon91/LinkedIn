const crypto = require('crypto');

// Python normalize_title equivalent in JS for test comparison
function normalizeTitle(title, articleUrl) {
  let t = title.toLowerCase();
  
  // Normalize accents and diacritics
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Keep only alphanumeric and spaces
  t = t.replace(/[^a-z0-9\s]/g, " ");
  
  // Remove common Spanish stopwords
  const stopwords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "en", "para", "por", "con", "sin", "sobre",
    "y", "o", "u", "a", "al", "que", "se", "su", "sus", "como"
  ]);
  
  const words = t.split(/\s+/).filter(w => w && !stopwords.has(w));
  let slug = words.join("-");
  
  if (!slug) {
    slug = crypto.createHash('md5').update(articleUrl).digest('hex').slice(0, 12);
  }
  
  return slug.slice(0, 100);
}

// Levenshtein functions from workers/src/utils.js
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j]     + 1,        // deletion
        prev[j - 1] + cost,     // substitution
      );
    }
    prev = curr;
  }

  return prev[b.length];
}

function levenshteinRatio(a, b) {
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return Number((levenshteinDistance(a, b) / maxLen).toFixed(4));
}

// Test cases
const titles = [
  ["Hacienda lanzará una inspección masiva de autónomos en junio", "https://url1.com"],
  ["Hacienda lanza inspección masiva a los autónomos en junio", "https://url2.com"],
  ["La Agencia Tributaria inspeccionará masivamente a autónomos el mes que viene", "https://url3.com"],
  ["Hacienda aprueba ayudas de 200 euros para pymes", "https://url4.com"],
  ["Ayudas de 200 euros de Hacienda para pymes y autónomos", "https://url5.com"],
];

console.log("--- Slugs generated ---");
const slugs = [];
for (const [t, url] of titles) {
  const slug = normalizeTitle(t, url);
  slugs.push(slug);
  console.log(`Title: ${t}\nSlug : ${slug}\n`);
}

console.log("--- Similarity checking ---");
for (let i = 0; i < slugs.length; i++) {
  for (let j = i + 1; j < slugs.length; j++) {
    const ratio = levenshteinRatio(slugs[i], slugs[j]);
    const isDup = ratio <= 0.18;
    console.log(`Slug A: ${slugs[i]}`);
    console.log(`Slug B: ${slugs[j]}`);
    console.log(`Levenshtein ratio: ${ratio.toFixed(4)} (Similarity: ${((1 - ratio) * 100).toFixed(1)}%) | Duplicate: ${isDup}`);
    console.log("-".repeat(40));
  }
}
