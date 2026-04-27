"""
Secret Symbols of the Rosicrucians (Geheime Figuren, 1785/1788)
Franz Hartmann English translation, Boston: Occult Publishing Co., 1888
Source: archive.org / Franz-Hartmann-Secret-Symbols-of-the-Rosicrucians_djvu.txt

Three main sections:
  1. Introduction (by Hartmann) — lines ~154–1136
  2. Vocabulary of Occult Terms — lines ~1137–2612
  3. Part II: Alchemical Texts (Aureum Seculum, Parable, Allegory) — lines ~2613–end
"""
import re
import requests
import time
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

TEXT_URL = (
    "https://archive.org/download/franz-hartmann-secret-symbols-of-the-rosicrucians_202303"
    "/Franz-Hartmann-Secret-Symbols-of-the-Rosicrucians_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Running headers produced by OCR: strip these from every page
NOISE_PAT = re.compile(
    r"^\d+\s+THE\s+SECRET\s+SYMBOLS\s+OF\s+THE\s+ROSICRUCIANS\.$"
    r"|^I\d+\s+THE\s+SECRET\s+SYMBOLS\s+OF\s+THE\s+ROSICRUCIANS\.$"
    r"|^(INTRODUCTION|VOCABULARY\s+OF\s+OCCULT\s+TERMS|PARABLE|ALLEGORY)\.\s*\d+$"
    r"|^\d{1,3}\s*$",
    re.IGNORECASE,
)

SECTIONS = [
    ("introduction",   "Introduction",                  154,  1137),
    ("vocabulary",     "Vocabulary of Occult Terms",    1137, 2613),
    ("alchemical",     "Part II: Alchemical Texts",     2613, None),
]

THEMES = [
    "rosicrucianism", "secret_symbols", "occult_philosophy",
    "alchemy", "hermetic_philosophy", "rosicrucian_cosmology",
    "esoteric_christianity", "philosopher_stone",
]
CROSS_TAGS = ["transformation", "consciousness", "divine_union", "transcendence", "alchemy"]


def _fetch_lines() -> list[str]:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text.split("\n")


class SecretSymbolsRosicrucianIngester(BaseIngester):
    tradition = "rosicrucianism"
    text_name = "secret_symbols_rosicrucians"
    display_name = "Secret Symbols of the Rosicrucians — Franz Hartmann (1888)"
    source_url = "https://archive.org/details/franz-hartmann-secret-symbols-of-the-rosicrucians_202303"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        all_lines = _fetch_lines()
        total = len(all_lines)
        print(f"    Total lines: {total}")

        chunks = []
        for sec_id, sec_label, start, end in SECTIONS:
            raw = all_lines[start : (end if end else total)]
            cleaned = []
            for line in raw:
                s = line.strip()
                if NOISE_PAT.match(s):
                    continue
                cleaned.append(s if s else "")

            block = "\n".join(cleaned).strip()
            block = re.sub(r"\n{3,}", "\n\n", block)
            block = clean_text(block)

            if len(block) < 200:
                continue

            print(f"    Section {sec_id}: {len(block)} chars")

            label = (
                f"Secret Symbols of the Rosicrucians — {sec_label}\n"
                "Franz Hartmann / Original German (1785); English translation 1888\n\n"
            )
            for part in split_long_text(block):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Anonymous (Rosicrucian Brotherhood)",
                    "translator": "Franz Hartmann",
                    "date_composed": "1785 CE",
                    "book": "1",
                    "chapter": "1",
                    "section": sec_id,
                    "content": label + part,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"section": sec_id, "year_original": 1785, "year_translation": 1888},
                })

        print(f"    Total chunks: {len(chunks)}")
        return chunks
