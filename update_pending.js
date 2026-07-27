const API_URL = "https://mytaxbot-linkedin.a-lopezalon91.workers.dev/api";

async function main() {
    console.log("Fetching pending posts...");
    const res = await fetch(`${API_URL}/posts?status=pending`, {
        headers: { 'Authorization': 'Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e' }
    });
    if (!res.ok) {
        console.error("Error fetching posts:", await res.text());
        return;
    }
    
    let data = await res.json();
    let posts = data.posts || data; // handle { posts: [...] } vs [...]
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
        console.log("No pending posts found.");
        return;
    }
    
    const instructions = "REGLA OBLIGATORIA DE LONGITUD: El post principal (el texto de LinkedIn) DEBE cumplir el requisito estricto de CARACTERES MÍNIMOS. Tienes que escribir un post de AL MENOS 1000 caracteres de longitud. Desarrolla profundamente la 'Hoja de Ruta' técnica y el impacto financiero, usando frases contundentes y detalladas. No resumas excesivamente. Mantén el tono disruptivo de Alberto López y devuelve EXCLUSIVAMENTE el JSON con 'post', 'first_comment' y 'carousel'.";

    console.log(`Found ${posts.length} pending posts. Regenerating with length constraints...`);
    for (const p of posts) {
        console.log(`Regenerating post ${p.id}...`);
        const action_res = await fetch(`${API_URL}/posts/${p.id}/regenerate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer d5a8fb21e7d97b0a790518d6bc1f9b3e'
            },
            body: JSON.stringify({
                instructions: instructions
            })
        });
        if (action_res.ok) {
            console.log(`Post ${p.id} regenerated successfully.`);
        } else {
            console.error(`Error regenerating post ${p.id}:`, await action_res.text());
        }
        await new Promise(r => setTimeout(r, 15000)); // 15s delay to avoid rate limits
    }
}

main().catch(console.error);
