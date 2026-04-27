-- CORE TABLE RECOVERY SCRIPT
-- Run this in Supabase SQL Editor to recreate base tables

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    email text NOT NULL UNIQUE,
    name text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_affiliate boolean DEFAULT false,
    affiliate_enrolled_at timestamp with time zone,
    total_earnings_cents integer DEFAULT 0,
    available_balance_cents integer DEFAULT 0,
    total_withdrawn_cents integer DEFAULT 0,
    dinner_party_credits_cents integer DEFAULT 0,
    affiliate_opted_out boolean DEFAULT false,
    first_affiliate_visit timestamp with time zone,
    placements jsonb,
    placements_confirmed boolean DEFAULT false,
    placements_updated_at timestamp with time zone,
    role text DEFAULT 'user'
);

-- 2. PRODUCT_DEFINITIONS TABLE
CREATE TABLE IF NOT EXISTS public.product_definitions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    product_slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    price numeric(10,2),
    steps jsonb NOT NULL,
    system_prompt text NOT NULL,
    final_deliverable_prompt text NOT NULL,
    model text DEFAULT 'gpt-4',
    estimated_duration text,
    total_steps integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    instructions jsonb,
    product_group text,
    display_order integer,
    is_purchasable boolean DEFAULT true
);

-- 3. PRODUCT_ACCESS TABLE
CREATE TABLE IF NOT EXISTS public.product_access (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_slug text NOT NULL,
    purchase_date timestamp with time zone DEFAULT now(),
    stripe_session_id text,
    amount_paid numeric(10,2),
    access_granted boolean DEFAULT true,
    expires_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    completion_percentage integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    free_attempts_used integer DEFAULT 0,
    free_attempts_limit integer DEFAULT 2,
    purchase_source text,
    bundle_slug text,
    UNIQUE(user_id, product_slug)
);

-- 4. PRODUCT_SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.product_sessions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_slug text NOT NULL,
    current_step integer DEFAULT 1,
    status text DEFAULT 'in_progress',
    session_data jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    placements jsonb,
    placements_confirmed boolean DEFAULT false
);

-- 5. REFERRAL_HIERARCHY TABLE
CREATE TABLE IF NOT EXISTS public.referral_hierarchy (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    affiliate_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    referred_by_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    referral_code text NOT NULL UNIQUE,
    referral_link text NOT NULL,
    current_track text DEFAULT 'community_builder',
    stripe_connect_account_id text,
    stripe_connect_onboarding_complete boolean DEFAULT false,
    stripe_connect_charges_enabled boolean DEFAULT false,
    stripe_connect_payouts_enabled boolean DEFAULT false,
    total_referrals integer DEFAULT 0,
    active_referrals integer DEFAULT 0,
    enrolled_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. BETA_PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.beta_participants (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    cohort_name text,
    program_start_date timestamp with time zone,
    program_end_date timestamp with time zone,
    application_why_participate text,
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 7. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    event_action text NOT NULL,
    event_status text DEFAULT 'success',
    entity_type text,
    entity_id uuid,
    metadata jsonb DEFAULT '{}',
    error_message text,
    error_stack text,
    error_code text,
    request_path text,
    session_id text,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- 8. CONTENT_INDEX TABLE
CREATE TABLE IF NOT EXISTS public.content_index (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    content_type text NOT NULL,
    content_key text NOT NULL,
    content_value text,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(content_type, content_key)
);

-- 9. Handle new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Success message
DO $$ BEGIN RAISE NOTICE 'Core tables created successfully'; END $$;
