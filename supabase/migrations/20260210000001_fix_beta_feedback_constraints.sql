-- Fix missing UNIQUE constraints on beta feedback tables
-- These constraints were lost during the 2026-01-30 database rebuild.
-- The upsert operations in /api/beta/submit-feedback require these constraints
-- to handle ON CONFLICT clauses.

-- scan_feedback: UNIQUE on (beta_participant_id, product_slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scan_feedback_beta_participant_id_product_slug_key'
  ) THEN
    ALTER TABLE public.scan_feedback
      ADD CONSTRAINT scan_feedback_beta_participant_id_product_slug_key
      UNIQUE (beta_participant_id, product_slug);
  END IF;
END $$;

-- blueprint_feedback: UNIQUE on (beta_participant_id, product_slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'blueprint_feedback_beta_participant_id_product_slug_key'
  ) THEN
    ALTER TABLE public.blueprint_feedback
      ADD CONSTRAINT blueprint_feedback_beta_participant_id_product_slug_key
      UNIQUE (beta_participant_id, product_slug);
  END IF;
END $$;

-- declaration_feedback: UNIQUE on (beta_participant_id, product_slug)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'declaration_feedback_beta_participant_id_product_slug_key'
  ) THEN
    ALTER TABLE public.declaration_feedback
      ADD CONSTRAINT declaration_feedback_beta_participant_id_product_slug_key
      UNIQUE (beta_participant_id, product_slug);
  END IF;
END $$;

-- rite_one_consolidation: UNIQUE on (beta_participant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rite_one_consolidation_beta_participant_id_key'
  ) THEN
    ALTER TABLE public.rite_one_consolidation
      ADD CONSTRAINT rite_one_consolidation_beta_participant_id_key
      UNIQUE (beta_participant_id);
  END IF;
END $$;

-- rite_two_consolidation: UNIQUE on (beta_participant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rite_two_consolidation_beta_participant_id_key'
  ) THEN
    ALTER TABLE public.rite_two_consolidation
      ADD CONSTRAINT rite_two_consolidation_beta_participant_id_key
      UNIQUE (beta_participant_id);
  END IF;
END $$;

-- complete_journey_feedback: UNIQUE on (beta_participant_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complete_journey_feedback_beta_participant_id_key'
  ) THEN
    ALTER TABLE public.complete_journey_feedback
      ADD CONSTRAINT complete_journey_feedback_beta_participant_id_key
      UNIQUE (beta_participant_id);
  END IF;
END $$;
