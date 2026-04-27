# Sacred Knowledge RAG — Ingestion Workflow

## What This Is

A Python ingestion pipeline that scrapes public-domain mystical texts, chunks them, embeds them with OpenAI `text-embedding-3-small`, and stores them in a Supabase `knowledge_chunks` table with 1536-dim pgvector embeddings.

Working directory: `/Users/studio/Projects/quantum-strategies/scripts/ingest/`

---

## File Structure

```
scripts/ingest/
├── ingest.py            # CLI entry point — REGISTRY of all scrapers
├── config.py            # Env vars, OpenAI + Supabase clients, constants
├── db.py                # upsert_chunks, mark_source_ingested, delete_chunks_for_source
├── embed.py             # OpenAI embedding calls
├── chunk_utils.py       # clean_text(), split_long_text() (MAX_CHARS=2048)
├── status.py            # Rich table of knowledge_sources ingestion status
└── scrapers/
    ├── base.py          # BaseIngester ABC — run() calls get_chunks() + embed + upsert
    ├── taoism/
    ├── kabbalah/
    ├── tantra/
    ├── sufism/
    ├── christian_mysticism/
    ├── hermeticism/
    ├── rosicrucianism/
    └── science/         # empty — all science scrapers are pending
```

---

## How to Run

```bash
cd /Users/studio/Projects/quantum-strategies/scripts/ingest

# Run all pending (not yet ingested)
python ingest.py

# Run single tradition
python ingest.py rosicrucianism

# Run single source
python ingest.py rosicrucianism/fama_fraternitatis

# Re-ingest even if marked done
python ingest.py --refresh rosicrucianism/fama_fraternitatis

# Show status table
python ingest.py --status
```

---

## BaseIngester Pattern

Every scraper is a Python file in `scrapers/<tradition>/<text_name>.py` that:

1. Defines a class ending in `Ingester` inheriting `BaseIngester`
2. Sets class attributes: `tradition`, `text_name`, `display_name`, `source_url`
3. Implements `get_chunks()` returning `list[dict]`

```python
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text

class MyIngester(BaseIngester):
    tradition = "my_tradition"
    text_name = "my_text"
    display_name = "My Text — Full Title"
    source_url = "https://archive.org/details/..."

    def get_chunks(self) -> list[dict]:
        # fetch, parse, chunk
        chunks = []
        for seq, text in sections:
            for part in split_long_text(text):
                labeled = f"Title — Section {seq}\nTranslator info\n\n{part}"
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Author Name",
                    "translator": "Translator Name",
                    "date_composed": "~100 CE",
                    "book": "1",
                    "chapter": str(seq),
                    "section": f"section_{seq}",
                    "content": labeled,
                    "priority": 2,          # 1=essential, 2=important, 3=supplementary
                    "content_type": "primary_canon",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": ["tag1", "tag2"],
                    "cross_tradition_tags": ["consciousness", "transformation"],
                    "metadata": {"section_num": seq},
                })
        return chunks
```

After writing the scraper, add it to the REGISTRY in `ingest.py`:

```python
("my_tradition", "my_text", "scrapers.my_tradition.my_text"),
```

---

## Source Types & Strategies

### archive.org DjVuTXT (most common)

URL pattern: `https://archive.org/download/{item_id}/{item_id}_djvu.txt`

To find the item ID:
- Search archive.org for the book
- The item ID is in the URL: `archive.org/details/{item_id}`
- The DjVuTXT URL replaces `/details/` with `/download/` and appends `_djvu.txt`

Typical scraper pattern:
```python
TEXT_URL = "https://archive.org/download/{id}/{id}_djvu.txt"
TEXT_START = 1234  # line where actual text begins (after TOC)
TEXT_END   = 5678  # line where text ends (before appendices)

def _fetch_text() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(TEXT_URL, headers=HEADERS, timeout=90)
    r.raise_for_status()
    return r.text
```

**Finding start/end lines:** Download the .txt file, open in a text editor, search for the first real sentence of chapter 1. Note the line number. For end, find the last line of the main text before appendices/index.

**TOC discrimination:** TOC lines end with a page number: `r"\s+\d+\s*$"`. Real section headers don't. Use this to skip TOC entries when scanning for section headers.

**Running header noise:** OCR books have running headers on every page like "THE CLOUD OF UNKNOWING 47". Strip these with regex matching `^BOOKNAME\s+\d+` or `^\d+\s+BOOKNAME`.

### ctext.org scraping

For Chinese texts (Taoism, some others), ctext.org has clean English translations:

```python
from bs4 import BeautifulSoup

html = self.fetch(url)
soup = BeautifulSoup(html, "lxml")
for td in soup.find_all("td", class_="etext"):
    text = clean_text(td.get_text(separator=" "))
    if len(text) > 80:
        sections.append(text)
```

### Project Gutenberg

Plain text files, no OCR noise. Simpler to parse:
- Find `*** START OF THE PROJECT GUTENBERG EBOOK ***` line
- Find `*** END OF THE PROJECT GUTENBERG EBOOK ***` line
- Extract between those markers

---

## Critical: knowledge_sources Tracking

**The most common failure mode:** `mark_source_ingested()` silently does nothing if the `text_name` in your scraper doesn't match an existing row in `knowledge_sources`.

Before writing a scraper, check what text_name exists in the DB:
```python
python ingest.py --status
```

If the text_name your scraper uses doesn't appear in the status table, either:
1. It's a new source — you need to insert a row manually via Supabase dashboard, OR
2. The existing row uses a different text_name — match your scraper to it

To insert a missing row (run in Python REPL from this directory):
```python
from config import supabase
supabase.table("knowledge_sources").upsert({
    "tradition": "my_tradition",
    "text_name": "my_text",
    "display_name": "My Text Display Name",
    "priority": 2,
    "status": "pending",
    "chunk_count": 0,
}).execute()
```

---

## OCR Noise Filtering Patterns

### Roman numeral section headers

Many archive.org books use Roman numeral section dividers that OCR handles with `l`→`I` errors:

```python
SECTION_PAT = re.compile(r'^([IVXLC]+)$')  # standalone on its own line

def _rn_to_int(rn: str) -> int:
    vals = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100}
    rn = rn.replace('l', 'I').replace('i', 'I').upper()  # fix l→I BEFORE upper()
    result, prev = 0, 0
    for c in reversed(rn):
        curr = vals.get(c, 0)
        result = result - curr if curr < prev else result + curr
        prev = curr
    return result
```

### Sanskrit / bilingual OCR filtering

For Sanskrit texts (Kularnava Tantra, VBT, etc.) where DjVuTXT has interleaved Sanskrit Devanagari OCR'd into Latin characters:

```python
import re

SANSKRIT_OCR_PAT = re.compile(r'[^\x00-\x7F]|[ऀ-ॿ]')

_ENGLISH_ANCHORS = re.compile(
    r'\b(the|of|and|in|to|is|are|was|were|be|been|have|has|had|do|does|did|'
    r'will|would|could|should|may|might|can|this|that|these|those|which|who|'
    r'from|with|for|by|at|on|not|but|or|so|if|as|an|its|his|her|their|our|'
    r'all|one|two|three|said|thus|says|he|she|they|it|we|you|'
    r'then|when|how|what|where|there|here|now|also|only|even|more|into|upon|'
    r'such|no|any|shall|through|after|before|because|very|great|know|'
    r'therefore|indeed|whom|whose|like|than|both|each|neither|either)\b',
    re.IGNORECASE
)
_ROMAN_ONLY = re.compile(r'^[IVXLCivxlc]+\.?$')
_CONSEC_CONSONANTS = re.compile(r'[bcdfghjklmnpqrstvwxyz]{4}', re.IGNORECASE)

def _valid_short_fragment(stripped: str) -> bool:
    if re.search(r'\d', stripped): return False
    if any(ord(c) > 127 for c in stripped): return False  # accented chars = Sanskrit transliteration
    words = re.findall(r'[A-Za-z]+', stripped)
    if not words: return False
    if len(words) == 1 and _ROMAN_ONLY.match(words[0]): return False
    for w in words:
        if not (w.islower() or w.isupper() or w.istitle()): return False
        if _CONSEC_CONSONANTS.search(w): return False
    return True

def _is_english_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped: return True
    if SANSKRIT_OCR_PAT.search(stripped): return False
    total = len(stripped)
    if total < 3: return False
    ascii_letters = sum(1 for c in stripped if c.isalpha() and ord(c) < 128)
    if ascii_letters / total < 0.35 and total < 80: return False
    if total >= 60: return True
    if stripped[-1] in ('!', ')') and total < 50: return False
    if total < 20: return _valid_short_fragment(stripped)
    return bool(_ENGLISH_ANCHORS.search(stripped))
```

---

## Chunk Dict Required Fields

```python
{
    "tradition": str,          # e.g. "taoism", "sufism", "science"
    "text_name": str,          # must match knowledge_sources.text_name
    "author": str,
    "translator": str,
    "date_composed": str,
    "book": str,               # "1" if single-volume
    "chapter": str,
    "section": str,            # unique-ish identifier within text
    "content": str,            # labeled text: "Title — Chapter\nTranslator\n\nBody..."
    "priority": int,           # 1=essential, 2=important, 3=supplementary
    "content_type": str,       # "primary_canon" | "secondary_commentary" | "science_paper"
    "source_url": str,
    "language": "english",
    "themes": list[str],
    "cross_tradition_tags": list[str],
    "metadata": dict,          # any extra context
}
```

Do NOT include `"embedding"` — `BaseIngester.run()` adds it automatically.

---

## Corpus Status (as of 2026-04-22)

~37 of 64 target sources ingested. ~8,156 chunks.

### Completed
- **Taoism**: Tao Te Ching, Zhuangzi (inner), Neiye, I Ching, Zhuangzi Outer, Liezi
- **Kabbalah**: Sefer Yetzirah (partially), Zohar
- **Tantra**: Mahanirvana Tantra, VBT, Heart Sutra, Kularnava Tantra
- **Sufism**: Masnavi, Conference of the Birds, Fusus al-Hikam, Divan-e Shams, Ghazali Confessions
- **Christian Mysticism**: Cloud of Unknowing, Ascent of Mount Carmel, Interior Castle, Eckhart Sermons, Dark Night of the Soul, Showings, Practice of the Presence of God, Spiritual Canticle
- **Hermeticism**: Corpus Hermeticum, Kybalion, Asclepius
- **Rosicrucianism**: Fama Fraternitatis, Confessio Fraternitatis, Chymical Wedding

### Pending
- **Rosicrucianism**: Real History (Waite), Atalanta Fugiens, Secret Symbols, Themis Aurea, Rosicrucian Enlightenment
- **Sufism**: Risalat al-Qushayri
- **Kabbalah**: Sefer Yetzirah (archive.org Westcott), Sha'are Orah (Gates of Light)
- **Christian Mysticism**: Mystical Theology (Pseudo-Dionysius)
- **Tantra**: Tantraloka (Abhinavagupta)
- **Hermeticism**: Emerald Tablet (hardcode — very short)
- **Science** (all 10): DMN & Meditation, Gamma Coherence, REBUS Model, IIT 3.0, Orch-OR, Breathwork & Altered States, + 4 QS custom texts

---

## Troubleshooting

**Scraper produces 0 chunks**: The line range is wrong. Download the DjVuTXT manually and inspect. Run the parser in isolation with `python -c "from scrapers.x.y import *; ..."`.

**mark_source_ingested does nothing**: text_name mismatch. Check `--status` and fix the row or rename the scraper attribute.

**Duplicate chunks on re-run**: Use `--refresh` flag to delete existing chunks first.

**SSL timeout during upsert**: `db.py` already handles this with 3 retries + reconnect. If it keeps failing, reduce `INSERT_BATCH_SIZE` in `db.py` or `PROCESS_BATCH` in `base.py`.

**archive.org 429 / rate limit**: Increase `SCRAPE_DELAY` in `config.py` (default 1.5s). Archive.org is fairly lenient but repeated fast downloads trigger blocks.
