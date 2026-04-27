"""
The Confessions of Al Ghazzali (al-Munqidh min al-Dalal / Deliverance from Error)
Abu Hamid al-Ghazali, ~1100 CE. Claud Field translation (1909) — public domain.
Source: Project Gutenberg #58977
Strategy: fetch plain text, split on uppercase chapter headers.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = "https://www.gutenberg.org/cache/epub/58977/pg58977.txt"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Uppercase section headers in the text
SECTION_HEADERS = [
    "INTRODUCTION",
    "GHAZZALI’S SEARCH FOR TRUTH",
    "THE SUBTERFUGES OF THE SOPHISTS",
    "THE DIFFERENT KINDS OF SEEKERS AFTER TRUTH",
    "THE AIM OF SCHOLASTIC THEOLOGY AND ITS RESULTS",
    "CONCERNING THE PHILOSOPHICAL SECTS AND THE STIGMA OF INFIDELITY WHICH",
    "DIVISIONS OF THE PHILOSOPHIC SCIENCES",
    "SUFISM",
    "THE REALITY OF INSPIRATION: ITS IMPORTANCE FOR THE HUMAN RACE",
]

GUTENBERG_START = re.compile(r"\*\*\* START OF THE PROJECT GUTENBERG")
GUTENBERG_END   = re.compile(r"\*\*\* END OF THE PROJECT GUTENBERG")

THEMES = [
    "ghazali", "sufism", "deliverance_from_error", "islamic_mysticism",
    "spiritual_autobiography", "scholastic_theology", "sufi_epistemology",
    "divine_truth", "soul_purification",
]
CROSS_TAGS = [
    "transformation", "divine_union", "consciousness", "transcendence",
]


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

    # Build set of header lines (stripped)
    header_set = {h.strip() for h in SECTION_HEADERS}
    # Also match partial (for long header that might wrap)
    CONCERNING_PAT = re.compile(r"^CONCERNING THE PHILOSOPHICAL SECTS")

    hits: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped in header_set or CONCERNING_PAT.match(stripped):
            hits.append((i, stripped))

    sections: list[tuple[str, str]] = []
    for idx, (line_i, title) in enumerate(hits):
        end = hits[idx + 1][0] if idx + 1 < len(hits) else len(lines)
        block = "\n".join(l.strip() for l in lines[line_i + 1:end]).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        # Normalize underscore italics from Gutenberg (e.g. _word_ → word)
        block = re.sub(r"_([^_]+)_", r"\1", block)
        if len(block) > 100:
            sections.append((title, block))

    return sections


class GhazaliCongressionsIngester(BaseIngester):
    tradition = "sufism"
    text_name = "ghazali_confessions"
    display_name = "Confessions of Al-Ghazali (Deliverance from Error)"
    source_url = "https://www.gutenberg.org/ebooks/58977"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from Project Gutenberg...")
        raw = _fetch_text()
        sections = _parse_sections(raw)
        print(f"    Found {len(sections)} sections")

        all_chunks = []
        for sec_num, (title, block) in enumerate(sections, 1):
            block = clean_text(block)
            if len(block) < 100:
                continue
            for part in split_long_text(block):
                labeled = (
                    f"Confessions of Al-Ghazali — {title}\n"
                    f"Al-Ghazali (~1100 CE), Claud Field translation (1909)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Abu Hamid al-Ghazali",
                    "translator": "Claud Field",
                    "date_composed": "~1100 CE",
                    "book": "1",
                    "chapter": str(sec_num),
                    "section": title.lower().replace(" ", "_")[:40],
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
