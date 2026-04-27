"""
Dark Night of the Soul — St. John of the Cross (~1578-1585 CE)
E. Allison Peers translation (public domain)
Source: archive.org (DarkNightOfTheSoulBySt.JohnOfTheCross)
Strategy: fetch DjVuTXT, skip preamble/TOC section, split at "BOOK THE FIRST/SECOND"
          and then by "CHAPTER N" markers. 2 Books, 39 chapters total.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/DarkNightOfTheSoulBySt.JohnOfTheCross"
    "/Dark%20Night%20of%20the%20Soul%20by%20St.%20John%20of%20the%20Cross_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Actual text markers (TOC uses "BOOK I/II"; text uses "BOOK THE FIRST/SECOND")
BOOK_PAT    = re.compile(r"^BOOK THE (FIRST|SECOND)\s*$")
CHAPTER_PAT = re.compile(r"^CHAPTER ([IVXLC]+)\s*$")

# Noise: stray footnote references, page-number-only lines
FOOTNOTE_PAT = re.compile(r"^\d{1,3}\s+[A-Z]|^\d{1,3}\s*$")

BOOK_NAMES = {"FIRST": 1, "SECOND": 2}

THEMES = [
    "dark_night_of_the_soul", "christian_mysticism", "apophatic_theology",
    "contemplative_prayer", "purgation", "spiritual_transformation",
    "john_of_the_cross", "carmelite_mysticism", "via_negativa",
]
CROSS_TAGS = [
    "emptiness_void", "transformation", "divine_union", "transcendence",
    "consciousness",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _parse_chapters(raw: str) -> list[tuple[int, str, str]]:
    """Returns list of (book_num, chapter_roman, body_text)."""
    lines = raw.split("\n")

    # Find "BOOK THE FIRST" as text start
    text_start = 0
    for i, line in enumerate(lines):
        if BOOK_PAT.match(line.strip()):
            text_start = i
            break

    current_book = 1
    hits: list[tuple[int, int, str]] = []  # (line_i, book_num, chapter_roman)

    for i in range(text_start, len(lines)):
        stripped = lines[i].strip()
        m_book = BOOK_PAT.match(stripped)
        if m_book:
            current_book = BOOK_NAMES[m_book.group(1)]
            continue
        m_ch = CHAPTER_PAT.match(stripped)
        if m_ch:
            hits.append((i, current_book, m_ch.group(1)))

    chapters: list[tuple[int, str, str]] = []
    for idx, (line_i, book_num, ch_roman) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        block_lines: list[str] = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if FOOTNOTE_PAT.match(stripped):
                continue
            block_lines.append(stripped if stripped else "")
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 200:
            chapters.append((book_num, ch_roman, block))

    return chapters


class DarkNightOfTheSoulIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "dark_night_of_the_soul"
    display_name = "Dark Night of the Soul"
    source_url = "https://archive.org/details/DarkNightOfTheSoulBySt.JohnOfTheCross"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chapters = _parse_chapters(raw)
        print(f"    Found {len(chapters)} chapters across 2 books")

        all_chunks = []
        for book_num, ch_roman, block in chapters:
            block = clean_text(block)
            if len(block) < 200:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Dark Night of the Soul — Book {book_num}, Chapter {ch_roman}\n"
                    f"St. John of the Cross (~1578 CE), E. Allison Peers translation\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "St. John of the Cross",
                    "translator": "E. Allison Peers",
                    "date_composed": "~1578 CE",
                    "book": str(book_num),
                    "chapter": ch_roman,
                    "section": f"book_{book_num}_ch_{ch_roman.lower()}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "book": book_num,
                        "chapter": ch_roman,
                    },
                })

        return all_chunks
