import { nowISO } from '../utils.js';

const RSS_FEEDS = [
  'https://www.eleconomista.es/rss/rss-economia.php',
  'https://e00-expansion.uecdn.es/rss/economia.xml'
];

/**
 * Módulo de Scraping Serverless para Noticias (RSS)
 * Extrae noticias financieras/fiscales/laborales y las inserta como borradores.
 */
export async function scrapeNews(db) {
  let inserted = 0;
  
  for (const url of RSS_FEEDS) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'MyTaxBot/1.0' } });
      if (!res.ok) continue;
      
      const xml = await res.text();
      
      // Extracción rudimentaria de <item>...</item>
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      const keywordRegex = /\b(tributario|fiscal|laboral|hacienda|impuestos?|autónomos?|autonomos?|irpf|is|seguridad social)\b/i;

      while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        
        const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemXml.match(/<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>/) || itemXml.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>([\s\S]*?)<\/description>/);
        
        if (!titleMatch || !linkMatch) continue;
        
        const title = titleMatch[1].trim();
        const link = linkMatch[1].trim();
        let summary = descMatch ? descMatch[1].trim() : '';
        // Limpiar HTML tags del summary
        summary = summary.replace(/<[^>]*>?/gm, '').trim();
        
        if (keywordRegex.test(title) || keywordRegex.test(summary)) {
          // Generar ID a partir de URL
          const sourceId = `news-${btoa(link).substring(0, 30)}`;
          
          const existing = await db.prepare("SELECT id FROM posts WHERE source_id = ?").bind(sourceId).first();
          if (!existing) {
            await db.prepare(`
              INSERT INTO posts (id, source_id, source_url, source_name, type, sector, status, content, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              crypto.randomUUID(),
              sourceId,
              link,
              'PRENSA',
              'actualidad',
              'general', 
              'pending',
              JSON.stringify({ title, link, summary }),
              nowISO(),
              nowISO()
            ).run();
            inserted++;
          }
        }
      }
    } catch (e) {
      console.error(`[News Scraper] Error parseando ${url}:`, e);
    }
  }
  
  console.log(`[News Scraper] Ejecutado. Nuevos posts: ${inserted}`);
  return inserted;
}
