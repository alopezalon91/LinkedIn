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
export async function publishPost(db, env, postId, request) {
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
  let textToPublish = (post.content_edited ?? post.content).trim();
  if (!textToPublish) throw new Error('Post content is empty — cannot publish');

  // Convert markdown bold to Unicode bold for LinkedIn
  textToPublish = formatLinkedInText(textToPublish);

  let mediaUrn = null;
  let multiImageUrns = [];

  let binaryPdfData = null;
  if (request && request.headers.get('content-type')?.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('pdf');
    if (file) {
      binaryPdfData = new Uint8Array(await file.arrayBuffer());
    }
  }

  if (binaryPdfData) {
    mediaUrn = await uploadDocumentBinaryToLinkedIn(access_token, linkedin_urn, binaryPdfData);
  } else if (post.media_base64) {
    let isJsonCarousel = false;
    let isMultiImage = false;
    let isPdfCarousel = false;
    let decodedStr = '';
    
    try {
      const _bytes = Uint8Array.from(atob(post.media_base64), c => c.charCodeAt(0));
      decodedStr = new TextDecoder().decode(_bytes);
      if (decodedStr.startsWith('CAROUSEL:')) isJsonCarousel = true;
      if (decodedStr.startsWith('{"type":"multi-image"')) isMultiImage = true;
      if (decodedStr.startsWith('{"type":"pdf_carousel"')) isPdfCarousel = true;
    } catch(e) { console.error('[worker] Failed to decode media_base64:', e); }

    if (isMultiImage) {
      try {
        const payload = JSON.parse(decodedStr);
        for (const dataUri of payload.images) {
          const base64Data = dataUri.split(',')[1] || dataUri;
          const urn = await uploadImageToLinkedIn(access_token, linkedin_urn, base64Data);
          if (urn) multiImageUrns.push(urn);
        }
      } catch (err) {
        console.error('[worker] Failed to upload multi-image to LinkedIn. Error:', err);
      }
    } else if (isPdfCarousel) {
      try {
        const payload = JSON.parse(decodedStr);
        mediaUrn = await uploadDocumentToLinkedIn(access_token, linkedin_urn, payload.pdf_base64);
      } catch (err) {
        console.error('[worker] Failed to upload PDF carousel document to LinkedIn. Error:', err);
      }
    } else if (!isJsonCarousel) {
      try {
        mediaUrn = await uploadDocumentToLinkedIn(access_token, linkedin_urn, post.media_base64);
      } catch (err) {
        console.error('[worker] Failed to upload document to LinkedIn. Continuing with text only. Error:', err);
      }
    }
  }

  // 5. Build REST Posts payload
  const payload = buildPostPayload(linkedin_urn, textToPublish, multiImageUrns.length > 0 ? multiImageUrns : mediaUrn);

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

  // 5b. Publish the first comment if provided
  let commentResult = null;
  if (linkedinPostId && post.first_comment) {
    try {
      // Create comment payload per LinkedIn API
      const commentPayload = {
        actor: linkedin_urn,
        object: linkedinPostId,
        message: {
          text: post.first_comment
        }
      };

      const commentResponse = await fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(linkedinPostId)}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': LINKEDIN_VERSION,
          'X-RestLi-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(commentPayload),
      });

      if (!commentResponse.ok) {
        const commentErr = await commentResponse.text();
        console.error(`[worker] Failed to publish first_comment for post ${postId}: ${commentErr}`);
        commentResult = 'failed';
      } else {
        commentResult = 'success';
      }
    } catch (err) {
      console.error(`[worker] Error publishing first_comment for post ${postId}:`, err);
      commentResult = 'error';
    }
  }

  // 6. Update post in D1
  const publishedAt = nowISO();
  const updatedPost = await updatePost(db, postId, {
    status:           'published',
    published_at:     publishedAt,
    linkedin_post_id: linkedinPostId ?? 'unknown',
  });

  // 7. Disparar GitHub Actions para renderizar el Reel de Instagram (Faceless)
  if (post.video_flow_json && env.GITHUB_PAT) {
    try {
      const videoData = JSON.parse(post.video_flow_json);
      const ghPayload = {
        event_type: "render_video",
        client_payload: {
          postId: postId,
          video_data: videoData
        }
      };
      // Usamos await para asegurar que sale la petición antes de que el Worker muera
      await fetch("https://api.github.com/repos/alopezalon91/LinkedIn/dispatches", {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${env.GITHUB_PAT}`,
          "User-Agent": "Mytaxbot-Worker",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ghPayload)
      });
      console.log(`[worker] Disparado render_video en GitHub Actions para el post ${postId}`);
    } catch(e) {
      console.error("[worker] Error disparando GitHub Actions:", e);
    }
  }

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
function toBoldUnicode(text) {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120211);
    if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120205);
    if (code >= 48 && code <= 57) return String.fromCodePoint(code + 120764);
    return char;
  }).join('');
}

function formatLinkedInText(text) {
  return (text || '').replace(/\*\*(.*?)\*\*/g, (m, p1) => toBoldUnicode(p1));
}

function buildPostPayload(authorUrn, text, mediaUrnOrArray = null) {
  const payload = {
    author: authorUrn,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
    },
    lifecycleState: 'PUBLISHED',
  };

  if (mediaUrnOrArray) {
    if (Array.isArray(mediaUrnOrArray) && mediaUrnOrArray.length > 0) {
      // Multiple Images API structure
      payload.content = {
        multiImage: {
          images: mediaUrnOrArray.map(urn => ({ id: urn }))
        }
      };
    } else if (typeof mediaUrnOrArray === 'string') {
      // Single Document/Media structure
      payload.content = {
        media: {
          id: mediaUrnOrArray,
          title: "Documento Adjunto"
        }
      };
    }
  }
  return payload;
}

// ─── Image Upload (Multiple) ──────────────────────────────────────────────────

async function uploadImageToLinkedIn(access_token, authorUrn, base64Data) {
  const registerRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-RestLi-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn
      }
    })
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    throw new Error(`Failed to initialize image upload: ${err}`);
  }

  const registerData = await registerRes.json();
  const uploadUrl = registerData.value.uploadUrl;
  const imageUrn = registerData.value.image;

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/octet-stream'
    },
    body: bytes
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload image binary: ${err}`);
  }

  return imageUrn;
}

// ─── Document Upload ──────────────────────────────────────────────────────────

async function uploadDocumentToLinkedIn(access_token, authorUrn, base64Data) {
  // 1. Initialize Upload
  const registerRes = await fetch('https://api.linkedin.com/rest/documents?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-RestLi-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn
      }
    })
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    throw new Error(`Failed to initialize document upload: ${err}`);
  }

  const registerData = await registerRes.json();
  const uploadUrl = registerData.value.uploadUrl;
  const documentUrn = registerData.value.document;

  // 2. Decode Base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 3. Upload Binary Data
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/pdf'
    },
    body: bytes
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload document binary: ${err}`);
  }

  // 4. Poll document status until AVAILABLE
  await new Promise(resolve => setTimeout(resolve, 1500)); // Delay controlado de 1.5s para sincronizar estado
  let attempts = 0;
  const maxAttempts = 15;
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));

    const statusRes = await fetch(`https://api.linkedin.com/rest/documents/${encodeURIComponent(documentUrn)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'LinkedIn-Version': LINKEDIN_VERSION,
        'X-RestLi-Protocol-Version': '2.0.0'
      }
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.status === 'AVAILABLE') {
        return documentUrn;
      } else if (statusData.status === 'FAILED') {
        throw new Error(`Document processing failed on LinkedIn side.`);
      }
    }
  }

  throw new Error(`Timeout waiting for document processing on LinkedIn.`);
}

async function uploadDocumentBinaryToLinkedIn(access_token, authorUrn, bytesArrayBuffer) {
  // 1. Initialize Upload
  const registerRes = await fetch('https://api.linkedin.com/rest/documents?action=initializeUpload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-RestLi-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn
      }
    })
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    throw new Error(`Failed to initialize document upload: ${err}`);
  }

  const registerData = await registerRes.json();
  const uploadUrl = registerData.value.uploadUrl;
  const documentUrn = registerData.value.document;

  // 2. Upload Binary Data
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/pdf'
    },
    body: bytesArrayBuffer
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload document binary: ${err}`);
  }

  // 3. Mandatory 1.5s delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // 4. Poll document status until AVAILABLE
  let attempts = 0;
  const maxAttempts = 15;
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));

    const statusRes = await fetch(`https://api.linkedin.com/rest/documents/${encodeURIComponent(documentUrn)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'LinkedIn-Version': LINKEDIN_VERSION,
        'X-RestLi-Protocol-Version': '2.0.0'
      }
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.status === 'AVAILABLE') {
        return documentUrn;
      } else if (statusData.status === 'FAILED') {
        throw new Error(`Document processing failed on LinkedIn side.`);
      }
    }
  }

  throw new Error(`Timeout waiting for document processing on LinkedIn.`);
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
