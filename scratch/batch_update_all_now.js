const API_URL = 'https://mytaxbot-linkedin.a-lopezalon91.workers.dev';
const AUTH_TOKEN = 'd5a8fb21e7d97b0a790518d6bc1f9b3e';

async function main() {
  const pendingIds = [
    "637f3464-41c5-4b56-bf26-4dc7019c5714",
    "65458623-0193-44e6-b1ea-9fb89764e8c9",
    "a9b30a2c-2d91-42f2-9f33-4166a7d3936d",
    "bcd11a41-5d45-4804-9426-1ed4d74bf349",
    "ce479f45-91d9-441b-b9a9-1a9caf38f350",
    "f73c4877-98e1-40c9-b19a-09d3ba621ec5"
  ];
  console.log(`Found ${pendingIds.length} posts to update.`);
  
  const delay = ms => new Promise(r => setTimeout(r, ms));

  for (const id of pendingIds) {
    console.log(`\nProcessing post ${id}...`);
    await delay(15000);
    
    // 1. Regenerate text
    console.log(`  Regenerating text...`);
    const regTextRes = await fetch(`${API_URL}/api/posts/${id}/regenerate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({ 
        instructions: "Aplica ESTRICTAMENTE la regla de primera persona como mero transmisor objetivo. Reescribe el post para que esté en primera persona, pero limitándote a traducir la noticia o normativa de forma clara y precisa para tu audiencia. NUNCA des opiniones personales ni uses tono emocional (como 'me indigna' o 'yo opino'). Solo expón los datos y sus consecuencias reales. Elimina cualquier referencia en tercera persona como 'Alberto López opina'." 
      })
    });
    
    if (!regTextRes.ok) {
      console.error(`  Failed to regenerate text for ${id}:`, await regTextRes.text());
      continue;
    }
    const newPostData = await regTextRes.json();
    console.log(`  Text regenerated.`);
    
    // 2. Regenerate carousel
    console.log(`  Regenerating carousel...`);
    await delay(15000);
    const regCarRes = await fetch(`${API_URL}/api/posts/${id}/regenerate-carousel`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify({ content_edited: newPostData.content_edited })
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
