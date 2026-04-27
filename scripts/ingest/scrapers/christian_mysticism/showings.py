"""
Revelations of Divine Love (Showings) — Julian of Norwich (1373 CE)
Source: archive.org (RevelationsOfDivineLove) — Grace Warrack 1901 edition
Strategy: fetch Google Books DjVuTXT, split on "CHAPTER X" markers (including
          OCR-garbled Roman numerals like "XH"=XII, "XXVn"=XXVII, "LHI"=LIII).
          Chapters are numbered sequentially (1–86).
Running headers ("THE FIRST REVELATION N") and Digitized-by-Google lines filtered.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/RevelationsOfDivineLove"
    "/RevelationsOfDivineLove_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Flexible chapter pattern — also matches OCR-garbled Roman numerals
CHAPTER_PAT = re.compile(r"^CHAPTER [IVXLCivxlcHnmTU]+\s*$")

# Noise patterns
NOISE_PAT = re.compile(
    r"^THE\s+\w+\s+REVELATION\s+\d"   # running headers: "THE FIRST REVELATION 9"
    r"|Digitized\s+by\s+Googl"         # Google scan noise
    r"|^\d{1,4}\s*$"                   # lone page numbers
    r"|^-\s*\d+\s*-$"                  # page markers like "- 12 -"
    r"|^REVELATIONS OF DIVINE LOVE"     # running book titles
    r"|^\d+\s+REVELATIONS OF DIVINE LOVE",  # page-numbered running headers
    re.IGNORECASE,
)

TEXT_START_LINE = 3320  # First actual chapter starts here

THEMES = [
    "julian_of_norwich", "christian_mysticism", "divine_love",
    "mystical_visions", "female_mysticism", "apophatic_theology",
    "compassion_of_god", "incarnation", "all_shall_be_well",
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


def _parse_chapters(raw: str) -> list[tuple[int, str]]:
    """Returns list of (chapter_num, body_text). Chapters numbered 1–N."""
    lines = raw.split("\n")

    # Find chapter markers in actual text section
    hits: list[int] = []
    for i in range(TEXT_START_LINE, len(lines)):
        stripped = lines[i].strip()
        if CHAPTER_PAT.match(stripped) and stripped != "CHAPTER ":
            hits.append(i)

    chapters: list[tuple[int, str]] = []
    for idx, line_i in enumerate(hits):
        end = hits[idx + 1] if idx + 1 < len(hits) else len(lines)
        block_lines: list[str] = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if not stripped:
                block_lines.append("")
                continue
            if NOISE_PAT.search(stripped):
                continue
            block_lines.append(stripped)
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 150:
            chapters.append((idx + 1, block))

    return chapters


class ShowingsIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "showings"
    display_name = "Revelations of Divine Love (Showings)"
    source_url = "https://archive.org/details/RevelationsOfDivineLove"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chapters = _parse_chapters(raw)
        print(f"    Found {len(chapters)} chapters")

        all_chunks = []
        for ch_num, block in chapters:
            block = clean_text(block)
            if len(block) < 150:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Revelations of Divine Love — Chapter {ch_num}\n"
                    f"Julian of Norwich (1373 CE), Grace Warrack edition (1901)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Julian of Norwich",
                    "translator": None,
                    "date_composed": "1373 CE",
                    "book": "1",
                    "chapter": str(ch_num),
                    "section": f"chapter_{ch_num}",
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"chapter": ch_num},
                })

        return all_chunks
