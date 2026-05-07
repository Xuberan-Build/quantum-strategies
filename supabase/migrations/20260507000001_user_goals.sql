-- =====================================================
-- User Goals — tied to Three Rites journey stages
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  rite_stage   TEXT CHECK (rite_stage IN ('orientation', 'perception', 'declaration', 'all')),
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'achieved', 'paused')),
  ai_insights  JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title)
);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON public.user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_status ON public.user_goals(user_id, status);

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their goals"
  ON public.user_goals FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages user_goals"
  ON public.user_goals FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE TRIGGER update_user_goals_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
