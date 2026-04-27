"""
The Asclepius (The Perfect Sermon) — Hermes Trismegistus
G.R.S. Mead translation from Thrice-Greatest Hermes Vol. II (1906)
Source: archive.org thricegreatesth02meadgoog
Structure: 41 sections (Roman numeral headers I–XLI), dialogue format.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/thricegreatesth02meadgoog/"
    "thricegreatesth02meadgoog_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Asclepius text spans these lines in the source file
TEXT_START = 15147
TEXT_END   = 18980

# Section dividers: standalone Roman numeral on its own line
SECTION_PAT = re.compile(r'^([IVXLC]+)$')

# Noise patterns to strip
NOISE_PAT = re.compile(
    r'^THE PERFECT SERMON\s+\d+'   # running page header
    r'|^THRICE-GREATEST HERMES'    # running book header
    r'|^Hosted by Google'          # Google Books artifact
    r'|^\d{1,3}\s*$'               # bare page numbers
    r'|^\s*\d+\s*$'                # bare numbers
)

# Footnote lines: start with superscript digit marker
FOOTNOTE_PAT = re.compile(r'^\s*[\^]?\s*\d+\s+[A-Z]')

THEMES = [
    "hermeticism", "asclepius", "corpus_hermeticum", "hermes_trismegistus",
    "gnosis", "divine_mind", "sacred_dialogue", "hermetic_philosophy",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transcendence", "transformation",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _parse_sections(raw: str) -> list[tuple[int, str]]:
    lines = raw.split("\n")[TEXT_START:TEXT_END]

    # Find all section header positions
    section_starts: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        m = SECTION_PAT.match(line.strip())
        if m:
            section_starts.append((i, m.group(1)))

    if not section_starts:
        return []

    sections: list[tuple[int, str]] = []
    for idx, (start, rn) in enumerate(section_starts):
        end = section_starts[idx + 1][0] if idx + 1 < len(section_starts) else len(lines)
        block_lines = []
        for line in lines[start + 1:end]:
            stripped = line.strip()
            if not stripped:
                block_lines.append("")
                continue
            if NOISE_PAT.match(stripped):
                continue
            if FOOTNOTE_PAT.match(stripped):
                continue
            block_lines.append(stripped)
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        block = clean_text(block)
        if len(block) >= 80:
            sections.append((idx + 1, block))

    return sections


class AsclepiusIngester(BaseIngester):
    tradition = "hermeticism"
    text_name = "asclepius"
    display_name = "The Asclepius (Perfect Sermon)"
    source_url = "https://archive.org/details/thricegreatesth02meadgoog"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        sections = _parse_sections(raw)
        print(f"    Found {len(sections)} sections")

        all_chunks = []
        for seq, text in sections:
            for part in split_long_text(text):
                labeled = (
                    f"The Asclepius (The Perfect Sermon) — Section {seq}\n"
                    f"G.R.S. Mead translation, Thrice-Greatest Hermes Vol. II (1906)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Hermes Trismegistus (attributed)",
                    "translator": "G.R.S. Mead",
                    "date_composed": "~100-300 CE",
                    "book": "1",
                    "chapter": str(seq),
                    "section": f"section_{seq}",
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"section_num": seq},
                })

        return all_chunks
