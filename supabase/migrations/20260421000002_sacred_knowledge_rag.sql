-- =====================================================
-- Sacred Knowledge RAG — pgvector corpus infrastructure
-- Enables the Quantum Strategies knowledge engine:
-- 7 mystical traditions + science overlay, ~4,100 chunks
-- =====================================================

-- Enable pgvector (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- KNOWLEDGE CHUNKS
-- The core corpus table. One row per text chunk.
-- Embeddings are 1536-dim (OpenAI text-embedding-3-small)
-- or 3072-dim (text-embedding-3-large). Default: 1536.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Corpus identity
  tradition        TEXT NOT NULL,  -- taoism | kabbalah | tantra | sufism | christian_mysticism | hermeticism | rosicrucianism | science
  text_name        TEXT NOT NULL,  -- tao_te_ching | masnavi | zohar | vbt | corpus_hermeticum | ...
  author           TEXT,
  translator       TEXT,
  date_composed    TEXT,           -- e.g. "1258-1273", "~1375", "3rd century CE"

  -- Location within the text
  book             TEXT,
  chapter          TEXT,
  verse            TEXT,
  lines            TEXT,           -- e.g. "1-18" for Masnavi prologue
  technique_number INTEGER,        -- VBT technique index (1-112)
  section          TEXT,           -- named section within a text
  day              TEXT,           -- Chymical Wedding day label

  -- Content
  content          TEXT NOT NULL,
  embedding        vector(1536),

  -- Discovery metadata
  priority         INTEGER DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  content_type     TEXT DEFAULT 'primary_canon',  -- primary_canon | commentary | scholarly | synthesis | science
  source_url       TEXT,
  language         TEXT DEFAULT 'english',

  -- Thematic indexing — stored as arrays for filterable OR queries
  themes           TEXT[] DEFAULT '{}',
  cross_tradition_tags TEXT[] DEFAULT '{}',

  -- Full structured metadata for anything not in columns above
  metadata         JSONB DEFAULT '{}',

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Vector similarity index (IVFFlat — good for ~4,100 chunks)
-- lists = sqrt(n_rows) is the standard starting point
-- Rebuild with HNSW if query latency becomes an issue at scale
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON public.knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 64);

-- Filterable columns
CREATE INDEX IF NOT EXISTS knowledge_chunks_tradition_idx  ON public.knowledge_chunks (tradition);
CREATE INDEX IF NOT EXISTS knowledge_chunks_text_name_idx  ON public.knowledge_chunks (text_name);
CREATE INDEX IF NOT EXISTS knowledge_chunks_priority_idx   ON public.knowledge_chunks (priority);
CREATE INDEX IF NOT EXISTS knowledge_chunks_type_idx       ON public.knowledge_chunks (content_type);

-- GIN indexes for array containment queries (@>)
CREATE INDEX IF NOT EXISTS knowledge_chunks_themes_idx
  ON public.knowledge_chunks USING GIN (themes);
CREATE INDEX IF NOT EXISTS knowledge_chunks_cross_tags_idx
  ON public.knowledge_chunks USING GIN (cross_tradition_tags);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================

CREATE TRIGGER update_knowledge_chunks_updated_at
  BEFORE UPDATE ON public.knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SIMILARITY SEARCH FUNCTION
-- Called by the Next.js API route at query time.
-- Takes a pre-computed query embedding + optional filters.
-- =====================================================

CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding  vector(1536),
  match_threshold  FLOAT   DEFAULT 0.65,
  match_count      INT     DEFAULT 8,
  filter_tradition TEXT    DEFAULT NULL,
  filter_priority  INTEGER DEFAULT NULL,
  filter_themes    TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  tradition            TEXT,
  text_name            TEXT,
  author               TEXT,
  chapter              TEXT,
  verse                TEXT,
  lines                TEXT,
  technique_number     INTEGER,
  section              TEXT,
  content              TEXT,
  themes               TEXT[],
  cross_tradition_tags TEXT[],
  source_url           TEXT,
  priority             INTEGER,
  content_type         TEXT,
  metadata             JSONB,
  similarity           FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.tradition,
    kc.text_name,
    kc.author,
    kc.chapter,
    kc.verse,
    kc.lines,
    kc.technique_number,
    kc.section,
    kc.content,
    kc.themes,
    kc.cross_tradition_tags,
    kc.source_url,
    kc.priority,
    kc.content_type,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE
    -- Tradition filter (NULL = search all)
    (filter_tradition IS NULL OR kc.tradition = filter_tradition)
    -- Priority filter (NULL = all priorities)
    AND (filter_priority IS NULL OR kc.priority <= filter_priority)
    -- Theme filter — chunk must contain ALL requested themes
    AND (filter_themes IS NULL OR kc.themes @> filter_themes OR kc.cross_tradition_tags @> filter_themes)
    -- Similarity threshold
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- =====================================================
-- KEYWORD SEARCH FUNCTION (hybrid retrieval)
-- Runs in parallel with match_knowledge for BM25-style
-- matching. Results are merged and deduplicated in app code.
-- =====================================================

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS fts_content TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
  ON public.knowledge_chunks USING GIN (fts_content);

CREATE OR REPLACE FUNCTION public.search_knowledge_keyword(
  query_text       TEXT,
  match_count      INT     DEFAULT 8,
  filter_tradition TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  tradition   TEXT,
  text_name   TEXT,
  author      TEXT,
  chapter     TEXT,
  verse       TEXT,
  lines       TEXT,
  section     TEXT,
  content     TEXT,
  themes      TEXT[],
  source_url  TEXT,
  priority    INTEGER,
  rank        FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.tradition,
    kc.text_name,
    kc.author,
    kc.chapter,
    kc.verse,
    kc.lines,
    kc.section,
    kc.content,
    kc.themes,
    kc.source_url,
    kc.priority,
    ts_rank(kc.fts_content, websearch_to_tsquery('english', query_text)) AS rank
  FROM public.knowledge_chunks kc
  WHERE
    kc.fts_content @@ websearch_to_tsquery('english', query_text)
    AND (filter_tradition IS NULL OR kc.tradition = filter_tradition)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

-- =====================================================
-- QUERY LOG
-- Every query through the knowledge engine is recorded.
-- Powers content analytics: what is the community asking?
-- =====================================================

CREATE TABLE IF NOT EXISTS public.knowledge_queries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- The query
  query_text        TEXT NOT NULL,
  filter_tradition  TEXT,
  filter_themes     TEXT[],

  -- Retrieval results summary
  chunks_retrieved  INTEGER,
  traditions_hit    TEXT[],   -- which traditions appeared in retrieved chunks

  -- Generation
  response_length   INTEGER,
  model_used        TEXT,

  -- Source context (which product page triggered this)
  product_slug      TEXT,
  session_id        UUID REFERENCES public.product_sessions(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_queries_user_idx       ON public.knowledge_queries (user_id);
CREATE INDEX IF NOT EXISTS knowledge_queries_created_idx    ON public.knowledge_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_queries_tradition_idx  ON public.knowledge_queries (filter_tradition);
CREATE INDEX IF NOT EXISTS knowledge_queries_product_idx    ON public.knowledge_queries (product_slug);

-- =====================================================
-- CORPUS SOURCES REGISTRY
-- One row per source document in the manifest.
-- Tracks ingestion status so you know what's loaded.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tradition       TEXT NOT NULL,
  text_name       TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  author          TEXT,
  source_url      TEXT,
  format          TEXT,                   -- html | pdf | markdown
  priority        INTEGER DEFAULT 2,
  chunk_count     INTEGER DEFAULT 0,
  ingested_at     TIMESTAMPTZ,
  last_refreshed  TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending'  -- pending | ingested | error | skipped
    CHECK (status IN ('pending', 'ingested', 'error', 'skipped')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_sources_unique_idx
  ON public.knowledge_sources (tradition, text_name, COALESCE(source_url, ''));

-- =====================================================
-- RLS POLICIES
-- Knowledge chunks are readable by all authenticated users.
-- Tighten to product_access check once access tiers are defined.
-- Query log and sources table: admin only.
-- =====================================================

ALTER TABLE public.knowledge_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the corpus
CREATE POLICY "knowledge_chunks_authenticated_read"
  ON public.knowledge_chunks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can manage the corpus
CREATE POLICY "knowledge_chunks_admin_all"
  ON public.knowledge_chunks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Users can read their own queries; admins can read all
CREATE POLICY "knowledge_queries_own_read"
  ON public.knowledge_queries FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Service role inserts query logs (no user filter needed — bypasses RLS)
CREATE POLICY "knowledge_queries_insert"
  ON public.knowledge_queries FOR INSERT
  WITH CHECK (true);

-- Admins manage sources registry
CREATE POLICY "knowledge_sources_admin_all"
  ON public.knowledge_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "knowledge_sources_authenticated_read"
  ON public.knowledge_sources FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================
-- SEED: SOURCES REGISTRY FROM MANIFEST
-- Pre-populate the registry so ingestion status is trackable
-- from day one. chunk_count starts at 0, status = 'pending'.
-- =====================================================

INSERT INTO public.knowledge_sources (tradition, text_name, display_name, author, source_url, format, priority) VALUES
  -- TAOISM
  ('taoism', 'tao_te_ching',    'Tao Te Ching',              'Laozi',           'https://classics.mit.edu/Lao/taote.1.1.html',                    'html', 1),
  ('taoism', 'tao_te_ching',    'Tao Te Ching (multi-trans)', NULL,             'https://bopsecrets.org/gateway/passages/tao-te-ching.htm',       'html', 2),
  ('taoism', 'zhuangzi',        'Zhuangzi — Inner Chapters',  'Zhuangzi',       'https://ctext.org/zhuangzi/inner-chapters',                      'html', 1),
  ('taoism', 'zhuangzi',        'Zhuangzi — Outer Chapters',  'Zhuangzi',       'https://ctext.org/zhuangzi',                                     'html', 2),
  ('taoism', 'neiye',           'Neiye (Inner Training)',      NULL,             'https://ctext.org/guanzi/nei-ye',                                'html', 1),
  ('taoism', 'i_ching',         'I Ching',                    NULL,             'https://sacred-texts.com/ich/index.htm',                         'html', 2),
  ('taoism', 'liezi',           'Liezi',                      'Liezi',          'https://ctext.org/liezi',                                        'html', 3),
  -- KABBALAH
  ('kabbalah', 'sefer_yetzirah', 'Sefer Yetzirah',            NULL,             'https://www.sacred-texts.com/jud/yetzirah.htm',                  'html', 1),
  ('kabbalah', 'sefer_yetzirah', 'Sefer Yetzirah (Sefaria)',  NULL,             'https://www.sefaria.org/Sefer_Yetzirah',                         'html', 1),
  ('kabbalah', 'zohar',          'Zohar — Bereishit',         NULL,             'https://www.sefaria.org/Zohar,_Bereshit',                        'html', 1),
  ('kabbalah', 'zohar',          'Zohar — Idra Raba',         NULL,             'https://www.sefaria.org/Zohar,_Idra_Rabba',                      'html', 1),
  ('kabbalah', 'zohar',          'Zohar — Idra Zuta',         NULL,             'https://www.sefaria.org/Zohar,_Idra_Zuta',                       'html', 1),
  ('kabbalah', 'zohar',          'Zohar — Shir HaShirim',     NULL,             'https://www.sefaria.org/Zohar,_Song_of_Songs',                   'html', 2),
  ('kabbalah', 'bahir',          'Bahir',                     NULL,             'https://www.sacred-texts.com/jud/bahir/index.htm',               'html', 2),
  ('kabbalah', 'shaarei_orah',   'Sha''are Orah',             'Joseph Gikatilla','https://www.sacred-texts.com/jud/index.htm',                   'html', 2),
  -- TANTRA
  ('tantra', 'vijnana_bhairava_tantra', 'Vijñana Bhairava Tantra',        NULL,             'https://www.sacred-texts.com/tantra/vbt/index.htm',             'html', 1),
  ('tantra', 'vijnana_bhairava_tantra', 'VBT — Wallis Commentary',        'Christopher Wallis', 'https://hareesh.org/blog/2016/5/18/the-vijnana-bhairava-tantra-a-brief-overview', 'html', 2),
  ('tantra', 'shiva_sutras',     'Shiva Sutras',               NULL,             'https://sacred-texts.com/tantra/ss/index.htm',                   'html', 1),
  ('tantra', 'mahanirvana_tantra','Mahanirvana Tantra',         NULL,             'https://www.sacred-texts.com/tantra/maha/index.htm',             'html', 2),
  ('tantra', 'kularnava_tantra', 'Kularnava Tantra',            NULL,             'https://archive.org/details/KularnavaTantra',                    'pdf',  2),
  ('tantra', 'tantraloka',       'Tantraloka (selections)',     'Abhinavagupta',  'https://www.academia.edu/search?q=tantraloka+translation',       'pdf',  3),
  ('tantra', 'heart_sutra',      'Heart Sutra',                 NULL,             'https://www.sacred-texts.com/bud/tib/hrt.htm',                   'html', 1),
  -- SUFISM
  ('sufism', 'masnavi',          'Masnavi — All 6 Books',      'Rumi',           'https://sacred-texts.com/isl/masnavi/index.htm',                 'html', 1),
  ('sufism', 'masnavi',          'Masnavi — Reed Flute Prologue','Rumi',         'https://www.dar-al-masnavi.org/reedsong.html',                   'html', 1),
  ('sufism', 'divan_e_shams',    'Divan-e Shams-e Tabrizi',    'Rumi',           'https://rumi.network/divan-e-shams/',                            'html', 2),
  ('sufism', 'fusus_al_hikam',   'Fusus al-Hikam',             'Ibn Arabi',      'https://sacred-texts.com/isl/fusu/index.htm',                    'html', 1),
  ('sufism', 'conference_of_the_birds','Conference of the Birds','Attar',        'https://sacred-texts.com/isl/cfb/index.htm',                     'html', 1),
  ('sufism', 'deliverance_from_error','Deliverance from Error', 'Al-Ghazali',    'https://archive.org/details/AlGhazaliDeliverance',               'pdf',  2),
  ('sufism', 'risala_qushayri',  'Risalat al-Qushayri',        'Al-Qushayri',    'https://sacred-texts.com/isl/index.htm',                         'html', 2),
  -- CHRISTIAN MYSTICISM
  ('christian_mysticism', 'cloud_of_unknowing',  'Cloud of Unknowing',        NULL,              'https://sacred-texts.com/chr/cou/index.htm',              'html', 1),
  ('christian_mysticism', 'dark_night_of_the_soul','Dark Night of the Soul',  'John of the Cross','https://ccel.org/ccel/john_cross/dark_night',             'html', 1),
  ('christian_mysticism', 'interior_castle',     'Interior Castle',           'Teresa of Avila', 'https://ccel.org/ccel/teresa/castle2',                     'html', 1),
  ('christian_mysticism', 'mystical_theology',   'Mystical Theology',         'Pseudo-Dionysius','https://ccel.org/ccel/dionysius/mystical/',                'html', 1),
  ('christian_mysticism', 'eckhart_sermons',     'Meister Eckhart — Sermons', 'Meister Eckhart', 'https://dhspriory.org/kenny/Eckhart.htm',                  'html', 1),
  ('christian_mysticism', 'showings',            'Showings',                  'Julian of Norwich','https://ccel.org/ccel/julian/revelations',                'html', 2),
  ('christian_mysticism', 'practice_presence_god','Practice of the Presence', 'Brother Lawrence','https://ccel.org/ccel/lawrence/practice',                 'html', 2),
  ('christian_mysticism', 'spiritual_canticle',  'Spiritual Canticle',        'John of the Cross','https://ccel.org/ccel/john_cross/canticle',               'html', 2),
  -- HERMETICISM
  ('hermeticism', 'corpus_hermeticum', 'Corpus Hermeticum — All Tractates', NULL,  'https://gnosis.org/library/hermetica.htm',                     'html', 1),
  ('hermeticism', 'corpus_hermeticum', 'Tractate I: Poimandres',            NULL,  'https://gnosis.org/library/hermes1.html',                      'html', 1),
  ('hermeticism', 'corpus_hermeticum', 'Tractate XIII: Secret Sermon',      NULL,  'https://gnosis.org/library/hermes13.html',                     'html', 1),
  ('hermeticism', 'emerald_tablet',    'Emerald Tablet',                    NULL,  'https://sacred-texts.com/alc/emerald.htm',                     'html', 1),
  ('hermeticism', 'asclepius',         'Asclepius',                         NULL,  'https://gnosis.org/library/asclepius.htm',                     'html', 2),
  ('hermeticism', 'kybalion',          'The Kybalion',                      NULL,  'https://sacred-texts.com/eso/kyb/index.htm',                   'html', 2),
  -- ROSICRUCIANISM
  ('rosicrucianism', 'fama_fraternitatis',      'Fama Fraternitatis (1614)',      NULL,        'https://sacred-texts.com/sro/rhr/rhr03.htm',              'html', 1),
  ('rosicrucianism', 'fama_fraternitatis',      'Fama Fraternitatis (Vaughan)',   NULL,        'https://www.nommeraadio.ee/meedia/pdf/RRS/Rosicrucian%20Manifestos.pdf', 'pdf', 1),
  ('rosicrucianism', 'confessio_fraternitatis', 'Confessio Fraternitatis (1615)', NULL,        'https://sacred-texts.com/sro/rhr/rhr04.htm',              'html', 1),
  ('rosicrucianism', 'chymical_wedding',        'Chymical Wedding (1616)',        NULL,        'https://sacred-texts.com/sro/rhr/rhr05.htm',              'html', 1),
  ('rosicrucianism', 'real_history_rosicrucians','Real History of the Rosicrucians','A.E. Waite','https://sacred-texts.com/sro/rhr/index.htm',            'html', 2),
  ('rosicrucianism', 'atalanta_fugiens',        'Atalanta Fugiens',              'Michael Maier','https://archive.org/details/atalantafugiens00maie',     'pdf',  2),
  ('rosicrucianism', 'secret_symbols_rosicrucians','Secret Symbols of the Rosicrucians',NULL,  'https://archive.org/details/SecretSymbolsOfTheRosicrucians','pdf', 2),
  ('rosicrucianism', 'themis_aurea',            'Themis Aurea',                  'Michael Maier','https://sacred-texts.com/sro/rhr/rhr20.htm',            'html', 3),
  ('rosicrucianism', 'rosicrucian_enlightenment','Rosicrucian Enlightenment',    'Frances Yates','https://archive.org/details/Rosecrucian',               'html', 3),
  -- SCIENCE OVERLAY
  ('science', 'rebus_model',           'REBUS Model',                      'Carhart-Harris & Friston', 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6993338/', 'html', 1),
  ('science', 'dmn_meditation',        'DMN & Meditation',                 NULL,        'https://www.frontiersin.org/articles/10.3389/fnhum.2011.00058/full', 'html', 1),
  ('science', 'gamma_coherence',       'Gamma Coherence in Meditators',    'Davidson et al.', 'https://www.pnas.org/doi/10.1073/pnas.0407401101',         'html', 1),
  ('science', 'orch_or',               'Orchestrated Objective Reduction', 'Penrose-Hameroff', 'https://www.sciencedirect.com/science/article/pii/S1571064513001188', 'html', 2),
  ('science', 'iit',                   'Integrated Information Theory 3.0','Tononi',    'https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003588', 'html', 2),
  ('science', 'breathwork_altered',    'Breathwork & Altered States',      NULL,        'https://www.frontiersin.org/articles/10.3389/fnhum.2023.1091077/full', 'html', 2),
  -- IN-HOUSE SYNTHESIS (files, not URLs — ingested from local markdown)
  ('science', 'qs_tradition_venn_overlay',   'QS Tradition Venn Overlay',  'Quantum Strategies', NULL, 'markdown', 1),
  ('science', 'qs_darkness_void_synthesis',  'QS Darkness/Void Synthesis', 'Quantum Strategies', NULL, 'markdown', 1),
  ('science', 'qs_science_overlay',          'QS Science Overlay',         'Quantum Strategies', NULL, 'markdown', 1),
  ('science', 'qs_canonical_references',     'QS Canonical References',    'Quantum Strategies', NULL, 'markdown', 1)

ON CONFLICT (tradition, text_name, COALESCE(source_url, '')) DO NOTHING;
