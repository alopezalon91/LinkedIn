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

  if (status) { conditions.push('status = ?');  bindings.push(status); }
  if (type)   { conditions.push('type = ?');    bindings.push(type);   }
  if (sector) { conditions.push('sector = ?');  bindings.push(sector); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Urgency ordering: alta > media > baja, then AI score DESC
  const orderBy = `
    ORDER BY
      CASE urgency WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      ai_score DESC,
      created_at DESC
  `;

  const [rowsResult, countResult] = await Promise.all([
    db.prepare(`SELECT * FROM posts ${where} ${orderBy} LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, offset)
      .all(),
    db.prepare(`SELECT COUNT(*) AS total FROM posts ${where}`)
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
  const row = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
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

  await db.prepare(`
    INSERT INTO posts (
      id, type, sector, status, content, content_edited,
      source_id, source_url, source_name,
      urgency, ai_score, confidence_score,
      char_count, hashtags,
      scheduled_at, published_at, linkedin_post_id,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, 'pending', ?, NULL,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      NULL, NULL, NULL,
      ?, ?
    )
  `).bind(
    id,
    data.type,
    data.sector,
    data.content,
    data.source_id    ?? null,
    data.source_url   ?? null,
    data.source_name  ?? null,
    data.urgency      ?? 'media',
    data.ai_score     ?? null,
    data.confidence_score ?? null,
    charCount,
    hashtags,
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
    'status', 'content_edited', 'scheduled_at',
    'urgency', 'ai_score', 'confidence_score', 'hashtags',
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
  if (!['pending', 'approved'].includes(post.status)) {
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
