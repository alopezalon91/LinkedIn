/**
 * utils.js — Shared helper functions used across all API modules.
 */

// ─── UUID generation ──────────────────────────────────────────────────────────

/**
 * Generate a v4-style UUID using the Web Crypto API.
 * Works in Cloudflare Workers (no Node.js dependency).
 */
export function generateUUID() {
  return crypto.randomUUID();
}

// ─── Timestamps ───────────────────────────────────────────────────────────────

/** Return the current UTC time as an ISO 8601 string. */
export function nowISO() {
  return new Date().toISOString();
}

// ─── Levenshtein edit distance / ratio ───────────────────────────────────────

/**
 * Compute the Levenshtein edit distance between two strings.
 * O(m·n) time and O(n) space — acceptable for post-sized strings.
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j]     + 1,        // deletion
        prev[j - 1] + cost,     // substitution
      );
    }
    prev = curr;
  }

  return prev[b.length];
}

/**
 * Normalised edit distance: 0 = identical, 1 = completely different.
 * Uses max(len(a), len(b)) as denominator.
 */
export function levenshteinRatio(a, b) {
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return Number((levenshteinDistance(a, b) / maxLen).toFixed(4));
}

// ─── HTTP response helpers ────────────────────────────────────────────────────

/**
 * Build a JSON Response with correct headers.
 * @param {unknown}  data    – payload to serialise
 * @param {number}   status  – HTTP status code (default 200)
 * @param {object}   headers – additional headers to merge
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Build a standardised error JSON response.
 */
export function errorResponse(message, status = 400, extra = {}) {
  return jsonResponse({ error: message, ...extra }, status);
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

/**
 * Validate the Authorization: Bearer <token> header.
 * Returns true if valid, false otherwise.
 */
export function isAuthorized(request, env) {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length).trim();
  return token === env.DASHBOARD_SECRET;
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

/**
 * Build CORS headers for a given request.
 * For pre-flight OPTIONS requests, also adds Allow-Headers/Methods.
 *
 * @param {Request} request  – incoming request
 * @param {string}  origin   – allowed origin (from env.CORS_ORIGIN)
 */
export function corsHeaders(request, origin = '*') {
  const headers = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
  return headers;
}

// ─── Request body parsing ─────────────────────────────────────────────────────

/**
 * Safely parse JSON from a request body.
 * Returns an empty object if body is empty or malformed.
 */
export async function parseJSON(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
