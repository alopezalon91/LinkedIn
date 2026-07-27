import { nowISO } from '../utils.js';

/**
 * Módulo de Scraping Serverless para el BOE
 * Obtiene el sumario diario, filtra por palabras clave y guarda los borradores en la DB.
 */
export async function scrapeBOE(db) {
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const url = `https://www.boe.es/datosabiertos/api/boe/sumario/${dateStr}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    
    if (!res.ok) {
      console.error(`[BOE Scraper] Error fetching BOE: ${res.status}`);
      return 0;
    }

    const data = await res.json();
    if (!data.data || !data.data.sumario || !data.data.sumario.diario) return 0;
    
    let items = [];
    const diario = data.data.sumario.diario;
    const secciones = Array.isArray(diario.seccion) ? diario.seccion : [diario.seccion];
    
    for (const seccion of secciones) {
      if (!seccion || !seccion.departamento) continue;
      const deptos = Array.isArray(seccion.departamento) ? seccion.departamento : [seccion.departamento];
      
      for (const depto of deptos) {
        if (!depto.epigrafe) continue;
        const eps = Array.isArray(depto.epigrafe) ? depto.epigrafe : [depto.epigrafe];
        for (const ep of eps) {
          if (!ep.item) continue;
          const epsItems = Array.isArray(ep.item) ? ep.item : [ep.item];
          items.push(...epsItems);
        }
      }
    }

    const keywords = ['tributario', 'fiscal', 'laboral', 'hacienda', 'impuesto', 'autónomo', 'irpf', 'is', 'seguridad social'];
    let inserted = 0;

    for (const item of items) {
      const title = item.titulo || '';
      const textLower = title.toLowerCase();
      
      if (keywords.some(k => textLower.includes(k))) {
        const sourceId = item.identificador || `boe-${Date.now()}`;
        
        // Verificar si ya existe
        const existing = await db.prepare("SELECT id FROM posts WHERE source_id = ?").bind(sourceId).first();
        if (!existing) {
          await db.prepare(`
            INSERT INTO posts (source_id, url, source, sector, status, original_news_json, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            sourceId,
            `https://www.boe.es/diario_boe/txt.php?id=${sourceId}`,
            'BOE',
            'general', // El router cognitivo lo refinará
            'pending',
            JSON.stringify(item),
            title, // Como contenido inicial guardamos el título
            nowISO(),
            nowISO()
          ).run();
          inserted++;
        }
      }
    }
    
    console.log(`[BOE Scraper] Ejecutado. Nuevos posts: ${inserted}`);
    return inserted;
  } catch (e) {
    console.error(`[BOE Scraper] Excepción:`, e);
    return 0;
  }
}
