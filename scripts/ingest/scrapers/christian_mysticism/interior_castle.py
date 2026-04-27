"""
The Interior Castle (El Castillo Interior) — St. Teresa of Avila
Unknown translator edition (~1921), public domain
Source: archive.org
Strategy: fetch DjVuTXT, split by Mansion then Chapter, chunk per chapter.
7 mansions, 33 chapters total.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/TheInteriorCastleOrTheMansionsStTeresaOfAvila"
    "/The%20Interior%20Castle%20or%20The%20Mansions%20-%20St%20Teresa%20of%20Avila_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

MANSION_NAMES = {
    "FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4,
    "FIFTH": 5, "SIXTH": 6, "SEVENTH": 7,
}

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7,
    "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12,
}

THEMES = [
    "prayer", "contemplation", "soul", "divine_union", "mystical_journey",
    "interior_life", "humility", "grace", "spiritual_castle", "christian_mysticism",
]
CROSS_TAGS = [
    "transformation", "divine_union", "consciousness", "transcendence",
    "emptiness_void",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _parse_structure(raw: str) -> list[tuple[int, int, str, str]]:
    """
    Returns list of (mansion_num, chapter_num, section_label, text).
    Splits on THE X MANSIONS headers, then CHAPTER N. within each mansion.
    Stops at INDEX section. Handles "ONLY CHAPTER" as chapter 1.
    """
    lines = raw.split("\n")
    mansion_pat = re.compile(
        r"^THE (FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH) MANSIONS\s*$"
    )
    chapter_pat = re.compile(r"^CHAPTER ([IVX]+)\.\s*$")
    only_chapter_pat = re.compile(r"^ONLY CHAPTER\s*$")

    # Find end of actual text (notes/index follow the book)
    end_of_text = len(lines)
    end_markers = re.compile(r"^(HERE ENDS|NOTAS|INDEX)\b", re.IGNORECASE)
    for i, line in enumerate(lines):
        if end_markers.match(line.strip()):
            end_of_text = i
            break

    # Collect all split points
    splits: list[tuple[int, str, int, int]] = []  # (line_idx, type, mansion, chapter)
    current_mansion = 0
    current_chapter = 0

    for i, line in enumerate(lines[:end_of_text]):
        stripped = line.strip()
        mm = mansion_pat.match(stripped)
        cm = chapter_pat.match(stripped)
        om = only_chapter_pat.match(stripped)
        if mm:
            current_mansion = MANSION_NAMES[mm.group(1)]
            current_chapter = 0
            splits.append((i, "mansion", current_mansion, 0))
        elif cm and current_mansion > 0:
            current_chapter = ROMAN_TO_INT.get(cm.group(1), 0)
            if current_chapter:
                splits.append((i, "chapter", current_mansion, current_chapter))
        elif om and current_mansion > 0:
            current_chapter = 1
            splits.append((i, "chapter", current_mansion, 1))

    chunks: list[tuple[int, int, str, str]] = []
    for idx, (line_i, kind, mansion, chapter) in enumerate(splits):
        if kind != "chapter":
            continue
        end = splits[idx + 1][0] if idx + 1 < len(splits) else end_of_text
        end = min(end, end_of_text)
        block = "\n".join(lines[line_i:end]).strip()
        label = f"Mansion {mansion}, Chapter {chapter}"
        chunks.append((mansion, chapter, label, block))

    return chunks


class InteriorCastleIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "interior_castle"
    display_name = "The Interior Castle"
    source_url = "https://archive.org/details/TheInteriorCastleOrTheMansionsStTeresaOfAvila"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        sections = _parse_structure(raw)
        print(f"    Found {len(sections)} chapters across 7 mansions")

        all_chunks = []
        for mansion, chapter, label, block in sections:
            block = clean_text(block)
            if len(block) < 150:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"The Interior Castle — {label}\n"
                    f"St. Teresa of Avila\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "St. Teresa of Avila",
                    "translator": "Unknown",
                    "date_composed": "1577 CE",
                    "book": str(mansion),
                    "chapter": str(chapter),
                    "section": f"mansion_{mansion}_chapter_{chapter}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "mansion": mansion,
                        "chapter": chapter,
                        "section_label": label,
                    },
                })

        return all_chunks
