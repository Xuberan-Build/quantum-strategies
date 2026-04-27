"""
I Ching (Yi King) — James Legge translation, Sacred Books of the East Vol. 16 (1882)
Source: archive.org mlbd.sacredbooksofeas0000fmax.vol.16
Structure: 64 hexagrams parsed from OCR text. Many hexagram names are garbled (OCR noise),
           so we number them sequentially 1–64 and include the canonical English names.
"""
import re
import requests
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

TEXT_URL = (
    "https://archive.org/download/mlbd.sacredbooksofeas0000fmax.vol.16/"
    "mlbd.sacredbooksofeas0000fmax.vol.16_djvu.txt"
)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Text content starts after the TOC and introduction (~4150 lines)
TEXT_START_LINE = 4149
# Main text ends around line 12000 (after hexagram LXIV), appendices follow
TEXT_END_LINE   = 12200

# Hexagram heading pattern: Roman numeral + period + content ending in "hexagram" (OCR-garbled)
# Examples: "I. THe AwHien HEXAGRAM.", "VI. Tue Sune HeExacram.", "XXX. Tue Lit Aexacnam."
HEX_PAT = re.compile(r'^([IVXLCl]+)\.\s+', re.IGNORECASE)
HEX_END = re.compile(r'(?:h.{0,4}x|aex)\w*\.\s*$', re.IGNORECASE)

# Running headers to drop: "SECT. I. THE SUNG HEXAGRAM. 69", "120 THE YI KING. TEXT."
PAGE_HDR = re.compile(
    r'^(SECT\.|[0-9]+\s+THE\s+Y[ÉIF\d]\s+KING|THE\s+Y[ÉIF\d]\s+KING\.?\s+TEXT)',
    re.IGNORECASE
)
NOISE_PAT = re.compile(r'^[-=~]+$|^\d+\s*$|^[A-Z]{1,4}\s*\d*\s*$')

# Canonical hexagram names (1–64) for labeling
HEXAGRAM_NAMES = [
    "1. Qian (Heaven / Creative)",
    "2. Kun (Earth / Receptive)",
    "3. Zhun (Difficulty at the Beginning)",
    "4. Meng (Youthful Folly)",
    "5. Xu (Waiting / Nourishment)",
    "6. Song (Conflict)",
    "7. Shi (The Army)",
    "8. Bi (Holding Together)",
    "9. Xiao Xu (Small Taming)",
    "10. Lu (Treading)",
    "11. Tai (Peace)",
    "12. Pi (Standstill)",
    "13. Tong Ren (Fellowship)",
    "14. Da You (Great Possession)",
    "15. Qian (Modesty)",
    "16. Yu (Enthusiasm)",
    "17. Sui (Following)",
    "18. Gu (Work on the Decayed)",
    "19. Lin (Approach)",
    "20. Guan (Contemplation)",
    "21. Shi He (Biting Through)",
    "22. Bi (Grace)",
    "23. Bo (Splitting Apart)",
    "24. Fu (Return)",
    "25. Wu Wang (Innocence)",
    "26. Da Xu (Great Taming)",
    "27. Yi (Corners of the Mouth)",
    "28. Da Guo (Great Exceeding)",
    "29. Kan (The Abysmal / Water)",
    "30. Li (The Clinging / Fire)",
    "31. Xian (Influence / Wooing)",
    "32. Heng (Duration)",
    "33. Dun (Retreat)",
    "34. Da Zhuang (Great Power)",
    "35. Jin (Progress)",
    "36. Ming Yi (Darkening of the Light)",
    "37. Jia Ren (The Family)",
    "38. Kui (Opposition)",
    "39. Jian (Obstruction)",
    "40. Jie (Deliverance)",
    "41. Sun (Decrease)",
    "42. Yi (Increase)",
    "43. Guai (Breakthrough)",
    "44. Gou (Coming to Meet)",
    "45. Cui (Gathering Together)",
    "46. Sheng (Pushing Upward)",
    "47. Kun (Oppression / Exhaustion)",
    "48. Jing (The Well)",
    "49. Ge (Revolution)",
    "50. Ding (The Cauldron)",
    "51. Zhen (The Arousing / Thunder)",
    "52. Gen (Keeping Still / Mountain)",
    "53. Jian (Development / Gradual Progress)",
    "54. Gui Mei (The Marrying Maiden)",
    "55. Feng (Abundance)",
    "56. Lu (The Wanderer)",
    "57. Xun (The Gentle / Wind)",
    "58. Dui (The Joyous / Lake)",
    "59. Huan (Dispersion)",
    "60. Jie (Limitation)",
    "61. Zhong Fu (Inner Truth)",
    "62. Xiao Guo (Small Exceeding)",
    "63. Ji Ji (After Completion)",
    "64. Wei Ji (Before Completion)",
]

THEMES = [
    "i_ching", "yi_king", "book_of_changes", "taoism", "divination",
    "chinese_philosophy", "trigrams", "hexagrams", "change_transformation",
]
CROSS_TAGS = [
    "transformation", "consciousness", "divine_union", "transcendence",
]


def _rn_to_int(rn: str) -> int:
    """Convert (OCR-garbled) Roman numeral string to integer."""
    vals = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}
    rn = rn.replace('l', 'I').replace('i', 'I').upper()
    result, prev = 0, 0
    for c in reversed(rn):
        curr = vals.get(c, 0)
        if curr < prev:
            result -= curr
        else:
            result += curr
        prev = curr
    return result


def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text


def _is_content_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if PAGE_HDR.match(stripped):
        return False
    if NOISE_PAT.match(stripped) and len(stripped) < 15:
        return False
    return True


def _parse_hexagrams(raw: str) -> list[tuple[int, str]]:
    """Returns list of (hex_num_1indexed, text). Sequential numbering."""
    lines = raw.split("\n")[TEXT_START_LINE:TEXT_END_LINE]

    # Find hexagram header positions
    hit_indices: list[int] = []
    for i, line in enumerate(lines):
        s = line.strip()
        m = HEX_PAT.match(s)
        if m and HEX_END.search(s) and len(s) < 65:
            hit_indices.append(i)

    if not hit_indices:
        return []

    hexagrams: list[tuple[int, str]] = []
    for idx, start in enumerate(hit_indices):
        end = hit_indices[idx + 1] if idx + 1 < len(hit_indices) else len(lines)
        block_lines = []
        for line in lines[start + 1:end]:
            if _is_content_line(line):
                block_lines.append(line.strip())
        block = "\n".join(block_lines).strip()
        block = re.sub(r"\n{3,}", "\n\n", block)
        block = clean_text(block)
        if len(block) >= 80:
            hexagrams.append((idx + 1, block))

    return hexagrams


class IChingIngester(BaseIngester):
    tradition = "taoism"
    text_name = "i_ching"
    display_name = "I Ching (Yi King)"
    source_url = "https://archive.org/details/mlbd.sacredbooksofeas0000fmax.vol.16"

    def get_chunks(self) -> list[dict]:
        print("    Fetching text from archive.org...")
        raw = _fetch_text()
        hexagrams = _parse_hexagrams(raw)
        print(f"    Found {len(hexagrams)} hexagram sections")

        all_chunks = []
        for seq, text in hexagrams:
            # Map sequential index to canonical hexagram name (allow for gaps)
            name = HEXAGRAM_NAMES[seq - 1] if 1 <= seq <= 64 else f"Hexagram {seq}"
            for part in split_long_text(text):
                labeled = (
                    f"I Ching — {name}\n"
                    f"James Legge translation, Sacred Books of the East Vol. 16 (1882)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Anonymous (Chinese traditional)",
                    "translator": "James Legge",
                    "date_composed": "~1000-700 BCE",
                    "book": "1",
                    "chapter": str(seq),
                    "section": f"hexagram_{seq}",
                    "content": labeled,
                    "priority": 2,
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {"hexagram": seq, "hexagram_name": name},
                })

        return all_chunks
