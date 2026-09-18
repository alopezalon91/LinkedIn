import { nowISO } from '../utils.js';
import { generatePostFromDraft } from '../api/posts.js';

const RSS_SOURCES = [
  // Medios especializados directos de España
  { name: 'Autónomos y Emprendedor (ATA)', url: 'https://www.autonomosyemprendedor.es/rss' },
  { name: 'Infoautónomos', url: 'https://www.infoautonomos.com/feed/' },
  // Búsquedas de Bing News España especializadas en normativa y compliance
  { name: 'Bing Hacienda Autónomos', url: 'https://www.bing.com/news/search?q=hacienda+autonomos+espana&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Verifactu / Factura Electrónica', url: 'https://www.bing.com/news/search?q=verifactu+factura+electronica&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Seguridad Social / RETA', url: 'https://www.bing.com/news/search?q=seguridad+social+reta+autonomos&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Inspección Hacienda / Trabajo', url: 'https://www.bing.com/news/search?q=inspeccion+hacienda+espana&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing IRPF / IVA Autónomos', url: 'https://www.bing.com/news/search?q=irpf+iva+autonomos&format=rss&setmkt=es-ES&setlang=es' },
  { name: 'Bing Tributos Pymes', url: 'https://www.bing.com/news/search?q=tributos+pymes+espana&format=rss&setmkt=es-ES&setlang=es' }
];

const STRICT_EXCLUDE_KEYWORDS = /\b(shakira|pique|futbol|futbolista|jugador|fichaje|partido|liga|champions|cantante|artista|actor|actriz|cine|pel[ií]cula|concierto|festival|hollywood|novela|televisi[oó]n|gh vip|supervivientes|celebrity|zapatero|rajoy|s[aá]nchez|feij[oó]o|aznar|abascal|iglesias|marruecos|ucrania|guerra|misil|israel|bater[ií]as?|audiovisual|volkswagen|padres e hijos|padre a hijo|hijos? a padres?|hermano|hermana|familiares?|entre familiares|pr[eé]stamos? familiares?|donar dinero a un familiar|donaciones? entre familiares|cajero|cajeros|sacar dinero|dinero en efectivo|efectivo que se puede|l[ií]mite de efectivo|bizum que reciben|declarar los bizum|inquilino|casero|alquiler de vivienda|destroza la vivienda|arrendamiento de vivienda|ganancias del juego|casinos?|loter[ií]a|apuestas?|juegos? de azar|pesebre|hipoteca inversa|licencia de apertura|brics|desdolarizaci[oó]n|d[oó]lar|blackrock|fondos? buitre|bancos? centrales?|wall street|gas europeo|almacenamiento de gas|bonos mundiales|financiaci[oó]n auton[oó]mica|financiacion auton[oó]mica|reparto.*ccaa|comunidades aut[oó]nomas|estado y las comunidades|las comunidades y el estado|concierto econ[oó]mico|cupo catal[aá]n|consejo de pol[ií]tica fiscal|ley de financiaci[oó]n|plant[oó]n de madrid|ayuso planta|madrid se borra|junta de castilla y le[oó]n exige|consejeros del psoe|hacienda presume de dar.*a las ccaa|voracidad fiscal|liberaci[oó]n fiscal|d[ií]a de la liberaci[oó]n fiscal|hacienda recauda|recaudaci[oó]n casi el doble|recauda.*m[aá]s r[aá]pido|recauda cada mes|la agencia tributaria recauda|gpt-3|gpt-4|gpt-5|openai|sam altman|f[ií]sica cu[aá]ntica|cu[aá]ntica|ceuta|melilla|ayuntamiento de|cabildo|inversor:\s*['"«]|inspector.*:\s*['"«]|asesor.*:\s*['"«]|presidente de.*:\s*['"«]|entrevista a\b|afirma en una entrevista|en declaraciones a|osnabrück|job crafting|mba\b|m[aá]ster|master|cursos? gratuitos?|gimnasio|renting flexible|softphone|ecosistema mac|airbus|efactura f[oó]rum|calendario laboral.*festivos|tasa tur[ií]stica)\b/i;

const FOREIGN_EXCLUDE = /\b(mexico|méxico|sheinbaum|monreal|mañanera|sat\b|mmdp|pesos mexicanos|paquete económico|diputados de méxico|senado mexicano|lópez obrador|amlo|colombia|bogot[aá]|dian\b|gustavo petro|argentina|afip\b|arca\b|milei|buenos aires|pesos argentinos|per[uú]|sunat\b|chile\b|sii\b|latam|estados unidos|biden|trump|irs\b|india\b|sitharaman|gst\b|rupees|dólares\b|francia\b|precriterios|morena\b)\b/i;

const ENGLISH_STOPWORDS = /\b(the|and|for|with|this|that|from|how to|why you need|market|global|growth|revenue|business|ecommerce side hustles|dropshipping in|top 10|retailers|shopping|brands|selling|sellers|strategies|tools|tiktok shop is|what is|best practices|guide to)\b/gi;

// Palabras clave obligatorias que demuestran impacto real en la actividad de empresas o autónomos
const BUSINESS_TARGET_KEYWORDS = /\b(autónom[oa]s?|autonom[oa]s?|pymes?|empresas?|empresarios?|sociedades|sociedad limitada|reta|cuota de aut[oó]nomos?|cuotas|base de cotizaci[oó]n|factura electr[oó]nica|facturaci[oó]n electr[oó]nica|verifactu|ticketbai|inspecci[oó]n de trabajo|inspecci[oó]n de hacienda|inspecci[oó]n tributaria|inspecci[oó]n|tributos|consulta vinculante|dgt\b|tribunal supremo|teac|tear|tsj|liquidaci[oó]n|modelo 303|modelo 390|modelo 200|modelo 111|modelo 190|modelo 036|modelo 037|iva deducible|deducci[oó]n|desgravar|amortizaci[oó]n|embargo|sanci[oó]n tributaria|recargo|lgt\b|liva\b|lirpf\b|falsos aut[oó]nomos?|registro de jornada|despido|nif|nómina|laboral|ecommerce|e-commerce|tienda online|dropshipping)\b/i;

export function isValidSpanishTaxNews(title, summary) {
  const combined = `${title || ''} ${summary || ''}`;
  if (STRICT_EXCLUDE_KEYWORDS.test(combined)) return false;
  if (FOREIGN_EXCLUDE.test(combined)) return false;
  const englishMatches = combined.match(ENGLISH_STOPWORDS);
  if (englishMatches && englishMatches.length >= 2) return false;
  if (!BUSINESS_TARGET_KEYWORDS.test(combined)) return false;
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

const SPANISH_STOP_WORDS = new Set([
  'para', 'como', 'pero', 'este', 'esta', 'estos', 'estas', 'entre', 'sobre', 'desde', 'hasta', 'hacia',
  'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras', 'porque', 'cuando', 'donde', 'quien',
  'cual', 'cuales', 'tiene', 'tienen', 'puede', 'pueden', 'haber', 'hacer', 'dice', 'segun', 'tras',
  'ante', 'bajo', 'cabe', 'mediante', 'durante', 'sino', 'siquiera', 'algo', 'nada', 'poco', 'mucho',
  'tanto', 'cuanto', 'cada', 'cierto', 'unos', 'unas', 'estas', 'estos', 'ellos', 'ellas',
  'aqui', 'alla', 'bien', 'solo', 'gran', 'mas', 'menos', 'despues', 'antes', 'ahora', 'tambien',
  'nuevo', 'nueva', 'nuevos', 'nuevas', 'ultimo', 'ultima', 'ultimos', 'ultimas', 'dice', 'avisa',
  'confirma', 'senala', 'revela', 'anuncia', 'explica'
]);

export function cleanTitleForComparison(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^(video|vídeo|economia|economía|tribuna|opinion|opinión|directo|ultima hora|última hora|atencion|atención|aviso|alerta|exclusiva|analisis|análisis|urgente|editorial|en directo)[\s:.-]+/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSignificantWords(normTitle) {
  return new Set(
    (normTitle || '').split(' ')
      .filter(w => w.length > 3 && !SPANISH_STOP_WORDS.has(w))
  );
}

export function canonicalizeUrl(urlStr) {
  if (!urlStr) return '';
  try {
    let u = decodeEntities(urlStr);
    if (u.includes('bing.com/news/apiclick.aspx')) {
      const parsed = new URL(u.replace(/&amp;/g, '&'));
      const real = parsed.searchParams.get('url');
      if (real) u = decodeURIComponent(real);
    }
    const obj = new URL(u);
    const cleanParams = new URLSearchParams();
    for (const [k, v] of obj.searchParams) {
      const kl = k.toLowerCase();
      if (!kl.startsWith('utm_') && !['ref', 'tid', 'ocid', 'cvid', 'ei', 'form', 'sp'].includes(kl)) {
        cleanParams.set(k, v);
      }
    }
    obj.search = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
    obj.hash = '';
    return obj.toString().replace(/\/$/, '').toLowerCase();
  } catch(e) {
    return urlStr.split('?')[0].replace(/\/$/, '').toLowerCase();
  }
}

function generateSourceId(link, title) {
  let target = link || '';
  if (target.includes('bing.com/news/apiclick.aspx')) {
    try {
      const urlObj = new URL(target.replace(/&amp;/g, '&'));
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

export async function loadHistorySignatures(db) {
  const { results } = await db.prepare(`
    SELECT id, source_id, source_url, content, status 
    FROM posts 
    WHERE created_at >= datetime('now', '-90 days')
       OR status IN ('pending', 'draft', 'scheduled', 'approved', 'rejected')
  `).all();

  const knownSourceIds = new Set();
  const knownUrls = new Set();
  const signatures = [];

  for (const r of (results || [])) {
    if (r.source_id) knownSourceIds.add(r.source_id);
    const cUrl = canonicalizeUrl(r.source_url);
    if (cUrl) knownUrls.add(cUrl);

    let rawTitle = '';
    try {
      const parsed = JSON.parse(r.content);
      rawTitle = parsed.title || '';
    } catch(e) {
      rawTitle = r.content?.split('\n')[0] || '';
    }

    const normTitle = cleanTitleForComparison(rawTitle);
    const words = getSignificantWords(normTitle);
    if (words.size > 0) {
      signatures.push({
        id: r.id,
        status: r.status,
        sourceId: r.source_id,
        canonicalUrl: cUrl,
        normTitle,
        words,
        rawTitle
      });
    }
  }

  return { knownSourceIds, knownUrls, signatures };
}

export function findDuplicateMatch(history, item) {
  // 1. Direct Source ID match
  if (item.sourceId && history.knownSourceIds.has(item.sourceId)) {
    const matched = history.signatures.find(s => s.sourceId === item.sourceId);
    return { isDuplicate: true, matched, reason: 'source_id' };
  }

  // 2. Canonical URL match
  if (item.canonicalUrl && history.knownUrls.has(item.canonicalUrl)) {
    const matched = history.signatures.find(s => s.canonicalUrl === item.canonicalUrl);
    return { isDuplicate: true, matched, reason: 'canonical_url' };
  }

  // 3. Title Semantic / Fuzzy Similarity match
  const itemNorm = cleanTitleForComparison(item.title);
  const itemWords = getSignificantWords(itemNorm);
  if (!itemWords.size) return { isDuplicate: false };

  for (const sig of history.signatures) {
    if (sig.normTitle === itemNorm) {
      return { isDuplicate: true, matched: sig, reason: 'exact_title' };
    }

    if (itemNorm.length > 25 && sig.normTitle.length > 25 && (itemNorm.includes(sig.normTitle) || sig.normTitle.includes(itemNorm))) {
      return { isDuplicate: true, matched: sig, reason: 'title_substring' };
    }

    let common = 0;
    for (const w of itemWords) {
      if (sig.words.has(w)) common++;
    }

    const union = new Set([...itemWords, ...sig.words]).size;
    const jaccard = common / union;
    const minOverlap = common / Math.min(itemWords.size, sig.words.size);

    if (jaccard >= 0.45 || (common >= 4 && minOverlap >= 0.50)) {
      return { isDuplicate: true, matched: sig, reason: 'semantic_title_overlap' };
    }
  }

  return { isDuplicate: false };
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

  const history = await loadHistorySignatures(db);

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
        
        const combinedText = `${title} ${summary}`;
        
        // Filtrado estricto de relevancia y ámbito fiscal español
        if (!isValidSpanishTaxNews(title, summary)) {
          continue;
        }

        matchCount++;
        const canonicalUrl = canonicalizeUrl(link);
        const sourceId = generateSourceId(link, title);
        
        const dup = findDuplicateMatch(history, { title, sourceId, canonicalUrl });
        if (dup.isDuplicate) {
          dupCount++;
          continue;
        }

        const newId = crypto.randomUUID();
        const sector = detectSector(combinedText);
        const urgency = detectUrgency(combinedText);
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

        history.knownSourceIds.add(sourceId);
        if (canonicalUrl) history.knownUrls.add(canonicalUrl);
        const normTitle = cleanTitleForComparison(title);
        history.signatures.push({
          id: newId,
          status: 'draft',
          sourceId,
          canonicalUrl,
          normTitle,
          words: getSignificantWords(normTitle),
          rawTitle: title
        });

        newPostIds.push(newId);
        inserted++;
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
  let skippedDiscarded = 0;
  let alreadyPending = 0;
  const foundPosts = [];

  const history = await loadHistorySignatures(db);

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

    const canonicalUrl = canonicalizeUrl(link);
    const sourceId = generateSourceId(link, title);

    const dup = findDuplicateMatch(history, { title, sourceId, canonicalUrl });
    if (dup.isDuplicate) {
      if (dup.matched?.status === 'rejected') {
        skippedDiscarded++;
      } else if (dup.matched?.status === 'draft' || dup.matched?.status === 'pending') {
        alreadyPending++;
      }
      continue;
    }
    
    let sourceName = 'Prensa Digital';
    const sourceTag = itemXml.match(/<News:Source>(.*?)<\/News:Source>/i);
    if (sourceTag) {
      sourceName = decodeEntities(sourceTag[1]);
    }

    const newId = crypto.randomUUID();
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

    history.knownSourceIds.add(sourceId);
    if (canonicalUrl) history.knownUrls.add(canonicalUrl);
    const normTitle = cleanTitleForComparison(title);
    history.signatures.push({
      id: newId,
      status: 'draft',
      sourceId,
      canonicalUrl,
      normTitle,
      words: getSignificantWords(normTitle),
      rawTitle: title
    });

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

  return { inserted, posts: foundPosts, skipped_discarded: skippedDiscarded, already_in_queue: alreadyPending };
}
