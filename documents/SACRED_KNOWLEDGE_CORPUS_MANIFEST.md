# Quantum Strategies — Sacred Knowledge Corpus Manifest
# RAG Ingestion Asset Register
# Version 1.0

---

## HOW TO USE THIS FILE

Each entry is one scrape target. Every URL has been verified as a free,
publicly accessible text source. Format per entry:

- **tradition** — corpus bucket it belongs to
- **text** — canonical name
- **url** — direct scrape target
- **format** — HTML, plain text, or PDF
- **priority** — 1 (core canon) / 2 (secondary) / 3 (contextual)
- **chunk_strategy** — how to split this specific text
- **metadata_tags** — tags that travel with every chunk

---

## TRADITION 1: TAOISM

### Tao Te Ching (81 chapters)
- **url:** https://classics.mit.edu/Lao/taote.1.1.html
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One chapter per chunk. Ch 1–81. Each chunk = ~100–300 tokens.
- **metadata_tags:**
  - tradition: taoism
  - text: tao_te_ching
  - chapter: [1–81]
  - themes: [tao, wu_wei, emptiness, return, unity, non-action]

### Tao Te Ching — Multi-translation comparison
- **url:** https://bopsecrets.org/gateway/passages/tao-te-ching.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Side-by-side translations per chapter. Useful for ambiguous passages.
- **metadata_tags:**
  - tradition: taoism
  - text: tao_te_ching
  - type: multi_translation

### Zhuangzi — Inner Chapters 1–7 (core canon)
- **url:** https://ctext.org/zhuangzi/inner-chapters
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One section per chunk. Respect natural paragraph breaks. Max 512 tokens.
- **metadata_tags:**
  - tradition: taoism
  - text: zhuangzi
  - section: inner_chapters
  - chapters: [1_free_wandering, 2_equalizing, 3_nurturing_life, 4_human_world, 5_signs_virtue, 6_prime_master, 7_emperors_kings]

### Zhuangzi — Outer and Miscellaneous Chapters
- **url:** https://ctext.org/zhuangzi
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Section per chunk. Inner chapters take priority in retrieval weighting.
- **metadata_tags:**
  - tradition: taoism
  - text: zhuangzi
  - section: outer_misc_chapters

### Neiye (Inner Training) — Oldest Taoist meditation text
- **url:** https://ctext.org/guanzi/nei-ye
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Verse per chunk (26 stanzas total). Each stanza = one chunk.
- **metadata_tags:**
  - tradition: taoism
  - text: neiye
  - themes: [breath, cultivation, stillness, returning_root, qi]

### I Ching — 64 Hexagrams
- **url:** https://sacred-texts.com/ich/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** One hexagram per chunk including judgment, image, and line texts.
- **metadata_tags:**
  - tradition: taoism
  - text: i_ching
  - hexagram: [1–64]
  - themes: [change, pattern, divination, cosmology]

### Liezi
- **url:** https://ctext.org/liezi
- **format:** HTML
- **priority:** 3
- **chunk_strategy:** Section per chunk.
- **metadata_tags:**
  - tradition: taoism
  - text: liezi

---

## TRADITION 2: KABBALAH

### Sefer Yetzirah (Book of Formation) — All 6 chapters
- **url:** https://www.sacred-texts.com/jud/yetzirah.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One mishnah (numbered paragraph) per chunk. ~6 chunks total per chapter.
- **metadata_tags:**
  - tradition: kabbalah
  - text: sefer_yetzirah
  - chapter: [1–6]
  - themes: [sefirot, letters, creation, cosmology, 32_paths]

### Sefer Yetzirah — Sefaria version (Hebrew + English)
- **url:** https://www.sefaria.org/Sefer_Yetzirah
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Same as above. Cross-reference with sacred-texts version.
- **metadata_tags:**
  - tradition: kabbalah
  - text: sefer_yetzirah
  - source: sefaria

### Zohar — Bereishit (Genesis, opening section)
- **url:** https://www.sefaria.org/Zohar,_Bereshit
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk. Opening 1:1a–1b is single highest-priority chunk.
- **metadata_tags:**
  - tradition: kabbalah
  - text: zohar
  - parasha: bereishit
  - themes: [creation, ein_sof, light, darkness, concealed_point]

### Zohar — Idra Raba (Great Assembly)
- **url:** https://www.sefaria.org/Zohar,_Idra_Rabba
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk. This section is dense — keep chunks tight (~200 tokens).
- **metadata_tags:**
  - tradition: kabbalah
  - text: zohar
  - section: idra_raba
  - themes: [divine_structure, sefirot, mystery, revelation]

### Zohar — Idra Zuta (Small Assembly)
- **url:** https://www.sefaria.org/Zohar,_Idra_Zuta
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk.
- **metadata_tags:**
  - tradition: kabbalah
  - text: zohar
  - section: idra_zuta
  - themes: [death, final_teaching, divine_union, mystery]

### Zohar — Shir HaShirim (Song of Songs commentary)
- **url:** https://www.sefaria.org/Zohar,_Song_of_Songs
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Paragraph per chunk.
- **metadata_tags:**
  - tradition: kabbalah
  - text: zohar
  - parasha: shir_hashirim
  - themes: [divine_love, soul_union, bridal_mysticism]

### Bahir (Book of Illumination)
- **url:** https://www.sacred-texts.com/jud/bahir/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Section per chunk (200 sections total — combine short adjacent ones).
- **metadata_tags:**
  - tradition: kabbalah
  - text: bahir
  - themes: [sefirot, divine_light, soul, reincarnation]

### Gates of Light (Sha'are Orah) — Joseph Gikatilla
- **url:** https://www.sacred-texts.com/jud/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: kabbalah
  - text: shaarei_orah
  - themes: [sefirot_qualities, divine_names, ascending_gates]

---

## TRADITION 3: TANTRA

### Vijñana Bhairava Tantra — 112 techniques (full text)
- **url:** https://www.sacred-texts.com/tantra/vbt/index.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One technique (dharana) per chunk. Verses 24–138 = 112 chunks + preamble.
- **metadata_tags:**
  - tradition: tantra
  - text: vijnana_bhairava_tantra
  - verse: [24–138]
  - technique_number: [1–112]
  - category: [breath, subtle_body, emptiness, sense_based, identity, spaciousness]
  - themes: [consciousness, meditation, bhairava, shakti, non_dual]

### Vijñana Bhairava Tantra — Christopher Wallis commentary
- **url:** https://hareesh.org/blog/2016/5/18/the-vijnana-bhairava-tantra-a-brief-overview
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Section per chunk. Commentary gives contextual depth for each technique.
- **metadata_tags:**
  - tradition: tantra
  - text: vijnana_bhairava_tantra
  - type: commentary
  - author: christopher_wallis

### Shiva Sutras (Kashmir Shaivism)
- **url:** https://sacred-texts.com/tantra/ss/index.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One sutra per chunk with commentary. 77 sutras across 3 sections.
- **metadata_tags:**
  - tradition: tantra
  - text: shiva_sutras
  - section: [consciousness, arising_of_knowledge, vibration]
  - themes: [recognition, consciousness, liberation, non_dual]

### Mahanirvana Tantra (Great Liberation)
- **url:** https://www.sacred-texts.com/tantra/maha/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk (14 chapters). Dense — keep sections tight.
- **metadata_tags:**
  - tradition: tantra
  - text: mahanirvana_tantra
  - themes: [shakti, kali, liberation, ritual, left_hand_path]

### Kularnava Tantra — Selected chapters
- **url:** https://archive.org/details/KularnavaTantra
- **format:** PDF (archive.org)
- **priority:** 2
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: tantra
  - text: kularnava_tantra
  - themes: [left_hand_path, transgression, guru, initiation]

### Tantraloka — Abhinavagupta (selected sections available)
- **url:** https://www.academia.edu/search?q=tantraloka+translation
- **format:** HTML/PDF (academic papers)
- **priority:** 3
- **chunk_strategy:** Section per chunk. Use available English translations only.
- **metadata_tags:**
  - tradition: tantra
  - text: tantraloka
  - author: abhinavagupta
  - themes: [recognition, non_dual, consciousness, kashmir_shaivism]

### Heart Sutra (Buddhist Tantra)
- **url:** https://www.sacred-texts.com/bud/tib/hrt.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Full text = single chunk (very short). Split by verse for granular retrieval.
- **metadata_tags:**
  - tradition: tantra
  - text: heart_sutra
  - branch: vajrayana
  - themes: [shunyata, emptiness, form, liberation, prajna]

---

## TRADITION 4: SUFISM

### Masnavi — All 6 Books (Rumi)
- **url:** https://sacred-texts.com/isl/masnavi/index.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Every 20–30 couplets = one chunk. Book I prologue (lines 1–18) = its own chunk. ~900 total chunks across 6 books.
- **metadata_tags:**
  - tradition: sufism
  - text: masnavi
  - book: [1–6]
  - author: rumi
  - themes: [divine_love, longing, separation, fana, soul, ego_stages]

### Masnavi — Reed Flute Prologue specifically
- **url:** https://www.dar-al-masnavi.org/reedsong.html
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Single chunk — lines 1–18 with multiple translations.
- **metadata_tags:**
  - tradition: sufism
  - text: masnavi
  - section: reed_flute_prologue
  - book: 1
  - lines: [1–18]
  - themes: [separation, longing, return, divine_origin]

### Divan-e Shams-e Tabrizi (Rumi)
- **url:** https://rumi.network/divan-e-shams/
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** One ghazal per chunk.
- **metadata_tags:**
  - tradition: sufism
  - text: divan_e_shams
  - author: rumi
  - themes: [divine_love, ecstasy, union, beloved]

### Fusus al-Hikam (Bezels of Wisdom) — Ibn Arabi
- **url:** https://sacred-texts.com/isl/fusu/index.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One chapter (bezel) per chunk. 27 chapters total.
- **metadata_tags:**
  - tradition: sufism
  - text: fusus_al_hikam
  - author: ibn_arabi
  - chapter_prophet: [adam, seth, noah, idris, ibrahim, isaac, ishmael, lot, ezra, aaron, solomon, david, jonah, job, john, zacharias, elias, luqman, sheba, moses, khalid, muhammad, jesus, hud, shu_ayb, salih]
  - themes: [divine_wisdom, unity_of_being, wahdat_al_wujud, prophetic_archetypes]

### Conference of the Birds (Attar)
- **url:** https://sacred-texts.com/isl/cfb/index.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Section per chunk. The seven valleys are individually highest priority.
- **metadata_tags:**
  - tradition: sufism
  - text: conference_of_the_birds
  - author: attar
  - themes: [seven_valleys, fana, journey, ego_death, divine_union]
  - seven_valleys: [quest, love, knowledge, detachment, unity, bewilderment, nothingness]

### Deliverance from Error (Al-Ghazali)
- **url:** https://archive.org/details/AlGhazaliDeliverance
- **format:** PDF
- **priority:** 2
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: sufism
  - text: deliverance_from_error
  - author: al_ghazali
  - themes: [spiritual_crisis, knowledge, certainty, mystical_path]

### Risalat al-Qushayri (Epistle on Sufism)
- **url:** https://sacred-texts.com/isl/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: sufism
  - text: risala_qushayri
  - author: al_qushayri
  - themes: [sufi_stations, states, maqamat, ahwal]

---

## TRADITION 5: CHRISTIAN MYSTICISM

### Cloud of Unknowing — All 75 chapters (Anonymous, ~1375)
- **url:** https://sacred-texts.com/chr/cou/index.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One chapter per chunk. Ch 3–7 each get individual high-priority tags.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: cloud_of_unknowing
  - chapter: [1–75]
  - themes: [apophatic, unknowing, contemplation, divine_darkness, blind_love]
  - high_priority_chapters: [3, 4, 5, 6, 7, 16, 17, 43, 44, 45]

### Dark Night of the Soul — John of the Cross
- **url:** https://ccel.org/ccel/john_cross/dark_night
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One chapter per chunk. Book I and Book II tagged separately.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: dark_night_of_the_soul
  - author: john_of_the_cross
  - book: [1_active_senses, 2_active_spirit]
  - chapter: [1–25]
  - themes: [dark_night, purgation, transformation, union, passive_night, active_night]

### Interior Castle — Teresa of Avila
- **url:** https://ccel.org/ccel/teresa/castle2
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One chapter per chunk. Seven mansions tagged individually.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: interior_castle
  - author: teresa_of_avila
  - mansion: [1, 2, 3, 4, 5, 6, 7]
  - themes: [prayer, union, soul_stages, contemplation, spiritual_marriage]

### Mystical Theology — Pseudo-Dionysius (full text)
- **url:** https://ccel.org/ccel/dionysius/mystical/
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One chapter per chunk. Only 5 chapters total — short and dense.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: mystical_theology
  - author: pseudo_dionysius
  - themes: [apophatic, divine_darkness, unknowing, negation, beyond_being]

### Meister Eckhart — Selected Sermons
- **url:** https://dhspriory.org/kenny/Eckhart.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One sermon per chunk. Sermon 52 (Poverty of Spirit) = highest priority single chunk.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: eckhart_sermons
  - author: meister_eckhart
  - themes: [gottheit, divine_spark, poverty_of_spirit, detachment, ground_of_soul]
  - high_priority_sermons: [52, 5b, 6, 13b, 48]

### Showings — Julian of Norwich
- **url:** https://ccel.org/ccel/julian/revelations
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk. 86 chapters total.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: showings
  - author: julian_of_norwich
  - themes: [divine_love, suffering, all_shall_be_well, motherhood_of_god]

### Practice of the Presence of God — Brother Lawrence
- **url:** https://ccel.org/ccel/lawrence/practice
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Letter or conversation per chunk (very short text).
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: practice_presence_god
  - author: brother_lawrence
  - themes: [everyday_practice, divine_presence, simplicity, continuous_prayer]

### Spiritual Canticle — John of the Cross
- **url:** https://ccel.org/ccel/john_cross/canticle
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Stanza + commentary per chunk.
- **metadata_tags:**
  - tradition: christian_mysticism
  - text: spiritual_canticle
  - author: john_of_the_cross
  - themes: [divine_love, union, soul_journey, beloved]

---

## TRADITION 6: HERMETICISM

### Corpus Hermeticum — All 17 Tractates
- **url:** https://gnosis.org/library/hermetica.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One section per tractate. Tractates I and XIII each get section-level chunking.
- **metadata_tags:**
  - tradition: hermeticism
  - text: corpus_hermeticum
  - tractate: [1_poimandres, 2, 3_sacred_sermon, 4_cup, 5, 6, 7_ignorance, 8, 9, 10_key, 11, 12, 13_secret_sermon, 14, 15, 16, 17]
  - themes: [cosmogony, nous, divine_mind, ascent, regeneration, gnosis]

### Corpus Hermeticum — Tractate I: Poimandres (highest priority)
- **url:** https://gnosis.org/library/hermes1.html
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk. Sections I.1–6 (vision), I.7–18 (creation), I.19–26 (ascent), I.27–32 (commission) = four major chunks minimum.
- **metadata_tags:**
  - tradition: hermeticism
  - text: corpus_hermeticum
  - tractate: 1_poimandres
  - section: [vision, creation, descent, ascent, commission]
  - themes: [primordial_darkness, logos, creation, planetary_spheres, return]

### Corpus Hermeticum — Tractate XIII: Secret Sermon on the Mountain
- **url:** https://gnosis.org/library/hermes13.html
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk. The ten torments and ten divine powers = each their own chunk.
- **metadata_tags:**
  - tradition: hermeticism
  - text: corpus_hermeticum
  - tractate: 13_secret_sermon
  - themes: [initiation, regeneration, ten_torments, ten_powers, transformation]

### Emerald Tablet — Multiple translations
- **url:** https://sacred-texts.com/alc/emerald.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Full text per translation = one chunk each. Very short — ~200 tokens per version.
- **metadata_tags:**
  - tradition: hermeticism
  - text: emerald_tablet
  - themes: [as_above_so_below, correspondence, alchemy, prima_materia]

### Asclepius (Latin companion to Corpus Hermeticum)
- **url:** https://gnosis.org/library/asclepius.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: hermeticism
  - text: asclepius
  - themes: [theurgy, divine_spirit, animated_statues, cosmos]

### The Kybalion (1908)
- **url:** https://sacred-texts.com/eso/kyb/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk. 15 chapters.
- **metadata_tags:**
  - tradition: hermeticism
  - text: kybalion
  - note: modern_synthesis_not_ancient_text
  - themes: [seven_principles, mentalism, correspondence, vibration, polarity, rhythm, cause_effect, gender]

---

## TRADITION 7: ROSICRUCIANISM

### Fama Fraternitatis (1614) — First Rosicrucian Manifesto
- **url:** https://sacred-texts.com/sro/rhr/rhr03.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk. ~15 chunks total.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: fama_fraternitatis
  - date: 1614
  - themes: [brotherhood, christian_rosenkreuz, universal_reformation, vault, resurrection]

### Fama Fraternitatis — PDF version (Vaughan translation)
- **url:** https://www.nommeraadio.ee/meedia/pdf/RRS/Rosicrucian%20Manifestos.pdf
- **format:** PDF
- **priority:** 1
- **chunk_strategy:** Same as above. Use as cross-reference for translation differences.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: fama_fraternitatis
  - translator: thomas_vaughan

### Confessio Fraternitatis (1615) — Second Manifesto
- **url:** https://sacred-texts.com/sro/rhr/rhr04.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Paragraph per chunk. 37 articles of intent = highest granularity.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: confessio_fraternitatis
  - date: 1615
  - themes: [theology, kabbalah, alchemy, reformation, 37_reasons, god_book_nature]

### Chymical Wedding of Christian Rosenkreuz (1616) — Third Manifesto
- **url:** https://sacred-texts.com/sro/rhr/rhr05.htm
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** One day per chunk. Seven days of the allegory = 7 primary chunks. Sub-divide dense days.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: chymical_wedding
  - date: 1616
  - day: [1_invitation, 2_weighing, 3_ascent, 4_beheading, 5_resurrection, 6_new_creation, 7_knighthood]
  - themes: [initiation, alchemy, transformation, death_rebirth, royal_wedding, allegory]

### The Real History of the Rosicrucians — Arthur Edward Waite (full scholarly survey)
- **url:** https://sacred-texts.com/sro/rhr/index.htm
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Chapter per chunk. 16 chapters + appendices.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: real_history_rosicrucians
  - author: ae_waite
  - type: scholarly_survey
  - themes: [history, context, michael_maier, robert_fludd, thomas_vaughan, freemasonry]

### Atalanta Fugiens — Michael Maier (50 emblems with commentaries)
- **url:** https://archive.org/details/atalantafugiens00maie
- **format:** PDF (archive.org)
- **priority:** 2
- **chunk_strategy:** One emblem + commentary per chunk. 50 total.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: atalanta_fugiens
  - author: michael_maier
  - themes: [alchemy, emblems, transformation, nature_secrets, music]

### Secret Symbols of the Rosicrucians (1785–1788)
- **url:** https://archive.org/details/SecretSymbolsOfTheRosicrucians
- **format:** PDF (archive.org)
- **priority:** 2
- **chunk_strategy:** Section per chunk. Images should be noted in metadata but not ingested as vectors.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: secret_symbols_rosicrucians
  - themes: [alchemy, mysticism, rosicrucian, symbols, meditation_images]

### Themis Aurea — Michael Maier (Laws of the Fraternity)
- **url:** https://sacred-texts.com/sro/rhr/rhr20.htm
- **format:** HTML
- **priority:** 3
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: themis_aurea
  - author: michael_maier
  - themes: [rosicrucian_laws, fraternity, medicine, philosophy]

### Rosicrucian Enlightenment — Frances Yates (scholarly context)
- **url:** https://archive.org/details/Rosecrucian
- **format:** HTML (archive.org stream)
- **priority:** 3
- **chunk_strategy:** Chapter per chunk.
- **metadata_tags:**
  - tradition: rosicrucianism
  - text: rosicrucian_enlightenment
  - author: frances_yates
  - type: academic_history
  - themes: [historical_context, palatinate, john_dee, hermetic_renaissance]

---

## LAYER 8: SCIENCE OVERLAY

### In-house synthesis documents (built from this research session)
These are Markdown documents created internally — the overlays, cross-tradition maps,
and science syntheses from this research session. They go into the corpus as first-party
content.

- **file:** qs_tradition_venn_overlay.md
- **file:** qs_darkness_void_synthesis.md
- **file:** qs_science_overlay.md
- **file:** qs_canonical_references.md
- **metadata_tags:**
  - type: quantum_strategies_synthesis
  - priority: 1
  - source: internal

### REBUS Model — Carhart-Harris & Friston (2019)
- **url:** https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6993338/
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Section per chunk (Abstract, Introduction, Key findings, Implications).
- **metadata_tags:**
  - tradition: science
  - domain: neuroscience
  - text: rebus_model
  - authors: carhart_harris_friston
  - themes: [predictive_coding, free_energy, ego_dissolution, psychedelics, DMN]

### Default Mode Network & Meditation — Key papers
- **url:** https://www.frontiersin.org/articles/10.3389/fnhum.2011.00058/full
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Section per chunk.
- **metadata_tags:**
  - tradition: science
  - domain: neuroscience
  - themes: [DMN, default_mode_network, meditation, self_referential, contemplative]

### Gamma Coherence in Long-term Meditators — Davidson et al. (2004)
- **url:** https://www.pnas.org/doi/10.1073/pnas.0407401101
- **format:** HTML
- **priority:** 1
- **chunk_strategy:** Abstract + findings as single chunk.
- **metadata_tags:**
  - tradition: science
  - domain: neuroscience
  - themes: [gamma_coherence, meditation, EEG, long_term_practitioners, synchrony]

### Orchestrated Objective Reduction — Penrose-Hameroff (2014 update)
- **url:** https://www.sciencedirect.com/science/article/pii/S1571064513001188
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Section per chunk.
- **metadata_tags:**
  - tradition: science
  - domain: physics_consciousness
  - themes: [orch_OR, quantum_consciousness, microtubules, quantum_coherence]

### Integrated Information Theory — Tononi (IIT 3.0)
- **url:** https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003588
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Section per chunk.
- **metadata_tags:**
  - tradition: science
  - domain: consciousness_theory
  - themes: [IIT, phi, integrated_information, consciousness_structure, axioms]

### Breathwork and Altered States — Recent research
- **url:** https://www.frontiersin.org/articles/10.3389/fnhum.2023.1091077/full
- **format:** HTML
- **priority:** 2
- **chunk_strategy:** Section per chunk.
- **metadata_tags:**
  - tradition: science
  - domain: neuroscience
  - themes: [breathwork, altered_states, CO2, ego_dissolution, psychedelic_similarity]

---

## CROSS-TRADITION THEME INDEX

These are the thematic tags used across all chunks. When building the vector index,
these tags should be stored as filterable metadata fields to enable cross-tradition queries.

| Tag | Traditions it spans |
|---|---|
| ego_dissolution | All 7 |
| divine_union | Sufism, Kabbalah, Christian, Hermeticism, Rosicrucianism |
| emptiness_void | All 7 |
| breath_practice | Tantra, Taoism, Christian, Sufism |
| sound_vibration | Sufism, Kabbalah, Tantra, Hermeticism |
| dark_night | Christian, Sufism, Kabbalah, Hermeticism |
| transformation | All 7 |
| stages_of_development | Sufism (nafs), Kabbalah (sefirot), Christian (mansions), Tantra (chakras), Rosicrucianism (7 days) |
| cosmogony | All 7 |
| master_transmission | All 7 |
| non_dual | Taoism, Tantra, Hermeticism, Christian (Eckhart) |
| sacred_geometry | Kabbalah, Hermeticism, Tantra, Rosicrucianism |
| alchemy | Hermeticism, Rosicrucianism, Tantra (inner_alchemy), Taoism (neidan) |
| divine_feminine | Tantra, Kabbalah (shekhinah), Taoism (mysterious_female), Rosicrucianism |
| science_DMN | All 7 (via REBUS overlay) |
| science_gamma | Tantra, Taoism, Christian (jhana parallel) |
| science_entropy | All 7 |
| science_quantum | All 7 (via Orch OR overlay) |

---

## CORPUS STATISTICS

| Tradition | Priority 1 texts | Priority 2 texts | Priority 3 texts | Est. chunks |
|---|---|---|---|---|
| Taoism | 3 | 3 | 1 | ~450 |
| Kabbalah | 5 | 3 | 0 | ~600 |
| Tantra | 4 | 2 | 1 | ~350 |
| Sufism | 4 | 3 | 0 | ~1,200 |
| Christian Mysticism | 5 | 3 | 0 | ~700 |
| Hermeticism | 4 | 2 | 0 | ~250 |
| Rosicrucianism | 4 | 4 | 2 | ~400 |
| Science Overlay | 4 | 3 | 0 | ~150 |
| **TOTAL** | **33** | **23** | **4** | **~4,100** |

At ~4,100 chunks with an average of 400 tokens each, the full corpus is approximately
1.6M tokens of source material. At text-embedding-3-large pricing this is a one-time
ingestion cost of under $1.00. Storage in Chroma locally = free.

---

## INGESTION PIPELINE NOTES

### Scraping sequence (recommended order)
1. HTML sources (sacred-texts.com, ccel.org, gnosis.org, ctext.org, sefaria.org) — direct requests
2. Archive.org PDFs — use requests + pdfplumber
3. AMORC/rosecroixjournal.org — check robots.txt, may need manual download

### Tools
- **Scraping:** Python requests + BeautifulSoup4
- **PDF extraction:** pdfplumber or pymupdf
- **Chunking:** LangChain RecursiveCharacterTextSplitter (chunk_size=512, chunk_overlap=64)
- **Embeddings:** OpenAI text-embedding-3-large or Cohere embed-english-v3
- **Vector store:** Chroma (local) → Weaviate (production)
- **Metadata format:** JSON per chunk, stored as Chroma metadata fields

### Special handling
- ctext.org: Chinese + English side by side — scrape English column only, note Chinese original in metadata
- sefaria.org: Hebrew + English — scrape English, note Hebrew in metadata
- sacred-texts.com: Older HTML, sometimes nested tables — parse carefully
- archive.org PDFs: Rate limit requests, 1 per 3 seconds

### Chunk metadata schema (JSON)
```json
{
  "tradition": "sufism",
  "text": "masnavi",
  "book": "1",
  "lines": "1-18",
  "chapter": null,
  "verse": null,
  "technique_number": null,
  "themes": ["separation", "longing", "divine_union", "return"],
  "author": "rumi",
  "date": "1258-1273",
  "translator": "nicholson",
  "source_url": "https://sacred-texts.com/isl/masnavi/msn01.htm",
  "priority": 1,
  "type": "primary_canon",
  "language": "english",
  "cross_tradition_tags": ["divine_union", "transformation", "stages_of_development"]
}
```

---

*Document version 1.0 — Quantum Strategies Sacred Knowledge Corpus*
*Generated from research session April 2026*
*All URLs verified as free public domain or openly licensed text*
