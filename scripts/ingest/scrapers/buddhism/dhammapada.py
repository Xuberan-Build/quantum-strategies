"""
Dhammapada — F. Max Müller translation (1881, public domain)
Source: sacred-texts.com — Sacred Books of the East, Vol. 10
26 chapters, 423 verses. One chunk per chapter.
URL pattern: https://sacred-texts.com/bud/sbe10/sbe100{NN}.htm
Chapters 1–26 are sbe1003.htm through sbe1028.htm.
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

BASE_URL = "https://sacred-texts.com/bud/sbe10/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

CHAPTERS = [
    ( 1, "sbe1003.htm", "The Twin-Verses"),
    ( 2, "sbe1004.htm", "On Earnestness"),
    ( 3, "sbe1005.htm", "Thought"),
    ( 4, "sbe1006.htm", "Flowers"),
    ( 5, "sbe1007.htm", "The Fool"),
    ( 6, "sbe1008.htm", "The Wise Man (Pandita)"),
    ( 7, "sbe1009.htm", "The Venerable (Arhat)"),
    ( 8, "sbe1010.htm", "The Thousands"),
    ( 9, "sbe1011.htm", "Evil"),
    (10, "sbe1012.htm", "Punishment"),
    (11, "sbe1013.htm", "Old Age"),
    (12, "sbe1014.htm", "Self"),
    (13, "sbe1015.htm", "The World"),
    (14, "sbe1016.htm", "The Buddha (The Awakened)"),
    (15, "sbe1017.htm", "Happiness"),
    (16, "sbe1018.htm", "Pleasure"),
    (17, "sbe1019.htm", "Anger"),
    (18, "sbe1020.htm", "Impurity"),
    (19, "sbe1021.htm", "The Just"),
    (20, "sbe1022.htm", "The Way"),
    (21, "sbe1023.htm", "Miscellaneous"),
    (22, "sbe1024.htm", "The Downward Course"),
    (23, "sbe1025.htm", "The Elephant"),
    (24, "sbe1026.htm", "Thirst"),
    (25, "sbe1027.htm", "The Bhikshu (Mendicant)"),
    (26, "sbe1028.htm", "The Brâhmana (Arhat)"),
]

# Patterns to skip
_FOOTNOTE  = re.compile(r'^\s*\[')             # footnote lines start with [
_PAGE_NUM  = re.compile(r'^p\.\s*\d+\s*$')    # bare page numbers like "p. 45"
_NAV_NOISE = re.compile(
    r'^Sacred\s+Books|^Sacred\s+Texts|^Buddhism|^« Prev|^Next »|^«|^»',
    re.IGNORECASE
)

THEMES = [
    "buddhism", "dhammapada", "buddha", "dharma", "mind", "suffering",
    "nirvana", "impermanence", "non_attachment", "the_path", "awakening",
]
CROSS_TAGS = [
    "consciousness", "transformation", "ego_dissolution", "emptiness_void",
    "stages_of_development", "non_dual",
]


def _scrape_chapter(ch_num: int, filename: str, title: str) -> str:
    url = BASE_URL + filename
    time.sleep(SCRAPE_DELAY)
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    verse_lines: list[str] = []
    for p in soup.find_all("p"):
        text = p.get_text(separator=" ").strip()
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r'\bp\.\s*\d+\b', '', text).strip()  # strip inline page refs
        if not text or len(text) < 5:
            continue
        if _FOOTNOTE.match(text):
            continue
        if _PAGE_NUM.match(text):
            continue
        if _NAV_NOISE.match(text):
            continue
        # Skip book-level header (appears on every page)
        if "Sacred Books of the East" in text and "Müller" in text:
            continue
        # Skip all-caps chapter title line (e.g. "THE TWIN-VERSES.")
        if text.upper() == text and len(text) < 80:
            continue
        verse_lines.append(text)

    return "\n".join(verse_lines).strip()


class DhammapadaIngester(BaseIngester):
    tradition = "buddhism"
    text_name = "dhammapada"
    display_name = "Dhammapada (Max Müller, 1881)"
    source_url = BASE_URL + "index.htm"

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for ch_num, filename, title in CHAPTERS:
            print(f"    Chapter {ch_num}: {title}")
            chapter_text = _scrape_chapter(ch_num, filename, title)

            if not chapter_text or len(chapter_text) < 50:
                print(f"      WARNING: Chapter {ch_num} produced no text")
                continue

            for part in split_long_text(chapter_text):
                labeled = (
                    f"Dhammapada — Chapter {ch_num}: {title}\n"
                    f"F. Max Müller translation (1881)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Attributed to the Buddha (~3rd century BCE)",
                    "translator": "F. Max Müller",
                    "date_composed": "~3rd century BCE",
                    "book": "1",
                    "chapter": str(ch_num),
                    "section": f"ch{ch_num:02d}_{title.lower().replace(' ', '_').replace('(', '').replace(')', '')}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": BASE_URL + filename,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "chapter_number": ch_num,
                        "chapter_title": title,
                        "translator": "F. Max Müller",
                        "year_translated": 1881,
                        "series": "Sacred Books of the East, Vol. 10",
                    },
                })

        return all_chunks
