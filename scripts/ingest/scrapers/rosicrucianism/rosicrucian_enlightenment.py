"""
Rosicrucian and Masonic Origins — Manly P. Hall (1929)
From "Lectures on Ancient Philosophy: An Introduction to the Study and
Application of Rational Procedure," The Hall Publishing Company, pp. 397-417.
Public domain (1929; entered US PD in 2025).

Source: archive.org / Rosicrucian_And_Masonic_Origins_-_Manly_P_Hall_djvu.txt

Note: Frances Yates "The Rosicrucian Enlightenment" (1972) is NOT public domain.
This Hall essay is the best available PD text on Rosicrucian historical context.
"""
import re
import requests
import time
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

TEXT_URL = (
    "https://archive.org/download/Rosicrucian_And_Masonic_Origins_-_Manly_P_Hall"
    "/Rosicrucian_And_Masonic_Origins_-_Manly_P_Hall_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

TEXT_START = 14   # First line of actual essay text
NOISE_PAT = re.compile(
    r"^\[p\s+\d+\]\s*$"        # page reference markers like "[p 398]"
    r"|^\[pp\s+[\d\-]+\]\s*$"  # multi-page references like "[pp 398-399]"
    r"|^\d{1,3}\s*$",
    re.IGNORECASE,
)

THEMES = [
    "rosicrucianism", "rosicrucian_history", "freemasonry",
    "hermetic_philosophy", "esoteric_christianity",
    "secret_society", "mystery_traditions", "manly_hall",
]
CROSS_TAGS = ["transformation", "consciousness", "divine_union", "transcendence"]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    lines = r.text.split("\n")
    cleaned = []
    for line in lines[TEXT_START:]:
        s = line.strip()
        if NOISE_PAT.match(s):
            continue
        cleaned.append(s if s else "")
    block = "\n".join(cleaned).strip()
    return re.sub(r"\n{3,}", "\n\n", block)


class RosicrucianEnlightenmentIngester(BaseIngester):
    tradition = "rosicrucianism"
    text_name = "rosicrucian_enlightenment"
    display_name = "Rosicrucian and Masonic Origins — Manly P. Hall (1929)"
    source_url = "https://archive.org/details/Rosicrucian_And_Masonic_Origins_-_Manly_P_Hall"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        block = _fetch_text()
        block = clean_text(block)
        print(f"    Essay block: {len(block)} chars")

        chunks = []
        label = (
            "Rosicrucian and Masonic Origins — Manly P. Hall (1929)\n"
            "From 'Lectures on Ancient Philosophy,' The Hall Publishing Company\n\n"
        )
        for part in split_long_text(block):
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Manly P. Hall",
                "translator": "",
                "date_composed": "1929 CE",
                "book": "1",
                "chapter": "1",
                "section": "rosicrucian_masonic_origins",
                "content": label + part,
                "priority": 3,
                "content_type": "secondary_commentary",
                "source_url": self.source_url,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {"year": 1929, "pages": "397-417"},
            })

        print(f"    Total chunks: {len(chunks)}")
        return chunks
