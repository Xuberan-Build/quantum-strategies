"""
The Practice of the Presence of God — Brother Lawrence (~1666-1691 CE)
Old translation (public domain) — Project Gutenberg #13871
Structure: 4 Conversations + 15 Letters (19 sections total).
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = "https://www.gutenberg.org/cache/epub/13871/pg13871.txt"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

SECTION_PAT = re.compile(
    r"^(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|"
    r"ELEVENTH|TWELFTH|THIRTEENTH|FOURTEENTH|FIFTEENTH)\s+(CONVERSATION|LETTER)\.\s*$"
)

GUTENBERG_START = re.compile(r"\*\*\* START OF THE PROJECT GUTENBERG")
GUTENBERG_END   = re.compile(r"\*\*\* END OF THE PROJECT GUTENBERG")

THEMES = [
    "brother_lawrence", "christian_mysticism", "practice_of_presence",
    "contemplative_prayer", "mystical_union", "divine_presence",
    "simple_prayer", "carmelite_mysticism",
]
CROSS_TAGS = [
    "divine_union", "transformation", "transcendence", "consciousness",
]

ORDINAL_MAP = {
    "FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4, "FIFTH": 5,
    "SIXTH": 6, "SEVENTH": 7, "EIGHTH": 8, "NINTH": 9, "TENTH": 10,
    "ELEVENTH": 11, "TWELFTH": 12, "THIRTEENTH": 13, "FOURTEENTH": 14,
    "FIFTEENTH": 15,
}


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _parse_sections(raw: str) -> list[tuple[str, str]]:
    """Returns list of (title, body_text)."""
    lines = raw.split("\n")
    # Strip Gutenberg boilerplate
    start_idx, end_idx = 0, len(lines)
    for i, line in enumerate(lines):
        if GUTENBERG_START.search(line):
            start_idx = i + 1
        if GUTENBERG_END.search(line):
            end_idx = i
            break
    lines = lines[start_idx:end_idx]

    hits: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        m = SECTION_PAT.match(line.strip())
        if m:
            hits.append((i, line.strip().rstrip(".")))

    sections: list[tuple[str, str]] = []
    for idx, (line_i, title) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        block = "\n".join(l.strip() for l in lines[line_i + 1:end]).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 50:
            sections.append((title, block))

    return sections


class PracticeOfPresenceIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "practice_of_presence"
    display_name = "The Practice of the Presence of God"
    source_url = "https://www.gutenberg.org/ebooks/13871"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from Project Gutenberg...")
        raw = _fetch_text()
        sections = _parse_sections(raw)
        print(f"    Found {len(sections)} sections")

        all_chunks = []
        for sec_num, (title, block) in enumerate(sections, 1):
            block = clean_text(block)
            if len(block) < 50:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"The Practice of the Presence of God — {title}\n"
                    f"Brother Lawrence (~1666 CE)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Brother Lawrence",
                    "translator": None,
                    "date_composed": "~1666 CE",
                    "book": "1",
                    "chapter": str(sec_num),
                    "section": title.lower().replace(" ", "_"),
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"section": title},
                })

        return all_chunks
