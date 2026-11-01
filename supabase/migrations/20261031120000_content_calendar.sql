-- Content calendar: derivative pieces distilled from a long-form source post.
-- Additive only. Existing content_pieces rows (0 at time of writing) keep working.

-- 1. A piece can come from a published article instead of an angle
ALTER TABLE public.content_pieces ALTER COLUMN angle_id DROP NOT NULL;

ALTER TABLE public.content_pieces
  ADD COLUMN IF NOT EXISTS source_post_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Channel types for the distillation plan (LinkedIn kept only for old rows)
ALTER TABLE public.content_pieces DROP CONSTRAINT IF EXISTS content_pieces_piece_type_check;
ALTER TABLE public.content_pieces ADD CONSTRAINT content_pieces_piece_type_check CHECK (piece_type IN (
  'blog', 'social_twitter', 'social_linkedin', 'social_ig', 'email', 'email_sequence', 'gpt_product',
  'youtube_long', 'short', 'ig_carousel', 'ig_lettering', 'reddit', 'social_tiktok'
));

CREATE INDEX IF NOT EXISTS content_pieces_scheduled_idx ON public.content_pieces (scheduled_for);
CREATE INDEX IF NOT EXISTS content_pieces_source_post_idx ON public.content_pieces (source_post_id);
