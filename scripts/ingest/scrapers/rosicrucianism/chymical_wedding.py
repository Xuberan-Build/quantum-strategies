"""
The Chymical Wedding of Christian Rosenkreutz (1616/1690 translation)
Source: archive.org (ChymicalWeddingOfChristianRosenkreutz)
Strategy: fetch DjVuTXT (double-space OCR), split on "The <Ordinal> Day" markers,
          chunk each of the 7 days.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/ChymicalWeddingOfChristianRosenkreutz"
    "/Chymical%20Wedding%20of%20Christian%20Rosenkreutz_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

DAY_NAMES = {
    1: "First", 2: "Second", 3: "Third", 4: "Fourth",
    5: "Fifth", 6: "Sixth", 7: "Seventh",
}
DAY_PAT = re.compile(
    r"^The\s+(First|Second|Third|Fourth|Fifth|Sixth|Seventh)\s+Day\s*$",
    re.IGNORECASE,
)
DAY_MAP = {v.upper(): k for k, v in DAY_NAMES.items()}

THEMES = [
    "rosicrucian", "alchemical_allegory", "initiation", "sacred_marriage",
    "transformation", "christian_mysticism", "esoteric_christianity",
    "royal_wedding", "hermetic_philosophy",
]
CROSS_TAGS = [
    "divine_union", "transformation", "consciousness", "transcendence",
    "sacred_geometry",
]

# Double-space OCR noise
PAGE_PAT = re.compile(r"^Page\s+\d+\s*$", re.IGNORECASE)


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _fix_ocr(line: str) -> str:
    return re.sub(r"  +", " ", line)


def _parse_days(raw: str) -> list[tuple[int, str]]:
    lines = raw.split("\n")

    hits: list[tuple[int, int]] = []
    for i, line in enumerate(lines):
        m = DAY_PAT.match(line.strip())
        if m:
            num = DAY_MAP.get(m.group(1).upper(), 0)
            if num:
                hits.append((i, num))

    days: list[tuple[int, str]] = []
    for idx, (line_i, day_num) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        block_lines = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if not stripped:
                block_lines.append("")
                continue
            if PAGE_PAT.match(stripped):
                continue
            block_lines.append(_fix_ocr(stripped))
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 150:
            days.append((day_num, block))

    return days


class ChymicalWeddingIngester(BaseIngester):
    tradition = "rosicrucianism"
    text_name = "chymical_wedding"
    display_name = "The Chymical Wedding of Christian Rosenkreutz"
    source_url = "https://archive.org/details/ChymicalWeddingOfChristianRosenkreutz"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        days = _parse_days(raw)
        print(f"    Found {len(days)} days")

        all_chunks = []
        for day_num, block in days:
            day_name = DAY_NAMES.get(day_num, str(day_num))
            block = clean_text(block)
            if len(block) < 150:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"The Chymical Wedding of Christian Rosenkreutz — The {day_name} Day\n"
                    f"Johann Valentin Andreae (1616), Foxcroft translation (1690)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Johann Valentin Andreae",
                    "translator": "E. Foxcroft",
                    "date_composed": "1616 CE",
                    "book": "1",
                    "chapter": str(day_num),
                    "section": f"day_{day_num}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "day": day_num,
                        "day_name": day_name,
                    },
                })

        return all_chunks
