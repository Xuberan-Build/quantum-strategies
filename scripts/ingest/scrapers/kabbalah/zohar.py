"""
Zohar — Bereishit (Genesis)
Source: Sefaria API (Pritzker/Community English translation)
Strategy: iterate chapters 1–200, collect non-empty English paragraphs,
          one paragraph per chunk. Skip chapters with no English.
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

# Probe up to this chapter — stops early on consecutive empty chapters
MAX_CHAPTER = 200
CONSECUTIVE_EMPTY_STOP = 15  # stop if 15 empty chapters in a row


@retry(stop=stop_after_attempt(4), wait=wait_exponential(min=3, max=30))
def fetch_zohar_chapter(section: str, ch: int) -> list[str]:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(
        f"{API_BASE}/Zohar,_{section}.{ch}",
        headers=HEADERS,
        params={"lang": "en"},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    raw = data.get("text", [])
    cleaned = []
    for item in raw:
        if not item:
            continue
        text = BeautifulSoup(str(item), "lxml").get_text(separator=" ")
        text = clean_text(text)
        if len(text) > 40:
            cleaned.append(text)
    return cleaned


SECTIONS = [
    {
        "section": "Bereshit",
        "display": "Bereishit (Genesis)",
        "priority": 1,
        "themes": ["creation", "ein_sof", "light", "darkness", "concealed_point"],
        "cross_tags": ["cosmogony", "emptiness_void", "divine_union", "transformation"],
    },
]


class ZoharIngester(BaseIngester):
    tradition = "kabbalah"
    text_name = "zohar"
    display_name = "Zohar — Bereishit"
    source_url = "https://www.sefaria.org/Zohar,_Bereshit"

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for sec in SECTIONS:
            section = sec["section"]
            print(f"    Section: {sec['display']}")
            chunks_this_section = 0
            consecutive_empty = 0

            for ch in range(1, MAX_CHAPTER + 1):
                try:
                    paras = fetch_zohar_chapter(section, ch)
                except Exception as e:
                    print(f"      Ch {ch}: error {e}, stopping section")
                    break

                if not paras:
                    consecutive_empty += 1
                    if consecutive_empty >= CONSECUTIVE_EMPTY_STOP:
                        print(f"      Ch {ch}: {consecutive_empty} consecutive empty, stopping")
                        break
                    continue

                consecutive_empty = 0

                for p_i, para_text in enumerate(paras):
                    for part in split_long_text(para_text):
                        labeled = (
                            f"Zohar — {sec['display']}\n"
                            f"Chapter {ch}, Paragraph {p_i + 1}\n\n{part}"
                        )
                        all_chunks.append({
                            "tradition": self.tradition,
                            "text_name": self.text_name,
                            "translator": "Sefaria Community / Pritzker Edition",
                            "date_composed": "~13th century CE (core); compiled earlier",
                            "book": section,
                            "chapter": str(ch),
                            "verse": str(p_i + 1),
                            "section": f"{section}_ch{ch}",
                            "content": labeled,
                            "priority": sec["priority"],
                            "content_type": "primary_canon",
                            "source_url": f"https://www.sefaria.org/Zohar,_{section}.{ch}.{p_i+1}",
                            "language": "english",
                            "themes": sec["themes"],
                            "cross_tradition_tags": sec["cross_tags"],
                            "metadata": {
                                "zohar_section": section,
                                "chapter": ch,
                                "paragraph": p_i + 1,
                            },
                        })
                        chunks_this_section += 1

                if ch % 20 == 0:
                    print(f"      Ch {ch}: {chunks_this_section} chunks so far")

            print(f"    {sec['display']}: {chunks_this_section} chunks total")

        return all_chunks
