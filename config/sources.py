"""
config/sources.py
-----------------
Central registry of all data sources: BOE API endpoints, CCAA gazettes,
press RSS feeds, and official agency feeds.
"""

# ---------------------------------------------------------------------------
# BOE (Boletín Oficial del Estado) – Open Data API
# Docs: https://www.boe.es/datosabiertos/api/
# ---------------------------------------------------------------------------

BOE_API_BASE = "https://www.boe.es/datosabiertos/api"

# {date} must be formatted as YYYYMMDD (e.g. '20240601')
BOE_SUMARIO_URL = "https://www.boe.es/datosabiertos/api/boe/sumario/{date}"

# {id} is the BOE document identifier (e.g. 'BOE-A-2024-12345')
BOE_DOCUMENTO_URL = "https://www.boe.es/datosabiertos/api/documento/id/{id}"

# BOE sections we care about (Roman numeral prefix matches API response)
# I   = Disposiciones generales (Leyes, RD, Órdenes)
# II  = Autoridades y personal
# III = Otras disposiciones
# IV  = Administración de Justicia  ← less relevant, kept for completeness
BOE_RELEVANT_SECTIONS = {"I", "II", "III"}

# Minimum section ranks to include (mapped to numeric priority for sorting)
BOE_SECTION_PRIORITY = {
    "Ley": 1,
    "Real Decreto-ley": 2,
    "Real Decreto": 3,
    "Orden": 4,
    "Resolución": 5,
    "Instrucción": 6,
    "Circular": 7,
    "Otro": 8,
}

# ---------------------------------------------------------------------------
# CCAA – Boletines Oficiales de las Comunidades Autónomas (RSS)
# ---------------------------------------------------------------------------

CCAA_RSS = {
    "madrid": "https://www.bocm.es/rss/bocm-rss.xml",
    "cataluna": "https://portaldogc.gencat.cat/utilsEADOP/RSS/DOGC/RSS_RSS2_CA.xml",
    "andalucia": "https://www.juntadeandalucia.es/boja/rss.xml",
    "comunidad_valenciana": "https://www.dogv.gva.es/portal/rss.jsp",
    "galicia": "https://www.xunta.gal/diario-oficial-galicia/dog.rss",
    "canarias": "https://www.gobiernodecanarias.org/boc/rss/boc.xml",
    "pais_vasco": "https://www.euskadi.eus/bopv2/datos/bopv.xml",
    "aragon": "http://www.boa.aragon.es/cgi-bin/boa/rss.xml",
    "asturias": "https://sede.asturias.es/bopa/rss.xml",
    "baleares": "https://intranet.caib.es/eboibfront/es/rss",
    "cantabria": "https://boc.cantabria.es/boces/rss",
    "castilla_la_mancha": "https://docm.castillalamancha.es/portaldocm/rss.do",
    "castilla_y_leon": "https://bocyl.jcyl.es/rss",
    "extremadura": "https://doe.juntaex.es/rss.php",
    "la_rioja": "https://web.larioja.org/bor-rss",
    "murcia": "https://www.borm.es/rss",
    "navarra": "https://bon.navarra.es/es/rss",
}

# ---------------------------------------------------------------------------
# Press / News RSS Feeds
# ---------------------------------------------------------------------------

NEWS_RSS = {
    # ─── Medios Especializados (Fiscal, Contable, Pymes) ────────
    "supercontable": "https://www.supercontable.com/rss/",
    "infoautonomos": "https://www.infoautonomos.com/feed/",
    "pymes_y_autonomos": "https://www.pymesyautonomos.com/feed",
    "iberley": "https://www.iberley.es/feed",
    "cef": "https://www.cef.es/feed",

    # ─── 20 Medios Digitales Generalistas Importantes ────────────────
    "el_pais": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/seccion/economia",
    "el_mundo": "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml",
    "el_confidencial": "https://rss.elconfidencial.com/espana/",
    "abc": "https://www.abc.es/rss/2.0/portada/",
    "la_vanguardia": "https://www.lavanguardia.com/rss/home.xml",
    "el_espanol": "https://www.elespanol.com/rss/",
    "el_diario": "https://www.eldiario.es/rss/",
    "20_minutos": "https://www.20minutos.es/rss/",
    "la_razon": "https://news.google.com/rss/search?q=la+razon+espana&hl=es&gl=ES&ceid=ES:es",
    "huffpost": "https://news.google.com/rss/search?q=huffpost+espana&hl=es&gl=ES&ceid=ES:es",
    "vozpopuli": "https://www.vozpopuli.com/rss/",
    "libertad_digital": "https://feed.libertaddigital.com/portada.xml",
    "okdiario": "https://okdiario.com/feed",
    "the_objective": "https://theobjective.com/feed/",
    "el_debate": "https://www.eldebate.com/rss/feed.xml",
    "el_independiente": "https://www.elindependiente.com/feed/",
    "publico": "https://www.publico.es/rss/",
    "infolibre": "https://www.infolibre.es/rss/",
    "el_plural": "https://www.elplural.com/rss/",
    "ara": "https://www.ara.cat/rss/",

    # ─── 10 Medios Especializados (Economía, Autónomos, Pymes) ───────
    "expansion": "https://sindicacion.expansion.com/rss/economia.xml",
    "eleconomista_autonomos": "https://www.eleconomista.es/rss/rss-autonomos-pymes.php",
    "cinco_dias": "https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.com/seccion/economia/rss",
    "autonomo_y_emprendedor": "https://www.autonomosyemprendedor.es/rss",
    "pymes_y_autonomos": "https://www.pymesyautonomos.com/feed",
    "libre_mercado": "https://feed.libertaddigital.com/libre-mercado.xml",
    "iberley": "https://www.iberley.es/actualidad/feed",
    "fiscal_impuestos": "https://www.fiscal-impuestos.com/feed",
    "el_referente": "https://elreferente.es/feed/",
    "cepymenews": "https://cepymenews.es/feed/",

    # ─── 6 Medios de Noticias Tecnológicas (mínimo 5) ────────────────
    "xataka": "https://www.xataka.com/feed",
    "genbeta": "https://www.genbeta.com/feed",
    "computerhoy": "https://computerhoy.com/rss.xml",
    "muycomputer": "https://www.muycomputer.com/feed/",
    "silicon_es": "https://www.silicon.es/feed",
    "hipertextual": "https://hipertextual.com/feed",

    # ─── Fiscalidad Internacional — Grandes Despachos y Expertos ────────
    # Garrigues — Blog Tributario (feed real verificado)
    "garrigues_tributario": "https://blogtributario.garrigues.com/feed",
    # Legal Today — Blog de Fiscalidad Internacional (feed real verificado)
    "legal_today_fiscal": "https://www.legaltoday.com/feed/",
    # Leialta — Fiscalidad Internacional para empresas (WordPress feed)
    "leialta_fiscal": "https://leialta.com/feed/",
    # Lince Fiscal — Fiscalidad para autónomos con clientes internacionales
    "lince_fiscal": "https://lincefiscal.com/feed/",

    # ─── Canales de Creadores de Contenido Jurídico-Fiscal (YouTube) ─────
    # (ya integrados anteriormente)
    "lawtips_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCvN_q9K40xP0n7l_rZcZ4Pg",
    "abogado_tiktok_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UC292R249Hw97_38uE1f_B1A",

    # ─── 7 Creadores de Contenido Financiero (YouTube) ───────────────────
    # Fixcal / Álex Algarci — Fiscalidad internacional, cambio de residencia fiscal
    "fixcal_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCiUNJf8WN06DWttAritFtqg",
    # Juan Ramón Rallo — Economista liberal, política económica y finanzas
    "juan_rallo_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCX583S-3q5l6iWvK6oW-X9A",
    # Arte de Invertir (Alejandro Estebaranz) — Value investing, bolsa
    "arte_invertir_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCm6iZJqJ8Qj8j3D8-76_k-g",
    # Pablo Gil Trader — Análisis macroeconómico y trading
    "pablo_gil_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=@pablogiltrader",
    # Bolsa General (David Galán) — Análisis técnico y fundamental
    "bolsa_general_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCmU9b04Ym19_OvsSdt7rRYg",
    # Rankia — Educación financiera e inversión en español
    "rankia_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UC7f_Tush-CCwkb5hQNAuzdw",
    # Nómadas Fiscales — Residencia fiscal internacional, expatriados
    "nomadas_fiscales_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCG_9J5O8-T-R-nB1V43pI3g",
    # Javi Linares — Finanzas personales, inversión, método LINVEST
    "javi_linares_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=@Javierlinares",
}

# ---------------------------------------------------------------------------
# Official Agency Feeds (treated as high-credibility sources)
# ---------------------------------------------------------------------------

OFFICIAL_SOURCES = {
    "aeat": "https://sede.agenciatributaria.gob.es/Sede/todas-noticias.xml",
    "seguridad_social": "https://www.seg-social.es/wps/portal/wss/internet/RSS/RSSNoticias",
    "hacienda_canaria": "https://www3.gobiernodecanarias.org/noticias/feed/",
    "banco_espana": "https://www.bde.es/wbe/es/noticias/rss/noticias.xml",
    # Despachos internacionales — Fiscalidad Internacional de alto rigor
    "garrigues_tributario": "https://blogtributario.garrigues.com/feed",
    "cuatrecasas": "https://www.cuatrecasas.com/es/spain/publicaciones/publicaciones.rss",
    "legal_today_fiscal": "https://www.legaltoday.com/feed/",
}

# All official source keys – used for credibility check bypass
OFFICIAL_SOURCE_KEYS = set(OFFICIAL_SOURCES.keys())

# ---------------------------------------------------------------------------
# HTTP request settings (shared across scrapers)
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT = 15          # seconds
REQUEST_MAX_RETRIES = 3
REQUEST_RETRY_BACKOFF = 2.0   # seconds between retries (doubles each attempt)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, application/xml, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}
