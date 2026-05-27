-- =====================================================
-- Migration: expand_admin_audit_action_types
-- Date: 2026-05-27
--
-- Extends admin_audit_logs.action_type CHECK constraint
-- to cover the admin actions introduced by recent features:
--
--   - Content CMS (content_create / content_update / content_delete)
--   - Question Pool (question_pool_create / _update / _disable)
--   - Tao Situations (tao_situation_update)
--   - User Portraits (portrait_override)
--   - Friction Log (friction_triage — reserved for future use)
--
-- Today, calls to logAdminAction() with these action_type values
-- fail the existing CHECK constraint and are silently swallowed by
-- the helper's try/catch. The canonical record still lives on each
-- feature's per-feature audit table (portrait_audit_log, etc.),
-- but the central admin_audit_logs view is incomplete.
--
-- This migration drops the old constraint and recreates it with
-- the expanded list. No data is altered; existing rows already
-- satisfy the new constraint because the new values are a strict
-- superset of the old ones.
-- =====================================================


-- The currently-active CHECK constraint is the one applied by
-- migration 20260204190900_remote_schema.sql (it dropped the
-- original valid_action_type constraint from 20260128000001
-- and replaced it with admin_audit_logs_action_type_check).

ALTER TABLE public.admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_action_type_check;

ALTER TABLE public.admin_audit_logs
  ADD CONSTRAINT admin_audit_logs_action_type_check
  CHECK (action_type = ANY (ARRAY[
    -- Existing values (preserved from 20260204190900)
    'product_create'::text,
    'product_update'::text,
    'product_delete'::text,
    'step_create'::text,
    'step_update'::text,
    'step_delete'::text,
    'step_reorder'::text,
    'prompt_create'::text,
    'prompt_update'::text,
    'prompt_delete'::text,
    'prompt_rollback'::text,
    'user_role_change'::text,
    'admin_login'::text,
    'admin_logout'::text,
    'test_simulate'::text,

    -- Content CMS
    'content_create'::text,
    'content_update'::text,
    'content_delete'::text,

    -- Question Pool admin (Dynamic Question Pool feature)
    'question_pool_create'::text,
    'question_pool_update'::text,
    'question_pool_disable'::text,

    -- Tao Situations admin (Inner-Outer Alignment integration)
    'tao_situation_update'::text,

    -- User Portrait admin
    'portrait_override'::text,

    -- Friction Log admin (reserved — not yet emitted in code, but
    -- the triage PATCH endpoint should log to admin_audit_logs in a
    -- follow-up)
    'friction_triage'::text
  ]));


-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  v_check_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'admin_audit_logs'
      AND constraint_name = 'admin_audit_logs_action_type_check'
      AND constraint_type = 'CHECK'
  ) INTO v_check_exists;

  IF NOT v_check_exists THEN
    RAISE EXCEPTION 'admin_audit_logs_action_type_check constraint missing after migration';
  END IF;

  RAISE NOTICE 'admin_audit_logs CHECK constraint successfully expanded.';
END
$$;
