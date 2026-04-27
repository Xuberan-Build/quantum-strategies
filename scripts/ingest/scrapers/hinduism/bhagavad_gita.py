"""
Bhagavad Gita — Edwin Arnold translation "The Song Celestial" (1885, public domain)
Source: sacred-texts.com/hin/gita/ — 18 chapter pages (bg01.htm–bg18.htm)
Structure: one chunk per chapter; verse text extracted from body text.
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

BASE_URL = "https://sacred-texts.com/hin/gita/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# (chapter_num, slug, arnold_title, url)
CHAPTERS = [
    ("1",  "ch1",  "Of the Despondency of Arjuna",                            f"{BASE_URL}bg01.htm"),
    ("2",  "ch2",  "Of Doctrines",                                             f"{BASE_URL}bg02.htm"),
    ("3",  "ch3",  "Of Virtue in Work",                                        f"{BASE_URL}bg03.htm"),
    ("4",  "ch4",  "Of Religion by Knowledge",                                 f"{BASE_URL}bg04.htm"),
    ("5",  "ch5",  "Of Religion by Renouncing Fruit of Works",                 f"{BASE_URL}bg05.htm"),
    ("6",  "ch6",  "Of Religion by Self-Restraint",                            f"{BASE_URL}bg06.htm"),
    ("7",  "ch7",  "Of Religion by Discernment",                               f"{BASE_URL}bg07.htm"),
    ("8",  "ch8",  "Of Religion by Devotion to the One Supreme God",           f"{BASE_URL}bg08.htm"),
    ("9",  "ch9",  "Of Religion by the Kingly Knowledge and Kingly Mystery",   f"{BASE_URL}bg09.htm"),
    ("10", "ch10", "Of Religion by the Heavenly Perfections",                  f"{BASE_URL}bg10.htm"),
    ("11", "ch11", "Of the Manifesting of the One and Manifold",               f"{BASE_URL}bg11.htm"),
    ("12", "ch12", "Of Religion by Devotion",                                  f"{BASE_URL}bg12.htm"),
    ("13", "ch13", "Of Religion by Separation of Matter and Spirit",           f"{BASE_URL}bg13.htm"),
    ("14", "ch14", "Of Religion by Separation from the Qualities",             f"{BASE_URL}bg14.htm"),
    ("15", "ch15", "Of Religion by Attaining the Supreme",                     f"{BASE_URL}bg15.htm"),
    ("16", "ch16", "Of the Separateness of the Divine and Undivine",           f"{BASE_URL}bg16.htm"),
    ("17", "ch17", "Of Religion by the Threefold Kinds of Faith",              f"{BASE_URL}bg17.htm"),
    ("18", "ch18", "Of Religion by Deliverance and Renunciation",              f"{BASE_URL}bg18.htm"),
]

THEMES = [
    "hinduism", "bhagavad_gita", "krishna", "arjuna", "dharma", "yoga",
    "karma_yoga", "jnana_yoga", "bhakti_yoga", "consciousness", "atman", "brahman",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transformation", "ego_dissolution",
    "stages_of_development", "transcendence",
]

# Lines to discard from sacred-texts.com page boilerplate
_NOISE = re.compile(
    r'^(Sacred Texts|Hinduism|Index|Previous|Next|Buy this|Contents|'
    r'The Song Celestial|Bhagavad Gita|p\.\s*\d+|CHAPTER [IVXLC]+|'
    r'Sanskrit|English)\s*$',
    re.IGNORECASE,
)
# Skip bare page reference markers like "p. 12"
_PAGE_NUM = re.compile(r'^p\.\s*\d+\s*$', re.IGNORECASE)


def _scrape_chapter(url: str) -> str:
    """Fetch a chapter page and return cleaned verse text."""
    time.sleep(SCRAPE_DELAY)
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    body = soup.find("body")
    raw = body.get_text(separator="\n") if body else r.text

    kept = []
    for line in raw.split("\n"):
        stripped = line.strip()
        if not stripped:
            # preserve paragraph breaks
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if _NOISE.match(stripped):
            continue
        if _PAGE_NUM.match(stripped):
            continue
        # Drop short navigation fragments (single-word links like "Index", "Next")
        if len(stripped) <= 6 and stripped.isalpha():
            continue
        kept.append(stripped)

    # Collapse 3+ blank lines → 2
    text = "\n".join(kept)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return clean_text(text)


class BhagavadGitaIngester(BaseIngester):
    tradition = "hinduism"
    text_name = "bhagavad_gita"
    display_name = "Bhagavad Gita (Arnold, Song Celestial, 1885)"
    source_url = f"{BASE_URL}index.htm"

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for ch_num, ch_slug, ch_title, url in CHAPTERS:
            text = _scrape_chapter(url)
            print(f"    Chapter {ch_num} ({ch_title[:40]}): {len(text)} chars")

            parts = split_long_text(text)
            for part_i, part in enumerate(parts):
                part_label = f"part{part_i + 1}" if len(parts) > 1 else ""
                labeled = (
                    f"Bhagavad Gita — Chapter {ch_num}: {ch_title}\n"
                    f"Edwin Arnold translation (Song Celestial, 1885)\n\n{part}"
                )
                section_key = ch_slug
                if part_label:
                    section_key += f"_{part_label}"

                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Vyasa (attributed)",
                    "translator": "Edwin Arnold",
                    "date_composed": "~200 BCE – 200 CE",
                    "book": "1",
                    "chapter": ch_num,
                    "section": section_key,
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "chapter_number": int(ch_num),
                        "chapter_slug": ch_slug,
                        "chapter_title": ch_title,
                        "part": part_i + 1,
                        "total_parts": len(parts),
                        "translator": "Edwin Arnold",
                        "translation_year": 1885,
                    },
                })

        return all_chunks
