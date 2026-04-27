"""
Divan-e Shams-e Tabrizi (Divan Kabir) — Jalal al-Din Rumi (~1250 CE)
Nevit Oguz Ergin English translation (from Golpinarli's Turkish)
Source: archive.org (DivanEShamsDivanKabir)
Strategy: fetch DjVuTXT, skip translator's note, split on "Verse  NN" markers.
Double-space OCR throughout; OCR sometimes splits verse numbers (e.g. "1 79" = 179).
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/DivanEShamsDivanKabir"
    "/Divan-e-Shams-Divan-Kabir_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# "Verse  NN" or "Verse  N NN" (OCR split number)
VERSE_PAT = re.compile(r"^Verse\s+(\d[\d ]*\d|\d)\s*$")
METER_PAT = re.compile(r"^Meter\s*-\s*(\d+)\s*$")
PAGE_PAT  = re.compile(r"^\d{1,4}\s*$")

THEMES = [
    "divan_e_shams", "rumi", "sufism", "ghazal", "divine_love",
    "mystical_poetry", "ecstatic_union", "shams_tabrizi",
    "islamic_mysticism", "persian_poetry",
]
CROSS_TAGS = [
    "divine_union", "transformation", "transcendence", "consciousness",
    "emptiness_void",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _fix_ocr(line: str) -> str:
    return re.sub(r"  +", " ", line)


def _parse_verses(raw: str) -> list[tuple[int, int, str]]:
    """Returns list of (verse_num, meter_num, body_text)."""
    lines = raw.split("\n")

    current_meter = 1
    hits: list[tuple[int, int, int]] = []  # (line_i, verse_num, meter)

    for i, line in enumerate(lines):
        stripped = line.strip()
        m_meter = METER_PAT.match(stripped)
        if m_meter:
            current_meter = int(m_meter.group(1))
            continue
        m_verse = VERSE_PAT.match(stripped)
        if m_verse:
            # Normalize OCR-split numbers: "1 79" → 179
            num_str = re.sub(r"\s+", "", m_verse.group(1))
            verse_num = int(num_str)
            hits.append((i, verse_num, current_meter))

    verses: list[tuple[int, int, str]] = []
    for idx, (line_i, verse_num, meter) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        block_lines: list[str] = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if PAGE_PAT.match(stripped):
                continue
            block_lines.append(_fix_ocr(stripped) if stripped else "")
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 100:
            verses.append((verse_num, meter, block))

    return verses


class DivanEShamIngester(BaseIngester):
    tradition = "sufism"
    text_name = "divan_e_shams"
    display_name = "Divan-e Shams-e Tabrizi"
    source_url = "https://archive.org/details/DivanEShamsDivanKabir"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        verses = _parse_verses(raw)
        print(f"    Found {len(verses)} verses")

        all_chunks = []
        for verse_num, meter, block in verses:
            block = clean_text(block)
            if len(block) < 100:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Divan-e Shams (Divan Kabir) — Verse {verse_num} (Meter {meter})\n"
                    f"Jalal al-Din Rumi (~1250 CE), Nevit Oguz Ergin translation\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Jalal al-Din Rumi",
                    "translator": "Nevit Oguz Ergin",
                    "date_composed": "~1250 CE",
                    "book": str(meter),
                    "chapter": str(verse_num),
                    "section": f"meter_{meter}_verse_{verse_num}",
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "verse": verse_num,
                        "meter": meter,
                    },
                })

        return all_chunks
