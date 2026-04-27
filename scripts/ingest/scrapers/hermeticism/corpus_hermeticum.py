"""
Corpus Hermeticum (Tractates I–XIV) — G. R. S. Mead translation (1906)
Source: archive.org (GRSMeadThriceGreatestHermesVolII)
Strategy: fetch DjVuTXT, split by "CORPUS HERMETICUM N." markers,
          filter footnotes (Greek text, numbered references), chunk per tractate.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/GRSMeadThriceGreatestHermesVolII"
    "/G%20R%20S%20Mead%20-%20Thrice-Greatest%20Hermes%20-Vol%20II_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

ROMAN_TO_INT = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7,
    "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13,
    "XIV": 14, "XV": 15,
}

TRACTATE_TITLES = {
    1:  "Poemandres, The Shepherd of Men",
    2:  "The General Sermon",
    3:  "The Sacred Sermon",
    4:  "The Cup or Monad",
    5:  "Though Unmanifest God Is Most Manifest",
    6:  "In God Alone Is Good",
    7:  "The Greatest Ill Among Men Is the Not-Knowing God",
    8:  "That No One of Existing Things Doth Perish",
    9:  "On Thought and Sense",
    10: "The Key",
    11: "Mind unto Hermes",
    12: "About the Common Mind",
    13: "The Secret Sermon on the Mountain",
    14: "A Letter of Thrice-Greatest Hermes to Asclepius",
}

THEMES = [
    "poimandres", "gnosis", "divine_mind", "logos", "cosmic_creation",
    "hermetic_philosophy", "nous", "light_and_dark", "ascent_of_soul",
    "hermeticism", "thrice_greatest_hermes",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transformation", "transcendence",
    "emptiness_void",
]

# Footnote/noise patterns
FOOTNOTE_PAT = re.compile(
    r"^\d+\s+[A-Za-z]"          # numbered footnotes
    r"|^- \d+ -$"               # page numbers like "- 3 -"
    r"|\bCf\.\s"                # references "Cf. ..."
    r"|\bR\.\s+\d+"             # "R. 328"
    r"|\bP\.\s+\d+"             # "P. 128"
    r"|\bPat\.\s"               # "Pat. ..."
    r"|xcov|xpv|Kav|cpq|ogvv",  # Greek OCR fragments
    re.IGNORECASE,
)


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _parse_tractates(raw: str) -> list[tuple[int, str]]:
    """
    Returns list of (tractate_num, tractate_text).
    Splits on CORPUS HERMETICUM N. markers.
    Uses second pass (skips TOC).
    """
    lines = raw.split("\n")
    ch_pat = re.compile(r"^CORPUS HERMETICUM\s+([IVXLC]+)\.\s*(?:\([IVXLC]+\.\))?\s*$")

    # Find all tractate markers
    hits: list[tuple[int, int]] = []
    for i, line in enumerate(lines):
        m = ch_pat.match(line.strip())
        if m:
            num = ROMAN_TO_INT.get(m.group(1).upper(), 0)
            if num:
                hits.append((i, num))

    # Skip TOC — actual text starts at second occurrence of tractate I
    seen_i = 0
    actual_start_idx = 0
    for idx, (line_i, num) in enumerate(hits):
        if num == 1:
            seen_i += 1
            if seen_i == 2:
                actual_start_idx = idx
                break

    actual_hits = hits[actual_start_idx:]

    tractates: list[tuple[int, str]] = []
    for idx, (line_i, num) in enumerate(actual_hits):
        end = actual_hits[idx + 1][0] if idx + 1 < len(actual_hits) else len(lines)
        # Filter noise and footnotes
        block_lines: list[str] = []
        for line in lines[line_i:end]:
            stripped = line.strip()
            if not stripped:
                block_lines.append("")
                continue
            # Skip footnotes
            if FOOTNOTE_PAT.search(stripped):
                continue
            # Skip pure page numbers
            if re.match(r"^-?\s*\d+\s*-?$", stripped):
                continue
            block_lines.append(stripped)

        block = "\n".join(block_lines).strip()
        # Collapse multiple blank lines
        block = re.sub(r"\n{3,}", "\n\n", block)
        if len(block) > 200:
            tractates.append((num, block))

    return tractates


class CorpusHermeticumIngester(BaseIngester):
    tradition = "hermeticism"
    text_name = "corpus_hermeticum"
    display_name = "Corpus Hermeticum"
    source_url = "https://archive.org/details/GRSMeadThriceGreatestHermesVolII"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        tractates = _parse_tractates(raw)
        print(f"    Found {len(tractates)} tractates")

        all_chunks = []
        for num, block in tractates:
            title = TRACTATE_TITLES.get(num, f"Tractate {num}")
            block = clean_text(block)
            if len(block) < 200:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Corpus Hermeticum — Tractate {num}: {title}\n"
                    f"G. R. S. Mead translation (1906)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Hermes Trismegistus",
                    "translator": "G. R. S. Mead",
                    "date_composed": "~1st–3rd century CE",
                    "book": str(num),
                    "chapter": str(num),
                    "section": f"tractate_{num}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "tractate": num,
                        "title": title,
                    },
                })

        return all_chunks
