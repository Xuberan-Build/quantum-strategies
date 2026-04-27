"""
The Cloud of Unknowing — edited by Evelyn Underhill, 1922 (public domain)
Anonymous 14th-century English mystic
Source: archive.org (St. Mary's Hermitage digitization of Underhill 1922 edition)
Strategy: fetch DjVuTXT, split on "HERE BEGINNETH THE" chapter markers,
          starting from the Prologue. 75 chapters total.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/TheCloudOfUnknowing_201808"
    "/The%20Cloud%20of%20Unknowing_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Map Middle English ordinals → integers
ORDINAL_MAP = {
    "FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4, "FIFTH": 5,
    "SIXTH": 6, "SEVENTH": 7, "EIGHTH": 8, "NINTH": 9, "TENTH": 10,
    "ELEVENTH": 11, "TWELFTH": 12, "THIRTEENTH": 13, "FOURTEENTH": 14,
    "FIFTEENTH": 15, "SIXTEENTH": 16, "SEVENTEENTH": 17, "EIGHTEENTH": 18,
    "NINETEENTH": 19, "TWENTIETH": 20,
}

# Middle English compound ordinals: "ONE AND TWENTIETH" = 21, etc.
TENS = {
    "TWENTIETH": 20, "THIRTIETH": 30, "FORTIETH": 40, "FIFTIETH": 50,
    "SIXTIETH": 60, "SEVENTIETH": 70,
}
ONES = {
    "ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5,
    "SIX": 6, "SEVEN": 7, "EIGHT": 8, "NINE": 9,
}

THEMES = [
    "contemplation", "prayer", "divine_union", "cloud", "mystical_darkness",
    "soul", "christian_mysticism", "apophatic_theology", "love", "unknowing",
]
CROSS_TAGS = [
    "emptiness_void", "divine_union", "transformation", "consciousness",
    "transcendence",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _parse_ordinal(words: list[str]) -> int:
    """Convert Middle English ordinal words to int (e.g. ['ONE', 'AND', 'TWENTIETH'] → 21)."""
    # Filter out AND, CHAPTER
    words = [w for w in words if w not in ("AND", "CHAPTER")]
    if not words:
        return 0
    if len(words) == 1:
        # Check ORDINAL_MAP first, then TENS (for THIRTIETH, FORTIETH etc.)
        return ORDINAL_MAP.get(words[0], 0) or TENS.get(words[0], 0)
    # Compound: "ONE TWENTIETH" → ONES[ONE] + TENS[TWENTIETH]
    if len(words) == 2:
        ones = ONES.get(words[0], 0)
        tens = TENS.get(words[1], 0)
        if ones and tens:
            return tens + ones
        return ORDINAL_MAP.get(words[0], 0) or ORDINAL_MAP.get(words[1], 0)
    return 0


def _extract_ordinal_from_line(line: str) -> str:
    """
    Extract the ordinal portion from a HERE BEGINNETH line.
    e.g. "HERE BEGINNETH THE THREE AND TWENTIETH CHAPTER ..." → "THREE AND TWENTIETH"
    """
    # Remove "HERE BEGINNETH THE" prefix and anything after "CHAPTER"
    upper = line.strip().upper()
    # Strip prefix
    for prefix in ("HERE BEGINNETH THE ", "HERE BEGINNETH THE\n"):
        if upper.startswith(prefix):
            upper = upper[len(prefix):]
            break
    # Take only up to "CHAPTER" (stop at content description)
    if "CHAPTER" in upper:
        upper = upper[:upper.index("CHAPTER")]
    return upper.strip()


def _parse_chapters(raw: str) -> list[tuple[int, str, str]]:
    """
    Returns list of (chapter_num, title_ordinal, chapter_text).
    Splits on HERE BEGINNETH THE ... CHAPTER markers.
    The prologue is chapter 0.
    """
    lines = raw.split("\n")

    # Match both single-line and two-line formats
    here_pat = re.compile(r"^HERE BEGINNETH\b", re.IGNORECASE)
    prologue_pat = re.compile(r"^Here Beginneth the Prologue\s*$")

    # Find prologue start
    prologue_idx = 0
    for i, line in enumerate(lines):
        if prologue_pat.match(line.strip()):
            prologue_idx = i
            break

    # Collect all HERE BEGINNETH THE starts after prologue
    splits: list[tuple[int, str]] = [(prologue_idx, "PROLOGUE")]
    seen_titles: set[str] = set()

    i = prologue_idx + 1
    while i < len(lines):
        stripped = lines[i].strip()
        if here_pat.match(stripped):
            # Assemble full line — keep joining next lines until we hit "CHAPTER"
            full_line = stripped
            j = i + 1
            while j < len(lines) and "CHAPTER" not in full_line.upper():
                next_stripped = lines[j].strip()
                if next_stripped:
                    full_line = full_line + " " + next_stripped
                j += 1
                if j - i > 5:
                    break

            ordinal = _extract_ordinal_from_line(full_line)
            if not ordinal:
                i += 1
                continue

            # Deduplicate (scan artifact: some pages appear twice)
            if ordinal in seen_titles:
                i += 1
                continue
            seen_titles.add(ordinal)
            splits.append((i, ordinal))
        i += 1

    # Extract text for each split
    chapters: list[tuple[int, str, str]] = []
    for idx, (line_i, title) in enumerate(splits):
        end = splits[idx + 1][0] if idx + 1 < len(splits) else len(lines)
        block = "\n".join(lines[line_i:end]).strip()

        if title == "PROLOGUE":
            ch_num = 0
        else:
            words = [w for w in title.replace("AND", "").split() if w]
            ch_num = _parse_ordinal(words) or idx

        chapters.append((ch_num, title, block))

    return chapters


class CloudOfUnknowingIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "cloud_of_unknowing"
    display_name = "The Cloud of Unknowing"
    source_url = "https://archive.org/details/TheCloudOfUnknowing_201808"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chapters = _parse_chapters(raw)
        print(f"    Found {len(chapters)} chapters (incl. Prologue)")

        all_chunks = []
        for ch_num, title, block in chapters:
            block = clean_text(block)
            if len(block) < 100:
                continue
            ch_label = "Prologue" if ch_num == 0 else f"Chapter {ch_num}"
            for part in split_long_text(block):
                labeled = (
                    f"The Cloud of Unknowing — {ch_label}\n"
                    f"Anonymous (14th c.) / Evelyn Underhill ed. (1922)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Anonymous",
                    "translator": "Evelyn Underhill (editor)",
                    "date_composed": "~1375 CE",
                    "book": "1",
                    "chapter": str(ch_num),
                    "section": ch_label.lower().replace(" ", "_"),
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "chapter": ch_num,
                        "chapter_title": title,
                    },
                })

        return all_chunks
