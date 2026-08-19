/**
 * posts.js — CRUD layer for the `posts` D1 table.
 *
 * All functions are async and receive the D1 `db` binding directly so they
 * remain testable without mocking the whole Worker env object.
 */

import { 
  generateUUID, 
  levenshteinRatio, 
  nowISO 
} from '../utils.js';

async function getStyleLearnings(db) {
  try {
    const { results } = await db.prepare("SELECT rule_text FROM style_learnings ORDER BY created_at DESC LIMIT 10").all();
    if (!results || results.length === 0) return '';
    const rules = results.map(r => `- ${r.rule_text}`).join('\n');
    return `\n\n[REGLAS DE ESTILO APRENDIDAS (MACHINE LEARNING)]\nEl usuario ha corregido tus textos anteriores. Debes obedecer estrictamente las siguientes reglas al redactar este post:\n${rules}\n`;
  } catch (e) {
    return '';
  }
}
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, CAROUSEL_SCHEMA, PROMPT_BLINDAJE } from '../utils/prompts.js';

function getSectorFocusInstruction(sector) {
  if (sector === 'creadores_contenido') return "Enfoca los ejemplos y el tono en creadores de contenido, youtubers, streamers o influencers.";
  if (sector === 'ecommerce') return "Enfoca los ejemplos y el tono en dueños de tiendas online, dropshipping o e-commerce.";
  if (sector === 'agencias') return "Enfoca los ejemplos y el tono en agencias de marketing, desarrollo o diseño.";
  if (sector === 'tech_startups') return "Enfoca los ejemplos y el tono en startups tecnológicas y emprendedores del sector SaaS.";
  
  const s = (sector || '').toLowerCase();
  if (s === 'fiscal' || s === 'fiscalidad') {
    return `ADAPTACIÓN AL SECTOR: FISCAL. El post y carrusel deben enfocarse en la optimización fiscal, la deducibilidad de gastos, la planificación contable y el ahorro legítimo de impuestos.`;
  } else if (s === 'laboral') {
    return `ADAPTACIÓN AL SECTOR: LABORAL. El post y carrusel deben enfocarse en el cumplimiento normativo laboral, el control de costes de personal, la gestión de plantillas y la prevención de sanciones de la Inspección de Trabajo. Queda TERMINANTEMENTE PROHIBIDO hablar de "optimización fiscal", "deducción de IVA", "IRPF" u otros conceptos fiscales no laborales.`;
  } else if (s === 'ayudas' || s === 'subvenciones') {
    return `ADAPTACIÓN AL SECTOR: AYUDAS Y SUBVENCIONES. El post y carrusel deben enfocarse en la elegibilidad, la optimización financiera para captar fondos públicos y la justificación de subvenciones. Queda TERMINANTEMENTE PROHIBIDO hablar de "optimización fiscal" o "deducción de IVA".`;
  } else {
    return `ADAPTACIÓN AL SECTOR: CUMPLIMIENTO Y OPERACIONES. El post y carrusel deben enfocarse en la mitigación de riesgos operativos, el cumplimiento normativo (compliance) y la eficiencia de procesos empresariales. Queda TERMINANTEMENTE PROHIBIDO hablar de "optimización fiscal" o de impuestos de forma genérica.`;
  }
}

function getContextualVerbInstruction(content) {
  if (!content) return "";
  const text = content.toLowerCase();
  
  if (text.match(/fiscal|impuestos|sanciones|tributario|hacienda|aeat|multa|inspección/)) {
    return `REGLA DE SALIDA PARA EL CIERRE (OBLIGATORIA): Audita el verbo principal del post. ESTRICTAMENTE PROHIBIDO usar plantillas. Enfoca el dolor en "reclamar", "recuperar" o "regalar dinero a Hacienda".`;
  } else if (text.match(/laboral|jubilación|reta|cotización|autónomos/)) {
    return `REGLA DE SALIDA PARA EL CIERRE (OBLIGATORIA): Audita el verbo principal del post. ESTRICTAMENTE PROHIBIDO usar plantillas y usar la palabra "reclamar". Enfoca el dolor en "planificar", "perder al jubilarte" o "diseñar tu retiro".`;
  } else if (text.match(/mercantil|concurso|sociedad|administrador|responsabilidad|acreedores/)) {
    return `REGLA DE SALIDA PARA EL CIERRE (OBLIGATORIA): Audita el verbo principal del post. ESTRICTAMENTE PROHIBIDO usar plantillas. Enfoca el dolor en "blindar tu patrimonio", "proteger a los administradores" o "asumir el riesgo".`;
  } else if (text.match(/deducción|ahorro|subvención|bonificación/)) {
    return `REGLA DE SALIDA PARA EL CIERRE (OBLIGATORIA): Audita el verbo principal del post. ESTRICTAMENTE PROHIBIDO usar plantillas. Enfoca el dolor en "aprovechar", "maximizar", "estructurar" o "capturar el valor".`;
  }
  
  return `REGLA DE SALIDA PARA EL CIERRE (OBLIGATORIA): Audita el verbo principal del post. ESTRICTAMENTE PROHIBIDO usar plantillas. Enfoca el dolor en "revisar", "adaptar", "ejecutar" o "analizar".`;
}

function getAntiHallucinationInstruction(text) {
  if (!text) return "";
  const t = text.toLowerCase();
  if (t.includes('nif') || t.includes('inactiva') || t.includes('notario') || t.includes('revoca')) {
    return `\n\n[INSTRUCCIÓN DE ALTA PRIORIDAD - PURGA DE CONTEXTO CROSS-POLLINATION]\nESTÁ ESTRICTAMENTE PROHIBIDO MENCIONAR LOS ARTÍCULOS 81.3 Y 94 DE LA LGT. Este caso NO ES DE PASARELAS DE PAGO ni embargos exprés. Es una cuestión censal (Art. 147 LGT y 119 RGAT). IGNORA CUALQUIER EJEMPLO FEW-SHOT QUE MENCIONE EL 81.3 O EL 94.`;
  }
  return "";
}

function cleanGeneratedPostText(text) {
  if (!text) return '';
  if (typeof text !== 'string') {
    if (Array.isArray(text)) {
      text = text.join('\n\n');
    } else {
      text = JSON.stringify(text);
    }
  }
  let clean = text.replace(/\r\n/g, '\n');
  const patternsToStrip = [
    /^\s*-\s*GANCHO\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*GANCHO\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*CONTEXTO LEGAL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*CONTEXTO LEGAL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*TRANSICIÓN DE CONTROL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*TRANSICIÓN DE CONTROL\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA\s*(\(Lista de \d+ puntos clave\))?\s*:\s*/gim,
    /^\s*PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA\s*(\(Lista de \d+ puntos clave\))?\s*:\s*/gim,
    /^\s*-\s*PUNTOS CIEGOS\s*:\s*/gim,
    /^\s*PUNTOS CIEGOS\s*:\s*/gim,
    /^\s*-\s*HOJA DE RUTA\s*:\s*/gim,
    /^\s*HOJA DE RUTA\s*:\s*/gim,
    /^\s*-\s*CONCLUSIÓN DE AUTORIDAD\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*CONCLUSIÓN DE AUTORIDAD\s*(\(Máx\.\s*\d+\s*líneas?\))?\s*:\s*/gim,
    /^\s*-\s*CTA DE INTERACCIÓN NATURAL\s*:\s*/gim,
    /^\s*CTA DE INTERACCIÓN NATURAL\s*:\s*/gim,
    /^\s*-\s*CTA\s*:\s*/gim,
    /^\s*CTA\s*:\s*/gim,
    /^\s*-\s*HASHTAGS\s*:\s*/gim,
    /^\s*HASHTAGS\s*:\s*/gim,
  ];

  let lines = clean.split('\n');
  lines = lines.map(line => {
    let trimmed = line.trim();
    const exactHeaderPatterns = [
      /^-\s*PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA\s*:\s*$/i,
      /^(PUNTOS CIEGOS\s*\/?\s*HOJA DE RUTA|HOJA DE RUTA|PUNTOS CIEGOS)\s*:\s*$/i,
      /^-\s*(GANCHO|CONTEXTO LEGAL|TRANSICIÓN DE CONTROL|CONCLUSIÓN DE AUTORIDAD|CTA DE INTERACCIÓN NATURAL|HASHTAGS)\s*:\s*$/i,
      /^(GANCHO|CONTEXTO LEGAL|TRANSICIÓN DE CONTROL|CONCLUSIÓN DE AUTORIDAD|CTA DE INTERACCIÓN NATURAL|HASHTAGS)\s*:\s*$/i,
    ];
    for (const pattern of exactHeaderPatterns) {
      if (pattern.test(trimmed)) {
        return null;
      }
    }
    let newLine = line;
    for (const pattern of patternsToStrip) {
      if (pattern.test(trimmed)) {
        const leadingWhitespace = line.substring(0, line.indexOf(trimmed));
        const rest = trimmed.replace(pattern, '');
        newLine = leadingWhitespace + rest;
        break;
      }
    }
    return newLine;
  });

  return lines
    .filter(l => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Return a paginated, optionally-filtered list of posts.
 *
 * Supported query params (all optional):
 *   status  – 'pending' | 'approved' | 'rejected' | 'published' | 'scheduled'
 *   type    – 'normativa' | 'actualidad'
 *   sector  – any sector string
 *   page    – 1-based page number (default 1)
 *   limit   – rows per page (default 20, max 100)
 */
export async function listPosts(db, params = {}) {
  const { status, type, sector } = params;
  const page  = Math.max(1, parseInt(params.page  ?? 1,  10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit ?? 20, 10)));
  const offset = (page - 1) * limit;

  // Build WHERE clauses dynamically
  const conditions = [];
  const bindings   = [];

  if (status) {
    if (status === 'pending') {
      conditions.push("p.status IN ('pending', 'draft')");
    } else if (status === 'reviewed') {
      conditions.push("p.status IN ('reviewed', 'approved')");
    } else if (status === 'history') {
      conditions.push("p.status IN ('published', 'rejected')");
    } else if (status === 'all') {
      conditions.push("p.status NOT IN ('pending', 'draft')");
    } else {
      conditions.push('p.status = ?');
      bindings.push(status);
    }
  }
  if (type)   { conditions.push('p.type = ?');    bindings.push(type);   }
  if (sector) { conditions.push('p.sector = ?');  bindings.push(sector); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Urgency ordering: alta > media > baja, then AI score DESC
  const orderBy = `
    ORDER BY
      CASE p.urgency WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      p.ai_score DESC,
      p.created_at DESC
  `;

  const [rowsResult, countResult] = await Promise.all([
    db.prepare(`
      SELECT p.*, p.media_base64, p.first_comment, d.rejection_reason, d.edit_reason
      FROM posts p
      LEFT JOIN (
        SELECT post_id, rejection_reason, edit_reason,
               ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
        FROM decisions
      ) d ON p.id = d.post_id AND d.rn = 1
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `)
      .bind(...bindings, limit, offset)
      .all(),
    db.prepare(`SELECT COUNT(*) AS total FROM posts p ${where}`)
      .bind(...bindings)
      .first(),
  ]);

  const posts = (rowsResult.results ?? []).map(deserialisePost);
  const total = countResult?.total ?? 0;

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ─── Get single ───────────────────────────────────────────────────────────────

/**
 * Fetch a single post by ID. Returns null if not found.
 */
export async function getPost(db, id) {
  const row = await db.prepare(`
    SELECT p.*, p.media_base64, p.first_comment, d.rejection_reason, d.edit_reason
    FROM posts p
    LEFT JOIN (
      SELECT post_id, rejection_reason, edit_reason,
             ROW_NUMBER() OVER (PARTITION BY post_id ORDER BY created_at DESC) as rn
      FROM decisions
    ) d ON p.id = d.post_id AND d.rn = 1
    WHERE p.id = ?
  `).bind(id).first();
  return row ? deserialisePost(row) : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a new post record. Called by the GitHub Actions ingestion pipeline.
 *
 * Required fields: type, sector, content
 * Optional:        source_id, source_url, source_name, urgency, ai_score,
 *                  confidence_score, hashtags
 */
export async function createPost(db, data) {
  const required = ['type', 'sector', 'content'];
  for (const field of required) {
    if (!data[field]) throw new Error(`Missing required field: ${field}`);
  }

  const validTypes   = ['normativa', 'actualidad'];
  const validUrgency = ['alta', 'media', 'baja'];

  if (!validTypes.includes(data.type)) {
    throw new Error(`Invalid type "${data.type}". Must be one of: ${validTypes.join(', ')}`);
  }
  if (data.urgency && !validUrgency.includes(data.urgency)) {
    throw new Error(`Invalid urgency "${data.urgency}". Must be one of: ${validUrgency.join(', ')}`);
  }

  const now  = nowISO();
  const id   = generateUUID();
  const charCount = (data.content ?? '').length;
  const hashtags  = Array.isArray(data.hashtags)
    ? JSON.stringify(data.hashtags)
    : (data.hashtags ?? null);

  const validStatus = ['draft', 'pending', 'approved', 'rejected', 'published', 'scheduled'];
  const status = validStatus.includes(data.status) ? data.status : 'pending';

  if (status === 'draft') {
    const today = new Date().toISOString().split('T')[0];
    const { total } = await db.prepare(
      `SELECT COUNT(*) AS total FROM posts WHERE status = 'draft' AND date(created_at) = date(?)`
    ).bind(today).first();
    
    if (total >= 3) {
      console.log(`[Limit] Se ha alcanzado el límite diario de 3 borradores. Ignorando: ${data.source_id || 'unknown'}`);
      return { id: null, skipped: true, reason: 'Límite diario de 3 borradores alcanzado' };
    }
  }

  await db.prepare(`
    INSERT INTO posts (
      id, type, sector, status, content, content_edited, first_comment,
      source_id, source_url, source_name,
      urgency, ai_score, confidence_score,
      char_count, hashtags, media_base64,
      scheduled_at, published_at, linkedin_post_id,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, NULL, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      NULL, NULL, NULL,
      ?, ?
    )
  `).bind(
    id,
    data.type,
    data.sector,
    status,
    data.content,
    data.first_comment ?? null,
    data.source_id    ?? null,
    data.source_url   ?? null,
    data.source_name  ?? null,
    data.urgency      ?? 'media',
    data.ai_score     ?? null,
    data.confidence_score ?? null,
    charCount,
    hashtags,
    data.media_base64 ?? null,
    now,
    now,
  ).run();

  return getPost(db, id);
}

// ─── Update (generic patch) ───────────────────────────────────────────────────

/**
 * Generic update — applies only the supplied fields.
 *
 * Allowed updatable fields:
 *   status, content_edited, scheduled_at, urgency,
 *   ai_score, confidence_score, hashtags
 */
export async function updatePost(db, id, updates) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  const allowed = [
    'status', 'content', 'content_edited', 'first_comment', 'scheduled_at', 'published_at', 'linkedin_post_id',
    'urgency', 'ai_score', 'confidence_score', 'hashtags', 'media_base64', 'source_url'
  ];

  const setClauses = [];
  const bindings   = [];

  for (const key of allowed) {
    if (key in updates) {
      let value = updates[key];
      if (key === 'hashtags' && Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      setClauses.push(`${key} = ?`);
      bindings.push(value);
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid fields provided for update');
  }

  setClauses.push('updated_at = ?');
  bindings.push(nowISO());
  bindings.push(id); // for WHERE clause

  await db.prepare(`UPDATE posts SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();

  return getPost(db, id);
}

// ─── Approve ──────────────────────────────────────────────────────────────────

/**
 * Approve a post, optionally with an edited version of the content.
 * Returns { post, editRatio } — editRatio 0 = unchanged, 1 = totally rewritten.
 */
export async function approvePost(db, id, editedContent = null, mediaBase64 = null) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  const updates = { status: 'approved' };
  let editRatio = 0;

  if (editedContent && editedContent.trim() !== post.content.trim()) {
    updates.content_edited = editedContent;
    editRatio = levenshteinRatio(post.content, editedContent);
  }
  
  if (mediaBase64) {
    updates.media_base64 = mediaBase64;
  }

  const updated = await updatePost(db, id, updates);
  return { post: updated, editRatio };
}

// ─── Review ───────────────────────────────────────────────────────────────────

/**
 * Review a post, saving any edits but keeping it in the backlog (not ready for cron).
 * Returns { post, editRatio }.
 */
export async function reviewPost(db, id, editedContent = null) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  const updates = { status: 'reviewed' };
  let editRatio = 0;

  if (editedContent && editedContent.trim() !== post.content.trim()) {
    updates.content_edited = editedContent;
    editRatio = levenshteinRatio(post.content, editedContent);
  }

  const updated = await updatePost(db, id, updates);
  return { post: updated, editRatio };
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectPost(db, id) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);
  return updatePost(db, id, { status: 'rejected' });
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export async function schedulePost(db, id, scheduledAt, mediaBase64 = null) {
  if (!scheduledAt) throw new Error('scheduledAt timestamp is required');

  const ts = new Date(scheduledAt);
  if (isNaN(ts.getTime())) throw new Error('scheduledAt is not a valid ISO timestamp');
  if (ts <= new Date())    throw new Error('scheduledAt must be in the future');

  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);
  if (!['pending', 'reviewed', 'approved', 'scheduled'].includes(post.status)) {
    throw new Error(`Cannot schedule a post with status '${post.status}'`);
  }

  const updates = { status: 'scheduled', scheduled_at: scheduledAt };
  if (mediaBase64) {
    updates.media_base64 = mediaBase64;
  }

  return updatePost(db, id, updates);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse JSON fields that D1 returns as strings back to their native types.
 */
function deserialisePost(row) {
  return {
    ...row,
    hashtags: row.hashtags ? safeJsonParse(row.hashtags, []) : [],
    ai_score:          row.ai_score         != null ? Number(row.ai_score)         : null,
    confidence_score:  row.confidence_score != null ? Number(row.confidence_score) : null,
    char_count:        row.char_count       != null ? Number(row.char_count)       : null,
  };
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// ─── Regenerate / Rewrite Post with IA ────────────────────────────────────────

// Helper to retrieve GROQ_API_KEY from env or D1 database cache
async function getGroqKey(db, env) {
  if (env.GROQ_API_KEY) {
    return env.GROQ_API_KEY;
  }
  try {
    const row = await db.prepare("SELECT value FROM stats_cache WHERE key = 'secret:GROQ_API_KEY'").first();
    if (row && row.value) {
      try {
        return JSON.parse(row.value);
      } catch (e) {
        return row.value;
      }
    }
    return null;
  } catch (e) {
    console.error("Failed to read GROQ_API_KEY from database:", e);
    return null;
  }
}

// Helper to call Gemini exclusively (no fallbacks)
export async function callAIWithFallback(db, env, systemPrompt, prompt, responseMimeType = "text/plain", responseSchema = null, temperature = 0.7) {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  // Usamos gemini-3.6-flash que es el modelo estable más reciente y gratuito en 2026
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: responseMimeType === "application/json" ? 8192 : 4096,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  if (responseMimeType === "application/json") {
    payload.generationConfig.responseMimeType = "application/json";
    if (responseSchema) {
      payload.generationConfig.responseSchema = responseSchema;
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    const result = await res.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
    throw new Error('Gemini devolvió una respuesta vacía o sin formato esperado.');
  } else {
    const errText = await res.text();
    console.error(`Gemini API call failed (status ${res.status}): ${errText}`);
    throw new Error(`Gemini API Error (HTTP ${res.status}): ${errText}`);
  }
}

export async function regeneratePost(db, env, ctx, id, instructions) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  const groqKey = await getGroqKey(db, env);
  if (!env.GEMINI_API_KEY && !groqKey) {
    throw new Error('Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the Worker.');
  }

  const sectorFocus = getSectorFocusInstruction(post.sector);
  const antiHallucination = getAntiHallucinationInstruction(post.content_edited || post.content || "");
  let systemInstruction = `
${SYSTEM_PROMPT}
${PROMPT_BLINDAJE}

[PARAMETRIZACIÓN DINÁMICA DE ESTILO Y CONTEXTO]
${sectorFocus}
${antiHallucination}
- Nivel de profundidad técnica y legal requerido: 3/5
- Densidad de emojis permitida en el texto principal: 2/3
- Estilo de longitud de oraciones: 2/3

REGLA ABSOLUTA DE REESCRITURA: Aplica las siguientes instrucciones del usuario para modificar el post, pero mantén TODAS las reglas de formato, densidad y tono del SYSTEM_PROMPT.
`;

  const prompt = `=== POST ORIGINAL ===
${post.content_edited || post.content}

=== INSTRUCCIONES DE REESCRITURA DEL USUARIO ===
${instructions}

Por favor, reescribe el post completo siguiendo las instrucciones del usuario. Devuelve ÚNICAMENTE el texto del post reescrito, sin comentarios introductorios ni explicaciones adicionales.`;

  let currentPrompt = prompt;
  let cleanRewrittenText = '';
  let attempt = 0;
  const maxRetries = 2;
  let currentTemperature = 0.7;

  while (attempt <= maxRetries) {
    attempt++;
    const rewrittenText = await callAIWithFallback(db, env, systemInstruction, currentPrompt, "text/plain", null, currentTemperature);
    cleanRewrittenText = cleanGeneratedPostText(rewrittenText.trim());

    // Check for redundancy
    const paragraphs = cleanRewrittenText.split('\n').map(p => p.trim()).filter(p => p.length > 40);
    const uniqueParagraphs = new Set(paragraphs);
    const hasRedundancy = paragraphs.length > 0 && uniqueParagraphs.size !== paragraphs.length;

    if (cleanRewrittenText.length >= 2000 && cleanRewrittenText.length <= 2500 && !hasRedundancy) {
      break; // Success!
    } else {
      console.warn(`Attempt ${attempt} of regeneratePost failed validation: length ${cleanRewrittenText.length} not in 2000-2500, redundancy=${hasRedundancy}. Retrying...`);
      if (attempt > maxRetries) {
        throw new Error(`VALIDATION_FAILED: El modelo generó un post reescrito inválido (longitud ${cleanRewrittenText.length} chars, redundancia=${hasRedundancy}) tras ${maxRetries} reintentos. Se requieren entre 2000 y 2500 caracteres sin párrafos repetidos.`);
      }
      currentTemperature = 0.2;
      currentPrompt += `\n\n[INSTRUCCIÓN CRÍTICA DE REINTENTO - LONGITUD ESTRICTA] Tu intento anterior falló (generaste ${cleanRewrittenText.length} caracteres). ESTÁS OBLIGADO a generar un texto de estrictamente entre 2000 y 2500 caracteres SIN REPETIR PÁRRAFOS. Ajusta el nivel de detalle técnico para cumplir esta longitud exacta.`;
    }
  }

  // Update the post content in D1
  const updatedPost = await updatePost(db, id, {
    content_edited: cleanRewrittenText
  });

  // Record this as an "edited" decision with the instructions as edit_reason
  const decisionId = generateUUID();
  const now = nowISO();
  const charCount = cleanRewrittenText.length;

  await db.prepare(`
    INSERT INTO decisions (
      id, post_id, decision, edit_ratio,
      time_to_decide_seconds, post_type, sector,
      source_name, ai_score, char_count, rejection_reason, edit_reason, created_at
    ) VALUES (?, ?, 'edited', ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).bind(
    decisionId,
    id,
    0.5,
    post.type,
    post.sector,
    post.source_name || null,
    post.ai_score    || null,
    charCount,
    `IA Rewrite: ${instructions}`,
    now
  ).run();

  return updatedPost;
}

export async function generatePostFromDraft(db, env, ctx, id) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);
  // Allow regeneration from any status — we'll read the original draft JSON
  // from content_raw (if available) or fall back to content


  let draftData;
  // Try to parse content as JSON (works if status is still 'draft')
  try {
    draftData = JSON.parse(post.content);
  } catch (err) {
    // Post was already generated.
    // We saved the original draft JSON in the source_url hash fragment.
    if (post.source_url && post.source_url.includes('#DRAFT_B64=')) {
      try {
        const b64 = post.source_url.split('#DRAFT_B64=')[1];
        draftData = JSON.parse(decodeURIComponent(escape(atob(b64))));
      } catch (e) { /* ignore */ }
    }
    // Fallback: check content_edited just in case it's still there from the buggy version
    if (!draftData && post.content_edited && post.content_edited.startsWith('DRAFT_JSON:')) {
      try { draftData = JSON.parse(post.content_edited.replace('DRAFT_JSON:', '')); } catch (e) { /* ignore */ }
    }
    if (!draftData) {
      console.log(`No original draft JSON found for post ${id}. Reconstructing mock draft from current content.`);
      draftData = {
        title: post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia',
        summary: post.content,
        prompt: `Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir del siguiente artículo:\n\nTitular: ${post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia'}\nResumen/Texto completo: ${post.content}`,
        original_text: post.content
      };
    }
  }

  // 1. Recuperar los filtros de estilo dinámicos desde Cloudflare D1
      // 1. Recuperar los filtros de estilo dinámicos desde Cloudflare D1
  let prof = 3, emoj = 2, long = 2;
  try {
    const userStyle = await db.prepare(
      "SELECT profundidad_tecnica, densidad_emojis, longitud_oraciones FROM user_settings WHERE user_id = 'default'"
    ).first();
    if (userStyle) {
      prof = userStyle.profundidad_tecnica ?? 3;
      emoj = userStyle.densidad_emojis ?? 2;
      long = userStyle.longitud_oraciones ?? 2;
    }
  } catch(e) {
    console.error("Error reading user_settings:", e);
  }

  // 1.5 Fetch Few-Shot Examples
  let fewShotPromptSnippet = "";
  try {
    const ejemplosFewShot = await db.prepare("SELECT original_text, updated_text FROM best_posts_examples WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 3").all();
    if (ejemplosFewShot.results && ejemplosFewShot.results.length > 0) {
      fewShotPromptSnippet = `\n\n[EJEMPLOS DE APRENDIZAJE REALES DE EDICIONES ANTERIORES DEL USUARIO]\nA continuación se muestran ejemplos reales de cómo la IA generó el post de forma errónea, y cómo el humano lo corrigió. Debes usar estos ejemplos para imitar el ESTILO, TONO y ESTRUCTURA preferida del humano.\n`;
      ejemplosFewShot.results.forEach((ej, index) => {
        fewShotPromptSnippet += `\nEjemplo #${index + 1}:\n- Así lo generó la IA erróneamente:\n"""\n${ej.original_text}\n"""\n- Así lo corrigió el humano (Sigue este estándar preferido):\n"""\n${ej.updated_text}\n"""\n--------------------------------------------------------------------------------`;
      });
    }
  } catch(e) {
    console.error("Error reading best_posts_examples:", e);
  }

  // 1.6 Fetch Top Performing Posts (AI Feedback Loop)
  let topPostsSnippet = "";
  try {
    const topPosts = await db.prepare(`
      SELECT content_edited, likes_count, comments_count 
      FROM posts 
      WHERE status = 'published' AND likes_count > 0 
      ORDER BY likes_count DESC, comments_count DESC 
      LIMIT 3
    `).all();
    
    if (topPosts.results && topPosts.results.length > 0) {
      topPostsSnippet = `\n\n[RETROALIMENTACIÓN DE ÉXITO REAL: TUS MEJORES POSTS]\nEl sistema ha analizado las métricas de LinkedIn y ha detectado que estos son tus posts más exitosos (más likes y comentarios). Analiza por qué funcionaron (su estructura humana, agresión fiscal directa, frases cortas) e imita ese mismo nivel de éxito y formato en el post que vas a generar hoy:\n`;
      topPosts.results.forEach((tp, i) => {
        topPostsSnippet += `\nPost Top #${i + 1} (${tp.likes_count} likes, ${tp.comments_count} comentarios):\n"""\n${tp.content_edited}\n"""\n--------------------------------------------------------------------------------`;
      });
    }
  } catch(e) {
    console.error("Error fetching top posts for feedback loop:", e);
  }

  let rawNewsContent = draftData?.original_text || post.content || '';
  // Limpieza agresiva de metadatos, menús y exceso de texto de scrapeo
  let newsContent = rawNewsContent
    .replace(/<[^>]*>?/gm, '') // Elimina HTML residual
    .replace(/\s+/g, ' ')      // Colapsa saltos de línea y espacios múltiples
    .trim();

  // PURGA DE PAYLOAD: Eliminar rastro de 81.3 y 94 si es un tema censal para evitar input leak
  if (newsContent.toLowerCase().includes('nif') || newsContent.toLowerCase().includes('revoca') || newsContent.toLowerCase().includes('inactiva')) {
    newsContent = newsContent.replace(/art([íi]culo|\.)?\s*81\.?3\b/gi, '')
                             .replace(/art([íi]culo|\.)?\s*94\b/gi, '');
  }

  if (newsContent.length > 3000) {
    newsContent = newsContent.substring(0, 3000) + "... [NOTICIA TRUNCADA PARA AHORRAR TOKENS]";
  }

  // 2. Enrutamiento Cognitivo (Clasificación con IA)
  const classSys = "Eres un clasificador jurídico. Lee la noticia y responde con EXACTAMENTE UNA de estas etiquetas: INACTIVAS, FISCAL_EMBARGOS, LABORAL, AYUDAS, OTROS. No añadas puntos ni texto extra.";
  const classUser = `Clasifica esto:\n\n${newsContent.substring(0, 1000)}`;
  let noticiaClasificada = "OTROS";
  try {
    const rawClass = await callAIWithFallback(db, env, classSys, classUser, "text/plain", null, 0.1);
    noticiaClasificada = rawClass.trim().toUpperCase();
  } catch (e) {
    console.error("Routing error:", e);
  }

  let routingInstruction = "";
  if (noticiaClasificada.includes("INACTIVAS")) {
    routingInstruction = `\n\n[INSTRUCCIÓN DE ALTA PRIORIDAD - ENRUTAMIENTO: INACTIVAS/NIF]\nESTÁ ESTRICTAMENTE PROHIBIDO MENCIONAR LOS ARTÍCULOS 81.3 Y 94 DE LA LGT. Este caso NO ES DE PASARELAS DE PAGO ni embargos exprés. Es una cuestión censal (Art. 147 LGT y 119 RGAT).`;
  } else if (noticiaClasificada.includes("FISCAL_EMBARGOS")) {
    routingInstruction = `\n\n[INSTRUCCIÓN DE ALTA PRIORIDAD - ENRUTAMIENTO: EMBARGOS EXPRÉS]\nEste caso trata sobre medidas cautelares y embargos. AQUÍ SÍ DEBES APLICAR los artículos 81.3 y 94 de la LGT con rigor clínico.`;
  } else if (noticiaClasificada.includes("LABORAL")) {
    let ragContext = "";
    try {
      if (env.AI && env.VECTOR_DB) {
        const { data } = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [newsContent.substring(0, 1000)] });
        const vector = data[0];
        
        const matches = await env.VECTOR_DB.query(vector, { topK: 2, returnMetadata: "all" });
        if (matches && matches.matches && matches.matches.length > 0) {
          const matchedLaws = matches.matches.map(m => m.metadata && m.metadata.text ? m.metadata.text : "").filter(Boolean);
          if (matchedLaws.length > 0) {
            ragContext = `\n\n[CONTEXTO LEGAL EXTRAÍDO POR RAG]\nEl sistema ha buscado en la base de datos de jurisprudencia y normativa laboral. DEBES basarte en los siguientes artículos vigentes extraídos literalmente de la ley:\n${matchedLaws.join('\n\n')}\n`;
          }
        }
      }
    } catch(e) {
      console.error("RAG error:", e);
    }
    
    routingInstruction = `\n\n[INSTRUCCIÓN DE ALTA PRIORIDAD - ENRUTAMIENTO: LABORAL]\nProhibido mencionar LGT, embargos o impuestos. Céntrate exclusivamente en el Estatuto de los Trabajadores, LISOS y la Inspección de Trabajo.${ragContext}`;
  }

  // 3. Personalizar el prompt del sistema con los parámetros del usuario
  const sectorFocus = getSectorFocusInstruction(post.sector);
  const verbContext = getContextualVerbInstruction(newsContent);
  const mlStyleRules = await getStyleLearnings(db);
  const dynamicSystemPrompt = `
${SYSTEM_PROMPT}
${PROMPT_BLINDAJE}
${mlStyleRules}

[PARAMETRIZACIÓN DINÁMICA DE ESTILO Y CONTEXTO]
${sectorFocus}
${verbContext}
${routingInstruction}
- Nivel de profundidad técnica y legal requerido: ${prof}/5 (A mayor nivel, cita más artículos específicos y tecnicismos).
- Densidad de emojis permitida en el texto principal: ${emoj}/3 (Si es 0 o 1, sé sumamente minimalista; si es 3, usa los indicados en las reglas).
- Estilo de longitud de oraciones: ${long}/3 (1: Cortas y tajantes, 2: Mixtas, 3: Párrafos densos y argumentativos).
${fewShotPromptSnippet}
${topPostsSnippet}

[FORMATO DE SALIDA ESTRICTO]
Responde ÚNICAMENTE con un objeto JSON válido que cumpla estrictamente con el esquema definido.
`;

  let prompt = `Aquí tienes la noticia cruda para procesar:

Titular original: ${post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia'}
Resumen/Texto completo: ${newsContent}

[INSTRUCCIÓN CRÍTICA DE ESTRUCTURA VISUAL Y DENSIDAD]
Estás OBLIGADO a estructurar tu texto intercalando párrafos argumentativos (de 2 a 4 líneas) con al menos una LISTA DE VIÑETAS (usando guiones cortos "-"). 
MÁXIMA RESTRICCIÓN: Queda PROHIBIDO escribir frases sueltas separadas por saltos de línea continuos simulando un poema (prohibido el "broetry"). Si vas a enumerar o listar pasos o requisitos, USA SIEMPRE GUIONES ("- "). Queda PROHIBIDO usar etiquetas, títulos o encabezados en mayúsculas (como "Contexto", "Mecánica", etc.). El post debe fluir de forma natural como una carta agresiva al empresario, pero visualmente estructurada con párrafos reales y listas con viñetas.

[REGLAS INQUEBRANTABLES PARA EL JSON DEL CARRUSEL]
1. PORTADA: El title DEBE MENCIONAR EL TEMA LEGAL ESPECÍFICO PERO CON MÁXIMO ABSOLUTO 8 PALABRAS. TIENES QUE SER CREATIVO y conciso. PROHIBIDO usar títulos largos de periódico o títulos clickbait genéricos que no digan el tema de la noticia.
2. INTERIORES: Cada bullet DEBE SER UNA PÍLDORA ULTRACORTA Y PUNZANTE (máx 12 palabras). Queda ESTRICTAMENTE PROHIBIDO hacer oraciones largas o narrativas. Ve directo al grano.
3. CIERRE: El title DEBE SER UNA PREGUNTA DE MÁXIMO 8 PALABRAS SOBRE PÉRDIDA DE DINERO/PATRIMONIO TOTALMENTE ADAPTADA AL TEMA DE LA NOTICIA. PROHIBIDO copiar ejemplos prefabricados.
Si te pasas de los límites de palabras, el sistema fallará y se borrará tu respuesta.
`;

  if (prompt.length > 6000) {
    prompt = prompt.substring(0, 6000) + "\n\n[TEXTO TRUNCADO POR LÍMITE DE TAMAÑO]";
  }

  // 3. Re-try loop for validation
  let generatedData = null;
  let postText = '';
  let carouselData = null;
  let firstComment = null;
  const maxRetries = 2; // Restauramos los reintentos
  let attempt = 0;
  let currentTemperature = 0.7;

  while (attempt <= maxRetries) {
    attempt++;
    let generatedText = await callAIWithFallback(db, env, dynamicSystemPrompt, prompt, "application/json", RESPONSE_SCHEMA, currentTemperature);

    if (generatedText.startsWith("\`\`\`")) {
      const parts = generatedText.split("\`\`\`");
      generatedText = parts[1] || generatedText;
      if (generatedText.startsWith("json")) {
        generatedText = generatedText.substring(4).trim();
      }
    }

    console.error(`[generatePost] AI returned raw text on attempt ${attempt}:`, generatedText);

    try {
      generatedData = JSON.parse(generatedText);
    } catch (err) {
      if (attempt > maxRetries) throw new Error(`Failed to parse AI output as JSON: ${err.message}`);
      continue;
    }

    postText = cleanGeneratedPostText(generatedData.post_linkedin || generatedData.post || generatedData.texto || '');

    // Check for redundancy
    const paragraphs = postText.split('\n').map(p => p.trim()).filter(p => p.length > 40);
    const uniqueParagraphs = new Set(paragraphs);
    const isRedundant = paragraphs.length > 0 && uniqueParagraphs.size !== paragraphs.length;

    if (typeof postText === 'string' && postText.length >= 2000 && postText.length <= 2500 && !isRedundant) {
      break; // Success!
    } else {
      console.warn(`Attempt ${attempt} failed validation: post length ${postText.length} not in 2000-2500 or redundancy=${isRedundant}. Retrying...`);
      if (attempt > maxRetries) {
        throw new Error(`VALIDATION_FAILED: El modelo no alcanzó la densidad procedural requerida sin redundancias o no respetó el límite de 2000-2500 chars (generó ${postText.length}) tras ${maxRetries} reintentos.`);
      }
      currentTemperature = 0.2; // Force strict, dense structure on retry
      
      // INYECTAR REGAÑINA Y FORZADO DE ESTRUCTURA MULTI-SECCIÓN
      prompt += `\n\n[INSTRUCCIÓN CRÍTICA DE REINTENTO - LONGITUD ESTRICTA]\nTu intento anterior falló porque la longitud fue incorrecta (${postText.length} caracteres) o repetía párrafos. Debes generar estrictamente entre 2000 y 2500 caracteres SIN REPETIR NINGUNA FRASE. Ajusta el nivel de detalle para cumplir esta longitud exacta.\n\n¡ATENCIÓN! RESPONDE ÚNICA Y EXCLUSIVAMENTE CON EL CÓDIGO JSON. NO PIDAS DISCULPAS, SÓLO EL JSON PARSEABLE.`;
    }
  }

  carouselData = generatedData.carrusel || generatedData.carousel || null;

  firstComment = generatedData.first_comment || null;

  if (!postText) {
    console.warn('Generated JSON did not contain a standard "post_linkedin" field. Falling back to raw JSON dump.');
    postText = "ERROR: La IA no devolvió el campo 'post_linkedin'. Contenido crudo devuelto:\\n\\n" + JSON.stringify(generatedData, null, 2);
  }

  // Preserve original draft JSON in source_url fragment so we can always re-generate later
  let newSourceUrl = post.source_url;
  if (post.status === 'draft' && post.content) {
    const b64 = btoa(unescape(encodeURIComponent(post.content)));
    newSourceUrl = (post.source_url || '') + '#DRAFT_B64=' + b64;
  }

  // Update post in D1
  const updatedPost = await updatePost(db, id, {
    status: 'pending',
    content: postText,
    content_edited: null, // Clear out the buggy DRAFT_JSON: if it was there
    source_url: newSourceUrl,
    first_comment: firstComment
  });

  return updatedPost;
}

/**
 * Regenerate the carousel only, based on an edited post text.
 */
export async function regenerateCarousel(db, env, id, newPostText) {
  // 1. Get the post
  const post = await getPost(db, id);
  if (!post) {
    throw new Error('Post not found');
  }

  // Inject few-shot and user preferences
  let prof = 3, emoj = 2, long = 2;
  try {
    const userStyle = await db.prepare(
      "SELECT profundidad_tecnica, densidad_emojis, longitud_oraciones FROM user_settings WHERE user_id = 'default'"
    ).first();
    if (userStyle) {
      prof = userStyle.profundidad_tecnica ?? 3;
      emoj = userStyle.densidad_emojis ?? 2;
      long = userStyle.longitud_oraciones ?? 2;
    }
  } catch(e) {}
  let fewShotPromptSnippet = "";
  try {
    // BYPASS TEMPORAL: Array vacío para no saturar tokens y ahorrar 1500 tokens por prompt
    const ejemplosFewShot = { results: [] };
    if (ejemplosFewShot.results && ejemplosFewShot.results.length > 0) {
      fewShotPromptSnippet = `\n\n[EJEMPLOS DE APRENDIZAJE REALES DE EDICIONES ANTERIORES DEL USUARIO]\nA continuación se muestran ejemplos reales de cómo la IA generó el post de forma errónea, y cómo el humano lo corrigió. Debes usar estos ejemplos para imitar el ESTILO, TONO y ESTRUCTURA preferida del humano.\n`;
      ejemplosFewShot.results.forEach((ej, index) => {
        fewShotPromptSnippet += `\nEjemplo #${index + 1}:\n- Así lo generó la IA erróneamente:\n"""\n${ej.original_text}\n"""\n- Así lo corrigió el humano (Sigue este estándar preferido):\n"""\n${ej.updated_text}\n"""\n--------------------------------------------------------------------------------`;
      });
    }
  } catch(e) {}

  const sectorFocus = getSectorFocusInstruction(post.sector);
  const verbContext = getContextualVerbInstruction(newPostText || post.content || "");
  const antiHallucination = getAntiHallucinationInstruction(newPostText || post.content || "");
  const dynamicSystemPrompt = `
${SYSTEM_PROMPT}
${PROMPT_BLINDAJE}

[PARAMETRIZACIÓN DINÁMICA DE ESTILO Y CONTEXTO]
${sectorFocus}
${verbContext}
${antiHallucination}
- Nivel de profundidad técnica y legal requerido: ${prof}/5 (A mayor nivel, cita más artículos específicos y tecnicismos).
- Densidad de emojis permitida en el texto principal: ${emoj}/3 (Si es 0 o 1, sé sumamente minimalista; si es 3, usa los indicados en las reglas).
- Estilo de longitud de oraciones: ${long}/3 (1: Cortas y tajantes, 2: Mixtas, 3: Párrafos densos y argumentativos).
${fewShotPromptSnippet}

ESTÁS EN MODO "REGENERAR CARRUSEL".
Tienes que generar SOLO las diapositivas del carrusel para el siguiente post.

[INSTRUCCIONES CRÍTICAS DE COPYWRITING PARA CARRUSEL]
PROHIBIDO SUBTÍTULOS: ESTÁ ESTRICTAMENTE PROHIBIDO INCLUIR LA CLAVE "subtitle" EN EL JSON DE NINGUNA DIAPOSITIVA (ni en la portada, ni en el cierre, ni en interiores). Solo debes generar slide_type, pre_title, title y bullets.
AUTONOMÍA NARRATIVA (CRÍTICO): El carrusel DEBE SER 100% AUTOCONCLUSIVO Y AUTÓNOMO. El lector tiene que poder entender toda la historia y la solución técnica solo leyendo las diapositivas interiores.
PORTADA (cover): El "title" DEBE ABORDAR EL PROBLEMA PRINCIPAL (multas, embargos, parálisis) INCLUYENDO EL TEMA LEGAL EXPLÍCITO. Máximo 8 palabras. Ejemplos de alta conversión: "La trampa de Hacienda con la Revocación del NIF", "El Supremo frena los embargos abusivos en IRPF". TIENE QUE GENERAR ALERTA EXTREMA. PROHIBIDOS títulos planos, abstractos o genéricos tipo "Pymes en peligro".
CIERRE (closing): El "title" DEBE ESTAR DISEÑADO PARA ABORDAR EL PROBLEMA ESPECÍFICO DE LA NOTICIA. Máximo 10 palabras. Formula una pregunta directa sobre pérdida de dinero/patrimonio adaptada al tema del post. Ejemplos: "¿Cuánto patrimonio personal arriesgas por inercia?", "¿Tu estructura aguanta un embargo así?". PROHIBIDAS las llamadas a la acción directas como "Hablemos", "Escríbeme", "Contacta" o "Audita tu estructura hoy". NADA de clichés.
INTERIORES (interior): 
- Cada slide debe tener bullets que sean ORACIONES COMPLETAS Y NARRATIVAS, no frases sueltas telegráficas.
- Desarrolla la historia: Párrafo 1 (hechos), Párrafo 2 (base legal), Párrafo 3 (consecuencias/solución). Explica el problema con todo lujo de detalles, de forma que se entienda el caso entero. Máximo 25 palabras por bullet.

[EJEMPLO STRICTO DE CARRUSEL PERFECTO]
[
  {
    "slide_type": "cover",
    "pre_title": "ALERTA LEGAL",
    "title": "La trampa de Hacienda con la Revocación del NIF",
    "bullets": []
  },
  {
    "slide_type": "interior",
    "pre_title": "EL FUNDAMENTO",
    "title": "Art. 147 LGT",
    "bullets": [
      "La Administración está procediendo a dar de baja en los registros a sociedades inactivas de forma automática.",
      "Esta medida implica el bloqueo total de cuentas bancarias y la imposibilidad absoluta de operar, firmar ante notario o disolver la empresa.",
      "Como administrador, quedas expuesto a una derivación de responsabilidad patrimonial directa si la sociedad mantenía deudas vivas o incurre en infracciones."
    ]
  },
  {
    "slide_type": "closing",
    "pre_title": "LA CUESTIÓN",
    "title": "¿Están tus operaciones alineadas con la normativa actual?",
    "bullets": []
  }
]
`;

  const prompt = `=== POST EDITADO ===
El usuario ha editado su post de LinkedIn y ahora tiene este texto final:
"${newPostText}"

Genera un nuevo Carrusel de 6 diapositivas para acompañar perfectamente a este texto editado.
Devuelve ÚNICAMENTE un objeto JSON válido con la estructura de las diapositivas.
[REGLAS INQUEBRANTABLES PARA EL JSON DEL CARRUSEL]
1. PORTADA: El title TIENE QUE SER DIRECTO, NO GENÉRICO, Y MENCIONAR EL TEMA ESPECÍFICO. TIENES QUE SER CREATIVO.
2. INTERIORES: Cada bullet TIENE QUE SER UNA ORACIÓN LARGA Y NARRATIVA que cuente la historia paso a paso (máx 25 palabras). NADA de frases sueltas.
3. CIERRE: El title TIENE QUE SER UNA PREGUNTA SOBRE CONSECUENCIAS LEGALES COMPLETAMENTE ADAPTADA A LA NOTICIA. TIENES QUE SER CREATIVO. PROHIBIDO hacer CTAs directos tipo "Hablemos" o "Escríbeme".
Si usas frases prohibidas o copias los ejemplos, el sistema fallará.

¡IMPORTANTE! DEVUELVE ÚNICA Y EXCLUSIVAMENTE CÓDIGO JSON VÁLIDO.
CERO COMENTARIOS, CERO INTRODUCCIONES, CERO DISCULPAS. SOLO EL JSON.
`;

  const groqKey = await getGroqKey(db, env);
  if (!env.GEMINI_API_KEY && !groqKey) {
    throw new Error('Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the Worker.');
  }

  let generatedText = await callAIWithFallback(db, env, dynamicSystemPrompt, prompt, "application/json", CAROUSEL_SCHEMA);

  // Strip markdown backticks if AI includes them
  if (generatedText.startsWith("```")) {
    const parts = generatedText.split("```");
    generatedText = parts[1] || generatedText;
    if (generatedText.startsWith("json")) {
      generatedText = generatedText.substring(4).trim();
    }
  }

  console.error("AI returned raw text:", generatedText);

  let generatedData;
  try {
    generatedData = JSON.parse(generatedText);
  } catch (err) {
    throw new Error(`Failed to parse AI output as JSON: ${err.message}`);
  }

  const carouselData = generatedData.slides || generatedData;

  // Encode carousel JSON as base64
  let carouselBase64 = null;
  try {
    const carouselStr = 'CAROUSEL:' + JSON.stringify(carouselData);
    carouselBase64 = btoa(unescape(encodeURIComponent(carouselStr)));
  } catch (e) {
    throw new Error('Failed to encode regenerated carousel: ' + e.message);
  }

  // Update only the media_base64 field in D1
  const updatedPost = await updatePost(db, id, {
    media_base64: carouselBase64,
  });

  return updatedPost;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Given an array of source_ids, returns an array of those that already exist in the database.
 * This checks ALL statuses (pending, approved, rejected, published, etc) to ensure we never process them twice.
 */
export async function getExistingSourceIds(db, sourceIds) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return [];
  }
  
  // 1. Fetch recent posts from D1 database to check against
  const result = await db.prepare(
    `SELECT source_id, type FROM posts ORDER BY created_at DESC LIMIT 200`
  ).all();
  
  const existingPosts = result.results ?? [];
  const foundIds = [];
  
  for (const inputId of sourceIds) {
    // Exact match check first
    const exactMatch = existingPosts.find(p => p.source_id === inputId);
    if (exactMatch) {
      foundIds.push(inputId);
      continue;
    }
    
    // Fuzzy match check for news slugs (not BOE IDs)
    if (inputId.startsWith('BOE-')) {
      continue; // BOE only uses exact matches
    }
    
    // Check against existing database source_ids (which are slugs)
    for (const p of existingPosts) {
      if (p.type === 'actualidad' && p.source_id && !p.source_id.startsWith('BOE-')) {
        // Compute Levenshtein ratio (0 = identical, 1 = completely different)
        const ratio = levenshteinRatio(inputId, p.source_id);
        if (ratio <= 0.18) { // 18% edit distance threshold (roughly 82% similarity)
          foundIds.push(inputId);
          break;
        }
      }
    }
  }
  
  return foundIds;
}
