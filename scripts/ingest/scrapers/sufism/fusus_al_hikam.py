"""
Fusus al-Hikam (The Bezels / Seals of Wisdom) — Muhyiddin Ibn Arabi (1229 CE)
AFIRA English translation
Source: archive.org (book-fusus-al-hikam-english-ibn-arabi-by-afira)
Strategy: fetch DjVuTXT, skip TOC (lines with fill dots), split on
          "N[):] The Seal of" chapter markers in the actual text section.
27 chapters, one per prophet, each exploring a facet of divine wisdom.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/book-fusus-al-hikam-english-ibn-arabi-by-afira"
    "/book-%20%20fusus-al-hikam-english%20Ibn%20Arabi%20by%20AFIRA_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Chapter header in actual text: starts with "N[): ] The Seal", no trailing page number
CHAPTER_PAT = re.compile(r"^(\d+)[):]\s+The Seal\b")
# TOC entries always end with a page number (space + digits at end of line)
TOC_LINE_PAT = re.compile(r"\s\d+\s*$")

# Noise: page numbers, short lone lines
PAGE_PAT = re.compile(r"^\d{1,3}\s*$")

THEMES = [
    "fusus_al_hikam", "ibn_arabi", "sufism", "wahdat_al_wujud",
    "prophetic_wisdom", "divine_names", "barzakh", "imagination",
    "sufi_metaphysics", "islamic_mysticism",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transcendence", "transformation",
    "emptiness_void",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _parse_chapters(raw: str) -> list[tuple[int, str, str]]:
    """Returns list of (num, title_line, body_text)."""
    lines = raw.split("\n")

    # Find actual chapter markers (not TOC — TOC lines have fill characters)
    hits: list[tuple[int, int, str]] = []  # (line_idx, chapter_num, title)
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = CHAPTER_PAT.match(stripped)
        if m and not TOC_LINE_PAT.search(stripped):
            num = int(m.group(1))
            hits.append((i, num, stripped))

    # Deduplicate by chapter number (keep first real occurrence)
    seen: set[int] = set()
    deduped: list[tuple[int, int, str]] = []
    for line_i, num, title in hits:
        if num not in seen:
            seen.add(num)
            deduped.append((line_i, num, title))

    chapters: list[tuple[int, str, str]] = []
    for idx, (line_i, ch_num, title) in enumerate(deduped):
        end = deduped[idx + 1][0] if idx + 1 < len(deduped) else len(lines)
        block_lines: list[str] = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if PAGE_PAT.match(stripped):
                continue
            block_lines.append(stripped if stripped else "")
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 200:
            chapters.append((ch_num, title, block))

    return chapters


class FususAlHikamIngester(BaseIngester):
    tradition = "sufism"
    text_name = "fusus_al_hikam"
    display_name = "Fusus al-Hikam (Bezels of Wisdom)"
    source_url = "https://archive.org/details/book-fusus-al-hikam-english-ibn-arabi-by-afira"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chapters = _parse_chapters(raw)
        print(f"    Found {len(chapters)} chapters")

        all_chunks = []
        for ch_num, title, block in chapters:
            block = clean_text(block)
            if len(block) < 200:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Fusus al-Hikam — {title}\n"
                    f"Muhyiddin Ibn Arabi (1229 CE), AFIRA English translation\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Muhyiddin Ibn Arabi",
                    "translator": "AFIRA",
                    "date_composed": "1229 CE",
                    "book": "1",
                    "chapter": str(ch_num),
                    "section": f"seal_{ch_num}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "chapter": ch_num,
                        "title": title,
                    },
                })

        return all_chunks
