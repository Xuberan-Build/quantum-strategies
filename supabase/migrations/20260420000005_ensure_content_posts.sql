-- Re-apply content_posts table creation — prior migration (20260406000006) was
-- recorded in schema_migrations but the table was never actually created.
CREATE TABLE IF NOT EXISTS public.content_posts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('blog', 'whitepaper', 'resource')),
  title         TEXT NOT NULL,
  excerpt       TEXT,
  body          TEXT DEFAULT '',
  author        TEXT,
  tags          TEXT[] DEFAULT '{}',
  is_published  BOOLEAN DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_posts_type_idx        ON content_posts (type);
CREATE INDEX IF NOT EXISTS content_posts_published_idx   ON content_posts (is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS content_posts_slug_idx        ON content_posts (slug);

CREATE OR REPLACE FUNCTION public.update_content_posts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_content_posts_updated_at ON public.content_posts;
CREATE TRIGGER trigger_content_posts_updated_at
  BEFORE UPDATE ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_content_posts_updated_at();

ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_posts' AND policyname = 'Public can read published posts'
  ) THEN
    CREATE POLICY "Public can read published posts"
      ON public.content_posts FOR SELECT
      USING (is_published = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_posts' AND policyname = 'Service role full access to content_posts'
  ) THEN
    CREATE POLICY "Service role full access to content_posts"
      ON public.content_posts TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
