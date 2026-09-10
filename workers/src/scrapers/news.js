import { nowISO } from '../utils.js';
import { generatePostFromDraft } from '../api/posts.js';

const RSS_SOURCES = [
  // Bing News España con parámetros estrictos de mercado e idioma español
  { name: 'Bing Fiscal / Hacienda', url: 'https://www.bing.com/news/search?q=hacienda+impuestos+espana&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Autónomos / RETA', url: 'https://www.bing.com/news/search?q=autonomos+seguridad+social+espana&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Ecommerce', url: 'https://www.bing.com/news/search?q=ecommerce+espana&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Verifactu / Facturación', url: 'https://www.bing.com/news/search?q=factura+electronica+verifactu&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing IRPF / IVA', url: 'https://www.bing.com/news/search?q=irpf+iva+hacienda&format=rss&setmkt=es-ES&setlang=es' },
  // Medios especializados directos de España
  { name: 'Infoautónomos', url: 'https://www.infoautonomos.com/feed/' },
  { name: 'El Debate Economía', url: 'https://www.eldebate.com/rss/economia.xml' },
  { name: 'El Mundo Economía', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml' }
];

const HIGH_RELEVANCE_KEYWORDS = /\b(tributari[oa]s?|fiscal(es)?|hacienda|aeat|agencia tributaria|impuest[oa]s?|irpf|iva|sociedades|plusval[ií]a|sanci[oó]n(es)?|embargo|inspecci[oó]n|inspeccion|deducci[oó]n|deducciones|autónom[oa]s?|autonom[oa]s?|reta|cuota de aut[oó]nomos|cuota|seguridad social|facturaci[oó]n electr[oó]nica|factura electr[oó]nica|verifactu|ticketbai|ecommerce|e-commerce|comercio electr[oó]nico|tienda online|dropshipping|declaraci[oó]n de la renta|renta|despido|nif|revocaci[oó]n|cotizaci[oó]n|cotizaciones|laboral|pensiones?|jubilaci[oó]n|modelo 720|modelo 303|modelo 390|modelo 100|campa[ñn]a de la renta|finanzas|pyme|pymes)\b/i;

const EXCLUDE_KEYWORDS = /\b(f[uú]tbol|liga|champions|partido|fichaje|marruecos|ucrania|guerra|misil|israel|bater[ií]as?|osnabrück|audiovisual|volkswagen|cine|pel[ií]cula|concierto|festival|hollywood|inmersivas|job crafting|mba\b|m[aá]ster|master|cursos? gratuitos?|gimnasio|renting flexible|softphone|ecosistema mac|cu[aá]ntica|f[ií]sica cu[aá]ntica|gas europeo|almacenamiento de gas|bonos mundiales|financiaci[oó]n auton[oó]mica|consejo de pol[ií]tica fiscal|plant[oó]n de madrid|ayuso planta|madrid se borra|junta de castilla y le[oó]n exige|consejeros del psoe|ingreso m[ií]nimo vital|aut[oó]nomos chinos|pesebre|hipoteca inversa|airbus|efactura f[oó]rum|calendario laboral.*festivos|tasa tur[ií]stica)\b/i;

const FOREIGN_EXCLUDE = /\b(mexico|méxico|sheinbaum|monreal|mañanera|sat\b|mmdp|pesos mexicanos|paquete económico|diputados de méxico|senado mexicano|lópez obrador|amlo|colombia|bogot[aá]|dian\b|gustavo petro|argentina|afip\b|arca\b|milei|buenos aires|pesos argentinos|per[uú]|sunat\b|chile\b|sii\b|latam|estados unidos|biden|trump|irs\b|india\b|sitharaman|gst\b|rupees|dólares\b|francia\b|precriterios|morena\b)\b/i;

const ENGLISH_STOPWORDS = /\b(the|and|for|with|this|that|from|how to|why you need|market|global|growth|revenue|business|ecommerce side hustles|dropshipping in|top 10|retailers|shopping|brands|selling|sellers|strategies|tools|tiktok shop is|what is|best practices|guide to)\b/gi;

export function isValidSpanishTaxNews(title, summary) {
  const combined = `${title || ''} ${summary || ''}`;
  if (EXCLUDE_KEYWORDS.test(combined)) return false;
  if (FOREIGN_EXCLUDE.test(combined)) return false;
  const englishMatches = combined.match(ENGLISH_STOPWORDS);
  if (englishMatches && englishMatches.length >= 2) return false;
  if (!HIGH_RELEVANCE_KEYWORDS.test(combined)) return false;
  return true;
}

function decodeEntities(str) {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/gi, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractTagContent(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  if (!match) return '';
  return decodeEntities(match[1]);
}

function generateSourceId(link, title) {
  let target = link || '';
  if (target.includes('bing.com/news/apiclick.aspx')) {
    try {
      const urlObj = new URL(target);
      const realUrl = urlObj.searchParams.get('url');
      if (realUrl) {
        target = decodeURIComponent(realUrl);
      } else {
        const tid = urlObj.searchParams.get('tid') || '';
        target = tid ? `${target}-${tid}` : target;
      }
    } catch(e) {}
  }
  const cleanUrl = target.split('?')[0].replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
  const cleanTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 24);
  return `news-${cleanUrl}-${cleanTitle}`;
}

export function detectSector(text) {
  const t = (text || '').toLowerCase();
  if (t.match(/ecommerce|e-commerce|comercio electr[oó]nico|tienda online|dropshipping|shein|temu|amazon/)) return 'ecommerce';
  if (t.match(/creador|streamer|youtuber?|twitch|influencer|onlyfans/)) return 'content_creator';
  if (t.match(/inmobiliari|vivienda|alquiler|arrendamiento|plusval[ií]a|piso|hipoteca/)) return 'inmobiliario';
  if (t.match(/irpf|iva|patrimonio|declaraci[oó]n de la renta|campa[ñn]a de renta/)) return 'iva_irpf';
  if (t.match(/autónom|autonom|reta|cuota de aut[oó]nomo/)) return 'autonomos';
  if (t.match(/pyme|pymes|sociedades|impuesto de sociedades/)) return 'pymes';
  if (t.match(/directiva|uni[oó]n europea|ue\b|bruselas/)) return 'normativa_europea';
  return 'general';
}

export function detectUrgency(text) {
  const t = (text || '').toLowerCase();
  if (t.match(/hacienda|inspecci[oó]n|sanci[oó]n|embargo|plazo|infracci[oó]n|alerta|urgente|multa/)) {
    return 'alta';
  }
  return 'media';
}

/**
 * Módulo de Scraping Serverless para Noticias (RSS)
 * Extrae noticias financieras/fiscales/laborales y las inserta como borradores.
 * Opcionalmente genera posts completos con IA si se pasa env.
 */
export async function scrapeNews(db, env = null, ctx = null) {
  let inserted = 0;
  const newPostIds = [];
  const debug = [];

  const headers = {
    'User-Agent': 'curl/7.88.1',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  };

  for (const source of RSS_SOURCES) {
    let feedCount = 0;
    let matchCount = 0;
    let dupCount = 0;
    try {
      const res = await fetch(source.url, { headers });
      if (!res.ok) {
        debug.push({ name: source.name, error: `HTTP ${res.status}` });
        continue;
      }
      
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      while ((match = itemRegex.exec(xml)) !== null) {
        feedCount++;
        const itemXml = match[1];
        
        let title = extractTagContent(itemXml, 'title');
        let link = extractTagContent(itemXml, 'link').trim();
        let summary = extractTagContent(itemXml, 'description').replace(/<[^>]*>?/gm, '').trim();
        
        if (!title || !link) continue;
        
        let sourceName = source.name;
        if (source.name.startsWith('Google') && title.includes(' - ')) {
          const parts = title.split(' - ');
          if (parts.length > 1) {
            sourceName = parts.pop().trim();
            title = parts.join(' - ').trim();
          }
        }
        
        // Resolver proxy URLs de Bing a enlaces reales
        if (link.includes('bing.com/news/apiclick.aspx')) {
          try {
            const urlObj = new URL(link);
            const realUrl = urlObj.searchParams.get('url');
            if (realUrl) link = realUrl;
          } catch(e) {}
        }
        
        const combinedText = `${title} ${summary}`;
        
        // Filtrado estricto de relevancia y ámbito fiscal español
        if (!isValidSpanishTaxNews(title, summary)) {
          continue;
        }
          matchCount++;
          const sourceId = generateSourceId(link, title);
          
          const existing = await db.prepare("SELECT id FROM posts WHERE source_id = ?").bind(sourceId).first();
          if (existing) {
            dupCount++;
          } else {
            const newId = crypto.randomUUID();
            const sector = detectSector(combinedText);
            const urgency = detectUrgency(combinedText);
            
            await db.prepare(`
              INSERT INTO posts (id, source_id, source_url, source_name, type, sector, urgency, status, content, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              newId,
              sourceId,
              link,
              sourceName,
              'actualidad',
              sector,
              urgency,
              'draft',
              JSON.stringify({ title, link, summary, original_text: `${title}\n\n${summary}` }),
              nowISO(),
              nowISO()
            ).run();
            newPostIds.push(newId);
            inserted++;
          }
      }
      debug.push({ name: source.name, items: feedCount, matches: matchCount, duplicates: dupCount });
    } catch (e) {
      debug.push({ name: source.name, error: e.message });
    }
  }
  
  console.log(`[News Scraper] Ejecutado. Nuevos posts: ${inserted}`);

  // Generar automáticamente con IA los posts más relevantes para la cola de revisión
  if (env && newPostIds.length > 0) {
    const toGenerate = newPostIds.slice(0, 3);
    const bgGenerate = async () => {
      for (const id of toGenerate) {
        try {
          await generatePostFromDraft(db, env, ctx, id);
          console.log(`[News Scraper] Post generado automáticamente con IA: ${id}`);
        } catch (err) {
          console.error(`[News Scraper] Fallo al generar post IA para ${id}:`, err);
        }
      }
    };
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(bgGenerate());
    } else {
      bgGenerate();
    }
  }

  // Comprobar posts pendientes actuales en DB
  const recentRows = await db.prepare("SELECT id, source_name, status, urgency, created_at FROM posts ORDER BY created_at DESC LIMIT 15").all();

  return { inserted, newPostIds, recent_posts: recentRows.results ?? [], debug };
}

/**
 * Búsqueda en vivo de noticias sobre un término específico (ej: "ecommerce", "criptomonedas", "irpf")
 */
export async function searchNewsLive(db, env, ctx, query) {
  if (!query || !query.trim()) return { inserted: 0, posts: [] };

  const cleanQuery = encodeURIComponent(query.trim());
  const feedUrl = `https://www.bing.com/news/search?q=${cleanQuery}+espana&format=rss&setmkt=es-ES&setlang=es`;
  
  const headers = {
    'User-Agent': 'curl/7.88.1',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  };

  const res = await fetch(feedUrl, { headers });
  if (!res.ok) throw new Error(`Bing News RSS respondió con HTTP ${res.status}`);

  const xml = await res.text();
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let inserted = 0;
  const foundPosts = [];

  while ((match = itemRegex.exec(xml)) !== null && inserted < 10) {
    const itemXml = match[1];
    let title = extractTagContent(itemXml, 'title');
    let link = extractTagContent(itemXml, 'link').trim();
    let summary = extractTagContent(itemXml, 'description').replace(/<[^>]*>?/gm, '').trim();
    
    if (!title || !link) continue;

    const combined = `${title} ${summary}`;
    if (FOREIGN_EXCLUDE.test(combined)) continue;
    if (EXCLUDE_KEYWORDS.test(combined)) continue;
    const englishMatches = combined.match(ENGLISH_STOPWORDS);
    if (englishMatches && englishMatches.length >= 2) continue;

    if (link.includes('bing.com/news/apiclick.aspx')) {
      try {
        const urlObj = new URL(link);
        const realUrl = urlObj.searchParams.get('url');
        if (realUrl) link = realUrl;
      } catch(e) {}
    }
    
    let sourceName = 'Prensa Digital';
    const sourceTag = itemXml.match(/<News:Source>(.*?)<\/News:Source>/i);
    if (sourceTag) {
      sourceName = decodeEntities(sourceTag[1]);
    }

    const sourceId = generateSourceId(link, title);
    
    const existing = await db.prepare("SELECT * FROM posts WHERE source_id = ?").bind(sourceId).first();
    if (existing) {
      foundPosts.push(existing);
    } else {
      const newId = crypto.randomUUID();
      const combined = `${title} ${summary}`;
      const sector = detectSector(combined);
      const urgency = detectUrgency(combined);
      const contentJson = JSON.stringify({ title, link, summary, original_text: `${title}\n\n${summary}` });

      await db.prepare(`
        INSERT INTO posts (id, source_id, source_url, source_name, type, sector, urgency, status, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newId,
        sourceId,
        link,
        sourceName,
        'actualidad',
        sector,
        urgency,
        'draft',
        contentJson,
        nowISO(),
        nowISO()
      ).run();

      foundPosts.push({
        id: newId,
        source_id: sourceId,
        source_url: link,
        source_name: sourceName,
        type: 'actualidad',
        sector,
        urgency,
        status: 'draft',
        content: contentJson,
        created_at: nowISO()
      });
      inserted++;
    }
  }

  return { inserted, posts: foundPosts };
}
