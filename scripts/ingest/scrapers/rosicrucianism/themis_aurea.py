"""
Themis Aurea: The Laws of the Fraternity of the Rosie Crosse — Michael Maier (1618/1656)
English translation: "Themis Aurea. The Laws of the Fraternity of the Rosie Crosse"
Published London, 1656. Dedicated to Elias Ashmole.
Source: archive.org / MaierusMThemisAureaTheLawsOfTheFraternityOfTheRosieCrosse1656

Note: 1656 old-English typography OCR — long-s (f) substitutions and fragment lines
are expected and tolerated.
"""
import re
import requests
import time
import urllib.parse
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

ITEM_ID = "MaierusMThemisAureaTheLawsOfTheFraternityOfTheRosieCrosse1656"
FNAME   = "Maierus M - Themis Aurea - The Laws of the Fraternity of the Rosie Crosse - 1656_djvu.txt"
TEXT_URL = f"https://archive.org/download/{ITEM_ID}/{urllib.parse.quote(FNAME)}"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Detected chapter start lines (some chapters have no OCR-detected heading; they
# are bounded by surrounding chapters).  None means "to end of file".
CHAPTERS = [
    ("I",    1081, 1338),
    ("II",   1338, 1929),
    ("III",  1929, 2170),
    ("IV",   2170, 2370),
    ("V",    2370, 2836),
    ("VI",   2836, 3072),
    ("VII",  3072, 3465),
    ("VIII", 3465, 3745),
    ("IX",   3745, 4191),
    ("X",    4191, 4454),
    ("XI",   4454, 4739),
    ("XII",  4739, 5237),
    ("XIV",  5237, 5462),
    ("XV",   5462, 5785),
    ("XVI",  5785, 6316),
    ("XVIII",6316, 6655),
    ("XIX",  6655, 6779),
    ("XX",   6779, None),
]

# Running headers in 1656 OCR: "The Myfteries and Lawes" (odd pages) + page number lines
NOISE_PAT = re.compile(
    r"^The\s+My[sf]ter[iy]es\s+and\s+La[wv]e[sf]\s*$"
    r"|^\d{1,3}\s*$"
    r"|^[A-Z]\s*$"          # single capital letter fragments
    r"|^[a-z]\s*$"          # single lowercase letter fragments
    r"|^[-*]\s*$",
    re.IGNORECASE,
)

THEMES = [
    "rosicrucianism", "themis_aurea", "rosicrucian_laws",
    "hermetic_philosophy", "alchemy", "esoteric_christianity",
    "rosicrucian_fraternity", "michael_maier",
]
CROSS_TAGS = ["transformation", "divine_union", "consciousness", "transcendence"]


def _fetch_lines() -> list[str]:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text.split("\n")


def _clean_block(raw_lines: list[str]) -> str:
    cleaned = []
    for line in raw_lines:
        s = line.strip()
        if NOISE_PAT.match(s):
            continue
        cleaned.append(s if s else "")
    block = "\n".join(cleaned).strip()
    return re.sub(r"\n{3,}", "\n\n", block)


class ThemisAureaIngester(BaseIngester):
    tradition = "rosicrucianism"
    text_name = "themis_aurea"
    display_name = "Themis Aurea — The Laws of the Fraternity of the Rosie Crosse (1656)"
    source_url = f"https://archive.org/details/{ITEM_ID}"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        all_lines = _fetch_lines()
        total = len(all_lines)
        print(f"    Total lines: {total}")

        chunks = []
        for ch_num, start, end in CHAPTERS:
            raw = all_lines[start : (end if end else total)]
            block = _clean_block(raw)
            block = clean_text(block)

            if len(block) < 150:
                print(f"    Chapter {ch_num}: too short ({len(block)} chars), skipping")
                continue

            print(f"    Chapter {ch_num}: {len(block)} chars")

            label = (
                f"Themis Aurea — Chapter {ch_num}: Laws of the Rosicrucian Fraternity\n"
                "Michael Maier (1618); English translation London 1656\n\n"
            )
            for part in split_long_text(block):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Michael Maier",
                    "translator": "Anonymous (1656)",
                    "date_composed": "1618 CE",
                    "book": "1",
                    "chapter": ch_num,
                    "section": f"chapter_{ch_num.lower()}",
                    "content": label + part,
                    "priority": 3,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"chapter": ch_num, "year_original": 1618, "year_translation": 1656},
                })

        print(f"    Total chunks: {len(chunks)}")
        return chunks
