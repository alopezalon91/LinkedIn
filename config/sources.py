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
}

# ---------------------------------------------------------------------------
# Press / News RSS Feeds
# ---------------------------------------------------------------------------

NEWS_RSS = {
    "expansion": "https://sindicacion.expansion.com/rss/economia.xml",
    "eleconomista_autonomos": "https://www.eleconomista.es/rss/rss-autonomos-pymes.php",
    "cinco_dias": "https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.com/seccion/economia/rss",
    "el_referente": "https://elreferente.es/feed/",
    "pymes_y_autonomos": "https://www.pymesyautonomos.com/feed",
    "autonomo_y_emprendedor": "https://www.autonomosyemprendedor.es/rss",
    "libre_mercado": "https://feed.libertaddigital.com/libre-mercado.xml",
    "el_pais_economia": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/seccion/economia/rss",
    "el_confidencial_economia": "https://rss.elconfidencial.com/economia/",
    "el_mundo_economia": "https://e00-elmundo.uecdn.es/elmundo/rss/economia.xml",
    "abc_economia": "https://www.abc.es/rss/2.0/economia/",
    "la_vanguardia_economia": "https://www.lavanguardia.com/rss/economia.xml",
    "la_razon_economia": "https://www.larazon.es/rss/economia.xml",
    "el_diario_economia": "https://www.eldiario.es/rss/economia/",
    "fiscal_impuestos": "https://www.fiscal-impuestos.com/feed",
    "iberley": "https://www.iberley.es/actualidad/feed",
    "notariado": "https://www.notariado.org/portal/rss",
    "lawtips_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UCvN_q9K40xP0n7l_rZcZ4Pg",
    "abogado_tiktok_youtube": "https://www.youtube.com/feeds/videos.xml?channel_id=UC292R249Hw97_38uE1f_B1A",
}

# ---------------------------------------------------------------------------
# Official Agency Feeds (treated as high-credibility sources)
# ---------------------------------------------------------------------------

OFFICIAL_SOURCES = {
    "aeat": "https://sede.agenciatributaria.gob.es/Sede/todas-noticias.xml",
    "seguridad_social": "https://www.seg-social.es/wps/portal/wss/internet/RSS/RSSNoticias",
    "hacienda_canaria": "https://tributos.gobierno-canarias.es/rss/novedades",
    "banco_espana": "https://www.bde.es/wbe/es/noticias-eventos/actualidad/rss-noticias-notas-prensa.xml",
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
