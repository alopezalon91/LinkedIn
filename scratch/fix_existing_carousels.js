const { execSync } = require('child_process');
const fs = require('fs');

// Simple .env parsing
let geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey && fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY\s*=\s*["']?([^"\n\r']+)["']?/);
  if (match) {
    geminiKey = match[1].trim();
  }
}

if (!geminiKey) {
  console.error("Error: GEMINI_API_KEY is not defined in process.env or .env file.");
  process.exit(1);
}

function runWranglerCommand(args) {
  try {
    const output = execSync(`npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "${args.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' });
    return JSON.parse(output);
  } catch (err) {
    console.error(`Wrangler command failed for query: ${args}`);
    console.error(err.stderr || err.message);
    throw err;
  }
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

  if (text.startsWith("```")) {
    const parts = text.split("```");
    text = parts[1] || text;
    if (text.startsWith("json")) {
      text = text.substring(4).trim();
    }
  }

  return JSON.parse(text);
}

async function main() {
  console.log("Fetching pending/reviewed posts from D1 database...");
  let rows;
  try {
    const queryResult = runWranglerCommand("SELECT id, status, content, media_base64 FROM posts WHERE status IN ('pending', 'reviewed') AND media_base64 IS NOT NULL");
    rows = queryResult[0].results || [];
  } catch (err) {
    console.error("Failed to query posts:", err.message);
    return;
  }

  if (rows.length === 0) {
    console.log("No pending/reviewed posts with carousels found to fix.");
    return;
  }

  console.log(`Found ${rows.length} posts to analyze and fix.`);

  for (const row of rows) {
    console.log(`\nProcessing post ${row.id} (${row.status})...`);
    try {
      // Decode original carousel
      const decodedStr = decodeURIComponent(escape(atob(row.media_base64)));
      if (!decodedStr.startsWith("CAROUSEL:")) {
        console.log("Skipping: media_base64 does not start with CAROUSEL:");
        continue;
      }

      const originalCarousel = JSON.parse(decodedStr.substring(9));
      console.log("Original slide titles:");
      originalCarousel.forEach((slide, idx) => {
        console.log(`  Slide ${idx+1}: ${slide.title}`);
      });

      const prompt = `
Reescribe los títulos y subtítulos de las diapositivas de este carrusel de LinkedIn para que no sean genéricos ni repetitivos, y se adapten de forma específica y única a la información contenida en el post.

POST DE LINKEDIN:
"""
${row.content}
"""

CARRUSEL ORIGINAL (JSON):
"""
${JSON.stringify(originalCarousel, null, 2)}
"""

REGLAS DE REESCRITURA OBLIGATORIAS:
1. La diapositiva 1 es la portada (slide_type: 'cover'). Su título debe ser impactante, editorial y en mayúsculas. Puedes mantenerlo si ya es bueno, o mejorarlo.
2. Las diapositivas interiores (slide_type: 'interior') DEBEN tener títulos y subtítulos personalizados, descriptivos y sumamente específicos basados en los datos y hechos reales del post.
3. Está TERMINANTEMENTE PROHIBIDO utilizar títulos interiores genéricos como "La letra pequeña", "¿Quién está en el radar?", "Qué ejecutar hoy", "Qué hacer hoy", "Mi enfoque de trinchera", "El problema", "Afectados", "Estrategia", etc.
4. Cada diapositiva interior debe tener un título que resuma la acción, el problema o la estrategia exacta descrita en esa diapositiva. Por ejemplo:
   - En lugar de "La letra pequeña", usa "Sanción de 3.000€" o "El recargo del 20%".
   - En lugar de "Qué ejecutar hoy", usa "Revisa tu facturación" o "Adapta tu ERP".
   - En lugar de "Mi enfoque de trinchera", usa "Deducción por I+D+i" o "Amortización acelerada".
5. No repitas títulos o conceptos clave en múltiples diapositivas dentro del mismo carrusel.
6. Mantén el mismo número de diapositivas y los mismos bullets intactos. Solo modifica los campos 'title' y 'subtitle'.
7. Devuelve ÚNICAMENTE un array JSON válido con el carrusel modificado.

Estructura de salida esperada:
[
  {
    "slide_type": "cover",
    "pre_title": "ACTUALIDAD",
    "title": "TÍTULO EDITORIAL EN MAYÚSCULAS",
    "subtitle": "...",
    "bullets": []
  },
  ...
]
`;

      console.log("Calling Gemini to rewrite slides...");
      const newCarousel = await callGemini(prompt);
      
      console.log("New slide titles:");
      newCarousel.forEach((slide, idx) => {
        console.log(`  Slide ${idx+1}: ${slide.title}`);
      });

      // Encode and update
      const newCarouselStr = 'CAROUSEL:' + JSON.stringify(newCarousel);
      const newMediaB64 = btoa(unescape(encodeURIComponent(newCarouselStr)));
      
      console.log("Updating post in database...");
      runWranglerCommand(`UPDATE posts SET media_base64 = '${newMediaB64}' WHERE id = '${row.id}'`);
      console.log(`Post ${row.id} updated successfully!`);

    } catch (err) {
      console.error(`Error processing post ${row.id}:`, err.message);
    }
  }

  console.log("\nAll done!");
}

main();
