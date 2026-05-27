-- =====================================================
-- Migration: dynamic_question_infra
-- Date: 2026-05-26
--
-- Additive infrastructure for dynamic question routing,
-- audience-aware step rendering, and signal extraction
-- across Three Rites products.
--
-- Changes:
--   1. New table: question_pool
--   2. New table: session_signals
--   3. New column: product_sessions.audience_track
--
-- Nothing is dropped. No existing table or policy is
-- altered beyond adding the one column.
-- =====================================================


-- =====================================================
-- 1. question_pool
--    Candidate questions for dynamic step rendering.
--    Keyed by a slug-style id (e.g. 'sig.aware.step1.anchor')
--    so pool entries can be referenced symbolically by
--    the unlocks/blocks arrays and application logic.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.question_pool (
  -- Slug-style primary key for symbolic referencing
  id                TEXT        PRIMARY KEY,

  -- Which product this question belongs to
  product_slug      TEXT        NOT NULL,

  -- 1-based step index matching product_definitions.steps
  step_index        INTEGER     NOT NULL,

  -- Semantic domain tag (e.g. 'signal', 'values', 'energy')
  domain            TEXT        NOT NULL,

  -- Which rite this belongs to
  rite              TEXT        NOT NULL
                    CHECK (rite IN ('perception', 'orientation', 'declaration')),

  -- Role of this question within a step's candidate set
  question_role     TEXT        NOT NULL DEFAULT 'anchor'
                    CHECK (question_role IN ('anchor', 'followup', 'variant')),

  -- Audience experience level: 1=novice, 2=practiced, 3=advanced
  experience_level  INTEGER     NOT NULL DEFAULT 2
                    CHECK (experience_level BETWEEN 1 AND 3),

  -- Audience tracks this question targets; {all} means unrestricted
  audience_tracks   TEXT[]      NOT NULL DEFAULT ARRAY['all'],

  -- The question text displayed to the user
  prompt_text       TEXT        NOT NULL,

  -- Optional per-track prompt overrides:
  -- { "operator": "...", "side_builder": "..." }
  prompt_variants   JSONB,

  -- Optional simpler follow-up when a user response is vague
  followup_text     TEXT,

  -- Pool IDs unlocked by a response to this question
  unlocks           TEXT[],

  -- Pool IDs excluded after a response to this question
  blocks            TEXT[],

  -- Vocabulary of signals this question typically produces
  signals_extracted TEXT[],

  -- Soft-disable without deletion
  active            BOOLEAN     NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.question_pool IS
  'Candidate questions for dynamic step rendering across Three Rites products. '
  'Each row is a single question variant keyed by a slug-style id. '
  'application logic uses unlocks/blocks to route follow-up questions '
  'and signals_extracted to guide GPT signal extraction.';

COMMENT ON COLUMN public.question_pool.id IS
  'Slug-style identifier, e.g. sig.aware.step1.anchor. Used symbolically in unlocks/blocks arrays.';
COMMENT ON COLUMN public.question_pool.audience_tracks IS
  'Which audience tracks see this question. {all} = unrestricted. '
  'Valid track values: operator, side_builder, inside_player, almost_builder, seeker.';
COMMENT ON COLUMN public.question_pool.prompt_variants IS
  'Optional per-track overrides of prompt_text, keyed by track name.';
COMMENT ON COLUMN public.question_pool.unlocks IS
  'Pool ids that become reachable when a user responds to this question.';
COMMENT ON COLUMN public.question_pool.blocks IS
  'Pool ids excluded from consideration after a user responds to this question.';

-- Lookup index: typical query is "give me active questions for this product+step"
CREATE INDEX IF NOT EXISTS idx_question_pool_lookup
  ON public.question_pool (product_slug, step_index, active);


-- =====================================================
-- updated_at trigger for question_pool
--    Reuses the canonical function created in
--    20251130000000_core_tables.sql.
-- =====================================================

DROP TRIGGER IF EXISTS update_question_pool_updated_at ON public.question_pool;
CREATE TRIGGER update_question_pool_updated_at
  BEFORE UPDATE ON public.question_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- RLS: question_pool
--    Questions are read-only for authenticated users.
--    All writes go through service_role only.
-- =====================================================

ALTER TABLE public.question_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read question_pool" ON public.question_pool;
CREATE POLICY "Authenticated users can read question_pool"
  ON public.question_pool
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role full access to question_pool" ON public.question_pool;
CREATE POLICY "Service role full access to question_pool"
  ON public.question_pool
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant SELECT to authenticated so the Data API exposes it
GRANT SELECT ON public.question_pool TO authenticated;
GRANT ALL    ON public.question_pool TO service_role;


-- =====================================================
-- 2. session_signals
--    Per-session extracted signals from user responses.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.session_signals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent session; cascade delete keeps signal data tidy
  product_session_id UUID        NOT NULL
                     REFERENCES public.product_sessions(id) ON DELETE CASCADE,

  -- Which step produced this signal (nullable: some signals are session-level)
  step_index         INTEGER,

  -- Signal vocabulary token, e.g. 'signal:helper', 'audience:seeker'
  signal             TEXT        NOT NULL,

  -- Quoted snippet from the user response that evidences the signal
  evidence           TEXT,

  -- Extraction confidence between 0.00 and 1.00
  confidence         NUMERIC(3,2)
                     CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- How this signal was determined
  source             TEXT        NOT NULL DEFAULT 'extraction'
                     CHECK (source IN ('extraction', 'user_self_id', 'inferred')),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.session_signals IS
  'Extracted signal tokens per product session, produced during or after '
  'step completion by GPT extraction or user self-identification.';

COMMENT ON COLUMN public.session_signals.signal IS
  'Namespaced signal token, e.g. signal:helper, audience:seeker, energy:high.';
COMMENT ON COLUMN public.session_signals.confidence IS
  'Extraction confidence in the range 0.00–1.00. NULL means confidence was not calculated.';
COMMENT ON COLUMN public.session_signals.source IS
  'extraction = GPT-extracted from response text; '
  'user_self_id = explicitly stated by the user; '
  'inferred = derived from multiple weaker signals.';

CREATE INDEX IF NOT EXISTS idx_session_signals_session
  ON public.session_signals (product_session_id);


-- =====================================================
-- RLS: session_signals
--    Users can SELECT signals from sessions they own.
--    All writes go through service_role only.
--    Pattern mirrors product_sessions ownership check.
-- =====================================================

ALTER TABLE public.session_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own session signals" ON public.session_signals;
CREATE POLICY "Users can view own session signals"
  ON public.session_signals
  FOR SELECT
  TO authenticated
  USING (
    product_session_id IN (
      SELECT id
      FROM public.product_sessions
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role full access to session_signals" ON public.session_signals;
CREATE POLICY "Service role full access to session_signals"
  ON public.session_signals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant SELECT to authenticated so the Data API exposes it
GRANT SELECT ON public.session_signals TO authenticated;
GRANT ALL    ON public.session_signals TO service_role;


-- =====================================================
-- 3. product_sessions.audience_track
--    Nullable. Set after audience routing is resolved.
--    No CHECK constraint — flexibility for new tracks.
-- =====================================================

ALTER TABLE public.product_sessions
  ADD COLUMN IF NOT EXISTS audience_track TEXT;

COMMENT ON COLUMN public.product_sessions.audience_track IS
  'Resolved audience track for this session. Set after the routing step. '
  'Expected values: operator, side_builder, inside_player, almost_builder, seeker, unknown. '
  'Nullable until routing is complete. No constraint enforced for forward-compatibility.';


-- =====================================================
-- Verification block
--    Asserts all three objects exist before the
--    migration is recorded as applied.
-- =====================================================

DO $$
DECLARE
  v_question_pool_exists   boolean;
  v_session_signals_exists boolean;
  v_audience_track_exists  boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'question_pool'
  ) INTO v_question_pool_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'session_signals'
  ) INTO v_session_signals_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'product_sessions'
      AND column_name  = 'audience_track'
  ) INTO v_audience_track_exists;

  RAISE NOTICE 'question_pool exists:                 %', v_question_pool_exists;
  RAISE NOTICE 'session_signals exists:               %', v_session_signals_exists;
  RAISE NOTICE 'product_sessions.audience_track exists: %', v_audience_track_exists;

  IF NOT (v_question_pool_exists AND v_session_signals_exists AND v_audience_track_exists) THEN
    RAISE EXCEPTION 'dynamic_question_infra migration verification failed';
  END IF;
END $$;
