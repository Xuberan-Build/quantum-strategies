"""
Tao Te Ching — 81 chapters
Source: classics.mit.edu plain-text version (James Legge translation, public domain)
Strategy: parse all 81 chapters from one .txt file, one chunk per chapter
"""
import re
from scrapers.base import BaseIngester
from chunk_utils import clean_text

TEXT_URL = "https://classics.mit.edu/Lao/taote.mb.txt"

THEMES = ["tao", "wu_wei", "emptiness", "return", "unity", "non_action"]
CROSS_TAGS = ["emptiness_void", "non_dual", "transformation", "ego_dissolution"]


class TaoTeChingIngester(BaseIngester):
    tradition = "taoism"
    text_name = "tao_te_ching"
    display_name = "Tao Te Ching (MIT Classics)"
    source_url = TEXT_URL

    def get_chunks(self) -> list[dict]:
        raw = self.fetch(TEXT_URL)

        # Split on "Chapter N" headings
        # Pattern: "Chapter " followed by digits, at start of a line or after newline
        parts = re.split(r"\n(Chapter\s+\d+)\s*\n", raw)

        # parts = [preamble, "Chapter 1", body1, "Chapter 2", body2, ...]
        # Zip heading + body pairs
        chunks = []
        for i in range(1, len(parts) - 1, 2):
            heading = parts[i].strip()       # "Chapter N"
            body = parts[i + 1]

            # Extract chapter number
            m = re.search(r"\d+", heading)
            if not m:
                continue
            chapter_num = int(m.group())

            content = clean_text(body)

            # Drop everything after "THE END" or next-page navigation
            content = re.sub(r"THE END.*", "", content, flags=re.S).strip()
            content = re.sub(r"\[Go to.*?\]", "", content).strip()

            if not content or len(content) < 20:
                print(f"    Chapter {chapter_num}: empty after clean, skipping")
                continue

            labeled = f"Tao Te Ching — Chapter {chapter_num}\n\n{content}"

            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Laozi",
                "translator": "James Legge",
                "date_composed": "~600–400 BCE",
                "chapter": str(chapter_num),
                "content": labeled,
                "priority": 1,
                "content_type": "primary_canon",
                "source_url": TEXT_URL,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {"chapter_number": chapter_num},
            })

        print(f"    Parsed {len(chunks)} chapters")
        return chunks
