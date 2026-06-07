const API_URL = 'https://mytaxbot-linkedin.a-lopezalon91.workers.dev';
const AUTH_TOKEN = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';

async function main() {
  const pendingIds = [
    "bcd11a41-5d45-4804-9426-1ed4d74bf349",
    "ce479f45-91d9-441b-b9a9-1a9caf38f350",
    "f73c4877-98e1-40c9-b19a-09d3ba621ec5"
  ];
  console.log(`Found ${pendingIds.length} posts to update carousels for.`);
  
  const delay = ms => new Promise(r => setTimeout(r, ms));

  for (const id of pendingIds) {
    console.log(`\nRegenerating carousel for post ${id}...`);
    await delay(60000);
    
    // Fetch the current post to get its content
    const getRes = await fetch(`${API_URL}/api/posts/${id}`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    if (!getRes.ok) {
      console.error(`  Failed to get post ${id}`);
      continue;
    }
    
    const postData = await getRes.json();
    const content = postData.content_edited || postData.content;
    
    const regCarRes = await fetch(`${API_URL}/api/posts/${id}/regenerate-carousel`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({ content_edited: content })
    });
    
    if (!regCarRes.ok) {
      console.error(`  Failed to regenerate carousel for ${id}:`, await regCarRes.text());
      continue;
    }
    console.log(`  Carousel regenerated.`);
  }
  
  console.log('\nAll done!');
}

main().catch(console.error);
