/**
 * posts.js — CRUD layer for the `posts` D1 table.
 *
 * All functions are async and receive the D1 `db` binding directly so they
 * remain testable without mocking the whole Worker env object.
 */

import { generateUUID, nowISO, levenshteinRatio } from '../utils.js';

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
    'urgency', 'ai_score', 'confidence_score', 'hashtags', 'media_base64'
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
          maxOutputTokens: responseMimeType === "application/json" ? 4096 : 2048,
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
        console.warn(`Gemini API call failed (status ${res.status}): ${errText}. Trying Groq fallback...`);
        // Fall through to Groq on any Gemini error (quota, rate limit, etc.)
      }
    } catch (err) {
      console.warn(`Gemini call failed with exception: ${err.message}. Trying Groq fallback...`);
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
        max_tokens: responseMimeType === "application/json" ? 3000 : 1500
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

export async function regeneratePost(db, env, id, instructions) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  const groqKey = await getGroqKey(db, env);
  if (!env.GEMINI_API_KEY && !groqKey) {
    throw new Error('Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the Worker.');
  }

  const systemInstruction = `[ROLE]
Actúa como un Copywriter de Élite para LinkedIn y un Asesor Fiscal ultra-disruptivo. Tu nombre es Alberto López, especialista en eCommerce y Real Estate. Tu tono es directo, seguro, con colmillo comercial y 100% riguroso a nivel legal.

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
- HASHTAGS: Añade exactamente 4 hashtags indexados al final.`;

  const prompt = `=== POST ORIGINAL ===
${post.content_edited || post.content}

=== INSTRUCCIONES DE REESCRITURA DE ALBERTO ===
${instructions}

Por favor, reescribe el post completo siguiendo las instrucciones de Alberto y respetando el formato original. Devuelve únicamente el texto del post reescrito y la nueva encuesta sugerida, sin comentarios introductorios ni explicaciones adicionales.`;

  const rewrittenText = await callAIWithFallback(db, env, systemInstruction, prompt, "text/plain");
  const cleanRewrittenText = rewrittenText.trim();

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

export async function generatePostFromDraft(db, env, id) {
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
      throw new Error('No se encontró el borrador original. Solo se puede rehacer si el post fue generado desde este panel recientemente.');
    }
  }

  let prompt = draftData.prompt;
  if (!prompt) {
    throw new Error('Draft JSON is missing the prompt string');
  }

  // Only truncate if very long (Gemini handles ~30k tokens, Groq ~6k)
  // Groq truncation happens in callAIWithFallback
  if (prompt.length > 20000) {
    prompt = prompt.substring(0, 20000) + "\n\n[TEXTO TRUNCADO POR LÍMITE DE TAMAÑO]";
  }

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

  // Para Llama 3.3 70B en Groq, forzamos la identidad al final del prompt del usuario para evitar amnesia
  prompt += `\n\n=== RECORDATORIO CRÍTICO DE IDENTIDAD ANTES DE GENERAR ===
1. Eres ALBERTO LÓPEZ, Copywriter de Élite y Fiscalista Disruptor. Escribe en PRIMERA PERSONA ("yo", "nuestro").
2. Tono DISRUPTIVO, con autoridad y lenguaje natural premium. Cero obviedades.
3. ESTRUCTURA: Gancho al dolor, Contexto, Hoja de Ruta (lista limpia), Cierre de Autoridad. (Máx 1500 caracteres).
4. CERO RELLENO: No uses frases genéricas como "Esto es muy importante". Ve directo al dato y a las consecuencias.
5. Usa los datos exactos del Fact-Check (fecha, sentencia) si los hay.
6. FORMATO: Es OBLIGATORIO que devuelvas un objeto JSON válido con las claves "post", "first_comment" y "carousel".`;

  let generatedText = await callAIWithFallback(db, env, systemInstruction, prompt, "application/json");

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

  const postText = generatedData.post || '';
  const firstComment = generatedData.first_comment || null;
  // Support both 'carousel' and 'carrusel' key names from Gemini
  const carouselData = generatedData.carousel || generatedData.carrusel || null;

  if (!postText) {
    throw new Error('Generated JSON did not contain a "post" field.');
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

  // 2. Prepare prompt
  const systemPrompt = `Eres Alberto López. Gestor fiscal y contable. Generas carruseles de LinkedIn en primera persona. Nunca hablas de ti mismo en tercera persona. Eres un transmisor objetivo de la noticia. No das opiniones personales.`;
  const prompt = `
=== FORMATO DE SALIDA (CRÍTICO) ===
El usuario ha editado su post de LinkedIn y ahora tiene este texto:
"${newPostText}"

Genera un nuevo Carrusel de 6 diapositivas para acompañar perfectamente a este texto editado.
Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta.
El campo "slide_type" es OBLIGATORIO: usa "cover" para la portada, "interior" para el contenido, y "closing" para la diapositiva de cierre al final.
PROHIBIDO ESCRIBIR PUNTOS FINALES (.) AL FINAL DE CADA BULLET.
PROHIBIDO CORTAR FRASES O TÍTULOS. Tienen que tener sentido completo.
PROHIBIDO USAR FRACCIONES O NÚMEROS DE DIAPOSITIVA (como "1/4", "2/5", "5/5") en el campo "pre_title". El "pre_title" debe ser siempre una categoría temática corta en mayúsculas (como "EL PROBLEMA", "AFECTADOS", "QUÉ HACER HOY", "ESTRATEGIA", "REGLA CLAVE", "CONSEJO PRÁCTICO"). La numeración del carrusel ya se renderiza de forma automática en otra sección de la diapositiva.
PROHIBIDO MENCIONAR el nombre "Alberto López" en ningún campo (title, subtitle, pre_title, bullets). Títulos directos sobre el tema: NUNCA "La estrategia de Alberto López" ni "Alberto López recomienda". El nombre ya aparece en la firma visual.
CONTENIDO OBLIGATORIO Y RIGOR: El carrusel NO puede ser un resumen vago ni contener texto motivacional. Debe ser un documento de utilidad inmediata. Si el post habla de una medida, inspección, ley o sentencia, el carrusel DEBE detallar explícitamente:
  1. Qué ley, sentencia o normativa exacta lo regula. ES OBLIGATORIO citar el número exacto, identificador y la fecha de la sentencia, ley o consulta vinculante. PROHIBIDO poner frases genéricas de relleno como "se puede consultar en el BOE" si no das el identificador exacto.
  2. Qué ocurre exactamente (los hechos concretos).
  3. Cuáles son las consecuencias reales (multas en euros, sanciones, paralizaciones).
FECHAS ABSOLUTAS: Si la noticia menciona un día relativo (ej: "este lunes"), tradúcelo SIEMPRE a una fecha absoluta (ej: "este lunes 8 de junio"). Nunca dejes fechas relativas.
BULLETS: Cada diapositiva interior debe tener entre 3 y 5 bullets. Cada bullet debe ser denso en información, concreto y útil — datos, importes, plazos o acciones exactas. PROHIBIDO bullets genéricos o motivacionales.
ESTRUCTURA DEL CARRUSEL: Evita la redundancia entre diapositivas. Si tienes 4 diapositivas interiores, usa una progresión lógica (ej. D1: El contexto, D2: A quién afecta, D3: Los riesgos reales, D4: Qué hacer hoy/Soluciones). NO repitas las mismas ideas con distintas palabras en diapositivas consecutivas.
TÍTULOS: El campo "title" debe ser corto, directo e impactante. Máximo 7 palabras. Sin rodeos. La fuerza del título viene de la precisión, no de la longitud.
DIAPOSITIVA DE CIERRE: el title DEBE ser una pregunta MUY CORTA Y DIRECTA (MÁXIMO 5 A 7 PALABRAS) que divida al lector, que le obligue a posicionarse. Las frases largas no funcionan, ve al grano. El subtitle DEBE ser una llamada a la acción original y desafiante aplicando este diccionario de marca:
  * En vez de "Comparte tus dudas", usa "Cuéntame cómo lo estás aplicando".
  * En vez de "¿Te afecta esta situación?", usa "¿Cómo estás lidiando con el bloqueo?".
  * En vez de "Déjanos tu comentario", usa "Te leo abajo" o "Abrimos debate".
  * En vez de "Escribe tu experiencia", usa "Cuéntame el caso real".
PROHIBIDO usar emojis señalando abajo.
{
  "carousel": [
    {
      "slide_type": "cover",
      "pre_title": "ACTUALIDAD",
      "title": "Título editorial de alto impacto",
      "subtitle": "Promesa de valor o sumario",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "EL PROBLEMA",
      "title": "Título personalizado y descriptivo sobre el problema (ej: Inspección sorpresa, El nuevo recargo, etc.)",
      "subtitle": "El impacto económico crudo",
      "bullets": [
        "De 2 a 3 puntos densos"
      ]
    },
    {
      "slide_type": "interior",
      "pre_title": "AFECTADOS",
      "title": "Título personalizado y descriptivo sobre los afectados (ej: Autónomos societarios, Pymes de más de 8M, etc.)",
      "subtitle": "Perfil de los afectados",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "QUÉ HACER HOY",
      "title": "Título personalizado y descriptivo sobre la acción a tomar (ej: Revisa tu facturación, Modifica el software, etc.)",
      "subtitle": "Mitiga el impacto de inmediato",
      "bullets": []
    },
    {
      "slide_type": "interior",
      "pre_title": "ESTRATEGIA",
      "title": "Título personalizado y descriptivo sobre la estrategia (ej: Optimización del IVA, Deducción por I+D+i, etc.)",
      "subtitle": "La estrategia de Alberto López",
      "bullets": []
    },
    {
      "slide_type": "closing",
      "pre_title": "TU TURNO (o llamada similar)",
      "title": "¿[Pregunta MUY ESPECÍFICA sobre las implicaciones de esta noticia para su negocio]?",
      "subtitle": "Llamada a la acción específica (ej. Cuéntame si te ha pasado, Revisa tus estatutos hoy)",
      "bullets": []
    }
  ]
}
`;

  const groqKey = await getGroqKey(db, env);
  if (!env.GEMINI_API_KEY && !groqKey) {
    throw new Error('Neither GEMINI_API_KEY nor GROQ_API_KEY is configured on the Worker.');
  }

  const responseSchema = {
    type: "object",
    properties: {
      carousel: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slide_type: { type: "string", enum: ["cover", "interior", "closing"] },
            pre_title: { type: "string" },
            title: { type: "string" },
            subtitle: { type: "string" },
            bullets: { type: "array", items: { type: "string" } }
          },
          required: ["slide_type", "pre_title", "title", "subtitle", "bullets"]
        }
      }
    },
    required: ["carousel"]
  };

  let generatedText = await callAIWithFallback(db, env, systemPrompt, prompt, "application/json", responseSchema);

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

  const carouselData = generatedData.carousel || generatedData.carrusel || null;
  if (!carouselData) {
    throw new Error('Generated JSON did not contain a "carousel" field.');
  }

  let carouselBase64 = null;
  const carouselStr = 'CAROUSEL:' + JSON.stringify(carouselData);
  carouselBase64 = btoa(unescape(encodeURIComponent(carouselStr)));

  const updatedPost = await updatePost(db, id, {
    media_base64: carouselBase64,
    content_edited: newPostText
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
