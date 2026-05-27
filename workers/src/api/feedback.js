/**
 * feedback.js — User decision recording and learning system analytics.
 *
 * Every time a user approves, rejects, or edits a post the dashboard calls
 * POST /api/feedback. This module inserts the decision and recalculates the
 * stats_cache so the analytics page always has fresh numbers.
 *
 * Learning phases:
 *   control_total   → < 30 decisions
 *   sugerencias     → 30–99 decisions (model suggests, human confirms)
 *   autopublicacion → ≥ 100 decisions + avg_confidence ≥ 0.80
 */

import { generateUUID, nowISO, levenshteinRatio } from '../utils.js';
import { getPost } from './posts.js';

const PHASE_THRESHOLDS = {
  sugerencias:     30,
  autopublicacion: 100,
};
const AUTO_PUBLISH_MIN_CONFIDENCE = 0.80;

// ─── Record decision ──────────────────────────────────────────────────────────

/**
 * Insert a user decision and update stats cache.
 *
 * Expected `data` shape:
 * {
 *   post_id:               string (required)
 *   decision:              'approved' | 'rejected' | 'edited' (required)
 *   edited_content?:       string  (the final text, for edit_ratio calculation)
 *   time_to_decide_seconds?: number
 * }
 */
export async function recordFeedback(db, data) {
  const { post_id, decision, edited_content, rejection_reason, edit_reason, time_to_decide_seconds } = data;

  if (!post_id)  throw new Error('post_id is required');
  if (!decision) throw new Error('decision is required');

  const validDecisions = ['approved', 'rejected', 'edited'];
  if (!validDecisions.includes(decision)) {
    throw new Error(`Invalid decision "${decision}". Must be: ${validDecisions.join(', ')}`);
  }

  // Load source post for denormalised fields
  const post = await getPost(db, post_id);
  if (!post) throw new Error(`Post not found: ${post_id}`);

  // Calculate edit ratio
  let editRatio = 0;
  if (decision === 'edited' && edited_content) {
    editRatio = levenshteinRatio(post.content, edited_content);
  }

  const id  = generateUUID();
  const now = nowISO();

  await db.prepare(`
    INSERT INTO decisions (
      id, post_id, decision, edit_ratio,
      time_to_decide_seconds, post_type, sector,
      source_name, ai_score, char_count, rejection_reason, edit_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    post_id,
    decision,
    editRatio,
    time_to_decide_seconds ?? null,
    post.type,
    post.sector,
    post.source_name ?? null,
    post.ai_score    ?? null,
    post.char_count  ?? null,
    rejection_reason ?? null,
    edit_reason      ?? null,
    now,
  ).run();

  // Async cache refresh (fire and forget — non-blocking for the caller)
  _refreshStatsCache(db).catch(err =>
    console.error('[feedback] Stats cache refresh failed:', err.message),
  );

  return { id, decision, edit_ratio: editRatio };
}

// ─── Approval stats by segment ────────────────────────────────────────────────

/**
 * Calculate approval rates broken down by sector, source, and post type.
 * Uses the decisions table directly (no cache).
 */
export async function getApprovalStats(db) {
  const [bySector, bySource, byType] = await Promise.all([
    _aggregateBy(db, 'sector'),
    _aggregateBy(db, 'source_name'),
    _aggregateBy(db, 'post_type'),
  ]);

  return { by_sector: bySector, by_source: bySource, by_type: byType };
}

// ─── Learning progress ────────────────────────────────────────────────────────

/**
 * Returns the full learning system status for the dashboard.
 */
export async function getLearningProgress(db) {
  // Total decisions
  const totalRow = await db
    .prepare("SELECT COUNT(*) AS total FROM decisions")
    .first();
  const total = totalRow?.total ?? 0;

  // Overall approval rate
  const approvedRow = await db
    .prepare("SELECT COUNT(*) AS n FROM decisions WHERE decision IN ('approved','edited')")
    .first();
  const approvalRate = total > 0 ? Number((approvedRow.n / total).toFixed(4)) : 0;

  // By sector
  const sectorRows = await db.prepare(`
    SELECT
      sector,
      COUNT(*) AS total,
      SUM(CASE WHEN decision IN ('approved','edited') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM decisions
    WHERE sector IS NOT NULL
    GROUP BY sector
    ORDER BY total DESC
  `).all();

  const bySector = {};
  for (const row of sectorRows.results ?? []) {
    bySector[row.sector] = {
      approved: row.approved,
      rejected: row.rejected,
      total:    row.total,
      rate:     row.total > 0 ? Number((row.approved / row.total).toFixed(4)) : 0,
    };
  }

  // Weekly confidence trend (last 10 ISO weeks)
  const trendRows = await db.prepare(`
    SELECT
      strftime('%Y-W%W', created_at) AS week,
      AVG(ai_score / 10.0) AS avg_confidence
    FROM decisions
    WHERE ai_score IS NOT NULL
    GROUP BY week
    ORDER BY week DESC
    LIMIT 10
  `).all();

  const confidenceTrend = (trendRows.results ?? [])
    .reverse()
    .map(r => Number((r.avg_confidence ?? 0).toFixed(4)));

  // Derive current phase
  const avgConfidence = confidenceTrend.length
    ? confidenceTrend[confidenceTrend.length - 1]
    : 0;

  const phase = _derivePhase(total, avgConfidence);

  // Estimate weeks to next phase
  const weeksToAutopublish = _estimateWeeksToAutopublish(
    total, approvalRate, avgConfidence,
  );

  return {
    total_decisions:            total,
    approval_rate:              approvalRate,
    by_sector:                  bySector,
    avg_confidence_trend:       confidenceTrend,
    estimated_weeks_to_autopublish: weeksToAutopublish,
    current_phase:              phase,
  };
}

// ─── Internal stats cache refresh ─────────────────────────────────────────────

/**
 * Recalculate and persist stats to the stats_cache table.
 * Called after every new decision.
 */
async function _refreshStatsCache(db) {
  const [approval, learning] = await Promise.all([
    getApprovalStats(db),
    getLearningProgress(db),
  ]);

  const now = nowISO();
  const entries = [
    ['approval_stats',    JSON.stringify(approval)],
    ['learning_progress', JSON.stringify(learning)],
  ];

  for (const [key, value] of entries) {
    await db.prepare(`
      INSERT INTO stats_cache (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, value, now).run();
  }
}

// ─── Aggregation helper ───────────────────────────────────────────────────────

async function _aggregateBy(db, column) {
  const rows = await db.prepare(`
    SELECT
      ${column} AS segment,
      COUNT(*) AS total,
      SUM(CASE WHEN decision IN ('approved','edited') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM decisions
    WHERE ${column} IS NOT NULL
    GROUP BY ${column}
    ORDER BY total DESC
  `).all();

  const result = {};
  for (const row of rows.results ?? []) {
    result[row.segment] = {
      approved: row.approved,
      rejected: row.rejected,
      total:    row.total,
      rate:     row.total > 0 ? Number((row.approved / row.total).toFixed(4)) : 0,
    };
  }
  return result;
}

// ─── Phase logic ──────────────────────────────────────────────────────────────

function _derivePhase(totalDecisions, avgConfidence) {
  // Autopublicación desactivada por petición del usuario - se mantiene en control_total o sugerencias
  if (totalDecisions >= PHASE_THRESHOLDS.sugerencias) {
    return 'sugerencias';
  }
  return 'control_total';
}

function _estimateWeeksToAutopublish(totalDecisions, approvalRate, avgConfidence) {
  // Retorna null ya que no se va a autopublicar
  return null;
}
