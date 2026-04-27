"""
Real History of the Rosicrucians — A.E. Waite (1887)
Source: archive.org / Waite-A-E-Real-History-of-the-Rosicrucians_djvu.txt

Covers Waite's own scholarly commentary chapters:
  - Chapters I-II  (lines ~1326-2741): historical background, Paracelsus
  - Chapters VI-XVI (lines ~9517-end): alchemy, apologists, France, Freemasonry

Chapters III, IV, V (Fama, Confessio, Chymical Wedding) have their own scrapers.
"""
import re
import requests
import time
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

TEXT_URL = (
    "https://archive.org/download/real-history-of-the-rosicrucians-by-a.e.-waite"
    "/Waite-A-E-Real-History-of-the-Rosicrucians_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Chapter line boundaries (0-indexed from split('\n'))
# Chapters III/IV/V are already scraped; skip them.
CHAPTERS = [
    ("I",   "On the State of Mystical Philosophy in Germany at the Close of the Sixteenth Century",  1326, 1608),
    ("II",  "The Prophecy of Paracelsus and the Universal Reformation of the Whole Wide World",      1608, 2742),
    ("VI",  "On the Connection of the Rosicrucian Claims with those of Alchemy and Magic",           9517, 10060),
    ("VII", "Antiquity of the Rosicrucian Fraternity",                                               10060, 10328),
    ("VIII","The Case of Johann Valentin Andreas",                                                    10328, 11475),
    ("IX",  "Progress of Rosicrucianism in Germany",                                                 11475, 12343),
    ("X",   "Rosicrucian Apologists: Michael Maier",                                                 12343, 12936),
    ("XI",  "Rosicrucian Apologists: Robert Fludd",                                                  12936, 13959),
    ("XII", "Rosicrucian Apologists: Thomas Vaughan",                                                13959, 14224),
    ("XIII","Rosicrucian Apologists: John Heydon",                                                   14224, 16989),
    ("XIV", "Rosicrucianism in France",                                                              16989, 17568),
    ("XV",  "Connection Between the Rosicrucians and Freemasons",                                    17568, 17792),
    ("XVI", "Modern Rosicrucian Societies",                                                          17792, None),
]

NOISE_PAT = re.compile(
    r"^HISTORY\s+OF\s+THE\s+ROSICRUCIANS\.\s*\d+\s*$"
    r"|^REAL\s+HISTORY\s+OF\s+THE\s+ROSICRUCIANS\.\s*\d+\s*$"
    r"|^\d{1,3}\s*$"
    r"|^-\s*\d+\s*-$"
    r"|^[A-Z\s]{6,50}\.\s+\d+\s*$",  # running chapter title + page num
    re.IGNORECASE,
)

THEMES = [
    "rosicrucianism", "rosicrucian_history", "hermetic_philosophy",
    "alchemy", "esoteric_christianity", "secret_society",
    "michael_maier", "paracelsus", "rosicrucian_manifestos",
]
CROSS_TAGS = ["transformation", "consciousness", "divine_union", "transcendence"]


def _fetch_lines() -> list[str]:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text.split("\n")


class RealHistoryRosicrucianIngester(BaseIngester):
    tradition = "rosicrucianism"
    text_name = "real_history_rosicrucians"
    display_name = "The Real History of the Rosicrucians — A.E. Waite (1887)"
    source_url = "https://archive.org/details/real-history-of-the-rosicrucians-by-a.e.-waite"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        all_lines = _fetch_lines()
        total = len(all_lines)
        print(f"    Total lines in source: {total}")

        chunks = []
        for ch_num, ch_title, start, end in CHAPTERS:
            block_lines = all_lines[start : (end if end else total)]
            cleaned = []
            for line in block_lines:
                s = line.strip()
                if NOISE_PAT.match(s):
                    continue
                cleaned.append(s if s else "")

            block = "\n".join(cleaned).strip()
            block = re.sub(r"\n{3,}", "\n\n", block)
            block = clean_text(block)

            if len(block) < 200:
                print(f"    Chapter {ch_num} too short ({len(block)} chars), skipping")
                continue

            print(f"    Chapter {ch_num}: {len(block)} chars")

            label = (
                f"The Real History of the Rosicrucians — Chapter {ch_num}: {ch_title}\n"
                "A.E. Waite (1887)\n\n"
            )
            for part in split_long_text(block):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "A.E. Waite",
                    "translator": "",
                    "date_composed": "1887 CE",
                    "book": "1",
                    "chapter": ch_num,
                    "section": f"chapter_{ch_num.lower()}",
                    "content": label + part,
                    "priority": 2,
                    "content_type": "secondary_commentary",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"chapter": ch_num, "chapter_title": ch_title, "year": 1887},
                })

        print(f"    Total chunks: {len(chunks)}")
        return chunks
