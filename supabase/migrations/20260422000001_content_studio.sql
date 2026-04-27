-- =====================================================
-- Content Studio — long-form pillar + distribution pipeline
-- Anchor content (ebook/webinar/whitepaper/ecourse) →
--   chapters → blog posts → social sets → email → GPT products
-- =====================================================

-- Pillar: the anchor long-form piece
CREATE TABLE IF NOT EXISTS public.content_pillars (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  format           TEXT NOT NULL CHECK (format IN ('ebook', 'webinar', 'ecourse', 'whitepaper')),
  audience         TEXT,
  goal             TEXT,
  angle            TEXT,
  tone             TEXT DEFAULT 'inspirational'
    CHECK (tone IN ('mystical', 'academic', 'practical', 'inspirational')),
  tradition_filter TEXT,
  corpus_query     TEXT,
  status           TEXT NOT NULL DEFAULT 'brief'
    CHECK (status IN ('brief', 'research', 'outline', 'draft', 'review', 'published')),
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_pillars_status_idx  ON public.content_pillars (status);
CREATE INDEX IF NOT EXISTS content_pillars_format_idx  ON public.content_pillars (format);
CREATE INDEX IF NOT EXISTS content_pillars_created_idx ON public.content_pillars (created_at DESC);

CREATE TRIGGER update_content_pillars_updated_at
  BEFORE UPDATE ON public.content_pillars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sections: ordered chapters / sections within a pillar
CREATE TABLE IF NOT EXISTS public.content_sections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id       UUID NOT NULL REFERENCES public.content_pillars(id) ON DELETE CASCADE,
  order_index     INT NOT NULL DEFAULT 0,
  title           TEXT NOT NULL,
  description     TEXT,
  body            TEXT,
  version_history JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'draft', 'review', 'done')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_sections_pillar_idx ON public.content_sections (pillar_id, order_index);

CREATE TRIGGER update_content_sections_updated_at
  BEFORE UPDATE ON public.content_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pieces: derivative distribution content
CREATE TABLE IF NOT EXISTS public.content_pieces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id         UUID NOT NULL REFERENCES public.content_pillars(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES public.content_sections(id) ON DELETE SET NULL,
  piece_type        TEXT NOT NULL CHECK (piece_type IN (
    'blog', 'social_twitter', 'social_linkedin', 'social_ig',
    'email', 'email_sequence', 'gpt_product'
  )),
  title             TEXT,
  body              TEXT,
  platform_meta     JSONB DEFAULT '{}',
  version_history   JSONB DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'approved', 'published')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_pieces_pillar_idx   ON public.content_pieces (pillar_id);
CREATE INDEX IF NOT EXISTS content_pieces_section_idx  ON public.content_pieces (parent_section_id);
CREATE INDEX IF NOT EXISTS content_pieces_type_idx     ON public.content_pieces (piece_type);

CREATE TRIGGER update_content_pieces_updated_at
  BEFORE UPDATE ON public.content_pieces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Corpus links: which knowledge chunks informed a pillar
CREATE TABLE IF NOT EXISTS public.content_corpus_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id   UUID NOT NULL REFERENCES public.content_pillars(id) ON DELETE CASCADE,
  chunk_id    UUID NOT NULL REFERENCES public.knowledge_chunks(id) ON DELETE CASCADE,
  similarity  FLOAT,
  curated     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pillar_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS content_corpus_links_pillar_idx   ON public.content_corpus_links (pillar_id);
CREATE INDEX IF NOT EXISTS content_corpus_links_curated_idx  ON public.content_corpus_links (pillar_id, curated) WHERE curated = TRUE;

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE public.content_pillars      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pieces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_corpus_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_studio_admin_all" ON public.content_pillars FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','super_admin')));

CREATE POLICY "content_sections_admin_all" ON public.content_sections FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','super_admin')));

CREATE POLICY "content_pieces_admin_all" ON public.content_pieces FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','super_admin')));

CREATE POLICY "content_corpus_links_admin_all" ON public.content_corpus_links FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','super_admin')));
