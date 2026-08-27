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
    const diarios = Array.isArray(data.data.sumario.diario) ? data.data.sumario.diario : [data.data.sumario.diario];
    
    for (const diario of diarios) {
      if (!diario || !diario.seccion) continue;
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
    }

    // Palabras clave que SÍ nos interesan (muy enfocadas en autónomos/pymes)
    const keywordRegex = /\b(autónomos?|autonomos?|pymes?|empresas?|irpf|iva|is|impuesto sobre sociedades|seguridad social|reforma laboral|cuota|ayudas? directas?|subvencion(?:es)?|cese de actividad|hacienda)\b/i;
    
    // Palabras clave que NO nos interesan (ruido del BOE: nombramientos, universidades, convenios colectivos muy específicos de grandes empresas, etc.)
    const excludeRegex = /\b(nombramientos?|ceses?|licitaci[óo]n|adjudicaci[óo]n|concurso|oposici[óo]n|funcionarios?|universidad|convenio colectivo|ministerio|ayuntamiento|diputaci[óo]n|fuerzas armadas|polic[ií]a|guardia civil|condecoraci[óo]n|expropiaci[óo]n|becas?|premios?|subasta)\b/i;
    
    let inserted = 0;

    for (const item of items) {
      const title = item.titulo || '';
      
      // Filtrar por palabra clave Y asegurar que no tenga palabras de exclusión
      if (keywordRegex.test(title) && !excludeRegex.test(title)) {
        const sourceId = item.identificador || `boe-${Date.now()}`;
        
        // Verificar si ya existe
        const existing = await db.prepare("SELECT id FROM posts WHERE source_id = ?").bind(sourceId).first();
        if (!existing) {
          const contentJsonStr = JSON.stringify(item);
          await db.prepare(`
            INSERT INTO posts (id, source_id, source_url, source_name, type, sector, status, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            sourceId,
            `https://www.boe.es/diario_boe/txt.php?id=${sourceId}`,
            'BOE',
            'normativa',
            'general', // El router cognitivo lo refinará
            'pending',
            contentJsonStr, // Save original JSON here to parse it later
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
