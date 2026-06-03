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
    'status', 'content_edited', 'first_comment', 'scheduled_at', 'published_at', 'linkedin_post_id',
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
export async function approvePost(db, id, editedContent = null) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  const updates = { status: 'approved' };
  let editRatio = 0;

  if (editedContent && editedContent.trim() !== post.content.trim()) {
    updates.content_edited = editedContent;
    editRatio = levenshteinRatio(post.content, editedContent);
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

/**
 * Mark a post as scheduled and store the target publish timestamp.
 * @param {string} scheduledAt – ISO 8601 timestamp string
 */
export async function schedulePost(db, id, scheduledAt) {
  if (!scheduledAt) throw new Error('scheduledAt timestamp is required');

  const ts = new Date(scheduledAt);
  if (isNaN(ts.getTime())) throw new Error('scheduledAt is not a valid ISO timestamp');
  if (ts <= new Date())    throw new Error('scheduledAt must be in the future');

  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);
  if (!['pending', 'reviewed', 'approved'].includes(post.status)) {
    throw new Error(`Cannot schedule a post with status '${post.status}'`);
  }

  return updatePost(db, id, { status: 'scheduled', scheduled_at: scheduledAt });
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

export async function regeneratePost(db, env, id, instructions) {
  const post = await getPost(db, id);
  if (!post) throw new Error(`Post not found: ${id}`);

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the Worker.');
  }

  const systemInstruction = `Eres el asistente de Alberto López, gestor contable y fiscal en MyTaxBot (gestoría online para autónomos, pymes y emprendedores en toda España). Tu objetivo es reescribir una publicación de LinkedIn a partir de un borrador existente y de las nuevas instrucciones de Alberto.
Mantén la estructura del post original (titular llamativo con emoji, sección "Qué significa para ti" con bullets, opinión de Alberto, pregunta de debate y encuesta de LinkedIn) pero adapta el enfoque, el tono o el público objetivo según las nuevas instrucciones de Alberto.
NO incluyas ninguna llamada a la acción comercial o promocional (como 'escríbeme', 'te ayudamos'). El post debe ser puramente informativo y de valor.`;

  const prompt = `=== POST ORIGINAL ===
${post.content_edited || post.content}

=== INSTRUCCIONES DE REESCRITURA DE ALBERTO ===
${instructions}

Por favor, reescribe el post completo siguiendo las instrucciones de Alberto y respetando el formato original. Devuelve únicamente el texto del post reescrito y la nueva encuesta sugerida, sin comentarios introductorios ni explicaciones adicionales.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const rewrittenText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rewrittenText) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

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
  if (post.status !== 'draft') {
    throw new Error(`Only posts with status 'draft' can be generated, got '${post.status}'`);
  }

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the Worker.');
  }

  let draftData;
  try {
    draftData = JSON.parse(post.content);
  } catch (err) {
    throw new Error('Draft content is not valid JSON');
  }

  const prompt = draftData.prompt;
  if (!prompt) {
    throw new Error('Draft JSON is missing the prompt string');
  }

  const systemInstruction = "Actúa como un fiscalista disruptor, implacable y experto en copywriting de LinkedIn. IMPORTANTE: Responde SIEMPRE con un objeto JSON válido.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  let generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) {
    throw new Error('Gemini API returned an empty or invalid response.');
  }

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
    throw new Error(`Failed to parse Gemini output as JSON: ${err.message}`);
  }

  const postText = generatedData.post || '';
  const firstComment = generatedData.first_comment || null;

  if (!postText) {
    throw new Error('Generated JSON did not contain a "post" field.');
  }

  // Update post in D1
  const updatedPost = await updatePost(db, id, {
    status: 'pending',
    content: postText,
    first_comment: firstComment,
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
  
  // Create placeholders e.g. "?, ?, ?"
  const placeholders = sourceIds.map(() => '?').join(', ');
  
  const result = await db.prepare(
    `SELECT source_id FROM posts WHERE source_id IN (${placeholders})`
  )
    .bind(...sourceIds)
    .all();
    
  return (result.results ?? []).map(row => row.source_id);
}
