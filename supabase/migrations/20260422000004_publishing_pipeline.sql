-- Publishing Pipeline
-- Adds slug to content_pillars for public routes
-- Adds provenance FKs to content_posts for studio-originated content

-- 1. Slug column on content_pillars
ALTER TABLE public.content_pillars ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.content_pillars
SET slug = lower(
  regexp_replace(
    regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

ALTER TABLE public.content_pillars ADD CONSTRAINT content_pillars_slug_unique UNIQUE (slug);
ALTER TABLE public.content_pillars ALTER COLUMN slug SET NOT NULL;

-- 2. Provenance columns on content_posts (nullable, studio-originated content)
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL;

ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.content_topics(id) ON DELETE SET NULL;

ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS piece_id UUID REFERENCES public.content_pieces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS content_posts_pillar_idx ON public.content_posts (pillar_id);
CREATE INDEX IF NOT EXISTS content_posts_piece_idx  ON public.content_posts (piece_id);

NOTIFY pgrst, 'reload schema';
