# Parallel Terminal Prompts — Sacred Knowledge RAG Ingestion

Each prompt below is self-contained. Paste it into a fresh Claude Code terminal session.
Each terminal works a different slice of the remaining corpus.

Working directory for all terminals: `/Users/studio/Projects/quantum-strategies/scripts/ingest/`

Current corpus state: **58/72 sources ingested · 9,549 chunks**

Remaining (14 sources):
- Kabbalah: 5 skipped (Idra Raba, Idra Zuta, Bahir, Sha'are Orah, Shir HaShirim)
- Tantra: 2 skipped (Shiva Sutras, Tantraloka)
- Sufism: 1 skipped (Risalat al-Qushayri)
- Rosicrucianism: 1 skipped (Atalanta Fugiens)
- Science: 4 pending QS custom texts (BLOCKED — user must provide content)

---

## TERMINAL 1 — Kabbalah Deep Corpus (5 sources)

```
You are continuing a corpus ingestion project for a Quantum Strategies RAG system.
Working directory: /Users/studio/Projects/quantum-strategies/scripts/ingest/

READ WORKFLOW.md FIRST — it explains the entire pipeline.

READ scrapers/kabbalah/zohar.py — it is your primary pattern for ALL Sefaria scraping.
READ scrapers/kabbalah/sefer_yetzirah.py — secondary Sefaria pattern for shorter texts.
READ ingest.py lines 27–92 to understand the REGISTRY format.

IMPORTANT CONTEXT: These 5 sources are marked as "skipped" in the database. Some were
skipped provisionally; others were researched and no suitable source was found. Your job
is to actually try each one and either build a working scraper or document precisely why
it's impossible. "Skipped" is not permanent — re-ingest by adding to the REGISTRY and
running the scraper.

---

### Source 1: Zohar — Idra Raba (priority 1)
text_name: zohar_idra_raba   tradition: kabbalah

The Idra Raba ("Great Assembly") is in Zohar, Nasso — a section of Bamidbar (Numbers).
On Sefaria, the Idra Raba sections are accessible under the Zohar text hierarchy.

Step 1 — Probe Sefaria to confirm English availability:
```python
import requests, time
API_BASE = "https://www.sefaria.org/api/texts"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0)"}

# Try these API routes in order until you get English text back:
for route in [
    "Zohar,_Nasso.1",          # Idra Raba is within the Nasso section
    "Zohar,_Idra_Raba.1",
    "Zohar,_Idra_Raba.1.1",
    "Zohar_Idra_Raba.1",
]:
    time.sleep(1.5)
    r = requests.get(f"{API_BASE}/{route}", headers=HEADERS, params={"lang": "en"}, timeout=25)
    print(route, r.status_code, str(r.json().get("text", ""))[:200])
```

Also check the Sefaria table of contents to find the correct identifier:
```python
r = requests.get("https://www.sefaria.org/api/v2/index/Zohar", headers=HEADERS, timeout=25)
import json; print(json.dumps(r.json(), indent=2)[:3000])
```

Step 2 — If English text is available: build `scrapers/kabbalah/zohar_idra_raba.py`
following the exact same pattern as zohar.py. Chunk by paragraph. Use:
  themes: ["idra_raba", "divine_form", "sefirot", "masculine_feminine", "revelation"]
  cross_tags: ["divine_union", "mystical_union", "emanation", "transformation"]
  date_composed: "~13th century CE"
  translator: "Sefaria Community / Pritzker Edition"

Step 3 — If Sefaria has no English for Idra Raba: try archive.org
  Search: "zohar idra raba english" on archive.org
  The Sperling/Simon translation of the Zohar (Soncino Press, 1934) is likely PD in some volumes.
  Try: https://archive.org/search?query=zohar+soncino+english
  The Idra Raba appears in Soncino Zohar Vol. III. Look for "zoharvol03mose" or similar.

Step 4 — If no workable English source: mark definitively as skipped:
  from config import supabase
  supabase.table("knowledge_sources").update({"status": "skipped"}).eq("text_name", "zohar_idra_raba").execute()
  And add a precise comment in ingest.py explaining why.

---

### Source 2: Zohar — Idra Zuta (priority 1)
text_name: zohar_idra_zuta   tradition: kabbalah

The Idra Zuta ("Small Assembly") appears at the end of Ha'azinu (Devarim/Deuteronomy).
Same approach as Idra Raba — probe Sefaria first:

  Routes to try: "Zohar,_Idra_Zuta.1", "Zohar,_Ha'azinu.1", "Zohar,_Idra_Zuta.1.1"

If found: build `scrapers/kabbalah/zohar_idra_zuta.py`
  themes: ["idra_zuta", "death_of_the_king", "divine_form", "sefirot", "mystery"]
  cross_tags: ["dissolution", "transformation", "divine_union", "emptiness_void"]

If not on Sefaria: same Soncino archive.org fallback as Idra Raba (Vol. V contains Ha'azinu).

---

### Source 3: Zohar — Shir HaShirim (priority 2)
text_name: zohar_shir_hashirim   tradition: kabbalah

The Zohar's commentary on Song of Songs. Probe Sefaria:
  Routes to try: "Zohar,_Shir_HaShirim.1", "Zohar,_Song_of_Songs.1", "Zohar,_Shir_Hashirim.1"

If found: build `scrapers/kabbalah/zohar_shir_hashirim.py`
  themes: ["shir_hashirim", "divine_love", "erotic_mysticism", "bride_groom", "union"]
  cross_tags: ["divine_union", "mystical_union", "sacred_sexuality", "transformation"]

Note: Do NOT confuse with "Shir HaShirim Rabbah" (rabbinic midrash). You want the Zohar's
commentary, not the Midrash Rabbah on Song of Songs.

---

### Source 4: Bahir (priority 2)
text_name: bahir   tradition: kabbalah

A PREVIOUS TERMINAL noted "no English via Sefaria API" for the Bahir. Verify this is still
true and research alternatives:

Step 1 — Confirm Sefaria status:
```python
for route in ["Bahir.1", "Bahir.1.1", "Sefer_HaBahir.1"]:
    r = requests.get(f"{API_BASE}/{route}", headers=HEADERS, params={"lang":"en"}, timeout=25)
    print(route, r.status_code, str(r.json().get("text",""))[:200])
```

Step 2 — If Sefaria has English: build the scraper (it's a short text, ~200 sections).

Step 3 — If not on Sefaria: try archive.org for PD English translations:
  - Aryeh Kaplan translation (1979, Weiser Books) — CHECK IF PD (probably NOT, 1979)
  - "The Bahir: An Ancient Kabbalistic Text" — any Victorian-era translation
  - Try: https://archive.org/search?query=bahir+kabbalah+english
  - Check sacred-texts.com: https://www.sacred-texts.com/jud/yetzirah.htm and nearby pages

Step 4 — Alternative: The "Book Bahir" at Sefaria might have HEBREW only but no English
translation yet. If that's the case, document it precisely.

---

### Source 5: Sha'are Orah / Gates of Light (priority 2)
text_name: shaarei_orah   tradition: kabbalah

PREVIOUS STATUS: marked skipped because the Avi Weinstein English translation (1994, 
HarperCollins) is under copyright. The text itself (Gikatilla, ~1290 CE) is PD.

Step 1 — Check if there's an older PD English translation:
  - Search archive.org: "gates of light gikatilla", "shaarei orah", "sha'are orah"
  - Check if any pre-1928 translation exists (would be PD in the US)
  - Try sacred-texts.com

Step 2 — Check Sefaria:
  Routes: "Shaarei_Orah.1", "Shaarei_Orah.1.1", "Gates_of_Light.1"

Step 3 — If only the 1994 Weinstein translation exists: this source must remain skipped.
  Update the comment in ingest.py to be specific:
  # ("kabbalah", "shaarei_orah", ...),  # No PD English. Weinstein 1994 © HarperCollins.
  #   Sefaria has Hebrew only. Archive.org has no pre-1928 English translation.

---

### REGISTRY and knowledge_sources

When you successfully build a scraper:
1. Test it: python -c "from scrapers.kabbalah.X import *; i=XI(); c=i.get_chunks(); print(len(c), c[0]['content'][:300])"
2. Ensure the knowledge_sources row exists (check --status). If missing:
   from config import supabase
   supabase.table("knowledge_sources").upsert({
       "tradition": "kabbalah",
       "text_name": "zohar_idra_raba",  # adjust per source
       "display_name": "Zohar — Idra Raba",
       "priority": 1,
       "status": "pending",
       "chunk_count": 0
   }).execute()
3. Add to REGISTRY in ingest.py: ("kabbalah", "zohar_idra_raba", "scrapers.kabbalah.zohar_idra_raba"),
4. Run: python ingest.py kabbalah/zohar_idra_raba
5. Verify: python ingest.py --status

Run sources in priority order: Idra Raba → Idra Zuta → Shir HaShirim → Bahir → Sha'are Orah.
```

---

## TERMINAL 2 — Tantra + Sufism + Rosicrucianism (4 hard sources)

```
You are continuing a corpus ingestion project for a Quantum Strategies RAG system.
Working directory: /Users/studio/Projects/quantum-strategies/scripts/ingest/

READ WORKFLOW.md FIRST — it explains the entire pipeline.
READ scrapers/tantra/kularnava_tantra.py — archive.org DjVuTXT pattern with OCR filter.
READ scrapers/tantra/vbt.py — secondary tantra pattern.
READ scrapers/sufism/masnavi.py — archive.org pattern for sufism.
READ scrapers/rosicrucianism/fama_fraternitatis.py — rosicrucianism archive.org pattern.
READ ingest.py lines 27–92 — understand REGISTRY format and skip comments.

IMPORTANT CONTEXT: All 4 sources here are marked "skipped" due to source access problems
documented in previous sessions. The problems are REAL — do not ignore them. Research
each one carefully, try the documented alternatives, and either build a working scraper
OR confirm definitively that no PD/free English source exists and update the skip comment.

---

### Source 1: Shiva Sutras (priority 1)
text_name: shiva_sutras   tradition: tantra

PREVIOUS STATUS: "no free English text found" — the main English translation is Jaideva
Singh (1979, Motilal Banarsidass), which is under copyright.

The Shiva Sutras are very short — only 77 aphorisms in 3 chapters. Multiple translations exist.

Step 1 — Check these sources in order:
  a) Sefaria: unlikely but try — "Shiva_Sutras.1"
  b) sacred-texts.com: https://www.sacred-texts.com/tantra/ — scan for Shiva Sutras
  c) Swami Lakshmanjoo: his public domain lectures may be on shaivayoga.com or archive.org
     Search archive.org: "shiva sutras english translation"
  d) Mark Dyczkowski's translations — some appear on ishafoundation.org or similar sites
  e) Check: https://www.shankaracharya.org/ — some texts are freely published
  f) The "Siva Sutra Vimarsini" (Ksemaraja's commentary) — search archive.org for PD editions

Step 2 — If you find a usable free text (even a short one with commentary):
  Build scrapers/tantra/shiva_sutras.py
  The natural chunk structure: one sutra + its brief commentary per chunk.
  There are only 77 sutras — expect 80-150 chunks depending on commentary depth.
  themes: ["shiva_sutras", "consciousness", "recognition", "mantra", "liberation"]
  cross_tags: ["consciousness", "recognition_philosophy", "transformation", "non_dual"]
  
Step 3 — Hardcode fallback: If no full text found, hardcode just the 77 sutras themselves
  (the aphorisms are PD — they're ~1000 years old). No commentary needed:
  def get_chunks(self):
      SUTRAS = [
          ("I.1", "Consciousness is the Self (Caitanyamatma)"),
          ("I.2", "Knowledge is bondage (Jnanam bandha)"),
          # ... all 77 sutras with transliteration + common English rendering
      ]
      # Return one chunk per sutra with context header
  This produces a lean but valid source. Mark content_type as "primary_canon".

Step 4 — If no source at all and hardcode is insufficient: add precise skip comment:
  # ("tantra", "shiva_sutras", ...),  # 77-aphorism text. Singh 1979 © MLBD.
  #   No pre-1928 English translation found. Archive.org search: zero results.
  #   sacred-texts.com: not indexed. Consider hardcoding aphorisms only (77 sutras).

---

### Source 2: Tantraloka (priority 3)
text_name: tantraloka   tradition: tantra

PREVIOUS STATUS: "No public domain English translation exists." The DjVuTXT on archive.org
(tantralokaofabhi03abhiuoft) is unreadable Sanskrit OCR.

The Tantraloka is 37 chapters by Abhinavagupta (~1000 CE). No complete PD English exists.
However, there may be PARTIAL scholarly translations of key chapters.

Step 1 — Research partial translations:
  a) "Tantrasara" (Abhinavagupta's own summary) — Chakravarty 2012 translation © Rudra Press.
     Check if any older translation exists. Search archive.org: "tantrasara abhinavagupta"
  b) "The Trika Saivism of Kashmir" by Moti Lal Pandit — search archive.org
  c) Check Lorin Roche's "The Radiance Sutras" — it's a Vijnana Bhairava adaptation,
     already ingested, so skip.
  d) Alexis Sanderson's academic papers — available on academia.edu, may be freely downloadable
     These are scholarly (not primary text) but very high quality. Check if his papers
     cover Tantraloka passages directly. Content type: "scholarly_commentary"
  e) KSTS (Kashmir Series of Texts and Studies) — older scholarly editions with partial
     translations, possibly pre-1928. Search archive.org: "tantraloka KSTS"

Step 2 — If you find a usable partial text (even 5-10 key passages/chapters):
  Build scrapers/tantra/tantraloka.py
  Limit to whatever clean English is available.
  themes: ["tantraloka", "recognition", "consciousness", "mantra", "mandala", "liberation"]
  cross_tags: ["non_dual", "consciousness", "sacred_sexuality", "transformation"]

Step 3 — If nothing usable: confirm skip with detailed comment. Priority is 3 (lowest),
  so this is acceptable. Do not force a bad source.

---

### Source 3: Risalat al-Qushayri (priority 2)
text_name: risala_qushayri   tradition: sufism

PREVIOUS STATUS: "No PD English translation. Knysh 2007 (Garnet Publishing) is copyright."

Al-Qushayri's Epistle (~1045 CE) is a major Sufi theoretical text.

Step 1 — Research older translations:
  a) Search archive.org: "qushayri epistle sufism", "risala qushayri english"
  b) Check if there is a Victorian-era translation (any Orientalist publication pre-1928)
     Try search terms: "qushayri treatise 1914", "sufic orders qushayri"
  c) sacred-texts.com: https://www.sacred-texts.com/isl/ — scan for Qushayri
  d) Check "Studies in Islamic Mysticism" by Nicholson (1921, archive.org) — may include
     translated Qushayri passages: archive.org item "studiesinislamic00nichuoft"
  e) "The Mystics of Islam" (Nicholson 1914) is already ingested — check if it quotes
     Qushayri passages extensively. If so, those are already in the corpus.

Step 2 — Alternative approach: look for the ARABIC text with any freely available
  partial translations in academic papers. The text has 100+ short chapters on Sufi
  technical terms (hal, maqam, tawba, etc.) — even a partial list of 20-30 key chapters
  would be valuable if rendered in English.

Step 3 — Check if Sefaria or similar platforms have added it:
  Try: https://www.sefaria.org/search#{"query":"qushayri"}

Step 4 — If no PD English found: confirm skip with precise note:
  # ("sufism", "risala_qushayri", ...),  # No PD English. Knysh 2007 © Garnet.
  #   Archive.org: zero results. Nicholson does not translate Qushayri directly.
  #   Nicholson 1914 "Mystics of Islam" already in corpus — overlapping coverage.

---

### Source 4: Atalanta Fugiens (priority 2)
text_name: atalanta_fugiens   tradition: rosicrucianism

PREVIOUS STATUS: "SKIPPED: only PD file is mellon48atalanta (PDF, no text); Godwin 1989
translation (atalantafugiense0000maie) is © 1989 — not PD."

Atalanta Fugiens (Michael Maier, 1617) has 50 emblems, each with: motto (Latin), epigram
(Latin verse), and a prose discourse. The ORIGINAL LATIN is PD — the question is whether
any pre-1928 English translation exists.

Step 1 — Search specifically for partial English translations in older hermetic anthologies:
  a) "The Hermetic Museum" (Waite edition, 1893) — does NOT contain Atalanta Fugiens but
     check if it cross-references it: archive.org "hermetic museum waite"
  b) Any Victorian hermetic anthology on archive.org mentioning Atalanta Fugiens
  c) H.M.E. de Jong's "Michael Maier's 'Atalanta Fugiens'" (1969) — likely NOT PD (1969)
  d) Check: https://www.alchemywebsite.com/atalanta.html — may have translated emblems

Step 2 — Alternative: use the original Latin with key emblems hardcoded in English
  The 50 mottos are very short (1 line each) and the epigrams are 4-line verses. These
  are in Latin but translatable. Consider building a scraper that:
  - Fetches the archive.org DjVuTXT (mellon48atalanta)
  - Extracts the 50 discourse sections (the prose commentaries after each emblem)
  - Pairs them with their English motto (translated) as a header
  This requires OCR-quality checking — the mellon48atalanta item may be Latin prose
  that is clean enough to be useful despite being in Latin.

Step 3 — Check archive.org item directly:
  import requests
  r = requests.get("https://archive.org/download/mellon48atalanta/mellon48atalanta_djvu.txt",
                   headers={"User-Agent": "..."}, timeout=60)
  print(r.text[5000:7000])  # sample the middle for quality check

  If the text is clean Latin prose, note this for the user — the discourses are 400-600 words
  each in Latin and could potentially be translated (but that's outside scope here).

Step 4 — Check if "atalantafugiense0000maie" might actually be a different edition:
  r = requests.get("https://archive.org/metadata/atalantafugiense0000maie")
  print(r.json())  # Check actual metadata — is it the Godwin translation or something else?

Step 5 — If no usable English source: confirm skip with precise note.

---

### REGISTRY and knowledge_sources

When you successfully build a scraper:
1. Test: python -c "from scrapers.X.Y import *; i=YIngester(); c=i.get_chunks(); print(len(c), c[0]['content'][:300])"
2. Ensure knowledge_sources row exists — check python ingest.py --status. If missing:
   from config import supabase
   supabase.table("knowledge_sources").upsert({
       "tradition": "tantra",       # adjust
       "text_name": "shiva_sutras", # adjust
       "display_name": "Shiva Sutras",
       "priority": 1,
       "status": "pending",
       "chunk_count": 0
   }).execute()
3. Add to REGISTRY in ingest.py
4. Run: python ingest.py tradition/text_name
5. Verify: python ingest.py --status

Work in priority order: Shiva Sutras (p1) → Risalat al-Qushayri (p2) → Atalanta Fugiens (p2) → Tantraloka (p3).
```

---

## TERMINAL 3 — QS Custom Texts (BLOCKED — waiting on user)

```
You are continuing a corpus ingestion project for a Quantum Strategies RAG system.
Working directory: /Users/studio/Projects/quantum-strategies/scripts/ingest/

THESE 4 SOURCES ARE BLOCKED. Do NOT start this terminal until the user provides content.

The following science corpus entries require custom documents written by Quantum Strategies:

  text_name: qs_canonical_references      (priority 1)
  text_name: qs_darkness_void_synthesis   (priority 1)
  text_name: qs_science_overlay           (priority 1)
  text_name: qs_tradition_venn_overlay    (priority 1)

These are NOT scraped from external sources — they are internal QS documents.

Once the user provides content (as a file path, Google Doc link, or pasted text), for each:

1. Create a hardcoded scraper in scrapers/science/qs_<name>.py that reads the document
   and returns properly chunked content. Use split_long_text() from chunk_utils.py.
   
   Pattern for a local markdown/text file:
   
   class QSCanonicalRefsIngester(BaseIngester):
       tradition = "science"
       text_name = "qs_canonical_references"
       display_name = "QS Canonical References"
       source_url = "internal"
   
       def get_chunks(self) -> list[dict]:
           text = Path("/path/to/file.md").read_text()
           # Split by ## headers or by paragraph blocks
           sections = re.split(r'\n## ', text)
           chunks = []
           for sec in sections:
               for part in split_long_text(clean_text(sec)):
                   chunks.append({
                       "tradition": "science",
                       "text_name": self.text_name,
                       "content_type": "qs_synthesis",
                       "priority": 1,
                       "themes": [...],
                       "cross_tradition_tags": [...],
                       "content": part,
                   })
           return chunks

2. Ensure knowledge_sources row has status='pending' before running ingest.
3. Add to REGISTRY in ingest.py.
4. Run: python ingest.py science/qs_<name>

CHECK WITH THE USER: Do these documents exist in the documents/ folder, a Google Doc,
Notion, or elsewhere? Ask before proceeding.
```
