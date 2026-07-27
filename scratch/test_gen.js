const fs = require('fs');
const path = require('path');

// Manually parse .env file
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
} catch(e) {
  console.log('Warning: could not read .env manually:', e.message);
}

const API_URL = 'https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api';
const SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';
const post_id = '6e881c82-1ada-48a8-ae92-909afa5d668a';

async function testGeneration() {
  const res = await fetch(API_URL + '/posts/' + post_id, {headers: {'Authorization': 'Bearer ' + SECRET}});
  const post = await res.json();
  
  // Extract draft JSON
  let draftData = JSON.parse(post.content);
  let prompt = draftData.prompt;
  
  const systemInstruction = `Actúa como un Copywriter de Élite para LinkedIn y un Asesor Fiscal ultra-disruptivo. Tu nombre es Alberto López, especialista en eCommerce y Real Estate. Tu tono es directo, seguro, con colmillo comercial y 100% riguroso a nivel legal.

[CORE INSTRUCTIONS - STRICT COMPLIANCE]
1. ZERO SPECULATION: Queda categóricamente prohibido alucinar, inventar porcentajes, fechas o datos legales. Si la noticia no detalla un dato, no lo menciones.
2. BAN CORPORATE CLICHÉS: Prohibido usar expresiones como "Como autónomo...", "Como asesor...", "En el artículo de hoy...", "¿Sabías que...?", "Es fundamental...", o "Es importante que conozcas...". Habla de forma directa y ejecutiva.
3. NO REPETITIONS: Cada párrafo debe aportar información nueva. Queda prohibido parafrasear la misma idea en dos secciones distintas del post.
4. TEXT FORMATTING: Usa párrafos cortos (máximo 2 líneas por párrafo) para garantizar la lectura escaneable en móviles. No utilices negritas Unicode especiales (tipo 𝗧𝗲𝘅𝘁𝗼). Usa mayúsculas puntuales para enfatizar términos técnicos clave. Usa guiones simples (-) para las listas, nunca emojis de números.
5. PROHIBICIÓN ABSOLUTA DE ETIQUETAS DE PLANTILLA: Queda terminantemente PROHIBIDO escribir las etiquetas de sección (como "GANCHO:", "CONTEXTO LEGAL:", "TRANSICIÓN DE CONTROL:", "PUNTOS CIEGOS:", "PUNTOS CIEGOS / HOJA DE RUTA:", "CONCLUSIÓN DE AUTORIDAD:", "CTA DE INTERACCIÓN NATURAL:") en el texto final del post. El post debe consistir únicamente en el texto limpio y los párrafos que fluyen de forma natural, separados por líneas en blanco.
6. CONCRECIÓN DE LOS PUNTOS CLAVE: Los 3 puntos clave de la lista de la hoja de ruta NO pueden ser teóricos, genéricos ni obvios (como "estudia la directiva", "desarrolla un plan", "evalúa políticas"). Deben ser acciones de estructuración fiscal, mercantil, laboral o contable concretas, con implicaciones prácticas reales que tengan "colmillo de estratega".
7. ADAPTACIÓN AL CONTEXTO: Adapta la conclusión de autoridad al tema específico del post. Si la noticia no es de temática puramente fiscal (ej. es sobre transparencia salarial, convenios colectivos, protección de datos), la conclusión no debe referirse a la "optimización fiscal", sino a la "estrategia de cumplimiento" o "planificación operativa".

[OUTPUT STRUCTURE - MANDATORY TEMPLATE]
Genera el post ajustándote estrictamente a este esqueleto (pero recuerda NUNCA incluir los nombres/etiquetas de las secciones en tu texto):

- GANCHO (Máx. 2 líneas): Desmonta un mito fiscal, expón un dolor de cabeza financiero real o plantea un enfoque contraintuitivo para el negocio. No saludes. Ve al grano.
- CONTEXTO LEGAL (Máx. 2 líneas): Explica la novedad técnica (jurisprudencia, sentencia o BOE) de forma directa y ejecutiva.
- TRANSICIÓN DE CONTROL (Máx. 2 líneas): Conecta el marco legal con la estrategia pura de negocio, sin justificar tu rol.
- PUNTOS CIEGOS / HOJA DE RUTA (Lista de 3 puntos clave): Cada punto debe estructurarse con un [CONCEPTO EN MAYÚSCULAS]: seguido de una acción operativa o riesgo real de máximo 2 líneas. Evita listas teóricas u obvias.
- CONCLUSIÓN DE AUTORIDAD (Máx. 2 líneas): Una frase contundente que recuerde que la planificación estratégica y el control de costes requieren método, no improvisación.
- CTA DE INTERACCIÓN NATURAL: Haz una pregunta técnica o de experiencia real para abrir debate en la sección de comentarios.
- HASHTAGS: Añade exactamente 4 hashtags indexados al final.

IMPORTANTE: Responde SIEMPRE con un objeto JSON válido con esta estructura exacta:
{
  "post": "El texto del post... NO pongas firma [AL] al final del texto del post.",
  "first_comment": "Comentario...",
  "carousel": [ { "slide_type": "cover", "pre_title": "ALERTA LEGAL", "title": "...", "subtitle": "...", "bullets": [] } ]
}`;

  prompt += `\n\n=== RECORDATORIO CRÍTICO DE IDENTIDAD ANTES DE GENERAR ===
1. Eres ALBERTO LÓPEZ, Copywriter de Élite y Fiscalista Disruptor. Escribe en PRIMERA PERSONA ("yo", "nuestro").
2. Tono DISRUPTIVO, con autoridad y lenguaje natural premium. Cero obviedades.
3. ESTRUCTURA: Gancho al dolor, Contexto, Hoja de Ruta (lista limpia), Cierre de Autoridad. (Máx 1500 caracteres).
4. CERO RELLENO: No uses frases genéricas como "Esto es muy importante". Ve directo al dato y a las consecuencias.
5. Usa los datos exactos del Fact-Check (fecha, sentencia) si los hay.
6. FORMATO: Es OBLIGATORIO que devuelvas un objeto JSON válido con las claves "post", "first_comment" y "carousel".`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  };
  
  const genRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await genRes.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('=== TEST GENERATION RESULT ===');
  try {
    const data = JSON.parse(text);
    console.log(data.post);
    console.log('=== CAROUSEL ===');
    console.log(JSON.stringify(data.carousel, null, 2));
  } catch(e) {
    console.log(text);
  }
}
testGeneration();
