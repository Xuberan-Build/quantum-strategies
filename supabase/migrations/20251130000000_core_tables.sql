-- =====================================================
-- Core application tables (baseline)
-- Ensures core tables exist before later migrations.
-- Safe to run on existing databases.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Updated-at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_affiliate BOOLEAN DEFAULT FALSE,
  affiliate_enrolled_at TIMESTAMP WITH TIME ZONE,
  affiliate_opted_out BOOLEAN DEFAULT FALSE,
  first_affiliate_visit TIMESTAMP WITH TIME ZONE,
  total_earnings_cents INTEGER DEFAULT 0,
  available_balance_cents INTEGER DEFAULT 0,
  total_withdrawn_cents INTEGER DEFAULT 0,
  dinner_party_credits_cents INTEGER DEFAULT 0,
  placements JSONB,
  placements_confirmed BOOLEAN DEFAULT FALSE,
  placements_updated_at TIMESTAMP WITH TIME ZONE,
  role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin', 'super_admin'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);

-- =====================================================
-- PRODUCT DEFINITIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_definitions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  steps JSONB NOT NULL,
  system_prompt TEXT NOT NULL,
  final_deliverable_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4',
  estimated_duration TEXT,
  total_steps INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  instructions JSONB,
  product_group TEXT,
  display_order INTEGER,
  is_purchasable BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_product_definitions_slug ON public.product_definitions(product_slug);
CREATE INDEX IF NOT EXISTS idx_product_definitions_active ON public.product_definitions(is_active);

-- =====================================================
-- PRODUCT ACCESS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_access (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_session_id TEXT,
  amount_paid NUMERIC(10, 2),
  access_granted BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  free_attempts_used INTEGER DEFAULT 0,
  free_attempts_limit INTEGER DEFAULT 2,
  purchase_source TEXT,
  bundle_slug TEXT,
  UNIQUE(user_id, product_slug)
);

CREATE INDEX IF NOT EXISTS idx_product_access_user_id ON public.product_access(user_id);
CREATE INDEX IF NOT EXISTS idx_product_access_product_slug ON public.product_access(product_slug);
CREATE INDEX IF NOT EXISTS idx_product_access_stripe_session ON public.product_access(stripe_session_id);

-- =====================================================
-- PRODUCT SESSIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_sessions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 5,
  is_complete BOOLEAN DEFAULT FALSE,
  step_data JSONB DEFAULT '{}',
  deliverable_content TEXT,
  deliverable_url TEXT,
  deliverable_generated_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  placements JSONB,
  placements_confirmed BOOLEAN DEFAULT FALSE NOT NULL,
  current_section INTEGER DEFAULT 1 NOT NULL,
  followup_counts JSONB DEFAULT '{}' NOT NULL,
  version INTEGER DEFAULT 1,
  parent_session_id UUID REFERENCES public.product_sessions(id) ON DELETE SET NULL,
  is_latest_version BOOLEAN DEFAULT TRUE,
  scan_number INTEGER,
  parent_product_slug TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_sessions_user_id ON public.product_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_product_sessions_product_slug ON public.product_sessions(product_slug);
CREATE INDEX IF NOT EXISTS idx_product_sessions_complete ON public.product_sessions(is_complete);

-- =====================================================
-- CONVERSATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.product_sessions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  follow_up_count INTEGER DEFAULT 0,
  max_follow_ups INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON public.conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_step ON public.conversations(session_id, step_number);

COMMENT ON TABLE public.conversations IS 'AI conversation history per step';

-- =====================================================
-- PROMPTS + PRODUCT STEPS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug TEXT NOT NULL,
  scope TEXT NOT NULL,
  step_number INTEGER,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- UPLOADED DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.uploaded_documents (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.product_sessions(id) ON DELETE CASCADE,
  step_number INTEGER,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_user_id ON public.uploaded_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_session_id ON public.uploaded_documents(session_id);

-- =====================================================
-- CORE FUNCTIONS
-- =====================================================

-- Grant product access
CREATE OR REPLACE FUNCTION public.grant_product_access(
  p_email TEXT,
  p_product_slug TEXT,
  p_stripe_session_id TEXT,
  p_amount_paid DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_access_id UUID;
BEGIN
  -- Get or create user
  SELECT id INTO v_user_id FROM public.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    INSERT INTO public.users (email) VALUES (p_email) RETURNING id INTO v_user_id;
  END IF;

  -- Grant product access
  INSERT INTO public.product_access (
    user_id,
    product_slug,
    stripe_session_id,
    amount_paid
  ) VALUES (
    v_user_id,
    p_product_slug,
    p_stripe_session_id,
    p_amount_paid
  )
  ON CONFLICT (user_id, product_slug) DO UPDATE
    SET access_granted = TRUE,
        stripe_session_id = p_stripe_session_id,
        amount_paid = p_amount_paid
  RETURNING id INTO v_access_id;

  RETURN v_access_id;
END;
$$ LANGUAGE plpgsql;

-- Update session progress
CREATE OR REPLACE FUNCTION public.update_session_progress(
  p_session_id UUID,
  p_current_step INTEGER,
  p_total_steps INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_percentage INTEGER;
BEGIN
  -- Calculate completion percentage
  v_percentage := ROUND((p_current_step::DECIMAL / p_total_steps) * 100);

  -- Update session
  UPDATE public.product_sessions
  SET
    current_step = p_current_step,
    completion_percentage = v_percentage,
    last_activity_at = NOW()
  WHERE id = p_session_id;

  -- Update product_access completion percentage
  UPDATE public.product_access
  SET completion_percentage = v_percentage
  WHERE user_id = (SELECT user_id FROM public.product_sessions WHERE id = p_session_id)
    AND product_slug = (SELECT product_slug FROM public.product_sessions WHERE id = p_session_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_definitions_updated_at ON public.product_definitions;
CREATE TRIGGER update_product_definitions_updated_at
  BEFORE UPDATE ON public.product_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_sessions_updated_at ON public.product_sessions;
CREATE TRIGGER update_product_sessions_updated_at
  BEFORE UPDATE ON public.product_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
