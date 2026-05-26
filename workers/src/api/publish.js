/**
 * publish.js — LinkedIn post publishing via the REST Posts API.
 *
 * Uses the v2 REST Posts endpoint (not the legacy UGC API).
 * Handles token retrieval/refresh, rate-limit errors, and D1 state updates.
 *
 * LinkedIn API reference:
 *   https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api
 */

import { getStoredToken } from './linkedin_auth.js';
import { getPost, updatePost } from './posts.js';
import { nowISO } from '../utils.js';

const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';
const LINKEDIN_VERSION   = '202601'; // Pin to a stable monthly version

// ─── Publish ──────────────────────────────────────────────────────────────────

/**
 * Publish a post to LinkedIn.
 *
 * Steps:
 *  1. Fetch post from D1 and validate state
 *  2. Get LinkedIn token (with auto-refresh)
 *  3. Build the REST Posts payload
 *  4. POST to LinkedIn
 *  5. Store the returned post URN and update status to 'published'
 *
 * @returns {{ success: boolean, linkedin_post_id: string, post: object }}
 */
export async function publishPost(db, env, postId) {
  // 1. Load and validate the post
  const post = await getPost(db, postId);
  if (!post) throw new Error(`Post not found: ${postId}`);

  if (post.status === 'published') {
    throw new Error(`Post ${postId} is already published (linkedin_post_id: ${post.linkedin_post_id})`);
  }
  if (post.status === 'rejected') {
    throw new Error(`Cannot publish a rejected post (${postId})`);
  }

  // 2. Get valid LinkedIn token
  const tokenInfo = await getStoredToken(db, env);
  if (!tokenInfo) {
    throw new Error('No LinkedIn token found. Complete the OAuth flow at /api/auth/linkedin');
  }
  if (!tokenInfo.is_valid) {
    throw new Error('LinkedIn token has expired. Re-run OAuth flow or call /api/auth/refresh');
  }

  const { access_token, linkedin_urn } = tokenInfo;
  if (!linkedin_urn) {
    throw new Error('LinkedIn user URN not stored. Re-complete the OAuth flow.');
  }

  // 3. Decide which content to publish (prefer user-edited version)
  const textToPublish = (post.content_edited ?? post.content).trim();
  if (!textToPublish) throw new Error('Post content is empty — cannot publish');

  // 4. Build REST Posts payload
  const payload = buildPostPayload(linkedin_urn, textToPublish);

  // 5. POST to LinkedIn
  const response = await fetch(LINKEDIN_POSTS_URL, {
    method:  'POST',
    headers: {
      'Authorization':               `Bearer ${access_token}`,
      'Content-Type':                'application/json',
      'LinkedIn-Version':            LINKEDIN_VERSION,
      'X-RestLi-Protocol-Version':   '2.0.0',
    },
    body: JSON.stringify(payload),
  });

  // Handle rate limits (429) explicitly
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') ?? 'unknown';
    throw new Error(`LinkedIn rate limit hit. Retry after ${retryAfter} seconds.`);
  }

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`LinkedIn API error (${response.status}): ${errBody}`);
  }

  // The REST Posts API returns the post ID in the X-RestLi-Id header
  // or in the response body depending on version
  let linkedinPostId = response.headers.get('x-restli-id') ??
                       response.headers.get('X-RestLi-Id');

  // Some versions return a JSON body with the ID
  if (!linkedinPostId) {
    try {
      const body = await response.json();
      linkedinPostId = body.id ?? body.urn ?? null;
    } catch {
      // No JSON body — ID was already in header (or not available)
    }
  }

  // 6. Update post in D1
  const publishedAt = nowISO();
  const updatedPost = await updatePost(db, postId, {
    status:           'published',
    published_at:     publishedAt,
    linkedin_post_id: linkedinPostId ?? 'unknown',
  });

  return {
    success:         true,
    linkedin_post_id: linkedinPostId,
    post:            updatedPost,
  };
}

// ─── Payload builder ──────────────────────────────────────────────────────────

/**
 * Build a LinkedIn REST Posts API payload for a text-only post.
 *
 * See: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api#create-a-post
 */
function buildPostPayload(authorUrn, text) {
  return {
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
    },
    lifecycleState: 'PUBLISHED',
  };
}

// ─── Rate limit info ──────────────────────────────────────────────────────────

/**
 * Returns the number of posts published today (useful for rate limit checks).
 * LinkedIn free tier allows ~100 API calls/day.
 */
export async function getPublishedTodayCount(db) {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const result = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM posts
    WHERE status = 'published'
      AND published_at >= ?
  `).bind(todayStart.toISOString()).first();

  return result?.count ?? 0;
}
