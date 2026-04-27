"""
Mahanirvana Tantra — Arthur Avalon (Sir John Woodroffe) translation, 1913
Source: archive.org (public domain)
Strategy: fetch DjVuTXT, split by chapter headers, chunk by paragraph.
14 chapters (Ullaasas) covering kulachara initiation, sacraments, mantras,
worship of Brahman, and Kali as Adyashakti.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/npsc_the-great-liberation-mahanirvana-tantra-arthur-avalon"
    "/The%20Great%20Liberation%20Mahanirvana%20Tantra%20-%20Arthur%20Avalon_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

CHAPTER_TITLES = {
    1:  "The Liberation of Beings",
    2:  "The Worship of Brahman",
    3:  "Instruction regarding the Mantras",
    4:  "Initiation",
    5:  "The Five Makara",
    6:  "Worship according to the Vedachara, Shaivachara, and Shaktachara",
    7:  "Puja: Worship of Brahman",
    8:  "Rites for the Attainment of Special Desires",
    9:  "The Ten Samskaras",
    10: "Atonement and Expiation",
    11: "The Ashrama Dharma",
    12: "The Worship of Shava",
    13: "Yoga",
    14: "Liberation",
}

THEMES = [
    "shakti", "kundalini", "ritual", "mantra", "kali", "brahman",
    "initiation", "tantra_practice", "liberation", "dharma",
]
CROSS_TAGS = [
    "transformation", "divine_union", "consciousness", "emptiness_void",
    "sacred_geometry",
]

# Patterns that indicate footnote text rather than main text
FOOTNOTE_PATTERN = re.compile(
    r"^[\d\$\*\'\`\^\!\#\@]+"    # starts with digit or footnote symbol incl $
    r"|\bSee\s+\w+\b"             # "See chapter..."
    r"|\bvide\s+\w+\b"            # "vide supra"
    r"|\bidem\b"
    r"|\bSanskrit\b.*?means"
    r"|\bIbid\b",
    re.IGNORECASE,
)


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _split_chapters(raw: str) -> list[tuple[int, str]]:
    """
    Returns list of (chapter_number, chapter_text).
    The file has two sets of CHAPTER headings; the actual text starts
    at the second occurrence of 'CHAPTER I' (after the TOC).
    """
    lines = raw.split("\n")
    chapter_pattern = re.compile(r"^CHAPTER\s+([IVXLC]+)\s*$")

    # Find all chapter-heading line indices
    chapter_hits: list[tuple[int, int]] = []  # (line_idx, chapter_num)
    roman_map = {
        "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7,
        "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13,
        "XIV": 14, "XV": 15,
    }
    for i, line in enumerate(lines):
        m = chapter_pattern.match(line.strip())
        if m:
            num = roman_map.get(m.group(1).upper(), 0)
            if num:
                chapter_hits.append((i, num))

    # The actual text starts at the 2nd occurrence of CHAPTER I
    first_i = None
    seen_i = 0
    actual_start_idx = 0
    for line_idx, ch_num in chapter_hits:
        if ch_num == 1:
            seen_i += 1
            if seen_i == 2:
                actual_start_idx = line_idx
                break

    # Filter to just the second pass of chapter headings
    actual_hits = [(li, cn) for li, cn in chapter_hits if li >= actual_start_idx]

    chapters = []
    for i, (line_idx, ch_num) in enumerate(actual_hits):
        end_idx = actual_hits[i + 1][0] if i + 1 < len(actual_hits) else len(lines)
        chapter_lines = lines[line_idx:end_idx]
        chapters.append((ch_num, "\n".join(chapter_lines)))

    return chapters


def _extract_paragraphs(chapter_text: str) -> list[str]:
    """
    Split chapter text into substantial paragraphs.
    Skips footnote-heavy or very short segments.
    """
    # Collapse OCR line breaks: single newlines within a paragraph → space
    # But double+ newlines stay as paragraph breaks
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", chapter_text)
    raw_paras = re.split(r"\n\n+", text)

    paras = []
    for p in raw_paras:
        p = p.strip()
        # Remove leftover single-character lines (OCR noise)
        p = re.sub(r"(?m)^\s*[A-Za-z]\s*$", "", p)
        p = re.sub(r"\n{3,}", "\n\n", p)
        p = p.strip()

        if len(p) < 180:
            continue

        # Skip paragraphs that are mostly footnotes
        lines = p.split("\n")
        non_footnote = [l for l in lines if l.strip() and not FOOTNOTE_PATTERN.match(l.strip())]
        if len(non_footnote) < max(1, len(lines) // 3):
            continue

        paras.append(p)

    return paras


class MahanirvanaTantraIngester(BaseIngester):
    tradition = "tantra"
    text_name = "mahanirvana_tantra"
    display_name = "Mahanirvana Tantra"
    source_url = "https://archive.org/details/npsc_the-great-liberation-mahanirvana-tantra-arthur-avalon"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        chapters = _split_chapters(raw)
        print(f"    Found {len(chapters)} chapters")

        all_chunks = []
        for ch_num, ch_text in chapters:
            title = CHAPTER_TITLES.get(ch_num, f"Chapter {ch_num}")
            print(f"      Chapter {ch_num} ({title}): ", end="", flush=True)
            paragraphs = _extract_paragraphs(ch_text)
            print(f"{len(paragraphs)} paragraphs")

            for p_i, para in enumerate(paragraphs):
                para = clean_text(para)
                for part in split_long_text(para):
                    labeled = (
                        f"Mahanirvana Tantra — Chapter {ch_num}: {title}\n"
                        f"Paragraph {p_i + 1}\n\n{part}"
                    )
                    all_chunks.append({
                        "tradition": self.tradition,
                        "text_name": self.text_name,
                        "author": "Unknown",
                        "translator": "Arthur Avalon (Sir John Woodroffe)",
                        "date_composed": "~11th–12th century CE",
                        "book": str(ch_num),
                        "chapter": str(ch_num),
                        "verse": str(p_i + 1),
                        "section": f"chapter_{ch_num}",
                        "content": labeled,
                        "priority": 1,
                        "content_type": "primary_canon",
                        "source_url": (
                            "https://archive.org/details/"
                            "npsc_the-great-liberation-mahanirvana-tantra-arthur-avalon"
                        ),
                        "language": "english",
                        "themes": THEMES,
                        "cross_tradition_tags": CROSS_TAGS,
                        "metadata": {
                            "chapter": ch_num,
                            "chapter_title": title,
                            "paragraph": p_i + 1,
                        },
                    })

        return all_chunks
