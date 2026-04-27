"""
The Mystics of Islam — Reynold A. Nicholson (1914)
Source: sacred-texts.com/isl/moi/moi.htm (single HTML page, public domain)
Structure: 6 chapters on Sufi doctrine, practice, and mystical experience.
Substitutes for Risalat al-Qushayri (no PD English translation available).
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

TEXT_URL = "https://sacred-texts.com/isl/moi/moi.htm"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

CHAPTER_PAT = re.compile(r'^CHAPTER\s+(I{1,3}V?|VI?|VII?|VIII?|IX?|X{1,3})\s*\.?\s*$')
PAGE_NUM_PAT = re.compile(r'^p\.\s*\d+\s*$')
NOISE_PAT = re.compile(
    r'^(Sacred Texts|Islam|Index|Previous|Next|Buy this|Contents|Pickthall)'
    r'|^«\s*Previous'
    r'|^Next\s*»',
    re.IGNORECASE
)
# Footnote references inline: {text in braces}
FOOTNOTE_PAT = re.compile(r'\{[^}]{1,200}\}')

THEMES = [
    "sufism", "islamic_mysticism", "sufi_doctrine", "fana", "baqa",
    "hal_maqam", "divine_love", "marifah", "kashf", "tajalli",
    "nicholson", "mystical_states",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transformation", "transcendence",
    "ego_dissolution", "stages_of_development",
]

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
    "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10,
}


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _parse_chapters(html: str) -> list[tuple[int, str, str]]:
    """Returns list of (chapter_num, chapter_title, text)."""
    soup = BeautifulSoup(html, "lxml")
    body = soup.find("body")
    raw = body.get_text(separator="\n") if body else html
    lines = raw.split("\n")

    # Find chapter headers — they appear once each in the body text
    # The TOC uses prose descriptions, not the "CHAPTER I" pattern
    real_hits: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        m = CHAPTER_PAT.match(stripped)
        if m:
            real_hits.append((i, m.group(1)))

    if not real_hits:
        return []

    # Also find the Index line to mark end of last chapter
    index_line = None
    for i in range(real_hits[-1][0], len(lines)):
        if re.match(r'^[A-Z][a-z].*,\s*\d+', lines[i].strip()) and i > real_hits[-1][0] + 200:
            index_line = i
            break

    chapters = []
    for idx, (start, rn) in enumerate(real_hits):
        end = real_hits[idx + 1][0] if idx + 1 < len(real_hits) else (index_line or len(lines))
        ch_num = ROMAN_TO_INT.get(rn, idx + 1)

        # Find chapter title on the next non-empty line after the header
        ch_title = f"Chapter {rn}"
        for j in range(start + 1, min(start + 10, end)):
            candidate = lines[j].strip()
            if candidate and not PAGE_NUM_PAT.match(candidate) and len(candidate) > 5:
                ch_title = candidate
                break

        # Collect body text
        block_lines = []
        for line in lines[start + 1:end]:
            stripped = line.strip()
            if not stripped:
                block_lines.append("")
                continue
            if PAGE_NUM_PAT.match(stripped):
                continue
            if NOISE_PAT.match(stripped):
                continue
            block_lines.append(stripped)

        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        # Remove footnote braces
        block = FOOTNOTE_PAT.sub("", block)
        block = clean_text(block)

        if len(block) >= 200:
            chapters.append((ch_num, ch_title, block))

    return chapters


class MysticsOfIslamIngester(BaseIngester):
    tradition = "sufism"
    text_name = "mystics_of_islam"
    display_name = "The Mystics of Islam (Nicholson 1914)"
    source_url = "https://sacred-texts.com/isl/moi/moi.htm"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from sacred-texts.com...")
        html = _fetch_text()
        chapters = _parse_chapters(html)
        print(f"    Found {len(chapters)} chapters")

        all_chunks = []
        for ch_num, ch_title, text in chapters:
            parts = split_long_text(text)
            print(f"      Chapter {ch_num} ({ch_title[:40]}): {len(parts)} parts")
            for part_i, part in enumerate(parts):
                labeled = (
                    f"The Mystics of Islam — Chapter {ch_num}: {ch_title}\n"
                    f"Reynold A. Nicholson (Routledge, Kegan Paul, 1914)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Reynold A. Nicholson",
                    "translator": "",
                    "date_composed": "1914 CE",
                    "book": "1",
                    "chapter": str(ch_num),
                    "section": f"ch{ch_num}_part{part_i + 1}",
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "chapter_number": ch_num,
                        "chapter_title": ch_title,
                        "part": part_i + 1,
                    },
                })

        return all_chunks
