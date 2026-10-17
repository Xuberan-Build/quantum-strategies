-- Migration: 20261017100000_hide_product_prompts
--
-- SECURITY FIX: product prompt IP was readable with the public anon key.
--   * product_definitions: system_prompt, final_deliverable_prompt, steps (step prompts),
--     instructions were readable by anon + authenticated via policy pd_select.
--   * prompts: anon/authenticated SELECT policies.
--   * knowledge_query_log: policy "Service role full access" was USING (true) for PUBLIC.
--
-- Approach (additive, no data touched, idempotent):
--   1. prompts / knowledge_query_log: drop every policy, revoke all from anon + authenticated.
--      service_role bypasses RLS and keeps its grants; the app reads them via supabaseAdmin only.
--   2. product_definitions: keep RLS policy pd_select (is_active = true) but replace the
--      table-level SELECT grant with column-level grants on non-sensitive columns only.
--      Clients must therefore select explicit columns (select('*') now errors for anon/authenticated).
--      Columns added in future are NOT granted by default (safe default).
--
-- Withheld columns: system_prompt, final_deliverable_prompt, steps, instructions, model.
--
-- ROLLBACK (manual, only if needed):
--   GRANT SELECT ON public.product_definitions TO anon, authenticated;
--   (policies on prompts/knowledge_query_log were dropped intentionally; do not restore.)

DO $$
DECLARE
  pol record;
  col_list text;
BEGIN
  -- 1. prompts + knowledge_query_log: service-role only
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('prompts', 'knowledge_query_log')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;

  IF to_regclass('public.prompts') IS NOT NULL THEN
    ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.prompts FROM anon, authenticated, PUBLIC;
  END IF;

  IF to_regclass('public.knowledge_query_log') IS NOT NULL THEN
    ALTER TABLE public.knowledge_query_log ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.knowledge_query_log FROM anon, authenticated, PUBLIC;
  END IF;

  -- 2. product_definitions: column-level SELECT on safe columns only
  IF to_regclass('public.product_definitions') IS NOT NULL THEN
    ALTER TABLE public.product_definitions ENABLE ROW LEVEL SECURITY;

    -- Only the public/active-row read policy remains for non-service roles (pd_select, pd_service pre-exist).
    REVOKE ALL ON public.product_definitions FROM anon, authenticated, PUBLIC;

    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO col_list
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_definitions'
      AND column_name NOT IN ('system_prompt', 'final_deliverable_prompt', 'steps', 'instructions', 'model');

    EXECUTE format('GRANT SELECT (%s) ON public.product_definitions TO anon, authenticated', col_list);
  END IF;
END
$$;

COMMENT ON TABLE public.product_definitions IS
  'Product definitions. Prompt columns (system_prompt, final_deliverable_prompt, steps, instructions, model) are service-role only; anon/authenticated have column-level SELECT on safe columns.';
