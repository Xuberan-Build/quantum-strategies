"""
The Mystical Theology — Pseudo-Dionysius the Areopagite (~500 CE)
C.E. Rolt translation from "Dionysius the Areopagite on the Divine Names
and the Mystical Theology" (1920, SPCK). Public domain.
Source: archive.org dionysiusareopag00dion
Structure: 5 chapters (I–V), apophatic mystical treatise.
"""
import re
import requests
import time
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

TEXT_URL = (
    "https://archive.org/download/dionysiusareopag00dion/"
    "dionysiusareopag00dion_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Mystical Theology begins at grep line 9076 → Python index 9075
# Ends before "THE INFLUENCE OF DIONYSIUS IN RELIGIOUS HISTORY" (~line 9554)
TEXT_START = 9075
TEXT_END   = 9551  # stop before end-of-chapter footnotes and "THE INFLUENCE OF DIONYSIUS" section

# CHAPTER I, n (OCR for II), III, IV, V
CHAPTER_PAT = re.compile(r'^CHAPTER\s+([IVXn]+)\s*$')

# OCR artifact: "n" is used for "II"
RN_MAP = {'I': 1, 'n': 2, 'II': 2, 'III': 3, 'IV': 4, 'V': 5}

NOISE_PAT = re.compile(
    r'^\s*\d{1,3}\s*$'                   # bare page numbers
    r'|^THE\s+MYSTICAL\s+THEOLO'         # running page header "THE MYSTICAL THEOLOGY 193"
    r'|^\d{1,3}\s+DIONYSIUS'             # "198  DIONYSIUS  THE  AREOPAGITE"
    r'|^DIONYSIUS\s+THE\s+AREOPAGITE'    # "DIONYSIUS THE AREOPAGITE" standalone
    r'|^Hosted by Google$'
)

# Footnote lines: start with ^ (superscript marker) or digit(s) + spaces + text
FOOTNOTE_PAT = re.compile(r'^\s*[\^]\s+|^\s*\d{1,2}\s{2,}[A-Za-z]')

THEMES = [
    "apophatic_theology", "divine_darkness", "mystical_union", "negation",
    "pseudo_dionysius", "christian_mysticism", "transcendence", "via_negativa",
    "unknowing", "super_essential",
]
CROSS_TAGS = [
    "emptiness_void", "divine_union", "transcendence", "consciousness",
    "transformation",
]

CHAPTER_TITLES = {
    1: "What is the Divine Gloom",
    2: "How it is necessary to be united with and render praise to Him Who is the Cause of all",
    3: "What are the affirmative expressions respecting God, and what are the negative",
    4: "That He Who is the Pre-eminent Cause of everything sensibly perceived is not Himself any one of the things sensibly perceived",
    5: "That He Who is the Pre-eminent Cause of every thing intelligibly perceived is not Himself any one of the things intelligibly perceived",
}


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _parse_chapters(raw: str) -> list[tuple[int, str]]:
    lines = raw.split("\n")[TEXT_START:TEXT_END]

    # Find chapter start positions
    chapter_starts: list[tuple[int, int]] = []
    for i, line in enumerate(lines):
        m = CHAPTER_PAT.match(line.strip())
        if m:
            rn = m.group(1)
            ch_num = RN_MAP.get(rn, 0)
            if ch_num:
                chapter_starts.append((i, ch_num))

    if not chapter_starts:
        return []

    chapters: list[tuple[int, str]] = []
    for idx, (start, ch_num) in enumerate(chapter_starts):
        end = chapter_starts[idx + 1][0] if idx + 1 < len(chapter_starts) else len(lines)
        body_lines = []
        for line in lines[start + 1:end]:
            stripped = line.strip()
            if not stripped:
                body_lines.append("")
                continue
            if NOISE_PAT.match(stripped):
                continue
            if FOOTNOTE_PAT.match(stripped):
                continue
            body_lines.append(stripped)

        block = "\n".join(body_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        block = clean_text(block)
        if len(block) >= 80:
            chapters.append((ch_num, block))

    return chapters


class MysticalTheologyIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "mystical_theology"
    display_name = "Mystical Theology"
    source_url = "https://archive.org/details/dionysiusareopag00dion"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chapters = _parse_chapters(raw)
        print(f"    Found {len(chapters)} chapters")

        all_chunks = []
        for ch_num, text in chapters:
            ch_title = CHAPTER_TITLES.get(ch_num, f"Chapter {ch_num}")
            for part in split_long_text(text):
                labeled = (
                    f"The Mystical Theology — Chapter {ch_num}: {ch_title}\n"
                    f"Pseudo-Dionysius the Areopagite (~500 CE) / C.E. Rolt trans. (1920)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Pseudo-Dionysius the Areopagite",
                    "translator": "C.E. Rolt",
                    "date_composed": "~500 CE",
                    "book": "1",
                    "chapter": str(ch_num),
                    "section": f"chapter_{ch_num}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "chapter": ch_num,
                        "chapter_title": ch_title,
                    },
                })

        return all_chunks
