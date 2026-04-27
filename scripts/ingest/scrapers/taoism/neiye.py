"""
Neiye (Inner Training) — 10 English sections
Source: ctext.org/guanzi/nei-ye (AI + CTP English translation)
Strategy: one section per chunk via td.etext selector
"""
import re
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text

URL = "https://ctext.org/guanzi/nei-ye"

THEMES = ["breath", "cultivation", "stillness", "returning_root", "qi"]
CROSS_TAGS = ["breath_practice", "emptiness_void", "non_dual", "transformation"]

FOOTER_NOISE = {"Enjoy", "Site design", "Comments?", "Translation setting"}


class NeyieIngester(BaseIngester):
    tradition = "taoism"
    text_name = "neiye"
    display_name = "Neiye (Inner Training)"
    source_url = URL

    def get_chunks(self) -> list[dict]:
        html = self.fetch(URL)
        soup = BeautifulSoup(html, "lxml")

        raw_sections = []
        for td in soup.find_all("td", class_="etext"):
            text = clean_text(td.get_text(separator=" "))
            if len(text) > 80 and not any(text.startswith(n) for n in FOOTER_NOISE):
                raw_sections.append(text)

        chunks = []
        for i, section_text in enumerate(raw_sections):
            section_num = i + 1
            for part in split_long_text(section_text):
                labeled = f"Neiye (Inner Training) — Section {section_num}\n\n{part}"
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Attributed to Guan Zhong",
                    "translator": "CTP / AI Translation",
                    "date_composed": "~4th century BCE",
                    "chapter": str(section_num),
                    "section": f"section_{section_num}",
                    "content": labeled,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": URL,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"section_number": section_num},
                })

        print(f"    Parsed {len(raw_sections)} sections → {len(chunks)} chunks")
        return chunks
