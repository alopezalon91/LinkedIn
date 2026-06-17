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

async function adjustStyleParameters(db, env, originalText, editedText) {
  try {
    const userId = 'default';
    const longitudOriginal = originalText.length;
    const longitudEditada = editedText.length;
    const diferenciaAbsoluta = Math.abs(longitudOriginal - longitudEditada);
    const fueCambioSustancial = diferenciaAbsoluta > (longitudOriginal * 0.15);

    let evaluacion = {
      profundidad_tecnica: "MANTENER",
      densidad_emojis: "MANTENER",
      longitud_oraciones: "MANTENER"
    };

    if (env.GEMINI_API_KEY) {
      const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
      const evalPrompt = `
Analiza la diferencia entre el texto original generado por una IA y el texto final editado por el usuario humano para una publicación de LinkedIn de temática fiscal.

Texto Original de la IA: """
${originalText}
"""

Texto Editado por el Humano: """
${editedText}
"""

Tu tarea es evaluar la dirección del cambio del usuario en tres métricas exactas:
1. profundidad_tecnica: ¿El humano añadió más tecnicismos, artículos de ley o lenguaje legal? (Responde: "INCREMENTAR", "DECREMENTAR" o "MANTENER")
2. densidad_emojis: ¿El humano borró emojis o añadió más? (Responde: "INCREMENTAR", "DECREMENTAR" o "MANTENER")
3. longitud_oraciones: ¿El humano separó párrafos densos en frases cortas, o combinó frases sueltas en párrafos más robustos y técnicos? (Responde: "INCREMENTAR", "DECREMENTAR" o "MANTENER")

Debes responder ÚNICAMENTE con un objeto JSON válido con esta estructura:
{
  "profundidad_tecnica": "INCREMENTAR" | "DECREMENTAR" | "MANTENER",
  "densidad_emojis": "INCREMENTAR" | "DECREMENTAR" | "MANTENER",
  "longitud_oraciones": "INCREMENTAR" | "DECREMENTAR" | "MANTENER"
}
      `;
      const aiEvalResponse = await fetch(apiURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: evalPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      if (aiEvalResponse.ok) {
        const aiEvalResult = await aiEvalResponse.json();
        evaluacion = JSON.parse(aiEvalResult.candidates[0].content.parts[0].text);
      }
    }

    const currentSettings = await db.prepare("SELECT * FROM user_settings WHERE user_id = ?").bind(userId).first() || {
      profundidad_tecnica: 3, densidad_emojis: 2, longitud_oraciones: 2
    };

    const calibrarRango = (valor, accion, min, max) => {
      if (accion === "INCREMENTAR") return Math.min(valor + 1, max);
      if (accion === "DECREMENTAR") return Math.max(valor - 1, min);
      return valor;
    };

    const prof = calibrarRango(currentSettings.profundidad_tecnica, evaluacion.profundidad_tecnica, 1, 5);
    const emoj = calibrarRango(currentSettings.densidad_emojis, evaluacion.densidad_emojis, 0, 3);
    const long = calibrarRango(currentSettings.longitud_oraciones, evaluacion.longitud_oraciones, 1, 3);

    await db.prepare(`
      INSERT INTO user_settings (user_id, profundidad_tecnica, densidad_emojis, longitud_oraciones) 
      VALUES (?, ?, ?, ?) 
      ON CONFLICT(user_id) DO UPDATE SET 
        profundidad_tecnica = excluded.profundidad_tecnica, 
        densidad_emojis = excluded.densidad_emojis, 
        longitud_oraciones = excluded.longitud_oraciones
    `).bind(userId, prof, emoj, long).run();

    if (fueCambioSustancial) {
      await db.prepare(`
        INSERT INTO best_posts_examples (id, user_id, original_text, updated_text, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), userId, originalText, editedText, nowISO()).run();

      await db.prepare(`
        DELETE FROM best_posts_examples WHERE user_id = ? AND id NOT IN (
          SELECT id FROM best_posts_examples WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
        )
      `).bind(userId, userId).run();
    }

  } catch (err) {
    console.error('[feedback] Failed to adjust style parameters:', err);
  }
}

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
export async function recordFeedback(db, env, data) {
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

  // If edited, adjust style paramaters dynamically
  if (decision === 'edited' && edited_content) {
    adjustStyleParameters(db, env, post.content, edited_content).catch(err => 
      console.error('[feedback] Style adjustment failed:', err.message)
    );
  }

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
