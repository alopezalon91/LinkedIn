/**
 * index.js — Cloudflare Workers entry point & request router.
 *
 * Route table:
 *   GET    /api/health              → health check (no auth)
 *   GET    /api/auth/linkedin       → start LinkedIn OAuth flow (no auth)
 *   GET    /api/auth/callback       → LinkedIn OAuth callback (no auth)
 *   POST   /api/auth/refresh        → refresh LinkedIn token (auth required)
 *   GET    /api/posts               → list posts (auth)
 *   GET    /api/posts/:id           → get single post (auth)
 *   POST   /api/posts               → create post (auth — called by GitHub Actions)
 *   PATCH  /api/posts/:id           → update post (auth)
 *   POST   /api/posts/:id/approve   → approve post (auth)
 *   POST   /api/posts/:id/reject    → reject post (auth)
 *   POST   /api/posts/:id/schedule  → schedule post (auth)
 *   POST   /api/publish/:id         → publish post to LinkedIn (auth)
 *   POST   /api/feedback            → record user decision (auth)
 *   GET    /api/stats               → system stats (auth)
 *
 * CORS: all responses include Access-Control-Allow-Origin from env.CORS_ORIGIN.
 * Auth: Bearer token checked against env.DASHBOARD_SECRET.
 */

import {
  jsonResponse,
  errorResponse,
  corsHeaders,
  isAuthorized,
  parseJSON,
} from './utils.js';

import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  approvePost,
  rejectPost,
  reviewPost,
  schedulePost,
  regeneratePost,
  generatePostFromDraft,
  getExistingSourceIds,
} from './api/posts.js';

import { publishPost }                              from './api/publish.js';
import { recordFeedback, getLearningProgress }      from './api/feedback.js';
import { getSystemStats }                           from './api/stats.js';
import {
  startOAuthFlow,
  handleCallback,
  refreshToken,
  getStoredToken,
} from './api/linkedin_auth.js';

// ─── Worker entry point ───────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method.toUpperCase();

    // CORS pre-flight
    const cors = corsHeaders(request, env.CORS_ORIGIN ?? '*');
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const response = await route(request, env, ctx, url, path, method);
      // Attach CORS headers to every response
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    } catch (err) {
      console.error('[worker] Unhandled error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error', detail: err.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      );
    }
  },

  async scheduled(event, env, ctx) {
    const db = env.DB;
    console.log('[worker] Running scheduled cron trigger at', new Date().toISOString());
    try {
      // Find posts where status is 'scheduled' and scheduled_at is in the past (or exactly now)
      const { results } = await db.prepare(`
        SELECT id FROM posts 
        WHERE status = 'scheduled' 
          AND datetime(scheduled_at) <= datetime('now')
      `).all();

      if (!results || results.length === 0) {
        console.log('[worker] No scheduled posts due for publication.');
        return;
      }

      console.log(`[worker] Found ${results.length} post(s) due for publication. Publishing...`);
      for (const row of results) {
        try {
          await publishPost(db, env, row.id);
          console.log(`[worker] Successfully published scheduled post: ${row.id}`);
        } catch (err) {
          console.error(`[worker] Failed to publish scheduled post ${row.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[worker] Error in scheduled task:', err);
    }
  },
};

// ─── Router ───────────────────────────────────────────────────────────────────

async function route(request, env, ctx, url, path, method) {
  const db = env.DB;

  if (url.pathname === '/api/test-gemini') {
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`;
      const res = await fetch(testUrl);
      const text = await res.text();
      return new Response(text, { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  if (url.pathname === '/api/test-groq') {
    try {
      let groqKey = env.GROQ_API_KEY;
      if (!groqKey) {
        const row = await db.prepare("SELECT value FROM stats_cache WHERE key = 'secret:GROQ_API_KEY'").first();
        if (row && row.value) {
          try { groqKey = JSON.parse(row.value); } catch(e) { groqKey = row.value; }
        }
      }
      const testUrl = "https://api.groq.com/openai/v1/chat/completions";
      const payload = {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "hola" }],
        max_tokens: 10
      };
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      return new Response(JSON.stringify({ status: res.status, key: groqKey ? groqKey.substring(0, 10) : 'null', body: text }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // ── Health check (no auth) ────────────────────────────────────────────────
  if (path === '/api/health' && method === 'GET') {
    return handleHealth(db);
  }

  // ── OAuth endpoints (no auth — user-facing flow) ──────────────────────────
  if (path === '/api/auth/linkedin' && method === 'GET') {
    return handleAuthStart(env);
  }
  if (path === '/api/auth/callback' && method === 'GET') {
    return handleAuthCallback(db, env, url);
  }

  // ── All other /api/* routes require Bearer auth ────────────────────────────
  if (!isAuthorized(request, env)) {
    return errorResponse('Unauthorized. Provide Authorization: Bearer <token>', 401);
  }

  // ── Auth: refresh token ───────────────────────────────────────────────────
  if (path === '/api/auth/refresh' && method === 'POST') {
    return handleAuthRefresh(db, env);
  }

  // ── Posts CRUD ─────────────────────────────────────────────────────────────

  // Collection
  if (path === '/api/posts') {
    if (method === 'GET')  return handleListPosts(db, url);
    if (method === 'POST') return handleCreatePost(db, request);
    return errorResponse('Method not allowed', 405);
  }
  
  if (path === '/api/posts/check-sources' && method === 'POST') {
    return handleCheckSources(db, request);
  }

  // ── Post sub-actions: /api/posts/:id/approve|reject|review|schedule|regenerate|generate|regenerate-carousel|regenerate-video ────
  const subActionMatch = path.match(/^\/api\/posts\/([^/]+)\/(approve|reject|review|schedule|regenerate|generate|regenerate-carousel|regenerate-video)$/);
  if (subActionMatch && method === 'POST') {
    const [, postId, action] = subActionMatch;
    return handlePostAction(db, env, ctx, request, postId, action);
  }

  // Single post
  const singlePostMatch = path.match(/^\/api\/posts\/([^/]+)$/);
  if (singlePostMatch) {
    const [, postId] = singlePostMatch;
    if (method === 'GET')   return handleGetPost(db, postId);
    if (method === 'PATCH') return handleUpdatePost(db, request, postId);
    return errorResponse('Method not allowed', 405);
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  const publishMatch = path.match(/^\/api\/publish\/([^/]+)$/);
  if (publishMatch && method === 'POST') {
    const [, postId] = publishMatch;
    return handlePublish(db, env, postId, request);
  }

  // ── Feedback ──────────────────────────────────────────────────────────────
  if (path === '/api/feedback' && method === 'POST') {
    return handleFeedback(db, env, request);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  if (path === '/api/stats' && method === 'GET') {
    return handleStats(db);
  }

  // ── GitHub proxy ──────────────────────────────────────────────────────────
  if (path === '/api/github/dispatch' && method === 'POST') {
    return handleGithubDispatch(request);
  }

  // ── Decisions List (for Python Learning Model Sync) ───────────────────────
  if (path === '/api/decisions' && method === 'GET') {
    return handleListDecisions(db);
  }


  // ── 404 ───────────────────────────────────────────────────────────────────
  return errorResponse(`Route not found: ${method} ${path}`, 404);
}

// ─── Handler functions ────────────────────────────────────────────────────────

async function handleHealth(db) {
  try {
    await db.prepare('SELECT 1').first();
    
    // Check if we have a valid, unexpired stored LinkedIn token
    const tokenRow = await db.prepare('SELECT expires_at FROM oauth_tokens WHERE id = ?')
      .bind('linkedin')
      .first();
    const hasToken = !!(tokenRow && new Date(tokenRow.expires_at) > new Date());

    return jsonResponse({ 
      status: 'ok', 
      db: 'connected', 
      linkedin_token: hasToken,
      ts: new Date().toISOString() 
    });
  } catch (err) {
    return jsonResponse(
      { status: 'degraded', db: 'error', error: err.message, ts: new Date().toISOString() },
      503,
    );
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function handleAuthStart(env) {
  try {
    const { url, state } = startOAuthFlow(env);
    // Redirect the user's browser to LinkedIn
    return Response.redirect(url, 302);
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

async function handleAuthCallback(db, env, url) {
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return errorResponse(
      `LinkedIn OAuth error: ${error} — ${url.searchParams.get('error_description') ?? ''}`,
      400,
    );
  }
  if (!code) return errorResponse('Missing code parameter', 400);

  try {
    const token = await handleCallback(db, env, code);
    // Return a small HTML page — user sees success and can close the window
    return new Response(
      `<!DOCTYPE html><html><body>
        <h2>✅ LinkedIn connected!</h2>
        <p>You can close this window.</p>
        <script>window.opener?.postMessage('linkedin_oauth_success', '*'); window.close();</script>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html;charset=UTF-8' } },
    );
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

async function handleAuthRefresh(db, env) {
  try {
    const token = await refreshToken(db, env);
    return jsonResponse({ success: true, expires_at: token.expires_at });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

// ── Posts ─────────────────────────────────────────────────────────────────────

async function handleListPosts(db, url) {
  const params = Object.fromEntries(url.searchParams.entries());
  const result = await listPosts(db, params);
  return jsonResponse(result);
}

async function handleGetPost(db, postId) {
  const post = await getPost(db, postId);
  if (!post) return errorResponse(`Post not found: ${postId}`, 404);
  return jsonResponse(post);
}

async function handleCreatePost(db, request) {
  const data = await parseJSON(request);
  try {
    const post = await createPost(db, data);
    return jsonResponse(post, 201);
  } catch (err) {
    return errorResponse(err.message, 400);
  }
}

async function handleCheckSources(db, request) {
  try {
    const data = await parseJSON(request);
    const existingIds = await getExistingSourceIds(db, data.source_ids || []);
    return jsonResponse({ existing_source_ids: existingIds });
  } catch (err) {
    return errorResponse(err.message, 400);
  }
}

async function handleUpdatePost(db, request, postId) {
  const updates = await parseJSON(request);

  // Route to specialised handlers if action shorthand keys are present
  if (updates.action === 'approve' || 'approved' in updates || updates.status === 'approved') {
    return _handleApprove(db, postId, updates.content_edited ?? null, updates.media_base64 ?? null);
  }
  if (updates.action === 'reject' || updates.status === 'rejected') {
    return _handleReject(db, postId);
  }
  if ((updates.action === 'schedule' || updates.status === 'scheduled') && updates.scheduled_at) {
    return _handleSchedule(db, postId, updates.scheduled_at, updates.media_base64 ?? null);
  }

  try {
    const post = await updatePost(db, postId, updates);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function handlePostAction(db, env, ctx, request, postId, action) {
  const body = await parseJSON(request);

  switch (action) {
    case 'approve':  return _handleApprove(db, env, ctx, postId, body.content_edited ?? null, body.media_base64 ?? null);
    case 'reject':   return _handleReject(db, postId);
    case 'review':   return _handleReview(db, postId, body.content_edited ?? null);
    case 'schedule': return _handleSchedule(db, postId, body.scheduled_at, body.media_base64 ?? null);
    case 'regenerate': return _handleRegenerate(db, env, ctx, postId, body.instructions);
    case 'generate': return _handleGenerate(db, env, ctx, postId);
    case 'regenerate-carousel': return _handleRegenerateCarousel(db, env, postId, body.content_edited);
    case 'regenerate-video': return _handleRegenerateVideo(db, env, ctx, postId, body.content_edited);
    case 'update':   return _handleGenericUpdate(db, postId, body);
    default:         return errorResponse(`Unknown action: ${action}`, 400);
  }
}

async function _handleGenericUpdate(db, postId, data) {
  try {
    const { updatePost } = await import('./api/posts.js');
    // Remove the "action" key so we only pass the fields to update
    const { action, ...updates } = data;
    const post = await updatePost(db, postId, updates);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, 400);
  }
}

async function _handleApprove(db, env, ctx, postId, editedContent, mediaBase64) {
  try {
    const { post, editRatio } = await approvePost(db, postId, editedContent, mediaBase64);
    
    // Trigger video automation webhook if JSON exists
    if (post.video_flow_json && env.VIDEO_AUTOMATION_WEBHOOK) {
      const videoData = JSON.parse(post.video_flow_json);
      if (ctx && ctx.waitUntil) {
        ctx.waitUntil(
          fetch(env.VIDEO_AUTOMATION_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId: postId,
              video_data: videoData
            })
          }).catch(err => console.error("Error enviando flujo a automatización de vídeo tras aprobar:", err))
        );
      }
    }
    
    return jsonResponse({ post, edit_ratio: editRatio });
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleReview(db, postId, editedContent) {
  try {
    const { post, editRatio } = await reviewPost(db, postId, editedContent);
    return jsonResponse({ post, edit_ratio: editRatio });
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleReject(db, postId) {
  try {
    const post = await rejectPost(db, postId);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleSchedule(db, postId, scheduledAt, mediaBase64) {
  try {
    const post = await schedulePost(db, postId, scheduledAt, mediaBase64);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleRegenerate(db, env, ctx, postId, instructions) {
  try {
    if (!instructions) {
      return errorResponse('instructions are required for post regeneration', 400);
    }
    const post = await regeneratePost(db, env, ctx, postId, instructions);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleGenerate(db, env, ctx, postId) {
  try {
    const post = await generatePostFromDraft(db, env, ctx, postId);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleRegenerateCarousel(db, env, postId, newPostText) {
  try {
    if (!newPostText) {
      return errorResponse('content_edited is required for carousel regeneration', 400);
    }
    const { regenerateCarousel } = await import('./api/posts.js');
    const post = await regenerateCarousel(db, env, postId, newPostText);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

async function _handleRegenerateVideo(db, env, ctx, postId, newPostText) {
  try {
    if (!newPostText) {
      return errorResponse('content_edited is required for video regeneration', 400);
    }
    const { regenerateVideo } = await import('./api/posts.js');
    const post = await regenerateVideo(db, env, ctx, postId, newPostText);
    return jsonResponse(post);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

// ── Publish ───────────────────────────────────────────────────────────────────

async function handlePublish(db, env, postId, request) {
  try {
    const result = await publishPost(db, env, postId, request);
    return jsonResponse(result);
  } catch (err) {
    // Surface token/auth issues as 401, rate limits as 429, rest as 500
    let status = 500;
    if (err.message.includes('token') || err.message.includes('OAuth')) status = 401;
    if (err.message.includes('rate limit')) status = 429;
    if (err.message.includes('not found')) status = 404;
    return errorResponse(err.message, status);
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────

async function handleFeedback(db, env, request) {
  const data = await parseJSON(request);
  try {
    const result = await recordFeedback(db, env, data);
    return jsonResponse(result, 201);
  } catch (err) {
    return errorResponse(err.message, err.message.includes('not found') ? 404 : 400);
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function handleStats(db) {
  const stats = await getSystemStats(db);
  return jsonResponse(stats);
}

// ── GitHub proxy handler ──────────────────────────────────────────────────────

async function handleGithubDispatch(request) {
  try {
    const body = await parseJSON(request);
    const { workflow, token, repo, inputs } = body;

    if (!workflow || !token || !repo) {
      return errorResponse('Missing required parameters: workflow, token, repo', 400);
    }

    const payload = { ref: 'main' };
    if (inputs) {
      payload.inputs = inputs;
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'mytaxbot-linkedin-dashboard',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 204) {
      return jsonResponse({ success: true });
    } else {
      const errText = await res.text();
      let errMessage = res.statusText;
      try {
        const errData = JSON.parse(errText);
        errMessage = errData.message || errMessage;
      } catch (e) {}
      return errorResponse(`GitHub API error (${res.status}): ${errMessage}`, res.status);
    }
  } catch (err) {
    return errorResponse(`Network error contacting GitHub: ${err.message}`, 500);
  }
}

// ── Decisions List handler ───────────────────────────────────────────────────

async function handleListDecisions(db) {
  try {
    const res = await db.prepare(`
      SELECT d.*, p.content 
      FROM decisions d
      LEFT JOIN posts p ON d.post_id = p.id
      ORDER BY d.created_at DESC
      LIMIT 50
    `).all();
    return jsonResponse(res.results ?? []);
  } catch (err) {
    return errorResponse(err.message, 500);
  }
}

