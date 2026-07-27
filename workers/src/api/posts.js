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
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, CAROUSEL_SCHEMA, VIDEO_FLOW_SCHEMA, PROMPT_BLINDAJE } from '../utils/prompts.js';

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
    'urgency', 'ai_score', 'confidence_score', 'hashtags', 'media_base64', 'video_flow_json', 'source_url'
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

// Helper to call Gemini with a fallback to Groq
export async function callAIWithFallback(db, env, systemPrompt, prompt, responseMimeType = "text/plain", responseSchema = null, temperature = 0.7) {
  // 1. Try Gemini
  if (env.GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      
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
      } else {
        const errText = await res.text();
        console.error(`Gemini API call failed (status ${res.status}): ${errText}. Trying Groq fallback...`);
        // Fall through to Groq on any Gemini error (quota, rate limit, etc.)
      }
    } catch (err) {
      console.error(`Gemini call failed with exception: ${err.message}. Trying Groq fallback...`);
    }
  }

  // 2. Try Groq fallback
  const groqKey = await getGroqKey(db, env);
  if (groqKey) {
    console.log("Calling Groq API fallback...");
    try {
      // Groq llama-3.3-70b-versatile: ~6000 TPM free tier
      // Keep only the essential parts if prompt is too long
      const MAX_GROQ_CHARS = 5000;
      let groqPrompt = prompt;
      if (prompt.length > MAX_GROQ_CHARS) {
        // Try to preserve the BRANDING_RULES section which has instructions
        const rulesIndex = prompt.indexOf("=== [BRANDING_RULES]");
        if (rulesIndex !== -1) {
          const contentPart = prompt.substring(0, rulesIndex);
          const rulesPart = prompt.substring(rulesIndex);
          const allowedContent = MAX_GROQ_CHARS - rulesPart.length;
          groqPrompt = contentPart.substring(0, Math.max(allowedContent, 1000))
            + "\n\n[TEXTO TRUNCADO]\n\n" + rulesPart;
        } else {
          groqPrompt = prompt.substring(0, MAX_GROQ_CHARS) + "\n\n[TEXTO TRUNCADO]";
        }
      }

      let groqSystemPrompt = systemPrompt;
      if (responseMimeType === "application/json" && responseSchema) {
        groqSystemPrompt += `\n\n[FORMATO DE RESPUESTA OBLIGATORIO]\nDebes devolver EXCLUSIVAMENTE un objeto JSON válido que cumpla estrictamente con el siguiente JSON Schema. No añadas Markdown ni explicaciones adicionales, SOLO el JSON parseable:\n${JSON.stringify(responseSchema, null, 2)}\n`;
      }

      const url = "https://api.groq.com/openai/v1/chat/completions";
      const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: groqSystemPrompt },
          { role: "user", content: groqPrompt }
        ],
        temperature: 0.7,
        max_tokens: responseMimeType === "application/json" ? 2000 : 1500
      };

      if (responseMimeType === "application/json") {
        payload.response_format = { type: "json_object" };
      }

      let currentModel = "llama-3.3-70b-versatile";
      
      let retries = 0;
      const maxRetries = 2;
      while (retries <= maxRetries) {
        payload.model = currentModel;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const result = await res.json();
          const text = result.choices?.[0]?.message?.content;
          if (text) return text;
          break;
        } else if (res.status === 429) {
          const errText = await res.text();
          
          let waitTime = 10; // Default 10 seconds
          // Attempt to extract "try again in X.XXs"
          const waitMatch = errText.match(/try again in ([\d\.]+)s/);
          if (waitMatch && waitMatch[1]) {
            waitTime = Math.ceil(parseFloat(waitMatch[1])) + 1; // Add 1s padding
          }

          if (retries < maxRetries) {
            console.warn(`[Groq] Rate limit hit. Waiting ${waitTime}s...`);
            await new Promise(r => setTimeout(r, waitTime * 1000));
            retries++;
          } else {
            throw new Error(`Groq API Error: ${res.status} - ${errText}`);
          }
        } else {
          const errText = await res.text();
          console.error(`Groq API call failed (status ${res.status}): ${errText}`);
          throw new Error(`Groq API Error: ${res.status} - ${errText}`);
        }
      }
    } catch (err) {
      console.error(`Groq call failed with exception: ${err.message}`);
      throw err;
    }
  }

  throw new Error("Both Gemini and Groq API calls failed or are not configured.");
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

    if (cleanRewrittenText.length >= 1700 && !hasRedundancy) {
      break; // Success!
    } else {
      console.warn(`Attempt ${attempt} of regeneratePost failed validation: length ${cleanRewrittenText.length} < 1700, redundancy=${hasRedundancy}. Retrying...`);
      if (attempt > maxRetries) {
        throw new Error(`VALIDATION_FAILED: El modelo generó un post reescrito inválido (longitud ${cleanRewrittenText.length} chars, redundancia=${hasRedundancy}) tras ${maxRetries} reintentos. Se requieren al menos 1700 caracteres sin párrafos repetidos.`);
      }
      currentTemperature = 0.2;
      currentPrompt += `\n\n[INSTRUCCIÓN CRÍTICA DE REINTENTO - LONGITUD INSUFICIENTE O REDUNDANCIA]\nTu intento anterior falló (demasiado corto o repitió párrafos de forma cíclica). ESTÁS OBLIGADO a superar los 1.800 caracteres SIN REPETIR NINGÚN PÁRRAFO. Para lograrlo, DEBES estructurar el texto con las siguientes 4 secciones diferentes (2 párrafos por sección):\n1. Análisis técnico del impacto legal.\n2. Supuesto práctico detallado: Agencia de marketing embargada.\n3. Supuesto práctico detallado: E-commerce bloqueado.\n4. Procedimiento de defensa paso a paso (recursos y plazos).\n¡Desarrolla cada sección con muchísimos datos, artículos distintos y rigor para alargar la longitud sin añadir paja comercial ni repetir bloques!`;
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
    // BYPASS TEMPORAL: Array vacío para no saturar tokens y ahorrar 1500 tokens por prompt
    const ejemplosFewShot = { results: [] };
    if (ejemplosFewShot.results && ejemplosFewShot.results.length > 0) {
      fewShotPromptSnippet = `\n\n[EJEMPLOS DE APRENDIZAJE REALES DE EDICIONES ANTERIORES DEL USUARIO]\nA continuación se muestran ejemplos reales de cómo la IA generó el post de forma errónea, y cómo el humano lo corrigió. Debes usar estos ejemplos para imitar el ESTILO, TONO y ESTRUCTURA preferida del humano.\n`;
      ejemplosFewShot.results.forEach((ej, index) => {
        fewShotPromptSnippet += `\nEjemplo #${index + 1}:\n- Así lo generó la IA erróneamente:\n"""\n${ej.original_text}\n"""\n- Así lo corrigió el humano (Sigue este estándar preferido):\n"""\n${ej.updated_text}\n"""\n--------------------------------------------------------------------------------`;
      });
    }
  } catch(e) {
    console.error("Error reading best_posts_examples:", e);
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

[FORMATO DE SALIDA ESTRICTO]
Responde ÚNICAMENTE con un objeto JSON válido que cumpla estrictamente con el esquema definido.
`;

  let prompt = `Aquí tienes la noticia cruda para procesar:

Titular original: ${post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia'}
Resumen/Texto completo: ${newsContent}

[INSTRUCCIÓN CRÍTICA DE ESTRUCTURA VISUAL Y DENSIDAD]
Queda ESTRICTAMENTE PROHIBIDO escribir muros de texto continuos o bloques monolíticos.
MÁXIMA RESTRICCIÓN: Rompe visualmente el texto. Usa siempre párrafos cortos (máximo 3 líneas visuales), saltos de línea estratégicos y bullets. Para asegurar los 1.800 caracteres mínimos, expande exhaustivamente CADA SECCIÓN de la Terna Procedural con múltiples párrafos cortos y precisos. Utiliza OBLIGATORIAMENTE los 3 encabezados exactos exigidos con sus emojis correspondientes (⚠️, ⚖️, 💼).
`;

  if (prompt.length > 6000) {
    prompt = prompt.substring(0, 6000) + "\n\n[TEXTO TRUNCADO POR LÍMITE DE TAMAÑO]";
  }

  // 3. Re-try loop for validation
  let generatedData = null;
  let postText = '';
  let carouselData = null;
  let videoFlowData = null;
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
    const hasRedundancy = paragraphs.length > 0 && uniqueParagraphs.size !== paragraphs.length;

    if (postText.length >= 1700 && !hasRedundancy) {
      break; // Success!
    } else {
      console.warn(`Attempt ${attempt} failed validation: post length ${postText.length} < 1700 or redundancy=${hasRedundancy}. Retrying...`);
      if (attempt > maxRetries) {
        throw new Error(`VALIDATION_FAILED: El modelo no alcanzó la densidad procedural requerida sin redundancias o fue muy corto tras ${maxRetries} reintentos.`);
      }
      currentTemperature = 0.2; // Force strict, dense structure on retry
      
      // INYECTAR REGAÑINA Y FORZADO DE ESTRUCTURA MULTI-SECCIÓN
      prompt += `\n\n[INSTRUCCIÓN CRÍTICA DE REINTENTO - LONGITUD Y REDUNDANCIA]\nTu intento anterior falló porque era muy corto (${postText.length} caracteres) o repetía párrafos de forma cíclica. ESTÁS OBLIGADO a superar los 1.800 caracteres SIN REPETIR NINGUNA FRASE O PÁRRAFO. Para lograrlo sin añadir paja, DEBES estructurar el texto con las siguientes 4 secciones (mínimo 2 párrafos ultra-densos por sección):\n1. Análisis técnico del impacto legal y normativo.\n2. Supuesto práctico 1: Cómo afecta a una Agencia de Marketing digital.\n3. Supuesto práctico 2: Cómo afecta a un E-commerce.\n4. Procedimiento operativo de defensa (modelos a presentar, recursos, plazos legales).\n¡Desarrolla los supuestos prácticos y la defensa con el máximo rigor, citando artículos distintos y usando muchísimos tecnicismos para alargar la longitud sin repetir contenido!`;
    }
  }

  carouselData = generatedData.carrusel || generatedData.carousel || null;
  videoFlowData = generatedData.video_flow || null;
  firstComment = generatedData.first_comment || null;

  if (!postText) {
    console.warn('Generated JSON did not contain a standard "post_linkedin" field. Falling back to raw JSON dump.');
    postText = "ERROR: La IA no devolvió el campo 'post_linkedin'. Contenido crudo devuelto:\\n\\n" + JSON.stringify(generatedData, null, 2);
  }

  // Encode carousel JSON as base64 so it can be stored in media_base64
  // The frontend detects this by checking if it starts with 'CAROUSEL:'
  let carouselBase64 = null;
  if (carouselData) {
    try {
      const carouselStr = 'CAROUSEL:' + JSON.stringify(carouselData);
      carouselBase64 = btoa(unescape(encodeURIComponent(carouselStr)));
    } catch (e) {
      // If encoding fails, skip carousel - don't fail the whole generation
      console.error('Failed to encode carousel:', e);
    }
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
    first_comment: firstComment,
    ...(carouselBase64 ? { media_base64: carouselBase64 } : {}),
    ...(videoFlowData ? { video_flow_json: JSON.stringify(videoFlowData) } : {})
  });

  // DISPARADOR ASÍNCRONO PARA VÍDEO
  // Si tenemos webhook de Make/Zapier y hay video_flow, enviamos el payload en background
  if (videoFlowData && env.VIDEO_AUTOMATION_WEBHOOK) {
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(
        fetch(env.VIDEO_AUTOMATION_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: id,
            video_data: videoFlowData
          })
        }).catch(err => console.error("Error enviando flujo a automatización de vídeo:", err))
      );
    } else {
      console.warn("ctx.waitUntil no está disponible. No se puede ejecutar el webhook de vídeo de forma segura en background.");
    }
  }

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
`;

  const prompt = `=== POST EDITADO ===
El usuario ha editado su post de LinkedIn y ahora tiene este texto final:
"${newPostText}"

Genera un nuevo Carrusel de 6 diapositivas para acompañar perfectamente a este texto editado.
Devuelve ÚNICAMENTE un objeto JSON válido con la estructura de las diapositivas.
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

/**
 * Regenerate ONLY the video script, based on an edited post text.
 */
export async function regenerateVideo(db, env, ctx, id, newPostText) {
  // 1. Get the post
  const post = await getPost(db, id);
  if (!post) {
    throw new Error('Post not found');
  }

  // 2. Load context variables
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
  
  const { SYSTEM_PROMPT, VIDEO_FLOW_SCHEMA, PROMPT_BLINDAJE } = await import('../utils/prompts.js');

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
[RESTRICCIONES DE NATURALIDAD DE VÍDEO (OBLIGATORIAS)]
1. PROHIBICIÓN DE GANCHOS CLICHÉ: Queda terminantemente PROHIBIDO empezar la primera escena con frases como "Hoy te enseño", "En este vídeo verás", o "¿Sabías que...?". Empieza hablando directamente exponiendo un dato de dolor, métrica de pérdidas o contingencia real.
2. HUMANIZACIÓN DE LA VOZ: Las frases en 'voice_over_script' deben ser cortas, directas y asépticas. No debe sonar a discurso memorizado; debe imitar la respuesta natural e improvisada de un consultor senior en una reunión de negocio.
3. DINÁMICA VISUAL: En el campo 'visual_prompt', intercala momentos mirando a cámara con planos de apoyo rápidos (B-roll de código, pantallas financieras oscuras, etc) para evitar más de 4-5 segundos de exposición estática del presentador.

ESTÁS EN MODO "REGENERAR VÍDEO".
Tienes que generar SOLO el flujo de vídeo para acompañar al siguiente post editado.
`;

  const prompt = `=== POST EDITADO ===
El usuario ha editado su post de LinkedIn y ahora tiene este texto final:
"${newPostText}"

Genera un nuevo Guión de Vídeo dinámico para acompañar perfectamente a este texto editado.
Devuelve ÚNICAMENTE un objeto JSON válido con la estructura del vídeo (config y scenes).
`;


  const groqKey = await getGroqKey(db, env);
  if (!env.GEMINI_API_KEY && !groqKey) {
    throw new Error('Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the Worker.');
  }

  let generatedText = await callAIWithFallback(db, env, dynamicSystemPrompt, prompt, "application/json", VIDEO_FLOW_SCHEMA);

  if (generatedText.startsWith("```")) {
    const parts = generatedText.split("```");
    if (parts.length >= 3) {
      generatedText = parts[1].replace(/^json\n/i, "");
    }
  }
  generatedText = generatedText.trim();

  let videoFlowData = null;
  try {
    videoFlowData = JSON.parse(generatedText);
  } catch (e) {
    console.error("AI did not return valid JSON for video flow:", generatedText);
    throw new Error("La IA no devolvió un JSON válido para el guion de vídeo.");
  }

  // 3. Update DB
  const updatedPost = await updatePost(db, id, {
    video_flow_json: JSON.stringify(videoFlowData)
  });

  // The webhook is now triggered in handleApprove when the post is approved.

  return updatedPost;
}
