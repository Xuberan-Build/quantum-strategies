"""
Fama Fraternitatis (1614) — first Rosicrucian manifesto
Source: A.E. Waite, "The Real History of the Rosicrucians" (1887) — archive.org
        Chapter III (lines ~2779–3554) contains full English translation.
Running headers ("FAMA FRATERNITATIS. NN") stripped as noise.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/real-history-of-the-rosicrucians-by-a.e.-waite"
    "/Waite-A-E-Real-History-of-the-Rosicrucians_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

NOISE_PAT = re.compile(
    r"^FAMA\s+FRATERNITATIS\.\s*\d+\s*$"
    r"|^HISTORY\s+OF\s+THE\s+ROSICRUCIANS\.\s*\d+\s*$"
    r"|^\d{1,3}\s*$|^-\s*\d+\s*-$",
    re.IGNORECASE,
)
START_PAT = re.compile(r"^Fama Fraternitatis; or, a Discovery")
END_PAT   = re.compile(r"^CHAPTER IV\.")

THEMES = [
    "rosicrucian", "fama_fraternitatis", "rosicrucian_manifesto",
    "esoteric_christianity", "hermetic_philosophy", "spiritual_reformation",
    "christian_brotherhood", "secret_society",
]
CROSS_TAGS = ["transformation", "divine_union", "transcendence", "consciousness"]


def _fetch_section() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    lines = r.text.split("\n")
    collecting = False
    block_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not collecting:
            if START_PAT.match(stripped):
                collecting = True
                block_lines.append(stripped)
        else:
            if END_PAT.match(stripped):
                break
            if NOISE_PAT.match(stripped):
                continue
            block_lines.append(stripped if stripped else "")
    block = "\n".join(block_lines).strip()
    return re.sub(r"\n{3,}", "\n\n", block)


class FamaFraternitatisIngester(BaseIngester):
    tradition = "rosicrucianism"
    text_name = "fama_fraternitatis"
    display_name = "Fama Fraternitatis"
    source_url = "https://archive.org/details/real-history-of-the-rosicrucians-by-a.e.-waite"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        block = _fetch_section()
        block = clean_text(block)
        print(f"    Fama block: {len(block)} chars")

        all_chunks = []
        for part in split_long_text(block):
            labeled = (
                "Fama Fraternitatis — Rosicrucian Manifesto (1614)\n"
                "A.E. Waite translation / The Real History of the Rosicrucians (1887)\n\n"
                + part
            )
            all_chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Anonymous (Rosicrucian Brotherhood)",
                "translator": "A. E. Waite",
                "date_composed": "1614 CE",
                "book": "1",
                "chapter": "1",
                "section": "fama",
                "content": labeled,
                "priority": 1,
                "content_type": "primary_canon",
                "source_url": self.source_url,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {"manifesto": "fama_fraternitatis", "year": 1614},
            })
        return all_chunks
