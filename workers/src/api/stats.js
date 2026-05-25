/**
 * stats.js — Comprehensive dashboard analytics.
 *
 * getSystemStats() is the single endpoint that the analytics page consumes.
 * It tries the stats_cache first (stale-while-revalidate style), then falls
 * back to a live DB query if the cache is older than 5 minutes.
 */

import { nowISO } from '../utils.js';
import { getLearningProgress } from './feedback.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Main stats endpoint ──────────────────────────────────────────────────────

/**
 * Returns comprehensive stats for the dashboard.
 *
 * Shape:
 * {
 *   posts: { total, pending, approved, rejected, published, scheduled },
 *   this_week: { generated, published, approval_rate },
 *   top_sectors: [{ sector, posts, rate }],
 *   learning: { phase, avg_confidence, weeks_to_auto }
 * }
 */
export async function getSystemStats(db) {
  // Try cache first
  const cached = await _tryCache(db, 'system_stats');
  if (cached) return cached;

  // Compute live
  const stats = await _computeSystemStats(db);

  // Persist to cache
  await _writeCache(db, 'system_stats', stats);

  return stats;
}

// ─── Live computation ─────────────────────────────────────────────────────────

async function _computeSystemStats(db) {
  const weekStart = _startOfWeekISO();

  const [statusCounts, weekPosts, weekPublished, weekApproved, topSectors, learning] =
    await Promise.all([
      // Post counts by status
      db.prepare(`
        SELECT status, COUNT(*) AS n
        FROM posts
        GROUP BY status
      `).all(),

      // Posts created this week
      db.prepare(`
        SELECT COUNT(*) AS n
        FROM posts
        WHERE created_at >= ?
      `).bind(weekStart).first(),

      // Posts published this week
      db.prepare(`
        SELECT COUNT(*) AS n
        FROM posts
        WHERE status = 'published'
          AND published_at >= ?
      `).bind(weekStart).first(),

      // Approved or edited decisions this week (for weekly approval rate)
      db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN decision IN ('approved','edited') THEN 1 ELSE 0 END) AS approved
        FROM decisions
        WHERE created_at >= ?
      `).bind(weekStart).first(),

      // Top sectors by post count + approval rate
      db.prepare(`
        SELECT
          p.sector,
          COUNT(p.id) AS posts,
          COALESCE(
            CAST(SUM(CASE WHEN d.decision IN ('approved','edited') THEN 1 ELSE 0 END) AS REAL)
            / NULLIF(COUNT(d.id), 0),
            0
          ) AS rate
        FROM posts p
        LEFT JOIN decisions d ON d.post_id = p.id
        WHERE p.sector IS NOT NULL
        GROUP BY p.sector
        ORDER BY posts DESC
        LIMIT 10
      `).all(),

      // Learning progress (reuses the feedback module)
      getLearningProgress(db),
    ]);

  // Map status counts to a tidy object
  const postCounts = { total: 0, pending: 0, approved: 0, rejected: 0, published: 0, scheduled: 0 };
  for (const row of statusCounts.results ?? []) {
    if (row.status in postCounts) postCounts[row.status] = row.n;
    postCounts.total += row.n;
  }

  const weekGenerated = weekPosts?.n   ?? 0;
  const weekPub       = weekPublished?.n ?? 0;
  const weekTotal     = weekApproved?.total    ?? 0;
  const weekApprv     = weekApproved?.approved ?? 0;

  const sectors = (topSectors.results ?? []).map(r => ({
    sector: r.sector,
    posts:  r.posts,
    rate:   Number((r.rate ?? 0).toFixed(4)),
  }));

  const avgConf = learning.avg_confidence_trend?.slice(-1)[0] ?? 0;

  return {
    posts: postCounts,
    this_week: {
      generated:     weekGenerated,
      published:     weekPub,
      approval_rate: weekTotal > 0
        ? Number((weekApprv / weekTotal).toFixed(4))
        : 0,
    },
    top_sectors: sectors,
    learning: {
      phase:          learning.current_phase,
      avg_confidence: avgConf,
      weeks_to_auto:  learning.estimated_weeks_to_autopublish,
      total_decisions: learning.total_decisions,
    },
    generated_at: nowISO(),
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function _tryCache(db, key) {
  const row = await db
    .prepare('SELECT value, updated_at FROM stats_cache WHERE key = ?')
    .bind(key)
    .first();

  if (!row) return null;

  const age = Date.now() - new Date(row.updated_at).getTime();
  if (age > CACHE_TTL_MS) return null; // stale

  try { return JSON.parse(row.value); } catch { return null; }
}

async function _writeCache(db, key, data) {
  const now   = nowISO();
  const value = JSON.stringify(data);
  await db.prepare(`
    INSERT INTO stats_cache (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(key, value, now).run();
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** ISO string for start of the current Monday (UTC week). */
function _startOfWeekISO() {
  const now  = new Date();
  const day  = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}
