-- =====================================================
-- SECURITY FIX: Address Supabase Security Advisor Issues
-- Date: 2026-04-05
-- =====================================================
-- Fixes:
-- 1. RLS Disabled in Public: audit_logs, content_index, product_definitions_backup_20260101
-- 2. Sensitive Columns Exposed: audit_logs
-- 3. Security Definer Views: error_logs, recent_user_activity
-- 4. Function Search Path Mutable: multiple functions
-- =====================================================


-- =====================================================
-- 1. ENABLE RLS ON TABLES MISSING IT
-- =====================================================

-- audit_logs: admin-only write, users can read their own rows
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit log entries
CREATE POLICY audit_logs_select_own ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all audit log entries
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Service role / backend inserts (app writes logs via service role key, not anon/user)
-- The GRANT INSERT already exists from earlier migration; RLS allows inserts via service role
-- by default (service role bypasses RLS), so no insert policy needed for app usage.
-- Authenticated users should NOT insert their own audit logs directly.
CREATE POLICY audit_logs_insert_service ON audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- content_index: admin-only (internal content directory, not user-facing data)
ALTER TABLE content_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_index_select_admin ON content_index
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY content_index_all_admin ON content_index
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- product_definitions_backup_20260101: admin-only (backup table, no public access needed)
ALTER TABLE product_definitions_backup_20260101 ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_definitions_backup_admin_only ON product_definitions_backup_20260101
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );


-- =====================================================
-- 2. FIX SECURITY DEFINER VIEWS
-- Use security_invoker = true so views respect the
-- querying user's permissions and RLS policies instead
-- of the view creator's elevated privileges.
-- =====================================================

-- Fix error_logs view
DROP VIEW IF EXISTS error_logs;
CREATE VIEW error_logs
  WITH (security_invoker = true)
AS
SELECT
  al.user_id,
  u.email,
  al.event_type,
  al.event_action,
  al.error_message,
  al.error_stack,
  al.error_code,
  al.request_path,
  al.metadata,
  al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.event_status = 'error'
ORDER BY al.created_at DESC;

-- Fix recent_user_activity view
DROP VIEW IF EXISTS recent_user_activity;
CREATE VIEW recent_user_activity
  WITH (security_invoker = true)
AS
SELECT
  al.user_id,
  u.email,
  NULL::text AS full_name,
  al.event_type,
  al.event_action,
  al.event_status,
  al.error_message,
  al.metadata,
  al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.created_at > NOW() - INTERVAL '7 days'
ORDER BY al.created_at DESC;


-- =====================================================
-- 3. FIX FUNCTION SEARCH PATH MUTABLE
-- Explicitly pin search_path = public on all functions
-- that were missing it. This prevents search path
-- injection attacks.
-- =====================================================

-- Session management functions
ALTER FUNCTION auto_copy_placements_to_new_session() SET search_path = public;
ALTER FUNCTION copy_placements_between_sessions(uuid, uuid) SET search_path = public;
ALTER FUNCTION create_session_version(uuid, text, uuid) SET search_path = public;
ALTER FUNCTION get_session_versions(uuid, text) SET search_path = public;
ALTER FUNCTION can_create_new_version(uuid, text) SET search_path = public;

-- Test account functions
ALTER FUNCTION grant_test_account_access() SET search_path = public;
ALTER FUNCTION auto_grant_test_access_on_new_product() SET search_path = public;

-- Utility functions
ALTER FUNCTION normalize_user_email() SET search_path = public;
-- Note: add_nudge_to_step was a temporary migration helper (created+dropped in the same tx)

-- Affiliate functions (belt-and-suspenders: re-apply in case earlier migration missed any)
ALTER FUNCTION auto_enroll_affiliate() SET search_path = public;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  rls_missing INTEGER;
  insecure_views INTEGER;
  insecure_funcs INTEGER;
BEGIN
  -- Check for any remaining public tables without RLS
  SELECT COUNT(*) INTO rls_missing
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  -- Check for security definer views
  SELECT COUNT(*) INTO insecure_views
  FROM pg_views v
  JOIN pg_class c ON c.relname = v.viewname
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND NOT (c.reloptions::text[] @> ARRAY['security_invoker=true'])
    AND v.viewname IN ('error_logs', 'recent_user_activity');

  -- Check for functions still without search_path
  SELECT COUNT(*) INTO insecure_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.proconfig IS NULL
    AND p.proname IN (
      'auto_copy_placements_to_new_session',
      'copy_placements_between_sessions',
      'create_session_version',
      'get_session_versions',
      'can_create_new_version',
      'grant_test_account_access',
      'auto_grant_test_access_on_new_product',
      'normalize_user_email',
      'add_nudge_to_step',
      'auto_enroll_affiliate'
    );

  RAISE NOTICE '=== Security Fix Verification ===';
  RAISE NOTICE 'Public tables still missing RLS: %', rls_missing;
  RAISE NOTICE 'Insecure views remaining: %', insecure_views;
  RAISE NOTICE 'Functions still missing search_path (from fix list): %', insecure_funcs;

  IF insecure_funcs > 0 THEN
    RAISE WARNING 'Some functions still have mutable search_path — review manually';
  ELSE
    RAISE NOTICE '✓ All targeted functions have search_path pinned';
  END IF;
END $$;
