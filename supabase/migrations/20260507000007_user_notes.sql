CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_user_notes" ON public.user_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON public.user_notes TO service_role;
