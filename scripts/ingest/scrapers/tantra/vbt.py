"""
Vijnana Bhairava Tantra — Jaideva Singh translation, 1979
"Divine Consciousness: A Treasury of 112 Types of Yoga"
Source: archive.org (Motilal Banarsidass Publishers)
Strategy: fetch DjVuTXT, parse [Dharana N] markers, one chunk per dharana.
Each chunk includes the verse number, translation, and expository notes.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/"
    "JaidevaSinghVijnanabhairavaOrDivineConsciousnessATreasuryOf112TypesOfYoga"
    "/Jaideva%20Singh%20-Vijnanabhairava-or-Divine-Consciousness-A-Treasury-of-112-Types-of-Yoga_djvu.txt"
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

THEMES = [
    "consciousness", "meditation", "prana", "shakti", "shiva",
    "breath", "void", "mantra", "samadhi", "awareness",
]
CROSS_TAGS = [
    "emptiness_void", "transformation", "divine_union",
    "consciousness", "transcendence",
]


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _clean_ocr_line(line: str) -> str:
    """Fix common OCR artifacts in this specific scan."""
    # Multiple internal spaces → single space
    line = re.sub(r"  +", " ", line)
    # Hyphenation at line end: "medi- tation" → "meditation"
    line = re.sub(r"-\s+", "", line)
    return line


def _parse_dharanas(raw: str) -> list[tuple[int, str]]:
    """
    Split the VBT text into per-verse blocks using VERSE N markers.
    Dharanas start at verse 24 (Dharana 1 = Verse 24).
    Returns list of (dharana_number, block_text).
    Stops at verse 136 (end of dharanas section).
    """
    lines = raw.split("\n")
    verse_pattern = re.compile(r"^VERSE\s+(\d+)\s*$")

    # Find all VERSE N line indices
    starts: list[tuple[int, int]] = []  # (line_idx, verse_num)
    for i, line in enumerate(lines):
        m = verse_pattern.match(line.strip())
        if m:
            starts.append((i, int(m.group(1))))

    if not starts:
        return []

    # Filter to dharana range: verses 24–135 (dharanas 1–112)
    dharana_starts = [(li, vn) for li, vn in starts if 24 <= vn <= 135]

    dharanas = []
    for i, (line_idx, v_num) in enumerate(dharana_starts):
        # End at the next verse (within the full list) or EOF
        full_idx = starts.index((line_idx, v_num))
        end_idx = starts[full_idx + 1][0] if full_idx + 1 < len(starts) else len(lines)
        block_lines = lines[line_idx:end_idx]
        d_num = v_num - 23  # verse 24 = dharana 1
        dharanas.append((d_num, "\n".join(block_lines)))

    return dharanas


def _clean_dharana_block(block: str) -> str:
    """
    Clean a single dharana block:
    - Remove Devanagari Sanskrit lines (non-ASCII characters dominating the line)
    - Fix OCR spacing artifacts
    - Collapse whitespace
    """
    lines = block.split("\n")
    cleaned = []
    for line in lines:
        # Skip lines that are predominantly Devanagari (non-ASCII > 40% of chars)
        non_ascii = sum(1 for c in line if ord(c) > 127)
        if len(line) > 5 and non_ascii / max(len(line), 1) > 0.3:
            continue
        cleaned.append(_clean_ocr_line(line))

    text = "\n".join(cleaned)
    # Collapse 3+ blank lines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class VBTIngester(BaseIngester):
    tradition = "tantra"
    text_name = "vijnana_bhairava_tantra"
    display_name = "Vijnana Bhairava Tantra"
    source_url = "https://archive.org/details/JaidevaSinghVijnanabhairavaOrDivineConsciousnessATreasuryOf112TypesOfYoga"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()

        print("    Parsing dharanas...")
        dharanas = _parse_dharanas(raw)
        print(f"    Found {len(dharanas)} dharanas")

        all_chunks = []
        for d_num, block in dharanas:
            block_clean = _clean_dharana_block(block)
            if len(block_clean) < 100:
                continue

            v_num = d_num + 23  # dharana 1 = verse 24
            labeled = (
                f"Vijnana Bhairava Tantra — Dharana {d_num} (of 112), Verse {v_num}\n\n"
                f"{block_clean}"
            )

            for part in split_long_text(labeled):
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Vasugupta (attr.)",
                    "translator": "Jaideva Singh",
                    "date_composed": "~9th–10th century CE",
                    "book": "1",
                    "chapter": str(d_num),
                    "verse": str(d_num),
                    "section": f"dharana_{d_num}",
                    "content": part,
                    "priority": 1,
                    "content_type": "primary_canon",
                    "source_url": (
                        "https://archive.org/details/"
                        "JaidevaSinghVijnanabhairavaOrDivineConsciousnessATreasuryOf112TypesOfYoga"
                    ),
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "dharana": d_num,
                        "total_dharanas": 112,
                    },
                })

        return all_chunks
