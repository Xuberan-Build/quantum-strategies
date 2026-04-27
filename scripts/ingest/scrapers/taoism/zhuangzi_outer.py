"""
Zhuangzi — Outer Chapters (8–22) and Miscellaneous Chapters (23–33)
Source: ctext.org (James Legge translation)
Strategy: same as inner chapters — one section per chunk via td.etext selector.
"""
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text

# (chapter_num, slug, title, url)
OUTER_CHAPTERS = [
    ("8",  "webbed_toes",        "Webbed Toes",
     "https://ctext.org/zhuangzi/webbed-toes"),
    ("9",  "horses_hoofs",       "Horses' Hoofs",
     "https://ctext.org/zhuangzi/horsess-hoofs"),
    ("10", "cutting_satchels",   "Cutting Open Satchels",
     "https://ctext.org/zhuangzi/cutting-open-satchels"),
    ("11", "letting_be",         "Letting Be, and Exercising Forbearance",
     "https://ctext.org/zhuangzi/letting-be-and-exercising-forbearance"),
    ("12", "heaven_earth",       "Heaven and Earth",
     "https://ctext.org/zhuangzi/heaven-and-earth"),
    ("13", "way_of_heaven",      "The Way of Heaven (Tian Dao)",
     "https://ctext.org/zhuangzi/tian-dao"),
    ("14", "revolution_heaven",  "The Revolution of Heaven",
     "https://ctext.org/zhuangzi/revolution-of-heaven"),
    ("15", "ingrained_ideas",    "Ingrained Ideas",
     "https://ctext.org/zhuangzi/ingrained-ideas"),
    ("16", "correcting_nature",  "Correcting the Nature",
     "https://ctext.org/zhuangzi/correcting-the-nature"),
    ("17", "floods_autumn",      "Floods of Autumn",
     "https://ctext.org/zhuangzi/floods-of-autumn"),
    ("18", "perfect_enjoyment",  "Perfect Enjoyment",
     "https://ctext.org/zhuangzi/perfect-enjoyment"),
    ("19", "full_understanding", "Full Understanding of Life",
     "https://ctext.org/zhuangzi/full-understanding-of-life"),
    ("20", "tree_on_mountain",   "The Tree on the Mountain",
     "https://ctext.org/zhuangzi/tree-on-the-mountain"),
    ("21", "tian_zi_fang",       "Tian Zi Fang",
     "https://ctext.org/zhuangzi/tian-zi-fang"),
    ("22", "knowledge_north",    "Knowledge Rambling in the North",
     "https://ctext.org/zhuangzi/knowledge-rambling-in-the-north"),
]

MISC_CHAPTERS = [
    ("23", "geng_sang_chu",      "Geng-Sang Chu",
     "https://ctext.org/zhuangzi/geng-sang-chu"),
    ("24", "xu_wu_gui",          "Xu Wu Gui",
     "https://ctext.org/zhuangzi/xu-wu-gui"),
    ("25", "ze_yang",            "Ze Yang",
     "https://ctext.org/zhuangzi/ze-yang"),
    ("26", "metaphorical",       "Metaphorical Language (Wai Wu)",
     "https://ctext.org/zhuangzi/metaphorical-language"),
    ("27", "from_without",       "What Comes From Without",
     "https://ctext.org/zhuangzi/what-comes-from-without"),
    ("28", "kings_resign",       "Kings Who Have Wished to Resign",
     "https://ctext.org/zhuangzi/kings-who-have-wished-to-resign"),
    ("29", "robber_zhi",         "Robber Zhi",
     "https://ctext.org/zhuangzi/robber-zhi"),
    ("30", "sword_fight",        "Delight in the Sword Fight",
     "https://ctext.org/zhuangzi/delight-in-the-sword-fight"),
    ("31", "old_fisherman",      "The Old Fisherman",
     "https://ctext.org/zhuangzi/old-fisherman"),
    ("32", "lie_yu_kou",         "Lie Yu Kou",
     "https://ctext.org/zhuangzi/lie-yu-kou"),
    ("33", "tian_xia",           "Tian Xia (All Under Heaven)",
     "https://ctext.org/zhuangzi/tian-xia"),
]

ALL_CHAPTERS = OUTER_CHAPTERS + MISC_CHAPTERS

THEMES = ["tao", "wu_wei", "emptiness", "return", "spontaneity", "non_action", "zhuangzi"]
CROSS_TAGS = ["emptiness_void", "non_dual", "transformation", "ego_dissolution", "stages_of_development"]

FOOTER_NOISE = {"Enjoy", "Site design", "Comments?", "Translation setting"}


class ZhuangziOuterIngester(BaseIngester):
    tradition = "taoism"
    text_name = "zhuangzi_outer"
    display_name = "Zhuangzi — Outer & Miscellaneous Chapters"
    source_url = "https://ctext.org/zhuangzi/outer-chapters"

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for ch_num, ch_slug, ch_title, url in ALL_CHAPTERS:
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
                        "book": "1",
                        "chapter": ch_num,
                        "section": f"ch{ch_num}_sec{sec_num}_{ch_slug}",
                        "content": labeled,
                        "priority": 2,
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
