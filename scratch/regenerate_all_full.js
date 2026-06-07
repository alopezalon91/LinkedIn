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

async function main() {
  const postsData = await request('/api/posts?status=pending');
  const posts = postsData.posts || [];
  
  console.log(`Found ${posts.length} pending posts.`);
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`Regenerating post ${post.id}...`);
    try {
      const result = await request(`/api/posts/${post.id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({
          instructions: "Por favor, reescribe este post aplicando ESTRICTAMENTE las nuevas reglas: 1. TUTEO OBLIGATORIO. 2. CERO RELLENO: Elimina frases vacías (como 'esto supone un cambio'). Si la frase no da un dato exacto, bórrala. 3. CERO REDUNDANCIA: Prohibido repetir la misma frase o palabra ('deudas', 'sistema') constantemente. 4. TONO DISRUPTIVO EXTREMO: Empieza de forma agresiva y dura ('Hacienda acaba de activar...'), no como un telediario aburrido. 5. Usa iconos temáticos. PROHIBIDO simples números con emojis."
        })
      });
      console.log(`Success for ${post.id}`);
    } catch (e) {
      console.error(e);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
}
main();
