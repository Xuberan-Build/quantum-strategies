"""
Sefer Yetzirah (Sepher Yezirah) — W. Wynn Westcott translation (1887)
Source: sacred-texts.com/jud/sy/ — 6 chapters, ~48 sections total
Structure: each page is one chapter; sections labeled "SECTION N."
English paragraphs may contain inline Hebrew abbreviations — filter lines
where Hebrew characters exceed 40% of alpha characters.
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

BASE_URL = "https://sacred-texts.com/jud/sy/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

CHAPTER_URLS = [
    ("1", "Chapter I — The Sephiroth",      f"{BASE_URL}sy02.htm"),
    ("2", "Chapter II — The Twenty-Two Letters", f"{BASE_URL}sy03.htm"),
    ("3", "Chapter III — The Three Mothers", f"{BASE_URL}sy04.htm"),
    ("4", "Chapter IV — The Seven Double Letters", f"{BASE_URL}sy05.htm"),
    ("5", "Chapter V — The Twelve Simple Letters", f"{BASE_URL}sy06.htm"),
    ("6", "Chapter VI — The Cosmological Correspondences", f"{BASE_URL}sy07.htm"),
]

SECTION_PAT = re.compile(r'^SECTION\s+(\d+)\.$', re.IGNORECASE)
PAGE_NUM_PAT = re.compile(r'^p\.\s*\d+\s*$')
NOISE_PAT = re.compile(r'^(Sacred Texts|Judaism|Index|Previous|Next|Buy this|Contents|Sepher Yezirah)$', re.IGNORECASE)

THEMES = [
    "kabbalah", "sefer_yetzirah", "sefirot", "letters_of_creation",
    "32_paths", "cosmology", "sacred_geometry", "creation_doctrine",
]
CROSS_TAGS = [
    "cosmogony", "sacred_geometry", "transformation", "divine_union",
    "consciousness",
]


def _hebrew_ratio(text: str) -> float:
    """Fraction of alphabetic chars that are Hebrew Unicode."""
    alpha = [c for c in text if c.isalpha()]
    if not alpha:
        return 0.0
    hebrew = [c for c in alpha if '֐' <= c <= '׿' or 'יִ' <= c <= 'ﭏ']
    return len(hebrew) / len(alpha)


def _scrape_chapter(ch_num: str, ch_title: str, url: str) -> list[tuple[int, str]]:
    """Returns list of (section_num, english_text) for a chapter page."""
    time.sleep(SCRAPE_DELAY)
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    body = soup.find("body")
    raw_text = body.get_text(separator="\n") if body else r.text

    lines = raw_text.split("\n")
    sections: list[tuple[int, str]] = []
    current_sec = None
    current_lines: list[str] = []

    def _flush():
        if current_sec is None:
            return
        block = " ".join(current_lines).strip()
        block = re.sub(r'\s+', ' ', block)
        block = clean_text(block)
        if len(block) >= 60:
            sections.append((current_sec, block))

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if NOISE_PAT.match(stripped):
            continue
        if PAGE_NUM_PAT.match(stripped):
            continue

        m = SECTION_PAT.match(stripped)
        if m:
            _flush()
            current_sec = int(m.group(1))
            current_lines = []
            continue

        if current_sec is None:
            continue

        # Skip lines that are predominantly Hebrew
        if _hebrew_ratio(stripped) > 0.40:
            continue
        # Skip lines that are pure footnote numbers
        if re.match(r'^\d+$', stripped) and len(stripped) < 4:
            continue

        current_lines.append(stripped)

    _flush()
    return sections


class SeferYetzirahWestcottIngester(BaseIngester):
    tradition = "kabbalah"
    text_name = "sefer_yetzirah_westcott"
    display_name = "Sefer Yetzirah (Westcott 1887)"
    source_url = "https://sacred-texts.com/jud/sy/index.htm"

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for ch_num, ch_title, url in CHAPTER_URLS:
            sections = _scrape_chapter(ch_num, ch_title, url)
            print(f"    {ch_title}: {len(sections)} sections")

            for sec_num, text in sections:
                for part in split_long_text(text):
                    labeled = (
                        f"Sefer Yetzirah — {ch_title}, Section {sec_num}\n"
                        f"W. Wynn Westcott translation (1887)\n\n{part}"
                    )
                    all_chunks.append({
                        "tradition": self.tradition,
                        "text_name": self.text_name,
                        "author": "Attributed to Abraham / Ancient",
                        "translator": "W. Wynn Westcott",
                        "date_composed": "~2nd century BCE – 2nd century CE",
                        "book": ch_num,
                        "chapter": ch_num,
                        "section": f"ch{ch_num}_sec{sec_num}",
                        "content": labeled,
                        "priority": 1,
                        "content_type": "primary_canon",
                        "source_url": url,
                        "language": "english",
                        "themes": THEMES,
                        "cross_tradition_tags": CROSS_TAGS,
                        "metadata": {
                            "chapter_number": int(ch_num),
                            "chapter_title": ch_title,
                            "section_number": sec_num,
                            "translator": "Westcott",
                        },
                    })

        return all_chunks
