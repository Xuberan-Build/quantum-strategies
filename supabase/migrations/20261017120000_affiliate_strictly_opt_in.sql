-- Migration: 20261017120000_affiliate_strictly_opt_in
-- Purpose: Make the referral/affiliate program strictly opt-in.
--
-- Background: trigger_auto_enroll_affiliate (20251201000003, updated in
-- 20251201000006) fired AFTER INSERT on product_access and created a
-- referral_hierarchy row (with a generated referral_code) and set
-- users.is_affiliate = true for every buyer. Founder decision: nobody is
-- enrolled, gets a referral code, or receives referral emails unless they
-- explicitly opt in.
--
-- Changes:
--   1. referral_hierarchy.opted_in_at: the explicit opt-in marker. Only rows
--      with opted_in_at IS NOT NULL are treated as live affiliates.
--   2. Backfill: existing rows keep opted_in_at only if they show real
--      activity (completed/started Stripe Connect, referred users, a referrer
--      of someone, referral counts, or affiliate_transactions). Rows
--      auto-created by the trigger with no activity stay (not deleted) but
--      with opted_in_at NULL; users.is_affiliate is reset to false for them.
--   3. Drop trigger_auto_enroll_affiliate and neuter auto_enroll_affiliate().
--   4. Cancel any scheduled affiliate_invitation emails.
--
-- Rollback (manual; data is in backups/2026-10-17T05-23-09):
--   CREATE TRIGGER trigger_auto_enroll_affiliate AFTER INSERT ON product_access
--     FOR EACH ROW EXECUTE FUNCTION auto_enroll_affiliate();  -- and restore function body from 20251201000006
--   ALTER TABLE referral_hierarchy DROP COLUMN opted_in_at;

-- 1. Opt-in marker
ALTER TABLE public.referral_hierarchy
  ADD COLUMN IF NOT EXISTS opted_in_at timestamptz;

COMMENT ON COLUMN public.referral_hierarchy.opted_in_at IS
  'When the user explicitly opted in to the referral program. NULL = not opted in (row is inert: no code is honoured, no emails, not shown as affiliate).';

-- 2. Backfill (only touches rows not yet marked, so re-running is safe)
DO $$
DECLARE
  has_tx boolean := to_regclass('public.affiliate_transactions') IS NOT NULL;
BEGIN
  UPDATE public.referral_hierarchy rh
  SET opted_in_at = COALESCE(rh.enrolled_at, rh.created_at, now())
  WHERE rh.opted_in_at IS NULL
    AND (
      rh.stripe_connect_account_id IS NOT NULL
      OR rh.stripe_connect_onboarding_complete IS TRUE
      OR rh.referred_by_id IS NOT NULL
      OR COALESCE(rh.total_referrals, 0) > 0
      OR COALESCE(rh.active_referrals, 0) > 0
      OR EXISTS (SELECT 1 FROM public.referral_hierarchy c WHERE c.referred_by_id = rh.affiliate_id)
    );

  IF has_tx THEN
    EXECUTE $q$
      UPDATE public.referral_hierarchy rh
      SET opted_in_at = COALESCE(rh.enrolled_at, rh.created_at, now())
      WHERE rh.opted_in_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.affiliate_transactions t
          WHERE t.direct_referrer_id = rh.affiliate_id
             OR t.override_referrer_id = rh.affiliate_id
        )
    $q$;
  END IF;

  -- Users whose only "enrollment" was the auto trigger are no longer affiliates
  UPDATE public.users u
  SET is_affiliate = false,
      affiliate_enrolled_at = NULL
  WHERE u.is_affiliate IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.referral_hierarchy rh
      WHERE rh.affiliate_id = u.id AND rh.opted_in_at IS NOT NULL
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_hierarchy_opted_in
  ON public.referral_hierarchy (referral_code) WHERE opted_in_at IS NOT NULL;

-- 3. Remove auto-enrollment
DROP TRIGGER IF EXISTS trigger_auto_enroll_affiliate ON public.product_access;

CREATE OR REPLACE FUNCTION public.auto_enroll_affiliate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Intentionally a no-op. Affiliate enrollment is strictly opt-in via
  -- POST /api/affiliate/enroll. Kept only so old references do not break.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_enroll_affiliate() IS
  'DISABLED (2026-10-17): affiliate enrollment is opt-in only. No-op.';

-- 4. Cancel pending unsolicited invitation emails
DO $$
BEGIN
  IF to_regclass('public.email_sequences') IS NOT NULL THEN
    UPDATE public.email_sequences
    SET email_status = 'cancelled', updated_at = now()
    WHERE sequence_type = 'affiliate_invitation'
      AND email_status = 'scheduled';
  END IF;
END $$;
