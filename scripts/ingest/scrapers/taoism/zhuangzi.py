"""
Zhuangzi — Inner Chapters 1–7
Source: ctext.org (James Legge translation)
Strategy: one section per chunk via td.etext selector, chapter tagged
"""
import re
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text

CHAPTERS = [
    ("1", "free_wandering",  "Enjoyment in Untroubled Ease (Free Wandering)",
     "https://ctext.org/zhuangzi/enjoyment-in-untroubled-ease"),
    ("2", "equalizing",      "The Adjustment of Controversies (Equalizing Things)",
     "https://ctext.org/zhuangzi/adjustment-of-controversies"),
    ("3", "nurturing_life",  "Nourishing the Lord of Life",
     "https://ctext.org/zhuangzi/nourishing-the-lord-of-life"),
    ("4", "human_world",     "Man in the World, Associated with Other Men",
     "https://ctext.org/zhuangzi/man-in-the-world-associated-with"),
    ("5", "signs_virtue",    "The Seal of Virtue Complete",
     "https://ctext.org/zhuangzi/seal-of-virtue-complete"),
    ("6", "prime_master",    "The Great and Most Honoured Master",
     "https://ctext.org/zhuangzi/great-and-most-honoured-master"),
    ("7", "emperors_kings",  "The Normal Course for Rulers and Kings",
     "https://ctext.org/zhuangzi/normal-course-for-rulers-and-kings"),
]

THEMES = ["tao", "wu_wei", "emptiness", "return", "spontaneity", "non_action"]
CROSS_TAGS = ["emptiness_void", "non_dual", "transformation", "ego_dissolution", "stages_of_development"]

FOOTER_NOISE = {"Enjoy", "Site design", "Comments?", "Translation setting"}


class ZhuangziIngester(BaseIngester):
    tradition = "taoism"
    text_name = "zhuangzi"
    display_name = "Zhuangzi — Inner Chapters"
    source_url = "https://ctext.org/zhuangzi/inner-chapters"

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for ch_num, ch_slug, ch_title, url in CHAPTERS:
            html = self.fetch(url)
            soup = BeautifulSoup(html, "lxml")

            raw_sections = []
            for td in soup.find_all("td", class_="etext"):
                text = clean_text(td.get_text(separator=" "))
                if len(text) > 80 and not any(text.startswith(n) for n in FOOTER_NOISE):
                    raw_sections.append(text)

            print(f"    Chapter {ch_num} ({ch_slug}): {len(raw_sections)} sections")

            for sec_i, section_text in enumerate(raw_sections):
                sec_num = sec_i + 1
                for part in split_long_text(section_text):
                    labeled = (
                        f"Zhuangzi — Chapter {ch_num}: {ch_title}\n"
                        f"Section {sec_num}\n\n{part}"
                    )
                    all_chunks.append({
                        "tradition": self.tradition,
                        "text_name": self.text_name,
                        "author": "Zhuangzi",
                        "translator": "James Legge",
                        "date_composed": "~4th–3rd century BCE",
                        "book": ch_num,
                        "chapter": ch_num,
                        "section": f"ch{ch_num}_sec{sec_num}_{ch_slug}",
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
                            "section_number": sec_num,
                        },
                    })

        return all_chunks
