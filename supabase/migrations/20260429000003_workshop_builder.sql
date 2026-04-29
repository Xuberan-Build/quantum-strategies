-- Workshop builder tables

CREATE TABLE IF NOT EXISTS public.workshops (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workshop_modules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  video_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workshop_slides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid NOT NULL REFERENCES public.workshop_modules(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  slide_type text NOT NULL DEFAULT 'content'
    CHECK (slide_type IN ('title', 'statement', 'content', 'before_after', 'formula', 'insight')),
  content jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access workshops" ON public.workshops
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access workshop_modules" ON public.workshop_modules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access workshop_slides" ON public.workshop_slides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER workshops_updated_at
  BEFORE UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER workshop_modules_updated_at
  BEFORE UPDATE ON public.workshop_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER workshop_slides_updated_at
  BEFORE UPDATE ON public.workshop_slides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_workshop_modules_workshop_id
  ON public.workshop_modules(workshop_id, position);
CREATE INDEX IF NOT EXISTS idx_workshop_slides_module_id
  ON public.workshop_slides(module_id, position);
