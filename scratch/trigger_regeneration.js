const WORKER_URL = 'https://mytaxbot-linkedin.a-lopezalon91.workers.dev';
const DASHBOARD_SECRET = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';

async function request(path, options = {}) {
  const url = `${WORKER_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${DASHBOARD_SECRET}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("Fetching pending posts from Cloudflare Worker...");
  let postsData;
  try {
    postsData = await request('/api/posts?status=pending');
  } catch (err) {
    console.error("Failed to fetch pending posts:", err.message);
    return;
  }

  const posts = postsData.posts || [];
  if (posts.length === 0) {
    console.log("No pending posts found.");
    return;
  }

  console.log(`Found ${posts.length} pending posts. Triggering carousel regeneration with 15s delay between requests...`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n--------------------------------------------`);
    console.log(`[${i+1}/${posts.length}] Regenerating carousel for post ${post.id}...`);
    console.log(`Post preview: "${post.content.substring(0, 100)}..."`);
    
    try {
      const result = await request(`/api/posts/${post.id}/regenerate-carousel`, {
        method: 'POST',
        body: JSON.stringify({
          content_edited: post.content_edited || post.content
        })
      });

      console.log(`Success! Regenerated carousel for post ${post.id}.`);
      
      if (result.media_base64) {
        const decodedStr = decodeURIComponent(escape(atob(result.media_base64)));
        if (decodedStr.startsWith('CAROUSEL:')) {
          const carousel = JSON.parse(decodedStr.substring(9));
          console.log("New slide titles:");
          carousel.forEach((slide, idx) => {
            console.log(`  Slide ${idx+1}: [${slide.slide_type}] ${slide.title} (${slide.subtitle})`);
          });
        }
      }
    } catch (err) {
      console.error(`Error regenerating carousel for post ${post.id}:`, err.message);
    }

    if (i < posts.length - 1) {
      console.log("Waiting 15 seconds to avoid Gemini rate limits...");
      await delay(15000);
    }
  }

  console.log("\nAll pending posts processed.");
}

main();
