"""
The Kybalion: A Study of the Hermetic Philosophy of Ancient Egypt and Greece
By Three Initiates (1908) — public domain
Source: archive.org (Kybalion1908)
Strategy: fetch DjVuTXT, split by CHAPTER N. headers, chunk per chapter.
15 chapters covering the Seven Hermetic Principles.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/Kybalion1908"
    "/The%20Kybalion%20-%20Three%20Initiates%20%5BWilliam%20Walker%20Atkinson%5D%20%281908%29_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7,
    "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13,
    "XIV": 14, "XV": 15,
}

THEMES = [
    "hermetic_principles", "mentalism", "correspondence", "vibration",
    "polarity", "rhythm", "causation", "gender", "hermeticism",
    "as_above_so_below", "alchemy",
]
CROSS_TAGS = [
    "transformation", "consciousness", "divine_union", "transcendence",
    "sacred_geometry",
]

# Noise lines to skip (page headers, image captions, etc.)
NOISE_PAT = re.compile(
    r"^(THE KYBALION|Three Initiates|CHAPTER\s+PAGE|\d+\s+THE KYBALION|THE KYBALION\s+\d+)\s*$",
    re.IGNORECASE,
)


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _parse_chapters(raw: str) -> list[tuple[int, str]]:
    """
    Returns list of (chapter_num, chapter_text).
    Splits on CHAPTER N. headers.
    Skips TOC (only second pass of CHAPTER I counts).
    """
    lines = raw.split("\n")
    chapter_pat = re.compile(r"^CHAPTER\s+([IVX]+)\.\s*$")

    # Find all chapter markers
    hits: list[tuple[int, int]] = []
    for i, line in enumerate(lines):
        m = chapter_pat.match(line.strip())
        if m:
            num = ROMAN_TO_INT.get(m.group(1), 0)
            if num:
                hits.append((i, num))

    # Skip TOC — use second occurrence of CHAPTER I
    seen_i = 0
    actual_start_idx = 0
    for idx, (line_i, ch_num) in enumerate(hits):
        if ch_num == 1:
            seen_i += 1
            if seen_i == 2:
                actual_start_idx = idx
                break

    actual_hits = hits[actual_start_idx:]

    chapters: list[tuple[int, str]] = []
    for idx, (line_i, ch_num) in enumerate(actual_hits):
        end = actual_hits[idx + 1][0] if idx + 1 < len(actual_hits) else len(lines)
        # Filter noise lines
        block_lines = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if NOISE_PAT.match(stripped):
                continue
            block_lines.append(line)
        block = "\n".join(block_lines).strip()
        if block:
            chapters.append((ch_num, block))

    return chapters


class KybalionIngester(BaseIngester):
    tradition = "hermeticism"
    text_name = "kybalion"
    display_name = "The Kybalion"
    source_url = "https://archive.org/details/Kybalion1908"

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
                    f"The Kybalion — Chapter {ch_num}\n"
                    f"Three Initiates (1908)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Three Initiates",
                    "translator": None,
                    "date_composed": "1908 CE",
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
