-- =====================================================
-- Migration: user_portraits
-- Date: 2026-05-27
--
-- User Portrait infrastructure: accumulates identity
-- signals extracted from product briefings into a
-- per-user portrait that evolves across the full
-- product journey.
--
-- Changes:
--   1. Column addition : users.portrait_opt_out
--   2. New table       : user_portraits
--   3. New table       : briefings
--   4. New table       : portrait_audit_log
--   5. New table       : portrait_update_queue
--
-- Nothing is dropped. No existing table or policy is
-- altered beyond adding the one column to users.
-- =====================================================


-- =====================================================
-- JSONB CONTRACT (documentation only — not enforced by
-- the DB; enforced by the extraction worker and API
-- layer).
--
-- PortraitSection = {
--   current:     PortraitFact | null,
--   prior:       PortraitFact[],
--   transitions: PortraitTransition[]
-- }
--
-- PortraitFact = {
--   stated?:            string,         -- verbatim from the user
--   revealed?:          string,         -- inferred / synthesised by the model
--   summary?:           string,         -- human-readable one-liner
--   evidence:           string[],       -- quoted snippets from briefing / responses
--   confidence:         number,         -- 0.0 - 1.0
--   source_product:     string,         -- product_slug that produced this fact
--   source_briefing_id: uuid,           -- links to briefings.id
--   set_at:             timestamptz
-- }
--
-- PortraitTransition = {
--   from:           PortraitFact,
--   to:             PortraitFact,
--   detected_at:    timestamptz,
--   source_product: string
-- }
--
-- sections shape:
--   {
--     identity:  PortraitSection,
--     values:    PortraitSection,
--     energy:    PortraitSection,
--     activity:  PortraitSection,
--     results:   PortraitSection,
--     path:      PortraitSection
--   }
--
-- Delta / staleness design note:
--   Each section carries current, prior[], and
--   transitions[] so briefings can reference both the
--   present identity AND its history without re-querying
--   past sessions.  The worker promotes current -> prior
--   and appends a PortraitTransition whenever it detects
--   a meaningful shift, keeping the portrait live without
--   locking users into past identities.
-- =====================================================


-- =====================================================
-- 0. users.portrait_opt_out (column addition)
--
--    Canonical opt-out flag.  The matching column on
--    user_portraits.opt_out mirrors this value so the
--    extraction worker can read opt-out status in a
--    single table scan without joining users.  The
--    users column is always written first; the worker
--    syncs it to user_portraits when processing a
--    queue item.
-- =====================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS portrait_opt_out BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.portrait_opt_out IS
  'Canonical opt-out flag for the User Portrait system. '
  'When true the extraction worker skips this user and sets '
  'briefings.extraction_status = ''skipped''. '
  'Mirrored in user_portraits.opt_out for join-free reads.';


-- =====================================================
-- 1. user_portraits
--    One row per user.  Sections are JSONB following the
--    PortraitSection contract documented above.
--    Concurrency note: portrait writes are serialised
--    through portrait_update_queue (table 4); direct
--    UPDATE of sections by application code should never
--    bypass that queue.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_portraits (
  -- One row per user; cascade-delete when the user is removed
  user_id              UUID        PRIMARY KEY
                       REFERENCES public.users(id) ON DELETE CASCADE,

  -- JSONB portrait sections following the PortraitSection contract above.
  -- Expected keys: identity, values, energy, activity, results, path.
  sections             JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- opt_out mirrors users.portrait_opt_out for join-free worker reads.
  -- Canonical source is users.portrait_opt_out; this column is kept in
  -- sync by the extraction worker.
  opt_out              BOOLEAN     NOT NULL DEFAULT false,

  -- Schema version for forward-compatible section shape migrations.
  schema_version       INTEGER     NOT NULL DEFAULT 1,

  -- Timestamp of the most recent extraction worker run for this user.
  last_extracted_at    TIMESTAMPTZ,

  -- Timestamp of the most recent user confirmation ("this is still me").
  last_reviewed_at     TIMESTAMPTZ,

  -- Slugs of products whose deliverables have been extracted into this portrait.
  products_completed   TEXT[]      NOT NULL DEFAULT '{}',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_portraits IS
  'Per-user portrait accumulating identity signals extracted from product '
  'briefings. Sections (identity, values, energy, activity, results, path) '
  'are JSONB following the PortraitSection contract in the migration header. '
  'Writes are serialised via portrait_update_queue to prevent concurrent '
  'extraction races. Users can opt out or reset individual sections.';

COMMENT ON COLUMN public.user_portraits.sections IS
  'JSONB portrait sections. See PortraitSection contract in migration header. '
  'Expected top-level keys: identity, values, energy, activity, results, path.';
COMMENT ON COLUMN public.user_portraits.opt_out IS
  'Mirrors users.portrait_opt_out for join-free reads in the extraction worker. '
  'Do not update directly; the worker syncs this from users.portrait_opt_out.';
COMMENT ON COLUMN public.user_portraits.schema_version IS
  'Incremented when the PortraitSection shape changes in a breaking way, '
  'allowing the worker to migrate stale rows on next extraction.';
COMMENT ON COLUMN public.user_portraits.last_extracted_at IS
  'Timestamp of the most recent extraction worker run for this user. '
  'Used to detect users whose portrait is stale relative to new briefings.';
COMMENT ON COLUMN public.user_portraits.last_reviewed_at IS
  'Timestamp of the most recent user acknowledgement that the portrait '
  'is accurate ("this is still me"). Shown as a staleness indicator in the UI.';
COMMENT ON COLUMN public.user_portraits.products_completed IS
  'Array of product_slug values whose deliverables have been extracted '
  'into this portrait. Append-only; used to skip re-extraction.';

-- Opt-out index: worker WHERE opt_out = false scan
CREATE INDEX IF NOT EXISTS idx_user_portraits_opt_out
  ON public.user_portraits (opt_out);

-- Staleness index: worker finds users needing re-extraction
CREATE INDEX IF NOT EXISTS idx_user_portraits_last_extracted_at
  ON public.user_portraits (last_extracted_at);


-- updated_at trigger -- reuses the canonical function from
-- 20251130000000_core_tables.sql
DROP TRIGGER IF EXISTS update_user_portraits_updated_at ON public.user_portraits;
CREATE TRIGGER update_user_portraits_updated_at
  BEFORE UPDATE ON public.user_portraits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- RLS: user_portraits
--
--   SELECT  -- authenticated users see only their own row.
--   UPDATE  -- authenticated users may update only opt_out
--             and last_reviewed_at.  Postgres does not
--             support column-level RLS natively, so this
--             is enforced by the API layer (never pass
--             sections/schema_version/products_completed
--             from the client).  The policy allows the
--             UPDATE operation on the row; column
--             restriction is the API layer's
--             responsibility.  See the UPDATE policy
--             comment below.
--   INSERT  -- no direct INSERT from authenticated clients;
--             the row is created by the extraction worker
--             via service_role.
--   DELETE  -- no direct DELETE from authenticated clients.
--   service_role -- full access for the extraction worker.
-- =====================================================

ALTER TABLE public.user_portraits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own portrait" ON public.user_portraits;
CREATE POLICY "Users can view own portrait"
  ON public.user_portraits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Column-level note: Postgres RLS does not restrict which
-- columns an UPDATE can touch.  This policy allows the
-- authenticated user to UPDATE their own row.  The API
-- layer MUST only forward opt_out and last_reviewed_at
-- from client payloads -- never sections, schema_version,
-- or products_completed.
DROP POLICY IF EXISTS "Users can update own portrait opt_out and last_reviewed_at" ON public.user_portraits;
CREATE POLICY "Users can update own portrait opt_out and last_reviewed_at"
  ON public.user_portraits
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access to user_portraits" ON public.user_portraits;
CREATE POLICY "Service role full access to user_portraits"
  ON public.user_portraits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, UPDATE ON public.user_portraits TO authenticated;
GRANT ALL            ON public.user_portraits TO service_role;


-- =====================================================
-- 2. briefings
--    Canonical storage of every generated final
--    deliverable. One row per product session (enforced
--    by UNIQUE on product_session_id).
--    The extraction worker reads full_text, populates
--    structured_extract, then enqueues a
--    portrait_update_queue item.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.briefings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner; cascade-delete when the user is removed
  user_id              UUID        NOT NULL
                       REFERENCES public.users(id) ON DELETE CASCADE,

  -- Source session; cascade-delete when the session is removed.
  -- UNIQUE enforces one briefing per session.
  product_session_id   UUID        NOT NULL
                       REFERENCES public.product_sessions(id) ON DELETE CASCADE,

  -- Denormalised slug for worker queries without joining product_sessions
  product_slug         TEXT        NOT NULL,

  -- The full rendered markdown briefing text as shown to the user
  full_text            TEXT        NOT NULL,

  -- Portrait-shaped extract populated by the extraction worker after
  -- generation; NULL until extraction_status = 'completed'.
  structured_extract   JSONB,

  -- Model identifier used for generation, e.g. 'gpt-4o'
  model_used           TEXT,

  -- Wall-clock time the briefing was generated (not when extraction ran)
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Extraction lifecycle:
  --   pending   -- awaiting the extraction worker
  --   completed -- structured_extract populated, portrait updated
  --   failed    -- worker failed after max_attempts (see portrait_update_queue)
  --   skipped   -- user opted out at generation time
  extraction_status    TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (extraction_status IN
                         ('pending', 'completed', 'failed', 'skipped')),

  extraction_attempts  INTEGER     NOT NULL DEFAULT 0,
  extraction_error     TEXT,
  extracted_at         TIMESTAMPTZ
);

COMMENT ON TABLE public.briefings IS
  'Canonical storage of every generated product deliverable (briefing). '
  'One row per product_session (enforced by UNIQUE constraint). '
  'The extraction worker reads full_text, writes structured_extract, and '
  'enqueues a portrait_update_queue item to merge the extract into the '
  'user''s portrait. extraction_status tracks the lifecycle.';

COMMENT ON COLUMN public.briefings.full_text IS
  'The rendered markdown briefing shown to the user. Source of truth for '
  'the extraction worker; never modified after creation.';
COMMENT ON COLUMN public.briefings.structured_extract IS
  'Portrait-shaped JSONB extract produced by the extraction worker. '
  'Shape mirrors user_portraits.sections (see PortraitSection contract). '
  'NULL until extraction_status = ''completed''.';
COMMENT ON COLUMN public.briefings.model_used IS
  'Identifier of the model that generated the briefing, e.g. gpt-4o. '
  'Stored for debugging and cost attribution.';
COMMENT ON COLUMN public.briefings.extraction_status IS
  'pending = awaiting worker | completed = portrait updated | '
  'failed = exhausted attempts | skipped = user opted out.';
COMMENT ON COLUMN public.briefings.extraction_attempts IS
  'How many times the extraction worker has attempted this briefing. '
  'Compared against portrait_update_queue.max_attempts.';

-- One briefing per session -- enforces the 1:1 relationship
ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_product_session_id_unique UNIQUE (product_session_id);

-- Per-user chronological listing (briefing history UI)
CREATE INDEX IF NOT EXISTS idx_briefings_user_generated
  ON public.briefings (user_id, generated_at DESC);

-- Worker pending-queue scan: finds briefings needing extraction
CREATE INDEX IF NOT EXISTS idx_briefings_extraction_worker
  ON public.briefings (extraction_status, generated_at);


-- =====================================================
-- RLS: briefings
--
--   SELECT -- authenticated users see only their own rows.
--   INSERT / UPDATE / DELETE -- service_role only (the
--     API route that stores the briefing runs as
--     service_role).
-- =====================================================

ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefings" ON public.briefings;
CREATE POLICY "Users can view own briefings"
  ON public.briefings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access to briefings" ON public.briefings;
CREATE POLICY "Service role full access to briefings"
  ON public.briefings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.briefings TO authenticated;
GRANT ALL    ON public.briefings TO service_role;


-- =====================================================
-- 3. portrait_audit_log
--    Append-only ledger of every read, write, reset, or
--    admin override of a portrait field.  Drives:
--      - "Which briefing used which value" debugging
--      - "Show me what the system knows about me" user view
--      - Admin audit trail for overrides
-- =====================================================

CREATE TABLE IF NOT EXISTS public.portrait_audit_log (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner of the portrait field that was accessed
  user_id              UUID        NOT NULL
                       REFERENCES public.users(id) ON DELETE CASCADE,

  -- Briefing that triggered the read or write; SET NULL if briefing deleted
  briefing_id          UUID
                       REFERENCES public.briefings(id) ON DELETE SET NULL,

  -- Direction of the operation:
  --   read     -- a briefing generation consumed this portrait field
  --   write    -- an extractor updated this portrait field
  --   reset    -- user reset this section to empty
  --   override -- admin manually edited a field
  direction            TEXT        NOT NULL
                       CHECK (direction IN ('read', 'write', 'reset', 'override')),

  -- Portrait section touched: identity | values | energy | activity | results | path
  section              TEXT        NOT NULL
                       CHECK (section IN
                         ('identity', 'values', 'energy', 'activity', 'results', 'path')),

  -- Dot-path within the section, e.g. 'current.stated' or 'transitions[0]'
  field_path           TEXT,

  -- Previous value of the field (NULL for 'read' events or first write)
  old_value            JSONB,

  -- New value of the field (NULL for 'read' events)
  new_value            JSONB,

  -- User or admin who triggered the operation; NULL for system extractions
  actor_id             UUID,

  -- Append-only: no updated_at column
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.portrait_audit_log IS
  'Append-only ledger of every read, write, reset, or admin override of a '
  'portrait field. Enables "which briefing used which value" debugging and '
  'the "show me what the system knows about me" customer transparency view. '
  'Rows are never updated or deleted by application code (SET NULL on briefing '
  'delete is the only server-side mutation).';

COMMENT ON COLUMN public.portrait_audit_log.direction IS
  'read = briefing generation consumed this field; '
  'write = extraction worker updated this field; '
  'reset = user cleared this section; '
  'override = admin manually edited.';
COMMENT ON COLUMN public.portrait_audit_log.section IS
  'Portrait section touched: identity | values | energy | '
  'activity | results | path.';
COMMENT ON COLUMN public.portrait_audit_log.field_path IS
  'Dot-path within the section for fine-grained attribution, '
  'e.g. current.stated or transitions[0].';
COMMENT ON COLUMN public.portrait_audit_log.actor_id IS
  'UUID of the user or admin who triggered the operation. '
  'NULL for automated system extractions.';

-- Per-user chronological view (customer transparency UI)
CREATE INDEX IF NOT EXISTS idx_portrait_audit_log_user_created
  ON public.portrait_audit_log (user_id, created_at DESC);

-- Briefing-level attribution ("which fields did this briefing read/write?")
CREATE INDEX IF NOT EXISTS idx_portrait_audit_log_briefing
  ON public.portrait_audit_log (briefing_id);


-- =====================================================
-- RLS: portrait_audit_log
--
--   SELECT -- authenticated users see only their own
--             entries (customer transparency).
--   INSERT -- service_role only (never written by clients).
-- =====================================================

ALTER TABLE public.portrait_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own portrait audit entries" ON public.portrait_audit_log;
CREATE POLICY "Users can view own portrait audit entries"
  ON public.portrait_audit_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access to portrait_audit_log" ON public.portrait_audit_log;
CREATE POLICY "Service role full access to portrait_audit_log"
  ON public.portrait_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.portrait_audit_log TO authenticated;
GRANT ALL    ON public.portrait_audit_log TO service_role;


-- =====================================================
-- 4. portrait_update_queue
--    Serialises portrait writes per user. The extraction
--    worker polls status = 'pending' ordered by
--    created_at, sets status = 'processing' (advisory
--    lock on user_id prevents parallel workers picking
--    up the same user simultaneously), then merges the
--    structured_extract into user_portraits.
--    The partial unique index prevents the same briefing
--    from being enqueued while still pending or processing.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.portrait_update_queue (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Portrait owner; cascade-delete if user is removed
  user_id              UUID        NOT NULL
                       REFERENCES public.users(id) ON DELETE CASCADE,

  -- Briefing whose structured_extract is to be merged; cascade-delete if
  -- briefing is removed (avoids ghost queue items)
  briefing_id          UUID        NOT NULL
                       REFERENCES public.briefings(id) ON DELETE CASCADE,

  -- Queue lifecycle:
  --   pending    -- awaiting a worker pickup
  --   processing -- worker has claimed this item
  --   completed  -- portrait merged successfully
  --   failed     -- exhausted max_attempts
  status               TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  attempts             INTEGER     NOT NULL DEFAULT 0,
  max_attempts         INTEGER     NOT NULL DEFAULT 3,

  -- Error detail from the last failed attempt
  error_message        TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Set when a worker claims this item (status -> processing)
  processing_started_at TIMESTAMPTZ,

  -- Set when the worker finishes (status -> completed | failed)
  processed_at         TIMESTAMPTZ
);

COMMENT ON TABLE public.portrait_update_queue IS
  'Serialises portrait writes per user to prevent concurrent extraction races '
  'when bundle buyers complete multiple products near-simultaneously. '
  'Workers poll pending rows ordered by created_at, claim via status update, '
  'and optionally take an advisory lock on user_id for strict serialisation. '
  'The partial unique index on briefing_id prevents duplicate queue entries.';

COMMENT ON COLUMN public.portrait_update_queue.status IS
  'pending = awaiting worker | processing = worker claimed | '
  'completed = merged into portrait | failed = exhausted max_attempts.';
COMMENT ON COLUMN public.portrait_update_queue.max_attempts IS
  'Maximum extraction attempts before the item is marked failed '
  'and the briefing.extraction_status is set to ''failed''.';
COMMENT ON COLUMN public.portrait_update_queue.processing_started_at IS
  'Wall-clock time the worker set status = ''processing''. '
  'Used to detect stalled items (processing_started_at older than threshold).';

-- Worker pickup scan: pending items in FIFO order
CREATE INDEX IF NOT EXISTS idx_portrait_update_queue_status_created
  ON public.portrait_update_queue (status, created_at);

-- Per-user queue depth / status queries
CREATE INDEX IF NOT EXISTS idx_portrait_update_queue_user_status
  ON public.portrait_update_queue (user_id, status);

-- Prevent the same briefing from being enqueued while still active.
-- Completed and failed items are excluded so a manual retry re-enqueue is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS portrait_queue_unique_briefing
  ON public.portrait_update_queue (briefing_id)
  WHERE status IN ('pending', 'processing');


-- =====================================================
-- RLS: portrait_update_queue
--    Service role only -- no authenticated client access.
--    The queue is an internal worker mechanism; clients
--    never read or write it directly.
-- =====================================================

ALTER TABLE public.portrait_update_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to portrait_update_queue" ON public.portrait_update_queue;
CREATE POLICY "Service role full access to portrait_update_queue"
  ON public.portrait_update_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.portrait_update_queue TO service_role;


-- =====================================================
-- Verification block
--    Asserts all tables and the users column exist
--    before the migration is recorded as applied.
--    Raises EXCEPTION (rolling back) if any check fails.
-- =====================================================

DO $$
DECLARE
  v_user_portraits_exists        boolean;
  v_briefings_exists             boolean;
  v_portrait_audit_log_exists    boolean;
  v_portrait_update_queue_exists boolean;
  v_portrait_opt_out_col_exists  boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_portraits'
  ) INTO v_user_portraits_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'briefings'
  ) INTO v_briefings_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portrait_audit_log'
  ) INTO v_portrait_audit_log_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'portrait_update_queue'
  ) INTO v_portrait_update_queue_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'users'
      AND column_name  = 'portrait_opt_out'
  ) INTO v_portrait_opt_out_col_exists;

  RAISE NOTICE 'user_portraits exists:         %', v_user_portraits_exists;
  RAISE NOTICE 'briefings exists:              %', v_briefings_exists;
  RAISE NOTICE 'portrait_audit_log exists:     %', v_portrait_audit_log_exists;
  RAISE NOTICE 'portrait_update_queue exists:  %', v_portrait_update_queue_exists;
  RAISE NOTICE 'users.portrait_opt_out exists: %', v_portrait_opt_out_col_exists;

  IF NOT (
    v_user_portraits_exists
    AND v_briefings_exists
    AND v_portrait_audit_log_exists
    AND v_portrait_update_queue_exists
    AND v_portrait_opt_out_col_exists
  ) THEN
    RAISE EXCEPTION 'user_portraits migration verification failed -- one or more objects missing';
  END IF;
END $$;
