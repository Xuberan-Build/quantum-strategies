"""
Liezi — 8 chapters (attributed to Lie Yukou, ~4th century BCE)
Source: ctext.org (Leon Wieger translation)
Structure: 8 chapters scraped via td.etext selector.
"""
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text

CHAPTERS = [
    ("1", "tian_rui",   "Tian Rui (Heaven's Gifts)",
     "https://ctext.org/liezi/tian-rui"),
    ("2", "huang_di",   "Huang Di (The Yellow Emperor)",
     "https://ctext.org/liezi/huang-di"),
    ("3", "zhou_mu",    "Zhou Mu Wang (King Mu of Zhou)",
     "https://ctext.org/liezi/zhou-mu-wang"),
    ("4", "zhong_ni",   "Zhong Ni (Confucius)",
     "https://ctext.org/liezi/zhong-ni"),
    ("5", "tang_wen",   "Tang Wen (Tang's Questions)",
     "https://ctext.org/liezi/tang-wen"),
    ("6", "li_ming",    "Li Ming (Effort and Destiny)",
     "https://ctext.org/liezi/li-ming"),
    ("7", "yang_zhu",   "Yang Zhu",
     "https://ctext.org/liezi/yang-zhu"),
    ("8", "shuo_fu",    "Shuo Fu (Explaining Conjunctions)",
     "https://ctext.org/liezi/shuo-fu"),
]

THEMES = [
    "taoism", "liezi", "wu_wei", "emptiness", "fate_destiny",
    "chinese_philosophy", "transformation", "non_action",
]
CROSS_TAGS = [
    "emptiness_void", "non_dual", "transformation", "ego_dissolution",
]

FOOTER_NOISE = {"Enjoy", "Site design", "Comments?", "Translation setting"}


class LieziIngester(BaseIngester):
    tradition = "taoism"
    text_name = "liezi"
    display_name = "Liezi"
    source_url = "https://ctext.org/liezi"

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
                        f"Liezi — Chapter {ch_num}: {ch_title}\n"
                        f"Section {sec_num}\n\n{part}"
                    )
                    all_chunks.append({
                        "tradition": self.tradition,
                        "text_name": self.text_name,
                        "author": "Lie Yukou (attributed)",
                        "translator": "Leon Wieger",
                        "date_composed": "~4th century BCE",
                        "book": "1",
                        "chapter": ch_num,
                        "section": f"ch{ch_num}_sec{sec_num}_{ch_slug}",
                        "content": labeled,
                        "priority": 3,
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
