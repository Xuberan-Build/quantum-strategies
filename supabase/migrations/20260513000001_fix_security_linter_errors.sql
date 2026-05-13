-- =====================================================
-- Fix two security linter errors:
--
-- 1. generation_analytics view was SECURITY DEFINER
--    (runs as superuser/owner, bypassing RLS).
--    Fix: recreate with security_invoker = true so
--    the querying user's RLS policies are enforced.
--
-- 2. member_deadlines has RLS disabled.
--    Fix: enable RLS with service_role-only access,
--    matching the member_sequences / discord bot pattern.
-- =====================================================


-- ─── 1. generation_analytics — security_invoker view ─────────────────────────

CREATE OR REPLACE VIEW public.generation_analytics
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW public.generation_analytics IS
  'Aggregated AI generation stats per user per product. Use for cost tracking and quality monitoring.';


-- ─── 2. member_deadlines — enable RLS, service_role only ─────────────────────
-- Discord bot uses the service_role key (bypasses RLS automatically).
-- No authenticated/anon users should access this table directly.

ALTER TABLE public.member_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to member_deadlines"
  ON public.member_deadlines
  TO service_role
  USING (true)
  WITH CHECK (true);
