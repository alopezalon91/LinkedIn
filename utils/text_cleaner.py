import re
import logging

log = logging.getLogger("text_cleaner")

def clean_boe_text(raw_text: str, max_chars: int = 4000) -> str:
    """
    Cleans BOE text by removing signatures, bureaucratic formulas, 
    massive name lists, and then truncates to max_chars.
    Safeguard: if cleaning reduces text below 500 chars, it aborts 
    cleaning and just truncates the raw text.
    """
    if not raw_text:
        return ""
        
    try:
        cleaned = raw_text
        
        # 1. Remove signatures and date at the bottom (e.g. "Madrid, 15 de marzo de 2024...")
        cleaned = re.sub(r"Madrid, \d{1,2} de [a-z]+ de \d{4}.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        
        # 2. Remove common massive list headers or annexes that follow "ANEXO"
        cleaned = re.sub(r"\bANEXO\b.*", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        
        # 3. Remove generic bureaucratic headers
        cleaned = re.sub(r"En virtud de lo dispuesto en el artículo[\w\s,]+(?:acuerda|dispone):?", "", cleaned, flags=re.IGNORECASE)
        
        # 4. Remove index or summary sections (Índice, Sumario)
        cleaned = re.sub(r"Índice\s+.*?(?=Artículo 1|Exposición de motivos|Preámbulo)", "", cleaned, flags=re.IGNORECASE | re.DOTALL)
        
        # Safeguard: if the regex was too aggressive
        if len(cleaned.strip()) < 500 and len(raw_text.strip()) >= 500:
            log.warning("Text cleaner reduced text below 500 chars. Reverting to raw text.")
            cleaned = raw_text
            
    except Exception as e:
        log.error(f"Error cleaning BOE text: {e}. Reverting to raw text.")
        cleaned = raw_text

    return cleaned.strip()[:max_chars]


def clean_news_text(raw_text: str, max_chars: int = 4000) -> str:
    """
    Cleans news text by removing generic footers, cookie banners, etc.
    """
    if not raw_text:
        return ""
        
    try:
        cleaned = raw_text
        
        # Cookie banners and generic journalistic footers
        cleaned = re.sub(r"(?i)(Lee también|Te puede interesar):?\s*.*?\n", "\n", cleaned)
        cleaned = re.sub(r"(?i)suscríbete a nuestra newsletter.*", "", cleaned, flags=re.DOTALL)
        cleaned = re.sub(r"(?i)todos los derechos reservados.*", "", cleaned, flags=re.DOTALL)
        
        if len(cleaned.strip()) < 500 and len(raw_text.strip()) >= 500:
            log.warning("Text cleaner reduced news text below 500 chars. Reverting to raw text.")
            cleaned = raw_text
            
    except Exception as e:
        log.error(f"Error cleaning news text: {e}. Reverting to raw text.")
        cleaned = raw_text

    return cleaned.strip()[:max_chars]
