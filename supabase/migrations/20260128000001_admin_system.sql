-- =====================================================
-- ADMIN SYSTEM - Role Management & Audit Logging
-- Migration: Add admin role to users and enhance audit logging
-- =====================================================

-- 1. Add role column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
  END IF;
END $$;

-- Add constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'admin', 'super_admin'));
  END IF;
END $$;

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Create admin_audit_logs table for admin-specific actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,

  -- Action details
  action_type TEXT NOT NULL, -- 'product_update', 'step_update', 'prompt_update', 'user_role_change', etc.
  target_type TEXT NOT NULL, -- 'product', 'step', 'prompt', 'user'
  target_id TEXT,            -- ID of the affected record
  target_name TEXT,          -- Human-readable name

  -- Change tracking
  previous_value JSONB,
  new_value JSONB,

  -- Request context
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for efficient queries
  CONSTRAINT valid_action_type CHECK (action_type IN (
    'product_create', 'product_update', 'product_delete',
    'step_create', 'step_update', 'step_delete', 'step_reorder',
    'prompt_create', 'prompt_update', 'prompt_delete', 'prompt_rollback',
    'user_role_change', 'admin_login', 'admin_logout',
    'test_simulate'
  ))
);

-- Indexes for admin_audit_logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- 3. RLS Policies for admin_audit_logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY admin_audit_logs_select_policy ON admin_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Only super_admins can insert audit logs directly (normally done via service role)
CREATE POLICY admin_audit_logs_insert_policy ON admin_audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- 4. Enhance prompts table with versioning columns
DO $$
BEGIN
  -- Add version column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'prompts'
    AND column_name = 'version'
  ) THEN
    ALTER TABLE prompts ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
  END IF;

  -- Add is_active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'prompts'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE prompts ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
  END IF;

  -- Add created_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'prompts'
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE prompts ADD COLUMN created_by UUID REFERENCES users(id);
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'prompts'
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE prompts ADD COLUMN notes TEXT;
  END IF;

  -- Rename 'prompt' to 'content' for clarity (if needed)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'prompts'
    AND column_name = 'prompt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'prompts'
    AND column_name = 'content'
  ) THEN
    ALTER TABLE prompts RENAME COLUMN prompt TO content;
  END IF;
END $$;

-- Create unique index on active prompts (only one active version per product/scope/step combo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_active_unique
  ON prompts(product_slug, scope, step_number)
  WHERE is_active = true;

-- Index for version history queries
CREATE INDEX IF NOT EXISTS idx_prompts_versions
  ON prompts(product_slug, scope, step_number, version DESC);

-- 5. Grant initial admin access to specified email
-- This will be applied when the user logs in
UPDATE users SET role = 'super_admin'
WHERE email = 'austin@quantumstrategies.online';

-- Also grant admin to the test account
UPDATE users SET role = 'admin'
WHERE email = 'santos.93.aus@gmail.com';

-- 6. Create helper function to check admin status
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id
    AND role IN ('admin', 'super_admin')
  );
END;
$$;

-- 7. Create helper function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_user_id UUID,
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id TEXT DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email TEXT;
  v_log_id UUID;
BEGIN
  -- Get admin email
  SELECT email INTO v_admin_email FROM users WHERE id = p_admin_user_id;

  -- Insert audit log
  INSERT INTO admin_audit_logs (
    admin_user_id,
    admin_email,
    action_type,
    target_type,
    target_id,
    target_name,
    previous_value,
    new_value,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_user_id,
    v_admin_email,
    p_action_type,
    p_target_type,
    p_target_id,
    p_target_name,
    p_previous_value,
    p_new_value,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION is_admin IS 'Check if a user has admin or super_admin role';
COMMENT ON FUNCTION log_admin_action IS 'Log an admin action for audit trail';
COMMENT ON TABLE admin_audit_logs IS 'Audit trail for all admin CMS actions';
