-- Lock the knowledge corpus to admins and the service role.
--
-- Until now any signed-in user (including customers) could read every row of
-- knowledge_chunks and knowledge_sources through the API, because of the
-- "authenticated_read" policies. The corpus holds internal material, so reads are
-- now limited to:
--   * the service role (server-side admin routes, scripts — bypasses RLS), and
--   * admins, via the existing "*_admin_all" policies.
-- All application code that reads the corpus already uses the service role.
--
-- Additive-safe: no data changes, no columns touched.

DROP POLICY IF EXISTS "knowledge_chunks_authenticated_read" ON public.knowledge_chunks;
DROP POLICY IF EXISTS "knowledge_sources_authenticated_read" ON public.knowledge_sources;

-- Defence in depth: the retrieval functions are SECURITY INVOKER (RLS already
-- applies), but they should not be callable by anon/authenticated at all.
-- Revoke on every overload so this holds regardless of signature drift.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('match_knowledge', 'search_knowledge_keyword')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END
$$;
