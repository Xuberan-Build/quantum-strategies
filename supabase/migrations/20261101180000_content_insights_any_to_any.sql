-- Any-to-any content system (brain/content/social-master-plan.md §1, §2, §5).
-- 1. content_insights: the unit every asset carries (one idea Austin said or wrote, with its source).
-- 2. content_asset_links: "made from" edges between any two assets, with direction (down / up / across / same).
-- 3. insight_id on content_pieces and social_posts: which insight an asset carries.
-- 4. content_promotions: winners proposed for a longer form (reviewed by Austin, then added to the topical map).
-- Additive only. Service-role access only (RLS on, no policies), like the rest of the content engine.

CREATE TABLE IF NOT EXISTS public.content_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line TEXT NOT NULL,                                   -- the idea in one sentence, Austin's words
  source_kind TEXT NOT NULL DEFAULT 'other' CHECK (source_kind IN (
    'article', 'vcap', 'reddit', 'x', 'recording', 'video', 'interview', 'other'
  )),
  source_ref TEXT,                                      -- slug, url, or file + timestamp
  source_post_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL,
  claim TEXT,                                           -- factual claim it makes, if any
  evidence_tier TEXT,                                   -- tier of the evidence behind the claim
  pillar TEXT,                                          -- P1..P8 or X (content/architecture.md)
  cluster TEXT,                                         -- problem cluster 1..12 (gtm/problem-solution-map.md)
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_insights_source_post_idx ON public.content_insights (source_post_id);
CREATE INDEX IF NOT EXISTS content_insights_status_idx ON public.content_insights (status, created_at DESC);

-- Asset kinds: article = content_posts, piece = content_pieces, social_post = social_posts,
-- insight = content_insights, external = a url (Reddit post, X post not made by the publisher). ids are text so
-- external urls fit; app code validates uuids for the internal kinds.
CREATE TABLE IF NOT EXISTS public.content_asset_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_kind TEXT NOT NULL CHECK (from_kind IN ('article', 'piece', 'social_post', 'insight', 'external')),
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL CHECK (to_kind IN ('article', 'piece', 'social_post', 'insight', 'external')),
  to_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('down', 'up', 'across', 'same')),
  insight_id UUID REFERENCES public.content_insights(id) ON DELETE SET NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_kind, from_id, to_kind, to_id)
);
CREATE INDEX IF NOT EXISTS content_asset_links_from_idx ON public.content_asset_links (from_kind, from_id);
CREATE INDEX IF NOT EXISTS content_asset_links_to_idx ON public.content_asset_links (to_kind, to_id);
CREATE INDEX IF NOT EXISTS content_asset_links_insight_idx ON public.content_asset_links (insight_id);

ALTER TABLE public.content_pieces ADD COLUMN IF NOT EXISTS insight_id UUID REFERENCES public.content_insights(id) ON DELETE SET NULL;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS insight_id UUID REFERENCES public.content_insights(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS content_pieces_insight_idx ON public.content_pieces (insight_id);
CREATE INDEX IF NOT EXISTS social_posts_insight_idx ON public.social_posts (insight_id);

-- New derivative types for "make from this" (X Articles by hand; Reddit posts distinct from answers).
ALTER TABLE public.content_pieces DROP CONSTRAINT IF EXISTS content_pieces_piece_type_check;
ALTER TABLE public.content_pieces ADD CONSTRAINT content_pieces_piece_type_check CHECK (piece_type IN (
  'blog', 'social_twitter', 'social_linkedin', 'social_ig', 'email', 'email_sequence', 'gpt_product',
  'youtube_long', 'short', 'ig_carousel', 'ig_lettering', 'reddit', 'social_tiktok',
  'x_article', 'reddit_post'
));

CREATE TABLE IF NOT EXISTS public.content_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('social_target', 'social_post', 'piece', 'external', 'insight')),
  source_id TEXT NOT NULL,
  insight_id UUID REFERENCES public.content_insights(id) ON DELETE SET NULL,
  platform TEXT,                                        -- youtube | instagram | tiktok | x | reddit | ...
  metric TEXT,                                          -- the number that matters on that channel
  value NUMERIC,
  channel_median NUMERIC,
  multiple NUMERIC,                                     -- value / channel_median
  proposed_title TEXT,
  proposed_format TEXT NOT NULL,                        -- a content_pieces.piece_type (blog, youtube_long, reddit_post, x_article, ig_carousel, ...)
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'dismissed', 'done')),
  piece_id UUID REFERENCES public.content_pieces(id) ON DELETE SET NULL,  -- the longer piece made from it
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_id, proposed_format)
);
CREATE INDEX IF NOT EXISTS content_promotions_status_idx ON public.content_promotions (status, created_at DESC);

ALTER TABLE public.content_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_asset_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_promotions ENABLE ROW LEVEL SECURITY;
