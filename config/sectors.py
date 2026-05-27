"""
config/sectors.py
-----------------
Keyword mappings per sector, hashtag maps, and the combined high-priority
keyword list used for quick pre-filtering before the AI relevance call.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# SECTOR_KEYWORDS
# Lowercased keyword lists used for fast text matching (no AI cost).
# A document matching ≥1 keyword in a sector is a candidate for that sector.
# ---------------------------------------------------------------------------

SECTOR_KEYWORDS: dict[str, list[str]] = {
    "ecommerce": [
        "amazon",
        "shopify",
        "tienda online",
        "marketplace",
        "dropshipping",
        "e-commerce",
        "ecommerce",
        "comercio electrónico",
        "venta online",
        "plataforma digital",
        "seller central",
        "fulfillment",
        "fba",
        "etsy",
        "wallapop",
        "mercadolibre",
        "alibaba",
        "oss",           # One-Stop-Shop IVA e-commerce
        "ioss",
        "impuesto digital",
        "dac7",          # EU directive on platform data sharing
    ],
    "content_creator": [
        "youtuber",
        "streamer",
        "influencer",
        "creador de contenido",
        "twitch",
        "youtube",
        "tiktok",
        "instagram",
        "redes sociales",
        "marketing de afiliados",
        "kdp",
        "kindle",
        "amazon kdp",
        "autopublicación",
        "monetización",
        "patreon",
        "onlyfans",
        "substack",
        "newsletter",
        "podcast",
        "royalties",
        "derechos de autor",
    ],
    "inmobiliario": [
        "inmobiliario",
        "alquiler",
        "rent to rent",
        "flipping",
        "flipping house",
        "vivienda",
        "arrendamiento",
        "hipoteca",
        "plusvalía",
        "transmisión inmueble",
        "compraventa",
        "promotor",
        "rehabilitación",
        "local comercial",
        "ibi",
        "itp",
        "ajd",
        "nuda propiedad",
        "usufructo",
        "comunidad de propietarios",
        "ley de arrendamientos urbanos",
        "lau",
        "vivienda de uso turístico",
        "vut",
        "airbnb",
        "booking",
    ],
    "iva_irpf": [
        "iva",
        "irpf",
        "declaración renta",
        "modelo 130",
        "modelo 303",
        "modelo 390",
        "modelo 347",
        "modelo 349",
        "modelo 720",
        "modelo 721",
        "facturación",
        "factura electrónica",
        "verifactu",
        "retención",
        "pago fraccionado",
        "módulos",
        "estimación directa",
        "estimación objetiva",
        "tipo impositivo",
        "exención",
        "deducción",
        "base imponible",
        "recargo de equivalencia",
        "prorrata",
        "operaciones intracomunitarias",
        "inversión sujeto pasivo",
    ],
    "autonomos": [
        "autónomo",
        "autónomos",
        "reta",
        "cotización",
        "cuota autónomo",
        "cuota de autónomos",
        "alta autónomo",
        "baja autónomo",
        "cese de actividad",
        "prestación por cese",
        "tarifa plana",
        "base de cotización",
        "incapacidad temporal",
        "it autónomo",
        "seguridad social autónomo",
        "rgss",
        "trabajador por cuenta propia",
        "economía irregular",
        "pluriactividad",
        "colaborador familiar",
        "societario",
    ],
    "pymes": [
        "pyme",
        "pymes",
        "sociedad limitada",
        "sl",
        "slu",
        "impuesto sobre sociedades",
        "is",
        "kis",                   # KitDigital / Kit Digital
        "kit digital",
        "emprendedor",
        "startup",
        "spin off",
        "reserva de capitalización",
        "reserva de nivelación",
        "entidades de nueva creación",
        "factura simplificada",
        "erte",
        "bonificación",
        "incentivo fiscal",
        "ayuda empresarial",
        "subvención",
        "ico",
        "financiación pyme",
        "aval sgr",
    ],
    "normativa_europea": [
        "directiva europea",
        "directiva ue",
        "reglamento ue",
        "reglamento europeo",
        "diario oficial ue",
        "diario oficial de la unión europea",
        "transposición",
        "eur-lex",
        "eurlex",
        "ocde",
        "pillar two",
        "impuesto mínimo global",
        "dac",
        "intercambio de información",
        "fatca",
        "crs",
        "dsa",
        "dma",
    ],
    "fiscal_internacional": [
        "residencia fiscal",
        "cambio de residencia fiscal",
        "doble imposición",
        "convenio de doble imposición",
        "cdi",
        "ley beckham",
        "régimen de impatriados",
        "régimen beckham",
        "exit tax",
        "impuesto de salida",
        "offshore",
        "holding internacional",
        "llc estados unidos",
        "jurisdicción fiscal",
        "andorra fiscal",
        "emiratos fiscalidad",
        "chipre fiscalidad",
        "malta fiscalidad",
        "zona especial canaria",
        "zec",
        "nomada digital fiscal",
        "expatriado fiscal",
        "residencia andorra",
        "precios de transferencia",
        "country by country",
        "cbcr",
        "grupo multinacional",
        "establecimiento permanente",
        "nómada digital",
        "fiscalidad internacional",
        "tributación internacional",
        "paraíso fiscal",
    ],
}

# ---------------------------------------------------------------------------
# HASHTAG_MAP
# Maps each sector to its recommended LinkedIn hashtags (beyond the always-
# included #Autónomos #Pymes).
# ---------------------------------------------------------------------------

HASHTAG_MAP: dict[str, list[str]] = {
    "ecommerce": [
        "#Ecommerce",
        "#VentaOnline",
        "#Amazon",
        "#Shopify",
        "#ComercioElectrónico",
        "#NegocioDigital",
    ],
    "content_creator": [
        "#CreadoresDeContenido",
        "#YouTuber",
        "#Influencer",
        "#MarketingDigital",
        "#MonetizaciónDigital",
        "#AmazonKDP",
    ],
    "inmobiliario": [
        "#Inmobiliario",
        "#Alquiler",
        "#RentToRent",
        "#FlippingHouse",
        "#InversiónInmobiliaria",
        "#MercadoInmobiliario",
    ],
    "iva_irpf": [
        "#IVA",
        "#IRPF",
        "#FiscalidadDigital",
        "#Impuestos",
        "#FacturaElectrónica",
        "#Verifactu",
    ],
    "autonomos": [
        "#Autónomos",
        "#CuotaAutónomos",
        "#RETA",
        "#TrabajoIndependiente",
        "#EmprendedorDigital",
    ],
    "pymes": [
        "#Pymes",
        "#Emprendimiento",
        "#Startup",
        "#ImpuestoSociedades",
        "#KitDigital",
        "#NegocioOnline",
    ],
    "normativa_europea": [
        "#NormativaEuropea",
        "#DirectivaUE",
        "#FiscalidadInternacional",
        "#OCDE",
        "#ReformaFiscal",
    ],
    "fiscal_internacional": [
        "#FiscalidadInternacional",
        "#ResidenciaFiscal",
        "#DobleImposición",
        "#NomadaDigital",
        "#PlanificaciónFiscal",
    ],
    "general": [
        "#Emprendimiento",
        "#NegocioDigital",
        "#GestoríaOnline",
        "#FiscalidadEspaña",
    ],
}

# ---------------------------------------------------------------------------
# TECH_KEYWORDS
# Technology, AI, software, and automation terms to let tech feeds pass the pre-filter.
# ---------------------------------------------------------------------------

TECH_KEYWORDS: list[str] = [
    "inteligencia artificial",
    "automatización",
    "automatizar",
    "software",
    "digitalización",
    "digitalizar",
    "herramienta digital",
    "tecnología",
    "chatgpt",
    "openai",
    "copilot",
    "gemini",
    "automatiza",
    "asistente virtual",
    "no-code",
    "nocode",
]

# ---------------------------------------------------------------------------
# MYTAXBOT_FOCUS_KEYWORDS
# Union of all high‑priority keywords relevant to MyTaxBot's niche.
# Used as a fast first-pass filter to avoid sending irrelevant content to AI.
# Sorted alphabetically for readability.
# ---------------------------------------------------------------------------

_all_keywords: set[str] = set()
for _kw_list in SECTOR_KEYWORDS.values():
    _all_keywords.update(_kw_list)
_all_keywords.update(TECH_KEYWORDS)

MYTAXBOT_FOCUS_KEYWORDS: list[str] = sorted(_all_keywords)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_sector_from_text(text: str) -> str:
    """
    Returns the best-matching sector for a given piece of text based on
    keyword frequency. Falls back to 'general' if no keywords match.

    Args:
        text: Lowercased text to analyze.

    Returns:
        Sector string key (e.g. 'ecommerce', 'autonomos', …).
    """
    text_lower = text.lower()
    scores: dict[str, int] = {sector: 0 for sector in SECTOR_KEYWORDS}

    for sector, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[sector] += 1

    best_sector = max(scores, key=lambda s: scores[s])
    return best_sector if scores[best_sector] > 0 else "general"


def get_hashtags_for_sector(sector: str, max_tags: int = 4) -> str:
    """
    Returns a space-separated string of hashtags for a sector, always
    including the core hashtags.

    Args:
        sector:   Sector key.
        max_tags: Max sector-specific tags to include (default 4).

    Returns:
        Hashtag string, e.g. '#Autónomos #Pymes #IVA #IRPF'
    """
    core = ["#Autónomos", "#Pymes"]
    sector_tags = HASHTAG_MAP.get(sector, HASHTAG_MAP["general"])[:max_tags]
    # Deduplicate while preserving order
    seen: set[str] = set()
    combined: list[str] = []
    for tag in core + sector_tags:
        if tag not in seen:
            seen.add(tag)
            combined.append(tag)
    return " ".join(combined)


def text_matches_any_keyword(text: str) -> bool:
    """
    Returns True if text contains at least one MYTAXBOT_FOCUS_KEYWORDS term.
    Used as a cheap pre-filter before calling the Gemini API.
    """
    text_lower = text.lower()
    return any(kw in text_lower for kw in MYTAXBOT_FOCUS_KEYWORDS)
