/**
 * posts.js — CRUD layer for the `posts` D1 table.
 *
 * All functions are async and receive the D1 `db` binding directly so they
 * remain testable without mocking the whole Worker env object.
 */

import { generateUUID, nowISO, levenshteinRatio } from '../utils.js';
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, CAROUSEL_SCHEMA } from '../utils/prompts.js';

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

function cleanGeneratedPostText(text) {
  if (!text) return '';
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
    'urgency', 'ai_score', 'confidence_score', 'hashtags', 'media_base64', 'video_flow_json'
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
async function callAIWithFallback(db, env, systemPrompt, prompt, responseMimeType = "text/plain", responseSchema = null) {
  // 1. Try Gemini
  if (env.GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      
      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
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
      const MAX_GROQ_CHARS = 8000;
      let groqPrompt = prompt;
      if (prompt.length > MAX_GROQ_CHARS) {
        // Try to preserve the BRANDING_RULES section which has instructions
        const rulesIndex = prompt.indexOf("=== [BRANDING_RULES]");
        if (rulesIndex !== -1) {
          const contentPart = prompt.substring(0, rulesIndex);
          const rulesPart = prompt.substring(rulesIndex);
          const allowedContent = MAX_GROQ_CHARS - rulesPart.length;
          groqPrompt = contentPart.substring(0, Math.max(allowedContent, 2000))
            + "\n\n[TEXTO TRUNCADO]\n\n" + rulesPart;
        } else {
          groqPrompt = prompt.substring(0, MAX_GROQ_CHARS) + "\n\n[TEXTO TRUNCADO]";
        }
      }

      const url = "https://api.groq.com/openai/v1/chat/completions";
      const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: groqPrompt }
        ],
        temperature: 0.7,
        max_tokens: responseMimeType === "application/json" ? 3500 : 2500
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
          
          if (currentModel === "llama-3.3-70b-versatile") {
            console.warn(`[Groq] Rate limit hit on 70b model. Falling back to 8b model...`);
            currentModel = "llama-3.1-8b-instant";
            retries++;
            continue; // Retry immediately with 8b
          }
          
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
  let systemInstruction = "Actúa como un Copywriter de Élite para LinkedIn. Reescribe el post según las instrucciones proporcionadas.";
  if (post.source_url && post.source_url.includes('#DRAFT_B64=')) {
    try {
      const b64 = post.source_url.split('#DRAFT_B64=')[1];
      const draftData = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (draftData.system_instruction) {
        systemInstruction = draftData.system_instruction;
      }
    } catch (e) { /* ignore */ }
  }

  const prompt = `=== POST ORIGINAL ===
${post.content_edited || post.content}

=== INSTRUCCIONES DE REESCRITURA DE ALBERTO ===
${instructions}

Por favor, reescribe el post completo siguiendo las instrucciones de Alberto y respetando el formato original. Devuelve únicamente el texto del post reescrito y la nueva encuesta sugerida, sin comentarios introductorios ni explicaciones adicionales.`;

  const rewrittenText = await callAIWithFallback(db, env, systemInstruction, prompt, "text/plain");
  const cleanRewrittenText = cleanGeneratedPostText(rewrittenText.trim());

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
      const formatRules = `Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{
  "post": "El texto completo del post para LinkedIn...",
  "first_comment": "Texto del primer comentario de la publicación (donde solemos dejar un enlace o CTA adicional).",
  "carousel": [
    { "slide_type": "cover", "pre_title": "...", "title": "...", "subtitle": "...", "bullets": [] },
    { "slide_type": "interior", "pre_title": "...", "title": "...", "subtitle": "...", "bullets": ["..."] },
    { "slide_type": "closing", "pre_title": "DEBATE", "title": "¿PREGUNTA?", "subtitle": "COMENTA TU CASO 👇", "bullets": [] }
  ]
}

=== REGLAS DEL COPYWRITING (CRÍTICO) ===
- REGLA DE EXTENSIÓN ESTRICTA: El campo "post" debe tener obligatoriamente entre 1800 y 2200 caracteres. NUNCA te pases de 2300 caracteres.
- REGLA ANTI-BUCLE (CRÍTICO): PROHIBIDO repetir frases de cierre como "Si te gustó", "Contáctanos" o "Comparte". Termina con UNA sola pregunta al final.
- CÓMO ALCANZAR LA LONGITUD: Para llegar a los 2000 caracteres sin repetir texto, DESARROLLA la noticia con esta estructura:
  1. Gancho inicial y explicación del problema.
  2. ¿A quién afecta y por qué? (Invéntate 2 ejemplos detallados de pymes o autónomos sufriendo este problema).
  3. Análisis técnico de la normativa (profundiza como un abogado experto).
  4. Consecuencias a largo plazo si no se preparan.
  5. Cierre con UNA sola pregunta.
- Agrupa las ideas en párrafos densos de 2 a 4 líneas. PROHIBIDO escribir párrafos de una sola frase o de una sola línea. Deja SIEMPRE una línea en blanco entre cada bloque de texto.
- TONO DISRUPTIVO Y DE ALERTA: Escribe como un experto advirtiendo de un peligro ("La Administración acaba de activar la trampa para...").

=== ESTRUCTURA Y FORMATO DEL POST DE LINKEDIN (CRÍTICO) ===
1. GANCHO: Título atractivo (máximo 1-2 líneas) con algún icono llamativo. Seguido de un salto de línea doble (\\n\\n).
2. CUERPO (ALTA DENSIDAD DE VALOR): Explicación detallada. Usa listas numeradas con emojis (1️⃣, 2️⃣, 3️⃣) para detallar la casuística o pasos. Usa como máximo 2 o 3 iconos temáticos (📈, 🏛️, 💶, ⚖️, ⚠️) en todo el post. Todo separado con saltos de línea doble (\\n\\n).
3. INTERACCIÓN: Termina el post siempre con una pregunta abierta MUY DIRECTA AL DOLOR del lector para generar comentarios y debate. Separada con una línea en blanco.
4. HASHTAGS: Incluye siempre 4 o 5 hashtags relevantes al final.
- ESTRUCTURA DE 6 SLIDES EXACTAS: 1 cover, 4 interior, 1 closing.
- CAROUSEL BULLETS: PROHIBIDO usar emojis numerados gigantes (1️⃣, 2️⃣, 3️⃣) o balas infantiles en el array de bullets del carrusel. Usa viñetas limpias sin emojis en las diapositivas.`;
      draftData = {
        title: post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia',
        summary: post.content,
        prompt: `Genera un contenido dual (Post de LinkedIn + Carrusel Resumido) a partir del siguiente artículo:\n\nTitular: ${post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia'}\nResumen/Texto completo: ${post.content}\n\n${formatRules}`,
        original_text: post.content
      };
    }
  }

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
    const ejemplosFewShot = await db.prepare(
      "SELECT original_text, updated_text FROM best_posts_examples WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 3"
    ).all();
    if (ejemplosFewShot.results && ejemplosFewShot.results.length > 0) {
      fewShotPromptSnippet = `\n\n[EJEMPLOS DE APRENDIZAJE REALES DE EDICIONES ANTERIORES DEL USUARIO]\nA continuación se muestran ejemplos reales de cómo la IA generó el post de forma errónea, y cómo el humano lo corrigió. Debes usar estos ejemplos para imitar el ESTILO, TONO y ESTRUCTURA preferida del humano.\n`;
      ejemplosFewShot.results.forEach((ej, index) => {
        fewShotPromptSnippet += `\nEjemplo #${index + 1}:\n- Así lo generó la IA erróneamente:\n"""\n${ej.original_text}\n"""\n- Así lo corrigió el humano (Sigue este estándar preferido):\n"""\n${ej.updated_text}\n"""\n--------------------------------------------------------------------------------`;
      });
    }
  } catch(e) {
    console.error("Error reading best_posts_examples:", e);
  }

  // 2. Personalizar el prompt del sistema con los parámetros del usuario
  const sectorFocus = getSectorFocusInstruction(post.sector);
  const verbContext = getContextualVerbInstruction(post.content);
  const dynamicSystemPrompt = `
${SYSTEM_PROMPT}

[PARAMETRIZACIÓN DINÁMICA DE ESTILO Y CONTEXTO]
${sectorFocus}
${verbContext}
- Nivel de profundidad técnica y legal requerido: ${prof}/5 (A mayor nivel, cita más artículos específicos y tecnicismos).
- Densidad de emojis permitida en el texto principal: ${emoj}/3 (Si es 0 o 1, sé sumamente minimalista; si es 3, usa los indicados en las reglas).
- Estilo de longitud de oraciones: ${long}/3 (1: Cortas y tajantes, 2: Mixtas, 3: Párrafos densos y argumentativos).
${fewShotPromptSnippet}
`;

  let prompt = `Aquí tienes la noticia cruda para procesar:

Titular original: ${post.source_id ? post.source_id.replace(/-/g, ' ') : 'Noticia'}
Resumen/Texto completo: ${post.content}
`;

  if (prompt.length > 20000) {
    prompt = prompt.substring(0, 20000) + "\n\n[TEXTO TRUNCADO POR LÍMITE DE TAMAÑO]";
  }

  let generatedText = await callAIWithFallback(db, env, dynamicSystemPrompt, prompt, "application/json", RESPONSE_SCHEMA);

  if (generatedText.startsWith("```")) {
    const parts = generatedText.split("```");
    generatedText = parts[1] || generatedText;
    if (generatedText.startsWith("json")) {
      generatedText = generatedText.substring(4).trim();
    }
  }

  let generatedData;
  try {
    generatedData = JSON.parse(generatedText);
  } catch (err) {
    throw new Error(`Failed to parse AI output as JSON: ${err.message}`);
  }

  let postText = cleanGeneratedPostText(generatedData.post_linkedin || generatedData.post || generatedData.texto || '');
  const carouselData = generatedData.carrusel || generatedData.carousel || null;
  const videoFlowData = generatedData.video_flow || null;

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
    const ejemplosFewShot = await db.prepare(
      "SELECT original_text, updated_text FROM best_posts_examples WHERE user_id = 'default' ORDER BY created_at DESC LIMIT 3"
    ).all();
    if (ejemplosFewShot.results && ejemplosFewShot.results.length > 0) {
      fewShotPromptSnippet = `\n\n[EJEMPLOS DE APRENDIZAJE REALES DE EDICIONES ANTERIORES DEL USUARIO]\nA continuación se muestran ejemplos reales de cómo la IA generó el post de forma errónea, y cómo el humano lo corrigió. Debes usar estos ejemplos para imitar el ESTILO, TONO y ESTRUCTURA preferida del humano.\n`;
      ejemplosFewShot.results.forEach((ej, index) => {
        fewShotPromptSnippet += `\nEjemplo #${index + 1}:\n- Así lo generó la IA erróneamente:\n"""\n${ej.original_text}\n"""\n- Así lo corrigió el humano (Sigue este estándar preferido):\n"""\n${ej.updated_text}\n"""\n--------------------------------------------------------------------------------`;
      });
    }
  } catch(e) {}

  const sectorFocus = getSectorFocusInstruction(post.sector);
  const dynamicSystemPrompt = `
${SYSTEM_PROMPT}

[PARAMETRIZACIÓN DINÁMICA DE ESTILO Y CONTEXTO]
${sectorFocus}
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
