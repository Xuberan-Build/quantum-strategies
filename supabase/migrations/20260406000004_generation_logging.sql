-- =====================================================
-- Generation Logging + Cross-Product Deliverable Pipeline
--
-- 1. generation_log      — append-only audit of every AI call
-- 2. product_sessions    — deliverable metadata columns
-- 3. conversations       — model/token metadata columns
-- 4. get_user_prior_deliverables() — cross-product context fn
-- =====================================================


-- =====================================================
-- 1. GENERATION LOG
-- Append-only audit table. One row per AI API call.
-- Drives cost tracking, quality analysis, and debugging.
-- =====================================================
CREATE TABLE IF NOT EXISTS generation_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES users(id) ON DELETE SET NULL,
  session_id       uuid        REFERENCES product_sessions(id) ON DELETE SET NULL,
  product_slug     text        NOT NULL,
  event_type       text        NOT NULL,  -- 'step_insight' | 'follow_up' | 'deliverable'
  step_number      int,                   -- NULL for deliverables
  model            text        NOT NULL,
  input_tokens     int,
  output_tokens    int,
  generation_ms    int,
  user_input       jsonb,                 -- structured input at time of call
  ai_output        text,                  -- full AI response text
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT generation_log_event_type_check
    CHECK (event_type IN ('step_insight', 'follow_up', 'deliverable'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS generation_log_user_idx    ON generation_log(user_id);
CREATE INDEX IF NOT EXISTS generation_log_session_idx ON generation_log(session_id);
CREATE INDEX IF NOT EXISTS generation_log_slug_idx    ON generation_log(product_slug);
CREATE INDEX IF NOT EXISTS generation_log_type_idx    ON generation_log(event_type);
CREATE INDEX IF NOT EXISTS generation_log_created_idx ON generation_log(created_at DESC);

-- RLS: users can read their own logs; service role writes (bypasses RLS)
ALTER TABLE generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generation logs"
  ON generation_log FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE generation_log IS
  'Append-only audit of every AI generation. Tracks model, tokens, latency, and full input/output per call.';


-- =====================================================
-- 2. PRODUCT SESSIONS — deliverable metadata
-- =====================================================
ALTER TABLE product_sessions
  ADD COLUMN IF NOT EXISTS deliverable_model              text,
  ADD COLUMN IF NOT EXISTS deliverable_input_tokens       int,
  ADD COLUMN IF NOT EXISTS deliverable_output_tokens      int,
  ADD COLUMN IF NOT EXISTS deliverable_generation_ms      int,
  ADD COLUMN IF NOT EXISTS deliverable_regeneration_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN product_sessions.deliverable_model IS
  'Model used to generate the final deliverable (e.g. gpt-4o).';
COMMENT ON COLUMN product_sessions.deliverable_regeneration_count IS
  'Number of times the deliverable was regenerated after initial generation.';


-- =====================================================
-- 3. CONVERSATIONS — generation metadata
-- One row per step per session. These columns store
-- the aggregate metadata for all AI calls on that step.
-- =====================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS model              text,
  ADD COLUMN IF NOT EXISTS total_input_tokens  int,
  ADD COLUMN IF NOT EXISTS total_output_tokens int;

COMMENT ON COLUMN conversations.model IS
  'Model that generated the most recent AI response on this step.';


-- =====================================================
-- 4. CROSS-PRODUCT DELIVERABLE LOOKUP
-- Returns all completed deliverables for a user,
-- ordered by completion time. Used by Strategic Path
-- and any future product that needs prior context.
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_prior_deliverables(
  p_user_id         uuid,
  p_exclude_session uuid DEFAULT NULL
)
RETURNS TABLE (
  product_slug       text,
  product_name       text,
  deliverable_content text,
  completed_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ps.product_slug,
    COALESCE(pd.name, ps.product_slug) AS product_name,
    ps.deliverable_content,
    ps.completed_at
  FROM product_sessions ps
  LEFT JOIN product_definitions pd ON ps.product_slug = pd.product_slug
  WHERE ps.user_id = p_user_id
    AND ps.is_complete = true
    AND ps.deliverable_content IS NOT NULL
    AND COALESCE(ps.is_latest_version, true) = true
    AND (p_exclude_session IS NULL OR ps.id != p_exclude_session)
  ORDER BY ps.completed_at ASC NULLS LAST;
$$;

COMMENT ON FUNCTION get_user_prior_deliverables IS
  'Returns all completed deliverables for a user, ordered by completion. Used to inject prior scan context into downstream products like Strategic Path Declaration.';


-- =====================================================
-- 5. ADMIN VIEW — generation analytics
-- Aggregates per user per product for cost/quality review
-- =====================================================
CREATE OR REPLACE VIEW generation_analytics AS
SELECT
  gl.user_id,
  u.email,
  gl.product_slug,
  gl.event_type,
  COUNT(*)                          AS call_count,
  SUM(gl.input_tokens)              AS total_input_tokens,
  SUM(gl.output_tokens)             AS total_output_tokens,
  SUM(gl.input_tokens + COALESCE(gl.output_tokens, 0)) AS total_tokens,
  ROUND(AVG(gl.generation_ms))      AS avg_generation_ms,
  MAX(gl.generation_ms)             AS max_generation_ms,
  MIN(gl.created_at)                AS first_call_at,
  MAX(gl.created_at)                AS last_call_at
FROM generation_log gl
LEFT JOIN users u ON gl.user_id = u.id
GROUP BY gl.user_id, u.email, gl.product_slug, gl.event_type;

COMMENT ON VIEW generation_analytics IS
  'Aggregated AI generation stats per user per product. Use for cost tracking and quality monitoring.';
