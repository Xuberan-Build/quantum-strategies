"""
Sefer Yetzirah (Book of Formation) — 6 chapters, 48 mishnahs
Source: Sefaria API (Sefaria Community Translation)
Strategy: one mishnah per chunk via chapter array fetch
"""
import time
import re
import requests
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

API_BASE = "https://www.sefaria.org/api/texts"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# 6 chapters — lengths discovered via API: [6, 48]
CHAPTER_COUNT = 6

THEMES = ["sefirot", "letters", "creation", "cosmology", "32_paths"]
CROSS_TAGS = ["cosmogony", "sacred_geometry", "transformation", "divine_union"]


@retry(stop=stop_after_attempt(4), wait=wait_exponential(min=2, max=20))
def fetch_chapter(ch: int) -> list[str]:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(
        f"{API_BASE}/Sefer_Yetzirah.{ch}",
        headers=HEADERS,
        params={"lang": "en"},
        timeout=25,
    )
    r.raise_for_status()
    data = r.json()
    raw = data.get("text", [])
    # Strip HTML tags from each mishnah text
    cleaned = []
    for item in raw:
        if not item:
            continue
        text = BeautifulSoup(str(item), "lxml").get_text(separator=" ")
        text = clean_text(text)
        if len(text) > 20:
            cleaned.append(text)
    return cleaned


class SeferYetzirahIngester(BaseIngester):
    tradition = "kabbalah"
    text_name = "sefer_yetzirah"
    display_name = "Sefer Yetzirah"
    source_url = "https://www.sefaria.org/Sefer_Yetzirah"

    def get_chunks(self) -> list[dict]:
        chunks = []

        for ch in range(1, CHAPTER_COUNT + 1):
            mishnahs = fetch_chapter(ch)
            print(f"    Chapter {ch}: {len(mishnahs)} mishnahs")

            for m_i, text in enumerate(mishnahs):
                mishnah_num = m_i + 1
                for part in split_long_text(text):
                    labeled = (
                        f"Sefer Yetzirah — Chapter {ch}, Mishnah {mishnah_num}\n\n{part}"
                    )
                    chunks.append({
                        "tradition": self.tradition,
                        "text_name": self.text_name,
                        "author": "Attributed to Abraham / Ancient",
                        "translator": "Sefaria Community Translation",
                        "date_composed": "~2nd century BCE – 2nd century CE",
                        "book": str(ch),
                        "chapter": str(ch),
                        "verse": str(mishnah_num),
                        "content": labeled,
                        "priority": 1,
                        "content_type": "primary_canon",
                        "source_url": f"https://www.sefaria.org/Sefer_Yetzirah.{ch}.{mishnah_num}",
                        "language": "english",
                        "themes": THEMES,
                        "cross_tradition_tags": CROSS_TAGS,
                        "metadata": {
                            "chapter": ch,
                            "mishnah": mishnah_num,
                        },
                    })

        return chunks
