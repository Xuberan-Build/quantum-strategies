"""
A Spiritual Canticle of the Soul — St. John of the Cross (1577-1578 CE)
David Lewis translation / Benedict Zimmerman edition (1909) — public domain
Source: archive.org (St.JohnOfTheCrossAscentOfMountCarmel)
Structure: 40 stanzas with commentary (some combined: "STANZAS XIV, XV").
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/St.JohnOfTheCrossAscentOfMountCarmel"
    "/St.%20John%20of%20the%20Cross%20-%20A%20Spiritual%20Canticle%20of%20the%20Soul_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

STANZA_PAT  = re.compile(r"^STANZAS?\s+([IVXLC]+(?:,\s*[IVXLC]+)?)\s*$")
FOOTNOTE_PAT = re.compile(r"^\d+\s+[A-Z]|^\d{1,3}\s*$")

THEMES = [
    "spiritual_canticle", "john_of_the_cross", "christian_mysticism",
    "mystical_union", "bridal_mysticism", "carmelite_mysticism",
    "divine_love", "song_of_songs", "via_unitiva",
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


def _parse_stanzas(raw: str) -> list[tuple[str, str]]:
    """Returns list of (stanza_label, body_text)."""
    lines = raw.split("\n")

    hits: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        m = STANZA_PAT.match(line.strip())
        if m:
            hits.append((i, line.strip()))

    stanzas: list[tuple[str, str]] = []
    for idx, (line_i, label) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        block_lines: list[str] = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if not stripped:
                block_lines.append("")
                continue
            if FOOTNOTE_PAT.match(stripped):
                continue
            block_lines.append(stripped)
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 150:
            stanzas.append((label, block))

    return stanzas


class SpiritualCanticleIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "spiritual_canticle"
    display_name = "A Spiritual Canticle of the Soul"
    source_url = "https://archive.org/details/St.JohnOfTheCrossAscentOfMountCarmel"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        stanzas = _parse_stanzas(raw)
        print(f"    Found {len(stanzas)} stanzas")

        all_chunks = []
        for idx, (label, block) in enumerate(stanzas, 1):
            block = clean_text(block)
            if len(block) < 150:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Spiritual Canticle — {label}\n"
                    f"St. John of the Cross (1577 CE), David Lewis translation (1909)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "St. John of the Cross",
                    "translator": "David Lewis",
                    "date_composed": "1577 CE",
                    "book": "1",
                    "chapter": str(idx),
                    "section": f"stanza_{idx}",
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"stanza_label": label, "stanza_num": idx},
                })

        return all_chunks
