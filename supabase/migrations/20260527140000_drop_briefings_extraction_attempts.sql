-- =====================================================
-- Migration: drop_briefings_extraction_attempts
-- Date: 2026-05-27
--
-- Drops public.briefings.extraction_attempts.
--
-- This column duplicated public.portrait_update_queue.attempts.
-- The worker maintained both — the queue authoritatively in the
-- claim step (UPDATE portrait_update_queue SET attempts = attempts+1),
-- and the briefing best-effort immediately after. Two counters
-- holding the same number is a drift vector; with the queue as
-- the single source of truth, the admin UI joins through
-- portrait_update_queue.attempts when it needs to display retry
-- count.
--
-- Code changes shipped alongside this migration:
--   - src/lib/portraits/worker.ts no longer writes the column.
--   - src/app/admin/portraits/[userId]/page.tsx drops it from the
--     briefings select and fetches portrait_update_queue.attempts
--     keyed by briefing_id.
--   - src/components/admin/PortraitInspector.tsx reads attempts
--     from the enriched briefing row.
--
-- No content loss: the column held a counter, not signal data.
-- The same number lives on portrait_update_queue.attempts.
-- =====================================================

ALTER TABLE public.briefings
  DROP COLUMN IF EXISTS extraction_attempts;


-- =====================================================
-- Verification
-- =====================================================

DO $$
DECLARE
  v_col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'briefings'
      AND column_name  = 'extraction_attempts'
  ) INTO v_col_exists;

  IF v_col_exists THEN
    RAISE EXCEPTION 'briefings.extraction_attempts still exists after migration';
  END IF;

  RAISE NOTICE 'briefings.extraction_attempts successfully dropped.';
END
$$;
