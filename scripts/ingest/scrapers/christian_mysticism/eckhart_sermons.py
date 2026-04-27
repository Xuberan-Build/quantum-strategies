"""
Meister Eckhart: Sermons and Collations
Franz Pfeiffer (1857) / C. de B. Evans translation (1924) — public domain
Source: archive.org (in.ernet.dli.2015.31707)
Strategy: fetch DjVuTXT, skip TOC (first 1389 lines), split on page headers
          "SERMONS AND COLLATIONS", filter noise, chunk per section.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/in.ernet.dli.2015.31707"
    "/2015.31707.Meister-Eckhart--Vol-1_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Running page headers and noise to skip
NOISE_PAT = re.compile(
    r"^SERMONS AND COLL"
    r"|^Digitized\s+by"
    r"|^\d+\s*$"
    r"|^Cod\.\s+Monac\b"
    r"|^MEISTER\s+ECKHART\s*$",
    re.IGNORECASE,
)

THEMES = [
    "divine_birth", "soul", "detachment", "mystical_union", "god",
    "christian_mysticism", "contemplation", "intellect", "being",
    "groundlessness",
]
CROSS_TAGS = [
    "emptiness_void", "divine_union", "consciousness", "transcendence",
    "transformation",
]

# Line where actual text begins (after TOC/preface)
TEXT_START = 1389
# Line where page section headers stop (rest of file = tractates)
TEXT_END = 16200


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _extract_sections(raw: str) -> list[tuple[int, str]]:
    """
    Returns list of (section_num, section_text) for each page section.
    Sections are delineated by "SERMONS AND COLLATIONS [N]" page headers.
    """
    lines = raw.split("\n")
    header_pat = re.compile(r"^SERMONS AND COLLATIONS\s*(\d*)\s*$", re.IGNORECASE)

    # Collect section start lines
    section_starts: list[tuple[int, int]] = []
    for i, line in enumerate(lines[TEXT_START:TEXT_END], start=TEXT_START):
        m = header_pat.match(line.strip())
        if m:
            page_num = int(m.group(1)) if m.group(1) else 0
            section_starts.append((i, page_num))

    sections: list[tuple[int, str]] = []
    for idx, (start, page_num) in enumerate(section_starts):
        end = section_starts[idx + 1][0] if idx + 1 < len(section_starts) else TEXT_END
        raw_lines = lines[start:end]

        # Filter noise and collect clean text
        clean: list[str] = []
        for line in raw_lines:
            stripped = line.strip()
            if NOISE_PAT.match(stripped):
                continue
            # Skip lone Roman numerals (sermon dividers)
            if re.match(r"^[IVXLC]+\.?\s*$", stripped) and len(stripped) <= 8:
                continue
            clean.append(stripped)

        text = " ".join(clean).strip()
        # Collapse multiple spaces
        text = re.sub(r"\s{2,}", " ", text)
        if len(text) > 200:
            sections.append((idx + 1, text))

    return sections


class EckhartSermonsIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "eckhart_sermons"
    display_name = "Meister Eckhart — Sermons"
    source_url = "https://archive.org/details/in.ernet.dli.2015.31707"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        sections = _extract_sections(raw)
        print(f"    Found {len(sections)} sections")

        all_chunks = []
        for section_num, text in sections:
            text = clean_text(text)
            if len(text) < 200:
                continue
            for part in split_long_text(text):
                labeled = (
                    f"Meister Eckhart — Sermons and Collations (Section {section_num})\n"
                    f"Pfeiffer / C. de B. Evans translation (1924)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Meister Eckhart",
                    "translator": "C. de B. Evans",
                    "date_composed": "~1290–1327 CE",
                    "book": "1",
                    "chapter": str(section_num),
                    "section": f"section_{section_num}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "section": section_num,
                        "source": "Pfeiffer/Evans Vol.1",
                    },
                })

        return all_chunks
