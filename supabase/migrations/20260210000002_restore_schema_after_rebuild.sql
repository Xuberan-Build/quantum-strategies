-- =====================================================
-- RESTORE SCHEMA AFTER DATABASE REBUILD
-- Fixes damage caused by 20260204190900_remote_schema.sql which dropped
-- constraints, columns, triggers, functions, RLS policies, and indexes
-- that were part of the original schema.
-- =====================================================

-- =====================================================
-- 1. CONVERSATIONS: Restore UNIQUE constraint
-- Used by 5+ places: ProductExperience, FollowUpChat,
-- step-insight, final-briefing, followup-response routes
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_session_id_step_number_key'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_session_id_step_number_key
      UNIQUE (session_id, step_number);
  END IF;
END $$;

-- =====================================================
-- 2. BETA_PARTICIPANTS: Restore missing columns
-- =====================================================

-- Progress tracking columns (used by trigger functions)
ALTER TABLE public.beta_participants
  ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS current_rite TEXT DEFAULT 'perception',
  ADD COLUMN IF NOT EXISTS perception_completed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orientation_completed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS declaration_completed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_completion_percentage DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS micro_feedback_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consolidation_feedback_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complete_journey_submitted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_completion_rate DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Conversion tracking columns
ALTER TABLE public.beta_participants
  ADD COLUMN IF NOT EXISTS total_amount_paid_before_offer DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS summary_pdf_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS summary_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS conversion_offer_presented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_code_generated TEXT,
  ADD COLUMN IF NOT EXISTS remaining_balance_offered DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS conversion_decision TEXT,
  ADD COLUMN IF NOT EXISTS conversion_decision_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversion_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS conversion_stripe_session_id TEXT;

-- Communication tracking columns
ALTER TABLE public.beta_participants
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS week_1_checkin_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS week_2_checkin_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS week_4_checkin_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rite_one_celebration_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rite_two_celebration_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rite_three_celebration_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_email_sent_at TIMESTAMPTZ;

-- Backfill null values before restoring NOT NULL constraints
UPDATE public.beta_participants SET cohort_name = 'Beta Cohort' WHERE cohort_name IS NULL;
UPDATE public.beta_participants SET status = 'active' WHERE status IS NULL;
UPDATE public.beta_participants SET created_at = NOW() WHERE created_at IS NULL;
UPDATE public.beta_participants SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE public.beta_participants SET program_start_date = created_at WHERE program_start_date IS NULL;
UPDATE public.beta_participants SET program_end_date = COALESCE(program_start_date, created_at) + INTERVAL '6 weeks' WHERE program_end_date IS NULL;
UPDATE public.beta_participants SET enrollment_date = created_at WHERE enrollment_date IS NULL;

-- Restore NOT NULL and defaults that were dropped
ALTER TABLE public.beta_participants
  ALTER COLUMN cohort_name SET DEFAULT 'Beta Cohort',
  ALTER COLUMN cohort_name SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN program_start_date SET DEFAULT NOW(),
  ALTER COLUMN program_start_date SET NOT NULL,
  ALTER COLUMN program_end_date SET DEFAULT (NOW() + INTERVAL '6 weeks'),
  ALTER COLUMN program_end_date SET NOT NULL;

-- =====================================================
-- 3. BETA_PARTICIPANTS: Restore CHECK constraints
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_status'
      AND conrelid = 'public.beta_participants'::regclass
  ) THEN
    ALTER TABLE public.beta_participants
      ADD CONSTRAINT valid_status CHECK (status IN ('active', 'completed', 'withdrawn'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_rite'
      AND conrelid = 'public.beta_participants'::regclass
  ) THEN
    ALTER TABLE public.beta_participants
      ADD CONSTRAINT valid_rite CHECK (current_rite IN ('perception', 'orientation', 'declaration', 'complete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_conversion'
      AND conrelid = 'public.beta_participants'::regclass
  ) THEN
    ALTER TABLE public.beta_participants
      ADD CONSTRAINT valid_conversion CHECK (conversion_decision IN ('purchased', 'declined', 'pending'));
  END IF;
END $$;

-- =====================================================
-- 4. BETA_PARTICIPANTS: Restore indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_beta_participants_status ON beta_participants(status);
CREATE INDEX IF NOT EXISTS idx_beta_participants_cohort ON beta_participants(cohort_name);
CREATE INDEX IF NOT EXISTS idx_beta_participants_enrollment_date ON beta_participants(enrollment_date);
CREATE INDEX IF NOT EXISTS idx_beta_participants_current_rite ON beta_participants(current_rite);

-- =====================================================
-- 5. FEEDBACK TABLES: Re-enable RLS + restore policies
-- The destructive migration disabled RLS on all feedback tables
-- =====================================================

ALTER TABLE public.blueprint_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.declaration_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rite_one_consolidation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rite_two_consolidation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complete_journey_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_conversion_results ENABLE ROW LEVEL SECURITY;

-- Restore user SELECT policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own scan feedback') THEN
    CREATE POLICY "Users view own scan feedback" ON scan_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own blueprint feedback') THEN
    CREATE POLICY "Users view own blueprint feedback" ON blueprint_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own declaration feedback') THEN
    CREATE POLICY "Users view own declaration feedback" ON declaration_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own rite one consolidation') THEN
    CREATE POLICY "Users view own rite one consolidation" ON rite_one_consolidation FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own rite two consolidation') THEN
    CREATE POLICY "Users view own rite two consolidation" ON rite_two_consolidation FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own journey feedback') THEN
    CREATE POLICY "Users view own journey feedback" ON complete_journey_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own conversion results') THEN
    CREATE POLICY "Users view own conversion results" ON beta_conversion_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users view own beta participation') THEN
    CREATE POLICY "Users view own beta participation" ON beta_participants FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Restore service_role full access policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access scan feedback') THEN
    CREATE POLICY "Service role full access scan feedback" ON scan_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access blueprint feedback') THEN
    CREATE POLICY "Service role full access blueprint feedback" ON blueprint_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access declaration feedback') THEN
    CREATE POLICY "Service role full access declaration feedback" ON declaration_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access rite one consolidation') THEN
    CREATE POLICY "Service role full access rite one consolidation" ON rite_one_consolidation FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access rite two consolidation') THEN
    CREATE POLICY "Service role full access rite two consolidation" ON rite_two_consolidation FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access journey feedback') THEN
    CREATE POLICY "Service role full access journey feedback" ON complete_journey_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access conversion results') THEN
    CREATE POLICY "Service role full access conversion results" ON beta_conversion_results FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access beta participants') THEN
    CREATE POLICY "Service role full access beta participants" ON beta_participants FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Restore feedback table indexes
CREATE INDEX IF NOT EXISTS idx_scan_feedback_participant ON scan_feedback(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_scan_feedback_product ON scan_feedback(product_slug);
CREATE INDEX IF NOT EXISTS idx_scan_feedback_submitted ON scan_feedback(submitted_at);
CREATE INDEX IF NOT EXISTS idx_blueprint_feedback_participant ON blueprint_feedback(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_feedback_product ON blueprint_feedback(product_slug);
CREATE INDEX IF NOT EXISTS idx_declaration_feedback_participant ON declaration_feedback(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_declaration_feedback_product ON declaration_feedback(product_slug);
CREATE INDEX IF NOT EXISTS idx_rite_one_consolidation_participant ON rite_one_consolidation(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_rite_one_consolidation_nps ON rite_one_consolidation(rite_one_nps);
CREATE INDEX IF NOT EXISTS idx_rite_two_consolidation_participant ON rite_two_consolidation(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_rite_two_consolidation_nps ON rite_two_consolidation(rite_two_nps);
CREATE INDEX IF NOT EXISTS idx_complete_journey_participant ON complete_journey_feedback(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_complete_journey_nps ON complete_journey_feedback(nps_score);
CREATE INDEX IF NOT EXISTS idx_complete_journey_founding ON complete_journey_feedback(founding_member_interest);
CREATE INDEX IF NOT EXISTS idx_complete_journey_timeline ON complete_journey_feedback(purchase_timeline);
CREATE INDEX IF NOT EXISTS idx_beta_conversion_participant ON beta_conversion_results(beta_participant_id);
CREATE INDEX IF NOT EXISTS idx_beta_conversion_decision ON beta_conversion_results(decision);
CREATE INDEX IF NOT EXISTS idx_beta_conversion_stage ON beta_conversion_results(purchased_at_stage);
CREATE INDEX IF NOT EXISTS idx_beta_conversion_date ON beta_conversion_results(decision_made_at);

-- =====================================================
-- 6. RESTORE TRIGGER FUNCTIONS
-- These were dropped by the destructive migration
-- =====================================================

-- 6a. sync_product_access_completion
CREATE OR REPLACE FUNCTION sync_product_access_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_access
  SET
    completed_at = NEW.completed_at,
    completion_percentage = 100
  WHERE user_id = NEW.user_id
    AND product_slug = NEW.product_slug
    AND completed_at IS NULL;
  RETURN NEW;
END;
$$;

-- 6b. update_beta_participant_progress
CREATE OR REPLACE FUNCTION update_beta_participant_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant_record RECORD;
  perception_count INTEGER;
  orientation_count INTEGER;
  declaration_count INTEGER;
  total_products INTEGER;
  total_feedback INTEGER;
  feedback_rate DECIMAL(5,2);
BEGIN
  SELECT * INTO participant_record
  FROM beta_participants
  WHERE user_id = NEW.user_id;

  IF participant_record IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO perception_count
  FROM product_access
  WHERE user_id = NEW.user_id
    AND product_slug SIMILAR TO 'perception-rite-scan-[1-5]'
    AND completed_at IS NOT NULL;

  SELECT COUNT(*) INTO orientation_count
  FROM product_access
  WHERE user_id = NEW.user_id
    AND product_slug IN ('personal-alignment', 'business-alignment', 'brand-alignment')
    AND completed_at IS NOT NULL;

  SELECT COUNT(*) INTO declaration_count
  FROM product_access
  WHERE user_id = NEW.user_id
    AND product_slug SIMILAR TO 'declaration-rite-%'
    AND completed_at IS NOT NULL;

  total_products := perception_count + orientation_count + declaration_count;

  SELECT COUNT(*) INTO total_feedback
  FROM (
    SELECT id FROM scan_feedback WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM blueprint_feedback WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM declaration_feedback WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM rite_one_consolidation WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM rite_two_consolidation WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM complete_journey_feedback WHERE beta_participant_id = participant_record.id
  ) AS all_feedback;

  IF total_products > 0 THEN
    feedback_rate := (total_feedback::DECIMAL / total_products::DECIMAL) * 100;
  ELSE
    feedback_rate := 0;
  END IF;

  UPDATE beta_participants
  SET
    perception_completed_count = perception_count,
    orientation_completed_count = orientation_count,
    declaration_completed_count = declaration_count,
    total_completion_percentage = ((perception_count + orientation_count + declaration_count) / 11.0) * 100,
    feedback_completion_rate = feedback_rate,
    current_rite = CASE
      WHEN perception_count < 5 THEN 'perception'
      WHEN orientation_count < 3 THEN 'orientation'
      WHEN declaration_count < 3 THEN 'declaration'
      ELSE 'complete'
    END,
    updated_at = NOW()
  WHERE id = participant_record.id;

  RETURN NEW;
END;
$$;

-- 6c. update_beta_feedback_counts
CREATE OR REPLACE FUNCTION update_beta_feedback_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  micro_count INTEGER;
  consolidation_count INTEGER;
  journey_submitted BOOLEAN;
  total_products INTEGER;
  total_feedback INTEGER;
  feedback_rate DECIMAL(5,2);
BEGIN
  SELECT COUNT(*) INTO micro_count
  FROM (
    SELECT id FROM scan_feedback WHERE beta_participant_id = NEW.beta_participant_id
    UNION ALL
    SELECT id FROM blueprint_feedback WHERE beta_participant_id = NEW.beta_participant_id
    UNION ALL
    SELECT id FROM declaration_feedback WHERE beta_participant_id = NEW.beta_participant_id
  ) AS micro_feedback;

  SELECT COUNT(*) INTO consolidation_count
  FROM (
    SELECT id FROM rite_one_consolidation WHERE beta_participant_id = NEW.beta_participant_id
    UNION ALL
    SELECT id FROM rite_two_consolidation WHERE beta_participant_id = NEW.beta_participant_id
  ) AS consolidations;

  SELECT EXISTS(
    SELECT 1 FROM complete_journey_feedback WHERE beta_participant_id = NEW.beta_participant_id
  ) INTO journey_submitted;

  SELECT
    perception_completed_count + orientation_completed_count + declaration_completed_count
  INTO total_products
  FROM beta_participants
  WHERE id = NEW.beta_participant_id;

  total_feedback := micro_count + consolidation_count + (CASE WHEN journey_submitted THEN 1 ELSE 0 END);

  IF total_products > 0 THEN
    feedback_rate := (total_feedback::DECIMAL / total_products::DECIMAL) * 100;
  ELSE
    feedback_rate := 0;
  END IF;

  UPDATE beta_participants
  SET
    micro_feedback_count = micro_count,
    consolidation_feedback_count = consolidation_count,
    complete_journey_submitted = journey_submitted,
    feedback_completion_rate = feedback_rate,
    updated_at = NOW()
  WHERE id = NEW.beta_participant_id;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 7. RESTORE TRIGGERS
-- =====================================================

-- Product session completion sync
DROP TRIGGER IF EXISTS trigger_sync_product_access_completion ON product_sessions;
CREATE TRIGGER trigger_sync_product_access_completion
  AFTER UPDATE OF completed_at ON product_sessions
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
  EXECUTE FUNCTION sync_product_access_completion();

-- Beta progress tracking
DROP TRIGGER IF EXISTS trigger_update_beta_progress ON product_access;
CREATE TRIGGER trigger_update_beta_progress
  AFTER UPDATE OF completed_at ON product_access
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
  EXECUTE FUNCTION update_beta_participant_progress();

-- Feedback count triggers
DROP TRIGGER IF EXISTS trigger_update_scan_feedback_count ON scan_feedback;
CREATE TRIGGER trigger_update_scan_feedback_count
  AFTER INSERT ON scan_feedback
  FOR EACH ROW EXECUTE FUNCTION update_beta_feedback_counts();

DROP TRIGGER IF EXISTS trigger_update_blueprint_feedback_count ON blueprint_feedback;
CREATE TRIGGER trigger_update_blueprint_feedback_count
  AFTER INSERT ON blueprint_feedback
  FOR EACH ROW EXECUTE FUNCTION update_beta_feedback_counts();

DROP TRIGGER IF EXISTS trigger_update_declaration_feedback_count ON declaration_feedback;
CREATE TRIGGER trigger_update_declaration_feedback_count
  AFTER INSERT ON declaration_feedback
  FOR EACH ROW EXECUTE FUNCTION update_beta_feedback_counts();

DROP TRIGGER IF EXISTS trigger_update_rite_one_consolidation_count ON rite_one_consolidation;
CREATE TRIGGER trigger_update_rite_one_consolidation_count
  AFTER INSERT ON rite_one_consolidation
  FOR EACH ROW EXECUTE FUNCTION update_beta_feedback_counts();

DROP TRIGGER IF EXISTS trigger_update_rite_two_consolidation_count ON rite_two_consolidation;
CREATE TRIGGER trigger_update_rite_two_consolidation_count
  AFTER INSERT ON rite_two_consolidation
  FOR EACH ROW EXECUTE FUNCTION update_beta_feedback_counts();

DROP TRIGGER IF EXISTS trigger_update_journey_feedback_count ON complete_journey_feedback;
CREATE TRIGGER trigger_update_journey_feedback_count
  AFTER INSERT ON complete_journey_feedback
  FOR EACH ROW EXECUTE FUNCTION update_beta_feedback_counts();

-- =====================================================
-- 8. FIX DUPLICATE enroll_beta_participant FUNCTION
-- Drop the old email-only overload that was re-created
-- by the destructive migration
-- =====================================================
DROP FUNCTION IF EXISTS enroll_beta_participant(TEXT, TEXT, TEXT);

-- =====================================================
-- 9. COURSE TABLES: Restore missing UNIQUE constraints
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_progress_user_id_course_slug_module_id_submodule_id_key'
  ) THEN
    ALTER TABLE public.course_progress
      ADD CONSTRAINT course_progress_user_id_course_slug_module_id_submodule_id_key
      UNIQUE (user_id, course_slug, module_id, submodule_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_slide_events_user_id_course_slug_module_id_submodule_key'
  ) THEN
    ALTER TABLE public.course_slide_events
      ADD CONSTRAINT course_slide_events_user_id_course_slug_module_id_submodule_key
      UNIQUE (user_id, course_slug, module_id, submodule_id, coord);
  END IF;
END $$;

-- =====================================================
-- 10. EMAIL_SEQUENCES: Restore missing constraints
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_sequence'
  ) THEN
    ALTER TABLE public.email_sequences
      ADD CONSTRAINT unique_user_sequence UNIQUE (user_id, sequence_type);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_email_status'
      AND conrelid = 'public.email_sequences'::regclass
  ) THEN
    ALTER TABLE public.email_sequences
      ADD CONSTRAINT valid_email_status CHECK (
        email_status IN ('scheduled', 'sent', 'failed', 'cancelled')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_sequence_type'
      AND conrelid = 'public.email_sequences'::regclass
  ) THEN
    ALTER TABLE public.email_sequences
      ADD CONSTRAINT valid_sequence_type CHECK (
        sequence_type IN ('affiliate_invitation')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_delay'
      AND conrelid = 'public.email_sequences'::regclass
  ) THEN
    ALTER TABLE public.email_sequences
      ADD CONSTRAINT valid_delay CHECK (delay_minutes >= 0);
  END IF;
END $$;

-- =====================================================
-- 11. USERS: Restore index
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
