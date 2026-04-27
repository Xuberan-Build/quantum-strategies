"""
Kularnava Tantra — Ram Kumar Rai English translation (1999)
Source: archive.org (Kularnava)
Strategy: fetch DjVuTXT. The file is bilingual (Sanskrit verse OCR + English translation).
          Skip TOC (~400 lines), then extract English paragraphs by filtering out OCR-garbled
          Sanskrit verse lines (identified by high ratio of non-ASCII/special characters,
          short verse-marker lines, etc.). Chunk consecutive English text into ~17 blocks
          (one per Ullasa) based on content headings, or by size.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = "https://archive.org/download/Kularnava/Kularnava_djvu.txt"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

TOC_END_LINE = 400  # Actual text starts after the table of contents

# Heuristic to detect OCR-garbled Sanskrit verse lines:
# - Short lines (< 60 chars) with high ratio of non-word chars
# - Lines containing "||" (Sanskrit verse separator)
# - Lines with patterns like "N11" or ":N:" (verse numbers)
SANSKRIT_OCR_PAT = re.compile(
    r"\|"                          # pipe/danda marker (Sanskrit verse separator)
    r"|©"                          # special chars in Sanskrit OCR
    r"|^\s*\d+[|!:]\s*$"           # bare verse numbers
    r"|\d{3,}"                     # 3+ digit sequences (verse numbers like "4011")
    r"|[!]\s*[A-Z0-9]{2,}"         # "! YI!" or "! E311" pattern
    r"|[A-Z]{2,}[0-9]|[0-9][A-Z]{2,}"  # mixed upper+digit (OCR noise)
)

# English function words that anchor a line as real translation (not Sanskrit OCR garbage)
_ENGLISH_ANCHORS = re.compile(
    r'\b(the|of|and|in|to|is|are|was|were|be|been|have|has|had|do|does|did|'
    r'will|would|could|should|may|might|can|this|that|these|those|which|who|'
    r'from|with|for|by|at|on|not|but|or|so|if|as|an|its|his|her|their|our|'
    r'all|one|two|three|said|thus|says|he|she|they|it|we|you|'
    r'then|when|how|what|where|there|here|now|also|only|even|more|into|upon|'
    r'such|no|any|shall|through|after|before|because|very|great|know|'
    r'therefore|indeed|whom|whose|like|than|both|each|neither|either)\b',
    re.IGNORECASE
)
_ROMAN_ONLY = re.compile(r'^[IVXLCivxlc]+\.?$')
_CONSEC_CONSONANTS = re.compile(r'[bcdfghjklmnpqrstvwxyz]{4}', re.IGNORECASE)

THEMES = [
    "kularnava_tantra", "kaula_tantra", "tantric_practice", "guru_tradition",
    "shiva_shakti", "tantric_yoga", "liberation", "kula_dharma",
    "sacred_ritual", "tantra",
]
CROSS_TAGS = [
    "divine_union", "transformation", "consciousness", "transcendence",
]

ULLASA_NAMES = [
    "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh",
    "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth",
    "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _valid_short_fragment(stripped: str) -> bool:
    """For very short lines (<20 chars): keep if no digits/non-ASCII, sane casing, no consonant clusters."""
    if re.search(r'\d', stripped):
        return False
    if any(ord(c) > 127 for c in stripped):
        return False
    words = re.findall(r'[A-Za-z]+', stripped)
    if not words:
        return False
    if len(words) == 1 and _ROMAN_ONLY.match(words[0]):
        return False
    for w in words:
        if not (w.islower() or w.isupper() or w.istitle()):
            return False
        if _CONSEC_CONSONANTS.search(w):
            return False
    return True


def _is_english_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True  # blank lines are separators
    if SANSKRIT_OCR_PAT.search(stripped):
        return False
    total = len(stripped)
    if total < 3:
        return False
    ascii_letters = sum(1 for c in stripped if c.isalpha() and ord(c) < 128)
    if ascii_letters / total < 0.35 and total < 80:
        return False
    # Long lines: pass through
    if total >= 60:
        return True
    # Short lines ending with ! or ) are Sanskrit danda/verse-end markers
    if stripped[-1] in ('!', ')') and total < 50:
        return False
    # Very short fragments: use structural heuristic
    if total < 20:
        return _valid_short_fragment(stripped)
    # Medium lines (20–60 chars): require at least one English anchor word
    return bool(_ENGLISH_ANCHORS.search(stripped))


def _parse_chunks(raw: str) -> list[tuple[int, str]]:
    """Returns list of (chunk_seq, text). Splits into ~17 ullasa-sized blocks."""
    lines = raw.split("\n")[TOC_END_LINE:]

    # Extract English-only lines
    english_lines: list[str] = []
    for line in lines:
        if _is_english_line(line):
            english_lines.append(line.strip() if line.strip() else "")

    # Join into a single text, then split into chunks
    full_text = "\n".join(english_lines).strip()
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    full_text = clean_text(full_text)

    parts = list(split_long_text(full_text))
    return [(i + 1, p) for i, p in enumerate(parts)]


class KularnavaTantraIngester(BaseIngester):
    tradition = "tantra"
    text_name = "kularnava_tantra"
    display_name = "Kularnava Tantra"
    source_url = "https://archive.org/details/Kularnava"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chunks = _parse_chunks(raw)
        print(f"    Found {len(chunks)} chunks")

        all_chunks = []
        for seq, text in chunks:
            labeled = (
                f"Kularnava Tantra — Part {seq}\n"
                f"Ram Kumar Rai translation (1999)\n\n{text}"
            )
            all_chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Anonymous (Kaula Tantric tradition)",
                "translator": "Ram Kumar Rai",
                "date_composed": "~900-1100 CE",
                "book": "1",
                "chapter": str(seq),
                "section": f"part_{seq}",
                "content": labeled,
                "priority": 2,
                "content_type": "primary_canon",
                "source_url": self.source_url,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {"sequence": seq},
            })

        return all_chunks
