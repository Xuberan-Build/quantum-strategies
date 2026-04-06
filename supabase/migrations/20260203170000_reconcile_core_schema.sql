-- Reconcile core tables with application expectations (safe, additive)

-- =====================================================
-- CONVERSATIONS
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    ALTER TABLE public.conversations
      ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS max_follow_ups INTEGER DEFAULT 3,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Ensure messages is non-nullable with a default
    ALTER TABLE public.conversations
      ALTER COLUMN messages SET DEFAULT '[]'::jsonb;
    UPDATE public.conversations SET messages = '[]'::jsonb WHERE messages IS NULL;
    ALTER TABLE public.conversations
      ALTER COLUMN messages SET NOT NULL;

    -- If legacy content column exists, make it nullable to avoid insert failures
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'content'
    ) THEN
      ALTER TABLE public.conversations ALTER COLUMN content DROP NOT NULL;
    END IF;
  END IF;
END $$;

-- =====================================================
-- PRODUCT SESSIONS
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.product_sessions') IS NOT NULL THEN
    ALTER TABLE public.product_sessions
      ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS step_data JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS deliverable_content TEXT,
      ADD COLUMN IF NOT EXISTS deliverable_url TEXT,
      ADD COLUMN IF NOT EXISTS deliverable_generated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS placements JSONB,
      ADD COLUMN IF NOT EXISTS placements_confirmed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS current_section INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS followup_counts JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS parent_session_id UUID,
      ADD COLUMN IF NOT EXISTS is_latest_version BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS scan_number INTEGER,
      ADD COLUMN IF NOT EXISTS parent_product_slug TEXT;
  END IF;
END $$;

-- =====================================================
-- PRODUCT ACCESS
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.product_access') IS NOT NULL THEN
    ALTER TABLE public.product_access
      ADD COLUMN IF NOT EXISTS free_attempts_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS free_attempts_limit INTEGER DEFAULT 2,
      ADD COLUMN IF NOT EXISTS purchase_source TEXT,
      ADD COLUMN IF NOT EXISTS bundle_slug TEXT;
  END IF;
END $$;

-- =====================================================
-- USERS
-- =====================================================
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS placements JSONB,
      ADD COLUMN IF NOT EXISTS placements_confirmed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS placements_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS affiliate_opted_out BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS first_affiliate_visit TIMESTAMPTZ;
  END IF;
END $$;
