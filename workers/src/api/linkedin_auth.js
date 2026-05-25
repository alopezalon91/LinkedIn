/**
 * linkedin_auth.js — LinkedIn OAuth 2.0 flow + token management.
 *
 * LinkedIn uses standard OAuth 2.0 Authorization Code flow.
 * Tokens are stored in the `oauth_tokens` D1 table (single row, id='linkedin').
 *
 * Required env vars / secrets:
 *   LINKEDIN_CLIENT_ID
 *   LINKEDIN_CLIENT_SECRET
 *   LINKEDIN_REDIRECT_URI
 */

import { nowISO } from '../utils.js';

const LINKEDIN_AUTH_URL  = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_ME_URL    = 'https://api.linkedin.com/v2/userinfo';

// LinkedIn API scopes needed for posting
const OAUTH_SCOPES = ['w_member_social', 'openid', 'profile', 'email'].join(' ');

// ─── Start OAuth flow ─────────────────────────────────────────────────────────

/**
 * Build the LinkedIn authorization URL that the user must visit.
 * Returns { url: string }
 */
export function startOAuthFlow(env) {
  if (!env.LINKEDIN_CLIENT_ID)    throw new Error('LINKEDIN_CLIENT_ID secret is not set');
  if (!env.LINKEDIN_REDIRECT_URI) throw new Error('LINKEDIN_REDIRECT_URI secret is not set');

  const state = crypto.randomUUID(); // CSRF protection token
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     env.LINKEDIN_CLIENT_ID,
    redirect_uri:  env.LINKEDIN_REDIRECT_URI,
    scope:         OAUTH_SCOPES,
    state,
  });

  return {
    url:   `${LINKEDIN_AUTH_URL}?${params.toString()}`,
    state, // caller should store this in a cookie/KV for CSRF validation
  };
}

// ─── Handle callback ──────────────────────────────────────────────────────────

/**
 * Exchange the authorization `code` for access + refresh tokens.
 * Fetches the user URN and persists everything to D1.
 * Returns the stored token record.
 */
export async function handleCallback(db, env, code) {
  if (!code) throw new Error('Authorization code is missing');

  _requireSecrets(env);

  // Exchange code for tokens
  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  env.LINKEDIN_REDIRECT_URI,
      client_id:     env.LINKEDIN_CLIENT_ID,
      client_secret: env.LINKEDIN_CLIENT_SECRET,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`LinkedIn token exchange failed (${tokenRes.status}): ${errBody}`);
  }

  const tokenData = await tokenRes.json();

  // LinkedIn returns expires_in in seconds from now
  const expiresAt = new Date(
    Date.now() + (tokenData.expires_in ?? 5183944) * 1000,
  ).toISOString();

  // Fetch the user URN using the new token
  const urn = await getLinkedInUserUrn(tokenData.access_token);

  await _upsertToken(db, {
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    expires_at:    expiresAt,
    linkedin_urn:  urn,
  });

  return getStoredToken(db);
}

// ─── Refresh token ────────────────────────────────────────────────────────────

/**
 * Use the stored refresh_token to get a new access_token.
 * Updates D1 with the new tokens.
 * Returns the updated token record.
 */
export async function refreshToken(db, env) {
  _requireSecrets(env);

  const current = await _getRawToken(db);
  if (!current) throw new Error('No token stored. Run OAuth flow first.');
  if (!current.refresh_token) throw new Error('No refresh_token available.');

  const refreshRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: current.refresh_token,
      client_id:     env.LINKEDIN_CLIENT_ID,
      client_secret: env.LINKEDIN_CLIENT_SECRET,
    }).toString(),
  });

  if (!refreshRes.ok) {
    const errBody = await refreshRes.text();
    throw new Error(`LinkedIn token refresh failed (${refreshRes.status}): ${errBody}`);
  }

  const data = await refreshRes.json();

  const expiresAt = new Date(
    Date.now() + (data.expires_in ?? 5183944) * 1000,
  ).toISOString();

  await _upsertToken(db, {
    access_token:  data.access_token,
    refresh_token: data.refresh_token ?? current.refresh_token,
    expires_at:    expiresAt,
    linkedin_urn:  current.linkedin_urn,
  });

  return getStoredToken(db);
}

// ─── Get stored token (with auto-refresh) ────────────────────────────────────

/**
 * Retrieve the current LinkedIn token.
 * Auto-refreshes if the token expires within 7 days.
 * Returns { access_token, linkedin_urn, expires_at } or null.
 */
export async function getStoredToken(db, env = null) {
  const row = await _getRawToken(db);
  if (!row) return null;

  // Auto-refresh if expiring within 7 days and we have env secrets
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt   = new Date(row.expires_at).getTime();
  const isExpiringSoon = expiresAt - Date.now() < sevenDaysMs;

  if (isExpiringSoon && env && row.refresh_token) {
    try {
      return await refreshToken(db, env);
    } catch (err) {
      console.error('[linkedin_auth] Auto-refresh failed:', err.message);
      // Return stale token — caller can decide what to do
    }
  }

  return {
    access_token:  row.access_token,
    refresh_token: row.refresh_token,
    expires_at:    row.expires_at,
    linkedin_urn:  row.linkedin_urn,
    updated_at:    row.updated_at,
    is_valid:      new Date(row.expires_at) > new Date(),
  };
}

// ─── Get LinkedIn user URN ────────────────────────────────────────────────────

/**
 * Call the LinkedIn /userinfo endpoint to retrieve the member's URN.
 * Returns something like 'urn:li:person:AbCdEfGhIj'
 */
export async function getLinkedInUserUrn(accessToken) {
  const res = await fetch(LINKEDIN_ME_URL, {
    headers: {
      Authorization:          `Bearer ${accessToken}`,
      'LinkedIn-Version':     '202401',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch LinkedIn user info (${res.status}): ${body}`);
  }

  const data = await res.json();
  // OpenID Connect userinfo returns `sub` as the member identifier
  if (!data.sub) throw new Error('LinkedIn userinfo response missing `sub` field');

  return `urn:li:person:${data.sub}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _getRawToken(db) {
  return db.prepare("SELECT * FROM oauth_tokens WHERE id = 'linkedin'").first();
}

async function _upsertToken(db, { access_token, refresh_token, expires_at, linkedin_urn }) {
  const now = nowISO();
  await db.prepare(`
    INSERT INTO oauth_tokens (id, access_token, refresh_token, expires_at, linkedin_urn, updated_at)
    VALUES ('linkedin', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      access_token  = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at    = excluded.expires_at,
      linkedin_urn  = excluded.linkedin_urn,
      updated_at    = excluded.updated_at
  `).bind(access_token, refresh_token, expires_at, linkedin_urn, now).run();
}

function _requireSecrets(env) {
  const missing = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI']
    .filter(k => !env[k]);
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`);
}
