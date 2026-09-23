import { nowISO } from '../utils.js';
import { generatePostFromDraft } from '../api/posts.js';

/**
 * Módulo de Scraping Serverless para el BOE
 * Obtiene el sumario diario, filtra estrictamente la Sección 1 (Disposiciones Generales),
 * elimina ruido administrativo (oposiciones, concursos, energía, etc.) y guarda borradores.
 */
export async function scrapeBOE(db, env = null, ctx = null) {
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

        // Blindaje estricto: ÚNICAMENTE Sección 1 / I (Disposiciones Generales: Leyes, Reales Decretos, Órdenes Ministeriales)
        // Ignora categóricamente Sección 2 (Personal/Oposiciones), Sección 3 (Otras disp./Subvenciones menores), 4 y 5.
        const secCodigo = String(seccion.codigo || seccion['@id'] || '').trim().toUpperCase();
        if (secCodigo !== '1' && secCodigo !== 'I') {
          continue;
        }

        const deptos = Array.isArray(seccion.departamento) ? seccion.departamento : [seccion.departamento];
        
        for (const depto of deptos) {
          if (!depto) continue;

          // Items directos en departamento
          const directItems = depto.item || depto.texto?.item;
          if (directItems) {
            const arr = Array.isArray(directItems) ? directItems : [directItems];
            items.push(...arr);
          }

          // Items bajo epígrafe
          const epigrafes = depto.epigrafe || depto.texto?.epigrafe;
          if (epigrafes) {
            const eps = Array.isArray(epigrafes) ? epigrafes : [epigrafes];
            for (const ep of eps) {
              if (!ep || !ep.item) continue;
              const epsItems = Array.isArray(ep.item) ? ep.item : [ep.item];
              items.push(...epsItems);
            }
          }
        }
      }
    }

    // Palabras clave que SÍ nos interesan (estrictamente tributario, fiscal, mercantil y laboral para pymes y autónomos)
    const keywordRegex = /\b(irpf|iva\b|impuesto\s+sobre\s+sociedades|sociedad(?:es)?\s+(?:mercantil(?:es)?|limitada(?:s)?)|factura(?:ci[óo]n)?(?:\s+electr[óo]nica)?|veri\*?factu|ticketbai|crea\s+y\s+crece|seguridad\s+social|cotizaci[óo]n(?:es)?|bases?\s+de\s+cotizaci[óo]n|mep\b|reforma\s+laboral|estatuto\s+de\s+los\s+trabajadores|despido|inspecci[óo]n\s+(?:de\s+tributos|de\s+trabajo|tributaria)|recaudaci[óo]n|ley\s+general\s+tributaria|lgt\b|aut[óo]nomos?|pymes?|reta\b|cuota\s+de\s+aut[óo]nomos?|retenciones?|modelo\s+\d{3}|tributari[oa]s?|fiscalidad)\b/i;
    
    // Palabras clave que NO nos interesan (ruido administrativo, oposiciones, empleo público, suministros energéticos, etc.)
    const excludeRegex = /\b(organismos?\s+aut[óo]nomos?|ciudades?\s+aut[óo]nomas?|comunidades?\s+aut[óo]nomas?|oposici[óo]n(?:es)?|concurso(?:s)?|proceso(?:s)?\s+selectivo(?:s)?|tribunal(?:es)?\s+calificador(?:es)?|admitid[oa]s?|excluid[oa]s?|personal\s+(?:laboral|funcionario)|escalas?\s+t[ée]cnicas?|nombramientos?|ceses?|licitaci[óo]n(?:es)?|adjudicaci[óo]n(?:es)?|subastas?|premios?|becas?|gas\b|electricidad|el[ée]ctric[oa]|hidrocarburos?|energ[íi]a|cnmc|convenio\s+(?:colectivo|único)|fuerzas\s+armadas|polic[íi]a|guardia\s+civil|militares?|planes?\s+de\s+estudio|titulaciones?|universidad(?:es)?|enseñanza|curr[íi]culo|mutualidad\s+general\s+judicial|muface|isfas)\b/i;
    
    let inserted = 0;
    const newPostIds = [];

    for (const item of items) {
      const title = item.titulo || '';
      
      // Filtrar por palabra clave Y asegurar que no tenga palabras de exclusión
      if (keywordRegex.test(title) && !excludeRegex.test(title)) {
        const sourceId = item.identificador || `boe-${Date.now()}`;
        
        // Verificar si ya existe
        const existing = await db.prepare("SELECT id FROM posts WHERE source_id = ?").bind(sourceId).first();
        if (!existing) {
          const newId = crypto.randomUUID();
          const contentJson = JSON.stringify({
            title,
            link: `https://www.boe.es/diario_boe/txt.php?id=${sourceId}`,
            summary: title,
            original_text: `Disposición General BOE:\n${title}\n\nIdentificador: ${sourceId}\nEnlace oficial: https://www.boe.es/diario_boe/txt.php?id=${sourceId}`
          });

          await db.prepare(`
            INSERT INTO posts (id, source_id, source_url, source_name, type, sector, status, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            newId,
            sourceId,
            `https://www.boe.es/diario_boe/txt.php?id=${sourceId}`,
            'BOE',
            'normativa',
            'fiscal',
            'draft',
            contentJson,
            nowISO(),
            nowISO()
          ).run();

          inserted++;
          newPostIds.push(newId);
        }
      }
    }
    
    console.log(`[BOE Scraper] Ejecutado. Nuevos posts: ${inserted}`);

    // Si hay posts y env disponible, generar post con IA en segundo plano
    if (env && newPostIds.length > 0) {
      const toGenerate = newPostIds.slice(0, 2);
      const bgGenerate = async () => {
        for (const id of toGenerate) {
          try {
            await generatePostFromDraft(db, env, ctx, id);
            console.log(`[BOE Scraper] Post normativo generado automáticamente con IA: ${id}`);
          } catch (err) {
            console.error(`[BOE Scraper] Fallo al generar post IA para ${id}:`, err);
          }
        }
      };
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(bgGenerate());
      } else {
        bgGenerate();
      }
    }

    return inserted;
  } catch (e) {
    console.error(`[BOE Scraper] Excepción:`, e);
    return 0;
  }
}
