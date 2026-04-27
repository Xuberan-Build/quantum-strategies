"""
Five Core Upanishads — F. Max Müller translation (Sacred Books of the East, 1879/1884)
Sources:
  Isa, Kena  → sacred-texts.com/hin/sbe01/ (SBE Vol. 1, Upanishads Part I)
  Katha, Mundaka → sacred-texts.com/hin/sbe15/ (SBE Vol. 15, Upanishads Part II)
  Mandukya → Hume 1921 translation, hardcoded (13 Principal Upanishads, public domain)

All translations are pre-1928 and fully in the public domain.
"""
import re
import time
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Noise lines common to all sacred-texts.com SBE pages
_NOISE = re.compile(
    r'^(Sacred Texts|Hinduism|Index|Previous|Next|Buy this|Contents|'
    r'Upanishads|Sacred Books|East|p\.\s*\d+)\s*$',
    re.IGNORECASE,
)
_PAGE_NUM = re.compile(r'^p\.\s*\d+\s*$', re.IGNORECASE)
# Bare footnote numbers (1, 2, 12, etc.) that appear alone on a line
_FOOTNOTE_NUM = re.compile(r'^\d{1,3}\s*$')
# Lines that are likely OCR artifacts: single or two ALLCAPS chars (split Sanskrit)
_OCR_FRAGMENT = re.compile(r'^[A-Z]{1,3}$')

THEMES = [
    "hinduism", "vedanta", "upanishads", "atman", "brahman", "consciousness",
    "self_inquiry", "non_duality", "advaita", "turiya", "om", "moksha",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transcendence", "non_duality",
    "ego_dissolution", "inner_kingdom", "stillness",
]

# ---------------------------------------------------------------------------
# Per-upanishad configuration
# Each entry has start_url, base_url (for resolving relative Next hrefs),
# max_pages (how many sequential pages to follow at most), and
# title_keyword used to verify we haven't wandered into a different text.
# ---------------------------------------------------------------------------
_SBE01 = "https://sacred-texts.com/hin/sbe01/"
_SBE15 = "https://sacred-texts.com/hin/sbe15/"

UPANISHADS_CONFIG = [
    {
        "name":     "isa",
        "display":  "Isa Upanishad",
        "start":    _SBE01 + "sbe01243.htm",
        "base":     _SBE01,
        "max_pages": 2,
        "keyword":  "isa",          # must appear (case-insensitive) in page body
        "date":     "~800–600 BCE",
        "priority": 1,
    },
    {
        "name":     "kena",
        "display":  "Kena Upanishad",
        "start":    _SBE01 + "sbe01018.htm",
        "base":     _SBE01,
        "max_pages": 3,
        "keyword":  "talavakara",   # sacred-texts uses the alternative name
        "date":     "~700–500 BCE",
        "priority": 1,
    },
    {
        "name":     "katha",
        "display":  "Katha Upanishad",
        "start":    _SBE15 + "sbe15003.htm",
        "base":     _SBE15,
        "max_pages": 8,
        "keyword":  "katha",
        "date":     "~500–200 BCE",
        "priority": 1,
    },
    {
        "name":     "mundaka",
        "display":  "Mundaka Upanishad",
        "start":    _SBE15 + "sbe15004.htm",
        "base":     _SBE15,
        "max_pages": 6,
        "keyword":  "mundaka",
        "date":     "~500–200 BCE",
        "priority": 1,
    },
]

# ---------------------------------------------------------------------------
# Mandukya — hardcoded (Hume 1921 public domain translation)
# 12 mantras: the shortest and most philosophically concentrated Upanishad
# ---------------------------------------------------------------------------
MANDUKYA_TEXT = """\
Mandukya Upanishad
Translated by Robert Ernest Hume (The Thirteen Principal Upanishads, Oxford, 1921)

1. Om! — This syllable is all this [world]. Its further explanation is: — The past, the present, the future — everything is just the word Om. And whatever else that transcends threefold time — that too is just the word Om.

2. For truly, everything here is Brahman; this self (Atman) is Brahman. This same self has four quarters (padas).

3. The waking state (jagrita-sthana), outwardly cognitive, having seven members, having nineteen mouths, enjoying the gross (sthula), the Common-to-all-men (Vaishvanara) is the first quarter.

4. The dreaming state (svapna-sthana), inwardly cognitive, having seven members, having nineteen mouths, enjoying the exquisite (pravivikta), the Brilliant (Taijasa) is the second quarter.

5. Where one asleep desires no desire whatsoever, sees no dream whatsoever — that is deep sleep (sushupti). The deep-sleep state (susupta-sthana), unified (ekibhuta), just a mass of consciousness (prajnana-ghana), consisting of bliss, enjoying bliss, whose mouth is thought, the Intelligent (Prajna) — this is the third quarter.

6. This is the Lord of all (Ishvara). This is the all-knowing. This is the inner controller (antaryamin). This is the womb of all; for this is the origin and the end of beings.

7. The fourth (turiya) is not that which is conscious of the internal world, nor that which is conscious of the external world, nor that which is conscious of both, nor that which is a mass of consciousness, nor that which is simple consciousness, nor that which is unconscious. It is unseen, incommunicable, ungraspable, uncharacterizable, unthinkable, undesignable, the essence of the assurance of which is the state of being one with the Self, the cessation of development, tranquil, benign, without a second (advaita). This is what is known as the fourth (turiya). This is the Self (Atman). This should be discerned.

8. This same Self (Atman), as regards its syllabic correspondence, is the syllable Om; and as regards its elements, the elements are the quarters (padas) and the quarters are the elements, namely, the sounds A, U, M.

9. Vaishvanara, whose sphere of activity is the waking state, is the sound A, the first element, from Apti ('obtaining') or from Adimatva ('being first'). He who knows this obtains all desires, and becomes first.

10. Taijasa, whose sphere of activity is the dream state, is the sound U, the second element, from Utkarsha ('exaltation') or from Ubhayatva ('intermediateness'). He who knows this exalts the flow of knowledge and becomes equalised; in his family there is born no one who knows not Brahman.

11. Prajna, whose sphere of activity is the deep-sleep state, is the sound M, the third element, from Miti ('erecting') or from Apiti ('immerging'). He who knows this erects ('measures') all this and becomes the immerging.

12. The fourth is soundless: unutterable, a quieting-down of all relative manifestations, blissful, peaceful, non-dual (advaita). Thus Om is the Self (Atman) indeed. He who knows this, with his self enters the Self — yea, he who knows this!
"""


def _fetch_page(url: str) -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    return r.text


def _extract_next_url(html: str, base: str) -> str | None:
    """Return the absolute URL of the 'Next' navigation link, or None."""
    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        if text in ("next", "next »", "»"):
            href = a["href"]
            if href.startswith("http"):
                return href
            return base.rstrip("/") + "/" + href.lstrip("/")
    return None


def _clean_lines(raw: str) -> str:
    """Strip navigation noise, page numbers, OCR fragments, and footnote numbers."""
    lines = raw.split("\n")
    kept = []
    for line in lines:
        s = line.strip()
        if not s:
            if kept and kept[-1] != "":
                kept.append("")
            continue
        if _NOISE.match(s):
            continue
        if _PAGE_NUM.match(s):
            continue
        if _FOOTNOTE_NUM.match(s):
            continue
        if _OCR_FRAGMENT.match(s):
            continue
        # Drop very short all-alpha tokens that are likely split OCR Sanskrit
        if len(s) <= 4 and s.isalpha() and s == s.upper():
            continue
        kept.append(s)

    text = "\n".join(kept)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return clean_text(text)


def _fetch_upanishad(cfg: dict) -> str:
    """
    Fetch all pages for one upanishad, following Next links up to max_pages.
    Returns concatenated cleaned text.
    """
    url = cfg["start"]
    base = cfg["base"]
    keyword = cfg["keyword"]
    max_pages = cfg["max_pages"]

    pages_text: list[str] = []

    for page_num in range(max_pages):
        html = _fetch_page(url)
        soup = BeautifulSoup(html, "lxml")
        body = soup.find("body")
        raw = body.get_text(separator="\n") if body else html

        # Verify we're still on the right text (by page 2+)
        if page_num > 0:
            raw_lower = raw.lower()
            if keyword not in raw_lower:
                break  # wandered into a different section

        cleaned = _clean_lines(raw)
        if cleaned:
            pages_text.append(cleaned)

        next_url = _extract_next_url(html, base)
        if not next_url:
            break
        url = next_url

    return "\n\n".join(pages_text)


class UpanishadsCoreIngester(BaseIngester):
    tradition = "hinduism"
    text_name = "upanishads_core"
    display_name = "Five Core Upanishads (Müller / Hume)"
    source_url = "https://sacred-texts.com/hin/sbe01/index.htm"
    priority = 1

    def get_chunks(self) -> list[dict]:
        all_chunks = []

        for cfg in UPANISHADS_CONFIG:
            name = cfg["name"]
            display = cfg["display"]
            date = cfg["date"]

            print(f"    Fetching {display}...")
            try:
                text = _fetch_upanishad(cfg)
            except Exception as e:
                print(f"      [WARN] Failed to fetch {display}: {e}")
                continue

            if len(text) < 200:
                print(f"      [WARN] {display}: too little text ({len(text)} chars), skipping")
                continue

            print(f"      {len(text)} chars")
            parts = split_long_text(text)
            print(f"      → {len(parts)} chunk(s)")

            for i, part in enumerate(parts):
                labeled = (
                    f"{display}\n"
                    f"F. Max Müller translation (Sacred Books of the East, 1879/1884)\n\n{part}"
                )
                all_chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Unknown (Vedic tradition)",
                    "translator": "F. Max Müller",
                    "date_composed": date,
                    "book": "1",
                    "chapter": name,
                    "section": f"{name}_part{i + 1}" if len(parts) > 1 else name,
                    "content": labeled,
                    "priority": cfg["priority"],
                    "content_type": "primary_canon",
                    "source_url": cfg["start"],
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "upanishad": name,
                        "upanishad_full": display,
                        "part": i + 1,
                        "total_parts": len(parts),
                        "translator": "F. Max Müller",
                        "translation_year": 1879,
                    },
                })

        # Mandukya — hardcoded Hume 1921 translation
        print("    Adding Mandukya Upanishad (Hume 1921, hardcoded)...")
        mandukya_parts = split_long_text(MANDUKYA_TEXT)
        for i, part in enumerate(mandukya_parts):
            labeled = (
                f"Mandukya Upanishad\n"
                f"Robert Ernest Hume translation (Thirteen Principal Upanishads, Oxford, 1921)\n\n{part}"
            )
            all_chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Unknown (Vedic tradition)",
                "translator": "Robert Ernest Hume",
                "date_composed": "~500–200 BCE",
                "book": "1",
                "chapter": "mandukya",
                "section": f"mandukya_part{i + 1}" if len(mandukya_parts) > 1 else "mandukya",
                "content": labeled,
                "priority": 1,
                "content_type": "primary_canon",
                "source_url": "https://sacred-texts.com/hin/upan/index.htm",
                "language": "english",
                "themes": THEMES + ["mandukya", "turiya", "om_mantra", "four_states"],
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {
                    "upanishad": "mandukya",
                    "upanishad_full": "Mandukya Upanishad",
                    "part": i + 1,
                    "total_parts": len(mandukya_parts),
                    "translator": "Robert Ernest Hume",
                    "translation_year": 1921,
                    "note": "hardcoded — 12 mantras, public domain Hume 1921",
                },
            })

        print(f"    Total chunks: {len(all_chunks)}")
        return all_chunks
