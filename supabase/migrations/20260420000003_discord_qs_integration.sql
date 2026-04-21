-- =====================================================
-- Discord ↔ Quantum Strategies Integration Layer
--
-- 1. Add rite completion tracking to member_sequences
-- 2. Trigger: sync member_sequences when a product_session completes
-- 3. RPC: get_member_deliverables(discord_id) → blueprint content
-- 4. View: member_rite_progress — unified cross-platform view
-- =====================================================


-- ─── 1. Extend member_sequences ──────────────────────────────────────────────

ALTER TABLE public.member_sequences
  ADD COLUMN IF NOT EXISTS rite_one_complete      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rite_one_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rite_two_complete      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rite_two_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rite_three_complete    BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rite_three_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_completed_product TEXT,
  ADD COLUMN IF NOT EXISTS last_completed_at      TIMESTAMPTZ;


-- ─── 2. Trigger: sync on product_session completion ─────────────────────────

CREATE OR REPLACE FUNCTION public.sync_discord_on_qs_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discord_id      TEXT;
  v_seq_stage       INTEGER;
  v_rite_num        INTEGER;
  v_all_done        BOOLEAN;

  v_rite_one_slugs   TEXT[] := ARRAY[
    'perception-rite-scan-1','perception-rite-scan-2','perception-rite-scan-3',
    'perception-rite-scan-4','perception-rite-scan-5'
  ];
  v_rite_two_slugs   TEXT[] := ARRAY[
    'personal-alignment','business-alignment','brand-alignment'
  ];
  v_rite_three_slugs TEXT[] := ARRAY[
    'declaration-rite-life-vision','declaration-rite-business-model',
    'declaration-rite-strategic-path'
  ];
BEGIN
  -- Only fire when completed_at transitions NULL → value
  IF OLD.completed_at IS NOT NULL OR NEW.completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve discord_id for this QS user
  SELECT discord_id INTO v_discord_id
  FROM users WHERE id = NEW.user_id;

  -- Skip if user hasn't linked their Discord account
  IF v_discord_id IS NULL THEN RETURN NEW; END IF;

  -- Skip if no member_sequences row exists for this discord_id
  SELECT sequence_stage INTO v_seq_stage
  FROM member_sequences WHERE discord_id = v_discord_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Update rite_purchased + last completion fields
  UPDATE member_sequences SET
    rite_purchased       = TRUE,
    last_completed_product = NEW.product_slug,
    last_completed_at    = NEW.completed_at
  WHERE discord_id = v_discord_id;

  -- Determine which rite this product belongs to
  IF NEW.product_slug = ANY(v_rite_one_slugs) THEN
    v_rite_num := 1;
  ELSIF NEW.product_slug = ANY(v_rite_two_slugs) THEN
    v_rite_num := 2;
  ELSIF NEW.product_slug = ANY(v_rite_three_slugs) THEN
    v_rite_num := 3;
  ELSE
    -- Not a rite product — still log the activity
    INSERT INTO discord_activity (discord_id, user_id, event_type, event_data, sequence_stage)
    VALUES (v_discord_id, NEW.user_id, 'product_completed',
      jsonb_build_object('product_slug', NEW.product_slug, 'rite_number', NULL, 'rite_complete', FALSE),
      v_seq_stage);
    RETURN NEW;
  END IF;

  -- Check whether every product in this rite group is now complete for this user
  SELECT bool_and(
    EXISTS (
      SELECT 1 FROM product_sessions
      WHERE user_id = NEW.user_id AND product_slug = slug AND completed_at IS NOT NULL
    )
  ) INTO v_all_done
  FROM unnest(
    CASE v_rite_num
      WHEN 1 THEN v_rite_one_slugs
      WHEN 2 THEN v_rite_two_slugs
      WHEN 3 THEN v_rite_three_slugs
    END
  ) AS slug;

  -- Stamp rite completion flag if all products in the group are done
  IF v_all_done THEN
    IF v_rite_num = 1 THEN
      UPDATE member_sequences
      SET rite_one_complete = TRUE, rite_one_completed_at = NEW.completed_at
      WHERE discord_id = v_discord_id AND rite_one_complete = FALSE;
    ELSIF v_rite_num = 2 THEN
      UPDATE member_sequences
      SET rite_two_complete = TRUE, rite_two_completed_at = NEW.completed_at
      WHERE discord_id = v_discord_id AND rite_two_complete = FALSE;
    ELSIF v_rite_num = 3 THEN
      UPDATE member_sequences
      SET rite_three_complete = TRUE, rite_three_completed_at = NEW.completed_at
      WHERE discord_id = v_discord_id AND rite_three_complete = FALSE;
    END IF;
  END IF;

  -- Append-only activity log entry
  INSERT INTO discord_activity (discord_id, user_id, event_type, event_data, sequence_stage)
  VALUES (
    v_discord_id,
    NEW.user_id,
    'product_completed',
    jsonb_build_object(
      'product_slug',  NEW.product_slug,
      'rite_number',   v_rite_num,
      'rite_complete', v_all_done
    ),
    v_seq_stage
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_product_session_complete ON public.product_sessions;

CREATE TRIGGER on_product_session_complete
  AFTER UPDATE OF completed_at ON public.product_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_discord_on_qs_completion();


-- ─── 3. RPC: get_member_deliverables ─────────────────────────────────────────
-- Returns all completed blueprints for a Discord member, newest first.
-- Includes full deliverable_content so the bot can extract closing gates / nudges.

CREATE OR REPLACE FUNCTION public.get_member_deliverables(p_discord_id TEXT)
RETURNS TABLE (
  product_slug        TEXT,
  product_name        TEXT,
  rite_number         INTEGER,
  completed_at        TIMESTAMPTZ,
  deliverable_content TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.product_slug,
    pd.name                                           AS product_name,
    CASE
      WHEN ps.product_slug IN (
        'perception-rite-scan-1','perception-rite-scan-2','perception-rite-scan-3',
        'perception-rite-scan-4','perception-rite-scan-5'
      ) THEN 1
      WHEN ps.product_slug IN (
        'personal-alignment','business-alignment','brand-alignment'
      ) THEN 2
      WHEN ps.product_slug IN (
        'declaration-rite-life-vision','declaration-rite-business-model',
        'declaration-rite-strategic-path'
      ) THEN 3
      ELSE NULL
    END                                               AS rite_number,
    ps.completed_at,
    ps.deliverable_content
  FROM product_sessions ps
  JOIN users u ON u.id = ps.user_id
  LEFT JOIN product_definitions pd ON pd.product_slug = ps.product_slug
  WHERE u.discord_id = p_discord_id
    AND ps.completed_at IS NOT NULL
    AND ps.deliverable_content IS NOT NULL
  ORDER BY ps.completed_at DESC;
$$;


-- ─── 4. View: member_rite_progress ───────────────────────────────────────────
-- Single source of truth for Discord + admin dashboards.
-- Shows per-member: sequence state, per-rite scan counts, last completion.

CREATE OR REPLACE VIEW public.member_rite_progress AS
SELECT
  ms.discord_id,
  ms.username,
  ms.name_detected,
  ms.joined_at,

  -- Linked QS account (null if not yet linked)
  u.id        AS user_id,
  u.email     AS user_email,
  u.name      AS user_name,

  -- Sequence state
  ms.sequence_stage,
  ms.sequence_complete,
  ms.hesitation_type,
  ms.member_type,
  ms.escalate_to_austin,
  ms.atl_member,
  ms.rite_purchased,

  -- Rite I — Perception (5 scans)
  ms.rite_one_complete,
  ms.rite_one_completed_at,
  COUNT(ps1.id) FILTER (WHERE ps1.completed_at IS NOT NULL) AS rite_one_scans_done,

  -- Rite II — Orientation (3 sessions)
  ms.rite_two_complete,
  ms.rite_two_completed_at,
  COUNT(ps2.id) FILTER (WHERE ps2.completed_at IS NOT NULL) AS rite_two_scans_done,

  -- Rite III — Declaration (3 sessions)
  ms.rite_three_complete,
  ms.rite_three_completed_at,
  COUNT(ps3.id) FILTER (WHERE ps3.completed_at IS NOT NULL) AS rite_three_scans_done,

  -- Most recent completion across all rites
  ms.last_completed_product,
  ms.last_completed_at

FROM public.member_sequences ms
LEFT JOIN public.users u
  ON u.discord_id = ms.discord_id
LEFT JOIN public.product_sessions ps1
  ON ps1.user_id = u.id
  AND ps1.product_slug IN (
    'perception-rite-scan-1','perception-rite-scan-2','perception-rite-scan-3',
    'perception-rite-scan-4','perception-rite-scan-5'
  )
LEFT JOIN public.product_sessions ps2
  ON ps2.user_id = u.id
  AND ps2.product_slug IN (
    'personal-alignment','business-alignment','brand-alignment'
  )
LEFT JOIN public.product_sessions ps3
  ON ps3.user_id = u.id
  AND ps3.product_slug IN (
    'declaration-rite-life-vision','declaration-rite-business-model',
    'declaration-rite-strategic-path'
  )
GROUP BY
  ms.discord_id, ms.username, ms.name_detected, ms.joined_at,
  ms.sequence_stage, ms.sequence_complete, ms.hesitation_type, ms.member_type,
  ms.escalate_to_austin, ms.atl_member, ms.rite_purchased,
  ms.rite_one_complete, ms.rite_one_completed_at,
  ms.rite_two_complete, ms.rite_two_completed_at,
  ms.rite_three_complete, ms.rite_three_completed_at,
  ms.last_completed_product, ms.last_completed_at,
  u.id, u.email, u.name;

-- RLS: view is accessible to service_role only (same as underlying tables)
COMMENT ON VIEW public.member_rite_progress IS
  'Unified Discord ↔ QS view: sequence state + per-rite completion counts. Used by bot and admin dashboard.';
