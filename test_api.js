const https = require('https');
const groq_key = process.env.GROQ_API_KEY;

if (!groq_key) {
  console.log("No groq key");
  process.exit(1);
}

const systemInstruction = `Eres Alberto López. Gestor fiscal y contable. Escribes en primera persona. NUNCA en tercera persona. Tu tono debe ser DISRUPTIVO, crítico, contraintuitivo y directo. Actúas como un experto advirtiendo de un peligro ("Hacienda acaba de activar la guillotina..."). Eres el azote de la burocracia asfixiante y el lenguaje confuso.
PROHIBIDO usar fórmulas de auto-referencia como 'Destaco que...' o 'Me pregunto...'. TUTEO OBLIGATORIO: Dirígete al lector siempre de 'tú', NUNCA de 'usted'. Ve directo al dato sin meta-lenguaje.
IMPORTANTE: Responde SIEMPRE con un objeto JSON válido con esta estructura exacta:
{
  "post": "El texto del post... NO pongas firma [AL] al final del texto del post.",
  "first_comment": "Comentario...",
  "carousel": [ { "slide_type": "cover", "pre_title": "...", "title": "...", "subtitle": "...", "bullets": [] } ]
}`;

const prompt = `Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir de la siguiente noticia de actualidad.

=== REGLA DE ORO ABSOLUTA: VERACIDAD 100% ===
LA INFORMACIÓN DEBE SER 100% REAL Y FIABLE. Está TERMINANTEMENTE PROHIBIDO inventar sentencias, fechas, porcentajes, nombres de tribunales o cualquier otro dato. Si el texto original no contiene un dato, NO lo deduzcas ni lo inventes. Tu prioridad número uno es el rigor.

=== DATOS DE LA NOTICIA ===
Titular: Seguridad Social admite que la Inspección no pueda entrar al negocio del autónomo
Resumen/Texto completo: El Tribunal Supremo elevó el domicilio social del negocio a domicilio constitucionalmente protegido...
Fuente: Diario AyE
Fecha: 2026-06-04

=== REPORTE DE INVESTIGACIÓN Y VERACIDAD ===
La noticia original de Diario AyE es VERAZ, pero carece de datos técnicos fundamentales. 
Tras revisar las fuentes jurídicas y jurisprudenciales oficiales, se aportan los siguientes datos técnicos exactos que deben ser incluidos:
- **Número de Sentencia:** Sentencia del Tribunal Supremo nº 441/2026.
- **Fecha exacta:** 14 de abril de 2026.
- **Caso práctico de origen:** El conflicto se originó tras una inspección forzosa en una nave industrial en Foios (Valencia).
- **Base Legal (Constitución):** El fallo protege directamente a las personas jurídicas amparándose en el Artículo 18.2 de la Constitución (inviolabilidad del domicilio).

IMPORTANTE: Usa los datos exactos (fechas, sentencias, base legal y origen del caso) de este reporte de investigación para enriquecer el post. 

=== ESTRUCTURA Y FORMATO DEL POST DE LINKEDIN (CRÍTICO) ===
- Usa párrafos cortos de 1 a 3 líneas máximo.
- Deja SIEMPRE una línea en blanco (doble salto de línea: \\n\\n) entre cada párrafo o sección para garantizar la legibilidad en LinkedIn.
1. GANCHO: Título atractivo (máximo 1-2 líneas) con algún icono llamativo. Seguido de un salto de línea doble (\\n\\n).
2. CUERPO (ALTA DENSIDAD DE VALOR): Explicación detallada, técnica pero accesible. NO escatimes en información, datos ni profundidad. Usa listas numeradas con emojis (1️⃣, 2️⃣, 3️⃣). Longitud obligatoria: MÍNIMO 2000 caracteres y máximo 2700. El post DEBE ser extenso, profundo y muy descriptivo.
3. INTERACCIÓN: Termina el post siempre con una pregunta abierta para generar comentarios y debate.
4. HASHTAGS: Incluye siempre 4 o 5 hashtags relevantes al final.`;

const payload = JSON.stringify({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: prompt }
  ],
  response_format: { type: 'json_object' },
  temperature: 0.7,
  max_tokens: 2000
});

const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + groq_key,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      console.log(JSON.parse(body).choices[0].message.content);
    } catch(e) {
      console.log(body);
    }
  });
});

req.write(payload);
req.end();
