-- =====================================================
-- Content schema refactor
-- content_pillars → content_angles (what it actually is)
-- New: content_pillars (strategic territory)
-- New: content_topics (subject within a pillar)
-- =====================================================

-- 1. Rename existing table + child column FKs
ALTER TABLE public.content_pillars RENAME TO content_angles;

ALTER TABLE public.content_sections     RENAME COLUMN pillar_id TO angle_id;
ALTER TABLE public.content_pieces       RENAME COLUMN pillar_id TO angle_id;
ALTER TABLE public.content_corpus_links RENAME COLUMN pillar_id TO angle_id;

ALTER TRIGGER update_content_pillars_updated_at
  ON public.content_angles
  RENAME TO update_content_angles_updated_at;

-- 2. True Pillars — strategic content territory
CREATE TABLE public.content_pillars (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  tradition_affinity TEXT[] DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_content_pillars_updated_at
  BEFORE UPDATE ON public.content_pillars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_pillars_admin_all" ON public.content_pillars FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "content_pillars_authenticated_read" ON public.content_pillars FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Topics — subject within a pillar
CREATE TABLE public.content_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id   UUID REFERENCES public.content_pillars(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  theme_tags  TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX content_topics_pillar_idx ON public.content_topics (pillar_id);

CREATE TRIGGER update_content_topics_updated_at
  BEFORE UPDATE ON public.content_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_topics_admin_all" ON public.content_topics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

CREATE POLICY "content_topics_authenticated_read" ON public.content_topics FOR SELECT
  USING (auth.role() = 'authenticated');

-- 4. Add topic_id to content_angles (nullable — existing rows are orphans until assigned)
ALTER TABLE public.content_angles
  ADD COLUMN topic_id UUID REFERENCES public.content_topics(id) ON DELETE SET NULL;

CREATE INDEX content_angles_topic_idx ON public.content_angles (topic_id);

-- =====================================================
-- SEED: The 5 QS Content Pillars
-- =====================================================

INSERT INTO public.content_pillars (title, description, tradition_affinity) VALUES

  (
    'The Self as Signal',
    'Who you are determines what you build. Consciousness, identity, waveform intelligence, perception, ego dissolution, Human Design, NLP. The self is the signal your market receives before the product does. Personal brand architecture — how your identity becomes your positioning, and why founders who haven''t done perception work build brands that feel hollow.',
    ARRAY['sufism', 'kabbalah', 'hinduism', 'science']
  ),

  (
    'The Architecture of Reality',
    'Reality is electrical. Strategy is pattern literacy. Waveform physics, density cascade, electrical perception, frequency vs amplitude vs bandwidth, phase coherence. Market timing, campaign pacing, why some offers land and others don''t even when the mechanics are identical. Phase coherence applied to launch strategy. Duty cycle applied to content output and burnout.',
    ARRAY['hermeticism', 'taoism', 'science']
  ),

  (
    'Strategy as Alignment',
    'Coherent systems outperform hustle every time. Quantum Business Framework, Three Rites diagnostics, waveform audit, timing, phase, the V.A.S.T. stack. Offer design, funnel architecture, PLG strategy, positioning against market alternatives. The Rites are both the transformation product and the strategic diagnostic tool.',
    ARRAY['rosicrucianism', 'kabbalah', 'taoism']
  ),

  (
    'Network as Infrastructure',
    'Coordination is the compound interest of community. Kingdom Economics, dinner party model, community coordination, collective momentum, role progression, Discord as infrastructure. Partnership architecture, referral mechanics, affiliate and revenue share design, co-marketing. How you build distribution through relationships rather than ads alone.',
    ARRAY['sufism', 'christian_mysticism', 'buddhism']
  ),

  (
    'The Builder''s Stack',
    'The fundamentals that make every vision executable. Demand generation, paid media, content marketing, conversion architecture, SEO, email, analytics, offer ladders, GTM strategy. The standalone business and marketing fundamentals pillar — no metaphysics required to enter here. Every fundamental gets a QS lens: demand generation becomes signal amplification, conversion architecture becomes phase alignment, SEO becomes visibility coherence.',
    ARRAY['science']
  );
