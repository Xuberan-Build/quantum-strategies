-- Fix content_angles format CHECK constraint.
-- The content_angles table was renamed from the original content_pillars table
-- (20260422000001), which had a legacy format constraint for 'ebook','webinar','ecourse','whitepaper'.
-- The current content pipeline uses format values like blog_post, long_form_essay, deep_dive, etc.
-- This migration drops the old constraint and adds the current one.

ALTER TABLE public.content_angles
  DROP CONSTRAINT IF EXISTS content_pillars_format_check;

ALTER TABLE public.content_angles
  ALTER COLUMN format DROP NOT NULL;

ALTER TABLE public.content_angles
  DROP CONSTRAINT IF EXISTS content_angles_format_check;

ALTER TABLE public.content_angles
  ADD CONSTRAINT content_angles_format_check CHECK (
    format IS NULL OR format IN (
      'blog_post',
      'thread',
      'video_script',
      'long_form_essay',
      'deep_dive',
      'comparison',
      'how_to_guide',
      'email_sequence',
      'gpt_product',
      'ebook',
      'webinar',
      'ecourse',
      'whitepaper'
    )
  );

-- Also drop the tone constraint (same stale table); tone column is unused in current pipeline
ALTER TABLE public.content_angles
  DROP CONSTRAINT IF EXISTS content_pillars_tone_check;

NOTIFY pgrst, 'reload schema';
