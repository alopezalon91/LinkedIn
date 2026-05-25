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
BOE_SUMARIO_URL = "https://www.boe.es/datosabiertos/api/sumario/{date}"

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
}

# ---------------------------------------------------------------------------
# Press / News RSS Feeds
# ---------------------------------------------------------------------------

NEWS_RSS = {
    "expansion": "https://www.expansion.com/rss/economia.html",
    "eleconomista_autonomos": "https://www.eleconomista.es/rss/rss-autonomos-pymes.php",
    "cinco_dias": "https://cincodias.elpais.com/rss/",
    "idealista_news": "https://www.idealista.com/news/feed/",
    "el_referente": "https://elreferente.es/feed/",
}

# ---------------------------------------------------------------------------
# Official Agency Feeds (treated as high-credibility sources)
# ---------------------------------------------------------------------------

OFFICIAL_SOURCES = {
    "aeat": "https://www.agenciatributaria.es/rss/novedades-noticias.xml",
    "seguridad_social": "https://www.seg-social.es/wps/portal/wss/internet/RSS/RSSNoticias",
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
        "LinkedInBot-Liberfy/1.0 (gestoría online; "
        "contact: hola@liberfy.es)"
    ),
    "Accept": "application/json, application/xml, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
}
