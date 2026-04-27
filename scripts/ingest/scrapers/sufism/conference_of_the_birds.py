"""
Conference of the Birds (Mantiq ut-Tayr)
by Farid ud-Din Attar — translated by R.P. Masani, 1924
Source: archive.org (public domain — published ~1924)
Strategy: fetch DjVuTXT, split on ALL-CAPS section headers,
          one chunk per section.
"""
import re
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/ConferenceOfTheBirdsByAttartr.R.P.MASANI"
    "/Conference%20of%20the%20birds%20by%20Attar%20(tr.%20R.%20P.%20MASANI)_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

THEMES = [
    "sufi_journey", "fana", "divine_love", "valley", "bird",
    "simurgh", "mystical_quest", "annihilation", "unity",
]
CROSS_TAGS = [
    "transformation", "divine_union", "emptiness_void",
    "consciousness", "transcendence",
]

# Sections to skip (title pages, brief descriptors)
SKIP_TITLES = {
    "CONFERENCE OF THE BIRDS", "A SUFI ALLEGORY",
    "BEING AN ABRIDGED VERSION OF", "FOREWORD",
}


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _is_section_header(line: str) -> bool:
    stripped = line.strip()
    # All-caps line with words, 5–60 chars, possibly with spaces/hyphens/apostrophes
    if 5 < len(stripped) < 65 and re.match(r"^[A-Z][A-Z\s\'\-,\.]+$", stripped):
        return True
    # "PART I", "PART II", etc.
    if re.match(r"^PART\s+[IVX]+$", stripped):
        return True
    return False


def _split_sections(raw: str) -> list[tuple[str, str]]:
    lines = raw.split("\n")
    sections: list[tuple[str, str]] = []
    current_title = "INTRODUCTION"
    current_lines: list[str] = []

    for line in lines:
        if _is_section_header(line):
            # Save current section
            block = "\n".join(current_lines).strip()
            if len(block) > 150 and current_title not in SKIP_TITLES:
                sections.append((current_title, block))
            current_title = line.strip()
            current_lines = []
        else:
            current_lines.append(line)

    # Flush last section
    block = "\n".join(current_lines).strip()
    if len(block) > 150 and current_title not in SKIP_TITLES:
        sections.append((current_title, block))

    return sections


class ConferenceOfTheBirdsIngester(BaseIngester):
    tradition = "sufism"
    text_name = "conference_of_the_birds"
    display_name = "Conference of the Birds"
    source_url = "https://archive.org/details/ConferenceOfTheBirdsByAttartr.R.P.MASANI"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        sections = _split_sections(raw)
        print(f"    Found {len(sections)} sections")

        all_chunks = []
        for section_num, (title, block) in enumerate(sections, start=1):
            block = clean_text(block)
            if len(block) < 150:
                continue

            for part in split_long_text(block):
                labeled = (
                    f"Conference of the Birds (Mantiq ut-Tayr) — {title}\n"
                    f"Farid ud-Din Attar / Masani translation (1924)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Farid ud-Din Attar",
                    "translator": "R.P. Masani",
                    "date_composed": "~1177 CE",
                    "book": "1",
                    "chapter": str(section_num),
                    "section": title[:80],
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "section_num": section_num,
                        "section_title": title,
                    },
                })

        return all_chunks
