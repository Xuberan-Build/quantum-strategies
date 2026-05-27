-- =====================================================
-- Migration: friction_log_and_tao_situations
-- Date: 2026-05-26
--
-- Additive tables for user-flagged step friction
-- capture and the Tao situation corpus.
--
-- Changes:
--   1. New table: step_friction_log
--   2. New table: tao_situations
--
-- Nothing is dropped. No existing table or policy is
-- altered in any way.
-- =====================================================


-- =====================================================
-- 1. step_friction_log
--    Captures user-flagged friction on any product step.
--    Users hit a small in-flow button ("too tedious",
--    "unclear", "other") and admins triage in a sidebar.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.step_friction_log (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user who flagged friction (nullable FK; SET NULL on user delete)
  user_id              UUID
                       REFERENCES public.users(id) ON DELETE SET NULL,

  -- The session in which friction occurred; cascade on session delete
  product_session_id   UUID
                       REFERENCES public.product_sessions(id) ON DELETE CASCADE,

  -- Slug of the product where the friction occurred
  product_slug         TEXT        NOT NULL,

  -- 0-based or 1-based step index matching the product definition
  step_index           INTEGER,

  -- Reason the user flagged this step
  reason               TEXT        NOT NULL
                       CHECK (reason IN ('tedious', 'unclear', 'other')),

  -- Optional free-text note from the user
  note                 TEXT,

  -- Optional snippet of the user's in-progress response at the time of flag
  response_excerpt     TEXT,

  -- Triage lifecycle status
  status               TEXT        NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'triaged', 'resolved', 'wont_fix')),

  -- Admin user who performed triage (SET NULL if that admin is deleted)
  triaged_by           UUID
                       REFERENCES public.users(id) ON DELETE SET NULL,

  -- When triage action was taken
  triaged_at           TIMESTAMPTZ,

  -- Admin note recorded during triage
  triage_note          TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.step_friction_log IS
  'User-flagged friction events on product steps. '
  'A user presses a small in-flow button (tedious / unclear / other) and '
  'an optional note is captured. Admins triage via a sidebar and advance '
  'status through new → triaged → resolved | wont_fix.';

COMMENT ON COLUMN public.step_friction_log.user_id IS
  'The authenticated user who flagged the friction. SET NULL if the user is deleted.';
COMMENT ON COLUMN public.step_friction_log.product_session_id IS
  'The session context for the flag. Cascade-deleted with the session.';
COMMENT ON COLUMN public.step_friction_log.reason IS
  'Primary friction category chosen by the user: tedious | unclear | other.';
COMMENT ON COLUMN public.step_friction_log.response_excerpt IS
  'Optional short snippet of the user''s in-progress step response at flag time. '
  'Helps admins understand what the user was doing when they flagged.';
COMMENT ON COLUMN public.step_friction_log.status IS
  'Triage lifecycle: new (unreviewed) → triaged (seen) → resolved | wont_fix.';
COMMENT ON COLUMN public.step_friction_log.triaged_by IS
  'Admin user who performed triage. SET NULL if that user is later removed.';

-- Composite lookup: admin sidebar filters by product+step+status
CREATE INDEX IF NOT EXISTS idx_step_friction_log_lookup
  ON public.step_friction_log (product_slug, step_index, status);

-- Per-user lookup: "show my flagged steps" UI
CREATE INDEX IF NOT EXISTS idx_step_friction_log_user
  ON public.step_friction_log (user_id);

-- Triage queue: ordered by creation date within a status bucket
CREATE INDEX IF NOT EXISTS idx_step_friction_log_triage_queue
  ON public.step_friction_log (status, created_at DESC);


-- =====================================================
-- updated_at trigger for step_friction_log
--    Reuses the canonical function created in
--    20251130000000_core_tables.sql.
-- =====================================================

DROP TRIGGER IF EXISTS update_step_friction_log_updated_at ON public.step_friction_log;
CREATE TRIGGER update_step_friction_log_updated_at
  BEFORE UPDATE ON public.step_friction_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- RLS: step_friction_log
--    Authenticated users can INSERT their own rows and
--    SELECT rows they own (so the UI can show "you flagged
--    this"). All writes and full reads for service_role.
-- =====================================================

ALTER TABLE public.step_friction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own friction flags" ON public.step_friction_log;
CREATE POLICY "Users can insert own friction flags"
  ON public.step_friction_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own friction flags" ON public.step_friction_log;
CREATE POLICY "Users can view own friction flags"
  ON public.step_friction_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access to step_friction_log" ON public.step_friction_log;
CREATE POLICY "Service role full access to step_friction_log"
  ON public.step_friction_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant to authenticated so the Data API exposes it
GRANT SELECT, INSERT ON public.step_friction_log TO authenticated;
GRANT ALL            ON public.step_friction_log TO service_role;


-- =====================================================
-- 2. tao_situations
--    Corpus of 172 situations × 7 layers ingested from
--    the sibling studio repo Python pipeline
--    (data/exports/tao.json). Each row is upserted by
--    the pipeline; layers are stored as JSONB.
--    No pgvector embeddings in this initial schema.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tao_situations (
  -- Dotted notation primary key, e.g. '01.01'
  id                   TEXT        PRIMARY KEY,

  -- Parent domain identifier, e.g. '01'
  domain_id            TEXT        NOT NULL,

  -- Human-readable domain label, e.g. 'Home'
  domain_name          TEXT        NOT NULL,

  -- Situation name, e.g. 'Morning Wake'
  name                 TEXT        NOT NULL,

  -- Experiential tier: 1 = surface, 2 = mid, 3 = deep
  tier                 INTEGER     NOT NULL
                       CHECK (tier IN (1, 2, 3)),

  -- Fate archetype associated with this situation (nullable)
  fate                 TEXT
                       CHECK (fate IS NULL OR fate IN ('Fear', 'Authority', 'Trust', 'Ego')),

  -- Core state quality of this situation (nullable)
  core_state           TEXT
                       CHECK (core_state IS NULL OR core_state IN
                         ('Being', 'Inner Peace', 'Love', 'OKness', 'Oneness')),

  -- Name used when referencing the being/archetype of this situation
  being_name           TEXT,

  -- Short phrase used to re-enter this situation's state
  re_entry_phrase      TEXT,

  -- How many content variants exist for this situation
  variant_count        INTEGER     DEFAULT 0,

  -- Layer 1: Identity layer content
  layer_identity       JSONB,

  -- Layer 2: Submodality layer content
  layer_submodality    JSONB,

  -- Layer 3: Language layer content
  layer_language       JSONB,

  -- Layer 4: Fate / BTE layer content
  layer_fate_bte       JSONB,

  -- Layer 5: Variance layer content
  layer_variance       JSONB,

  -- Layer 6: Personalization layer content
  layer_personalization JSONB,

  -- Layer 7: Protocol layer content
  layer_protocol       JSONB,

  -- Citation or origin text for the research underpinning this situation
  research_source      TEXT,

  -- Key research finding summarized for this situation
  research_finding     TEXT,

  -- Which studio export version produced this row (for provenance tracking)
  source_version       TEXT,

  -- Soft-disable: false rows are excluded from user-facing queries
  active               BOOLEAN     NOT NULL DEFAULT true,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tao_situations IS
  'Tao situation corpus: 172 situations across domains and tiers, each with '
  'up to 7 JSONB-encoded content layers. Rows are upserted by the studio '
  'Python pipeline from data/exports/tao.json. Users see active rows only.';

COMMENT ON COLUMN public.tao_situations.id IS
  'Dotted notation primary key, e.g. 01.01. Assigned by the studio pipeline.';
COMMENT ON COLUMN public.tao_situations.domain_id IS
  'Parent domain identifier, e.g. 01 for Home. Groups situations into domains.';
COMMENT ON COLUMN public.tao_situations.tier IS
  '1 = surface tier, 2 = mid tier, 3 = deep tier.';
COMMENT ON COLUMN public.tao_situations.fate IS
  'Fate archetype: Fear | Authority | Trust | Ego. Nullable when not applicable.';
COMMENT ON COLUMN public.tao_situations.core_state IS
  'Core state quality: Being | Inner Peace | Love | OKness | Oneness. '
  'Nullable when not applicable.';
COMMENT ON COLUMN public.tao_situations.layer_identity IS
  'L1 — Identity layer content as structured JSONB from the studio pipeline.';
COMMENT ON COLUMN public.tao_situations.layer_submodality IS
  'L2 — Submodality layer content as structured JSONB.';
COMMENT ON COLUMN public.tao_situations.layer_language IS
  'L3 — Language layer content as structured JSONB.';
COMMENT ON COLUMN public.tao_situations.layer_fate_bte IS
  'L4 — Fate / BTE layer content as structured JSONB.';
COMMENT ON COLUMN public.tao_situations.layer_variance IS
  'L5 — Variance layer content as structured JSONB.';
COMMENT ON COLUMN public.tao_situations.layer_personalization IS
  'L6 — Personalization layer content as structured JSONB.';
COMMENT ON COLUMN public.tao_situations.layer_protocol IS
  'L7 — Protocol layer content as structured JSONB.';
COMMENT ON COLUMN public.tao_situations.source_version IS
  'Studio export version tag that produced this row, e.g. v1.2.0. '
  'Used to detect stale rows after a pipeline re-run.';
COMMENT ON COLUMN public.tao_situations.active IS
  'Soft-disable flag. False rows are filtered from all user-facing queries. '
  'Use active = false instead of deleting rows to preserve pipeline provenance.';

-- Domain + tier lookup: primary navigation query from the portal
CREATE INDEX IF NOT EXISTS idx_tao_situations_domain_tier
  ON public.tao_situations (domain_id, tier);

-- Core state filter: segmentation and search by state quality
CREATE INDEX IF NOT EXISTS idx_tao_situations_core_state
  ON public.tao_situations (core_state);

-- Active filter: fast soft-delete filtering in user-facing queries
CREATE INDEX IF NOT EXISTS idx_tao_situations_active
  ON public.tao_situations (active);


-- =====================================================
-- updated_at trigger for tao_situations
--    Reuses the canonical function created in
--    20251130000000_core_tables.sql.
-- =====================================================

DROP TRIGGER IF EXISTS update_tao_situations_updated_at ON public.tao_situations;
CREATE TRIGGER update_tao_situations_updated_at
  BEFORE UPDATE ON public.tao_situations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- RLS: tao_situations
--    Authenticated users can SELECT active rows only.
--    All writes go through service_role (pipeline upsert).
-- =====================================================

ALTER TABLE public.tao_situations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active tao_situations" ON public.tao_situations;
CREATE POLICY "Authenticated users can read active tao_situations"
  ON public.tao_situations
  FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Service role full access to tao_situations" ON public.tao_situations;
CREATE POLICY "Service role full access to tao_situations"
  ON public.tao_situations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant SELECT to authenticated so the Data API exposes it
GRANT SELECT ON public.tao_situations TO authenticated;
GRANT ALL    ON public.tao_situations TO service_role;


-- =====================================================
-- Verification block
--    Asserts both tables exist before the migration
--    is recorded as applied.
-- =====================================================

DO $$
DECLARE
  v_step_friction_log_exists boolean;
  v_tao_situations_exists    boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'step_friction_log'
  ) INTO v_step_friction_log_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tao_situations'
  ) INTO v_tao_situations_exists;

  RAISE NOTICE 'step_friction_log exists: %', v_step_friction_log_exists;
  RAISE NOTICE 'tao_situations exists:    %', v_tao_situations_exists;

  IF NOT (v_step_friction_log_exists AND v_tao_situations_exists) THEN
    RAISE EXCEPTION 'friction_log_and_tao_situations migration verification failed';
  END IF;
END $$;
