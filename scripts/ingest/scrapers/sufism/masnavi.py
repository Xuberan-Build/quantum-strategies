"""
Masnavi-i Ma'navi (Spiritual Couplets) — E.H. Whinfield abridged translation, 1898
Maulana Jalalu'd-din Muhammad Rumi — All 6 books
Source: archive.org (public domain — published 1898)
Strategy: fetch single DjVuTXT, skip TOC, split by Book then Story/section,
          one chunk per story or prologue/epilogue block.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/masnavi-i-manavi-jalaluddin-rumi"
    "/Masnavi%20I%20Ma'navi_Jalaluddin%20Rumi_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

THEMES = [
    "love", "longing", "soul", "unity", "divine_love", "fana",
    "mystical_journey", "parable", "reed_flute", "sufi_teaching",
]
CROSS_TAGS = [
    "emptiness_void", "divine_union", "transformation",
    "consciousness", "transcendence",
]

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
    "VII": 7, "VIII": 8, "IX": 9, "X": 10,
}


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _fix_ocr(text: str) -> str:
    """Fix common OCR artifacts: extra spaces within words."""
    text = re.sub(r"(?<=[a-z])\s{2,}(?=[a-z])", " ", text)
    # Remove hyphenation artifacts
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    return text


def _split_into_books(lines: list[str]) -> list[tuple[int, int, int]]:
    """
    Find the second occurrence of each BOOK marker (the real text, not TOC).
    Returns list of (book_num, start_line, end_line).
    """
    book_pat = re.compile(r"^BOOK\s+([IVX]+)\s*$")
    hits: list[tuple[int, int]] = []
    for i, line in enumerate(lines):
        m = book_pat.match(line.strip())
        if m:
            hits.append((i, ROMAN_TO_INT.get(m.group(1), 0)))

    # There are two passes: TOC (lines 0-300) then actual text.
    # The second occurrence of BOOK I marks the real text start.
    seen = {}
    actual_hits = []
    for line_idx, book_num in hits:
        if book_num not in seen:
            seen[book_num] = "first"
        else:
            actual_hits.append((book_num, line_idx))

    books = []
    for i, (book_num, start) in enumerate(actual_hits):
        end = actual_hits[i + 1][1] if i + 1 < len(actual_hits) else len(lines)
        books.append((book_num, start, end))
    return books


def _split_book_into_sections(lines: list[str], start: int, end: int) -> list[tuple[str, str]]:
    """
    Split a book's lines into (section_title, section_text) pairs.
    Splits on PROLOGUE, Story X., ALL-CAPS TITLE, Epilogue.
    """
    section_pat = re.compile(
        r"^(PROLOGUE|Epilogue\s+to\s+Book\s+\w+|Story\s+[IVXLC]+\.|"
        r"[A-Z][A-Z\s\'\-,\.]+)\s*$"
    )
    # Find section start lines within this book
    section_hits: list[tuple[int, str]] = []
    for i in range(start + 1, end):
        stripped = lines[i].strip()
        if section_pat.match(stripped) and len(stripped) > 3:
            section_hits.append((i, stripped))

    if not section_hits:
        # Treat entire book as one section
        text = "\n".join(lines[start:end])
        return [("Book", text)]

    sections = []
    for idx, (line_i, title) in enumerate(section_hits):
        next_i = section_hits[idx + 1][0] if idx + 1 < len(section_hits) else end
        block = "\n".join(lines[line_i:next_i]).strip()
        sections.append((title, block))

    return sections


class MasnaviIngester(BaseIngester):
    tradition = "sufism"
    text_name = "masnavi"
    display_name = "Masnavi — All 6 Books"
    source_url = "https://archive.org/details/masnavi-i-manavi-jalaluddin-rumi"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        raw = _fix_ocr(raw)
        lines = raw.split("\n")

        books = _split_into_books(lines)
        print(f"    Found {len(books)} books")

        all_chunks = []
        for book_num, start, end in books:
            sections = _split_book_into_sections(lines, start, end)
            print(f"      Book {book_num}: {len(sections)} sections")

            for title, block in sections:
                block = clean_text(block)
                if len(block) < 150:
                    continue
                for part in split_long_text(block):
                    labeled = (
                        f"Masnavi-i Ma'navi — Book {book_num}, {title}\n"
                        f"Rumi / Whinfield translation (1898)\n\n{part}"
                    )
                    all_chunks.append({
                        "tradition": self.tradition,
                        "text_name": self.text_name,
                        "author": "Jalal ad-Din Rumi",
                        "translator": "E.H. Whinfield",
                        "date_composed": "~1258–1273 CE",
                        "book": str(book_num),
                        "chapter": str(book_num),
                        "section": title[:80],
                        "content": labeled,
                        "priority": 1,
                        "content_type": "primary_canon",
                        "source_url": self.source_url,
                        "language": "english",
                        "themes": THEMES,
                        "cross_tradition_tags": CROSS_TAGS,
                        "metadata": {
                            "book": book_num,
                            "section_title": title,
                        },
                    })

        return all_chunks
