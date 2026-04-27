"""
The Ascent of Mount Carmel — St. John of the Cross
David Lewis translation, 1906 (public domain)
Source: archive.org (Google Books scan)
Strategy: fetch DjVuTXT, skip TOC (first BOOK I), split by Book then Chapter,
          fix double-space OCR, filter Google Books noise lines.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/TheAscentOfMountCarmel/TheAscentOfMountCarmel_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7,
    "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13,
    "XIV": 14, "XV": 15, "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19,
    "XX": 20, "XXI": 21, "XXII": 22, "XXIII": 23, "XXIV": 24, "XXV": 25,
    "XXVI": 26, "XXVII": 27, "XXVIII": 28, "XXIX": 29, "XXX": 30,
    "XXXI": 31, "XXXII": 32, "XXXIII": 33, "XXXIV": 34, "XXXV": 35,
    "XL": 40, "XLI": 41, "XLII": 42, "XLV": 45,
}

# Patterns for Google Books noise lines to skip
NOISE_PAT = re.compile(
    r"Digitized\s+by\s+Googl"
    r"|^\s*Googl\s*$"
    r"|\[CHAP\."
    r"|\[BOOK"
    r"|OF\s+MOUNT\s+CARMEL\s*\."
    r"|THE\s+ASCENT\s+\[BOOK"
    r"|^\s*\d+\s+THE\s+ASCENT"
    r"|^\s*THE\s+ASCENT\s+\d"
    r"|^\s*\d{1,3}\s*$",
    re.IGNORECASE,
)

THEMES = [
    "dark_night", "soul", "contemplation", "divine_union", "purification",
    "faith", "mystical_journey", "christian_mysticism", "prayer", "detachment",
]
CROSS_TAGS = [
    "transformation", "emptiness_void", "consciousness", "transcendence",
    "divine_union",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _fix_ocr(text: str) -> str:
    """Fix Google Books double-space OCR artifacts."""
    # Collapse multiple spaces within lines to single space
    lines = text.split("\n")
    fixed = []
    for line in lines:
        # Skip Google Books noise
        if NOISE_PAT.search(line):
            fixed.append("")
            continue
        # Fix double spaces between words (keep indentation intent)
        cleaned = re.sub(r"  +", " ", line)
        # Fix hyphenation across lines — handled in chunk_utils
        fixed.append(cleaned)
    return "\n".join(fixed)


def _parse_structure(raw: str) -> list[tuple[int, int, str]]:
    """
    Returns list of (book_num, chapter_num, chapter_text).
    Skips TOC (uses second pass of BOOK I).
    """
    lines = raw.split("\n")
    book_pat = re.compile(r"^BOOK\s+([IVX]+)\b")
    chapter_pat = re.compile(r"^CHAPTER\s+([IVXLC]+)\b")

    # Collect all BOOK hits to find second pass of BOOK I
    book_hits: list[tuple[int, int]] = []
    for i, line in enumerate(lines):
        m = book_pat.match(line.strip())
        if m:
            num = ROMAN_TO_INT.get(m.group(1).upper(), 0)
            if num:
                book_hits.append((i, num))

    # Find second occurrence of BOOK I
    seen_book_i = 0
    actual_start = 0
    for line_idx, book_num in book_hits:
        if book_num == 1:
            seen_book_i += 1
            if seen_book_i == 2:
                actual_start = line_idx
                break

    # Find end of text (index follows)
    end_pat = re.compile(r"^THE\s+END\s*$", re.IGNORECASE)
    index_pat = re.compile(r"^INDEX\b", re.IGNORECASE)
    end_of_text = len(lines)
    for i in range(actual_start, len(lines)):
        l = lines[i].strip()
        if end_pat.match(l) or index_pat.match(l):
            end_of_text = i
            break

    # Collect all splits (BOOK and CHAPTER) after actual_start
    splits: list[tuple[int, str, int, int]] = []
    current_book = 0
    for i in range(actual_start, end_of_text):
        stripped = lines[i].strip()
        bm = book_pat.match(stripped)
        cm = chapter_pat.match(stripped)
        if bm:
            num = ROMAN_TO_INT.get(bm.group(1).upper(), 0)
            if num:
                current_book = num
                splits.append((i, "book", current_book, 0))
        elif cm and current_book > 0:
            num = ROMAN_TO_INT.get(cm.group(1).upper(), 0)
            if num:
                splits.append((i, "chapter", current_book, num))

    chapters: list[tuple[int, int, str]] = []
    for idx, (line_i, kind, book, chapter) in enumerate(splits):
        if kind != "chapter":
            continue
        end = splits[idx + 1][0] if idx + 1 < len(splits) else end_of_text
        end = min(end, end_of_text)
        block = "\n".join(lines[line_i:end]).strip()
        chapters.append((book, chapter, block))

    return chapters


class AscentOfMountCarmelIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "ascent_of_mount_carmel"
    display_name = "The Ascent of Mount Carmel"
    source_url = "https://archive.org/details/TheAscentOfMountCarmel"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        raw = _fix_ocr(raw)
        sections = _parse_structure(raw)
        print(f"    Found {len(sections)} chapters across 3 books")

        all_chunks = []
        for book, chapter, block in sections:
            block = clean_text(block)
            if len(block) < 150:
                continue
            label = f"Book {book}, Chapter {chapter}"
            for part in split_long_text(block):
                labeled = (
                    f"The Ascent of Mount Carmel — {label}\n"
                    f"St. John of the Cross / David Lewis translation (1906)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "St. John of the Cross",
                    "translator": "David Lewis",
                    "date_composed": "~1579–1585 CE",
                    "book": str(book),
                    "chapter": str(chapter),
                    "section": f"book_{book}_chapter_{chapter}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "book": book,
                        "chapter": chapter,
                    },
                })

        return all_chunks
