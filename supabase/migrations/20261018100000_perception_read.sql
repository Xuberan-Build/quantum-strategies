-- Migration: 20261018100000_perception_read
--
-- The Perception Read: the free front-door quiz, on the same engine as the Three Rites
-- (product_definitions + product_sessions). Contract: src/lib/read/CONTRACT.md.
--
-- Additive and idempotent. Touches no existing rows except to fill new columns with their defaults.
--   1. product_definitions: is_free, requires_auth, requires_chart, experience_kind.
--      Defaults keep every existing Rite exactly as it is (not free, auth required, chart required, 'rite').
--      The new flags are non-sensitive and get column-level SELECT for anon/authenticated
--      (20261017100000_hide_product_prompts.sql made new columns unreadable by default).
--   2. product_sessions: user_id may be NULL (anonymous Read attempts); lead_id, anon_token_hash, utm.
--      A CHECK makes every row either owned (user_id) or token-held (anon_token_hash).
--      Existing policies compare auth.uid() = user_id, which is never true for NULL user_id.
--      A RESTRICTIVE policy additionally hides any user_id-NULL row from anon/authenticated,
--      so a future permissive policy cannot expose anonymous attempts. Service role bypasses RLS.
--   3. read_leads and product_events: RLS on, all privileges revoked from anon/authenticated/PUBLIC.
--   4. read_save_answer(): atomic merge of one answer into step_data (no lost writes on fast taps).
--      Service role only.
--
-- The perception-read product row is seeded by scripts/read/seed-perception-read.ts (from READ_QUESTIONS).
--
-- ROLLBACK (manual, only if needed; never drops data without a backup):
--   DROP FUNCTION IF EXISTS public.read_save_answer(uuid, text, jsonb, integer);
--   DROP POLICY IF EXISTS ps_no_anonymous_rows ON public.product_sessions;
--   -- user_id NOT NULL can only be restored after anonymous rows are removed or assigned.

-- ─── 1. product_definitions flags ────────────────────────────────────────────
ALTER TABLE public.product_definitions
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_auth boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_chart boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS experience_kind text NOT NULL DEFAULT 'rite';

COMMENT ON COLUMN public.product_definitions.is_free IS 'Free product (no checkout). The Perception Read.';
COMMENT ON COLUMN public.product_definitions.requires_auth IS 'False when the experience runs anonymously (token-held product_sessions rows).';
COMMENT ON COLUMN public.product_definitions.requires_chart IS 'False skips the chart/placements gate in the Rites experience.';
COMMENT ON COLUMN public.product_definitions.experience_kind IS '''rite'' (ProductExperience) or ''read'' (/read quiz).';

GRANT SELECT (is_free, requires_auth, requires_chart, experience_kind)
  ON public.product_definitions TO anon, authenticated;

-- ─── 2. product_sessions: anonymous attempts ─────────────────────────────────
ALTER TABLE public.product_sessions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.product_sessions
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS anon_token_hash text,
  ADD COLUMN IF NOT EXISTS utm jsonb;

COMMENT ON COLUMN public.product_sessions.lead_id IS 'read_leads row captured at the email gate (Perception Read).';
COMMENT ON COLUMN public.product_sessions.anon_token_hash IS 'sha256 (hex) of the httpOnly qs_read_token cookie that holds an anonymous attempt.';
COMMENT ON COLUMN public.product_sessions.utm IS 'UTM set and landing variant at start.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.product_sessions'::regclass AND conname = 'product_sessions_owner_check'
  ) THEN
    ALTER TABLE public.product_sessions
      ADD CONSTRAINT product_sessions_owner_check
      CHECK (user_id IS NOT NULL OR anon_token_hash IS NOT NULL);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_product_sessions_lead_id
  ON public.product_sessions (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_sessions_anon_slug_created
  ON public.product_sessions (product_slug, created_at DESC) WHERE user_id IS NULL;

ALTER TABLE public.product_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_no_anonymous_rows ON public.product_sessions;
CREATE POLICY ps_no_anonymous_rows
  ON public.product_sessions
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

-- ─── 3a. read_leads ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.read_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  utm jsonb,
  source text,
  session_id uuid REFERENCES public.product_sessions(id) ON DELETE SET NULL,
  pattern text,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT read_leads_email_normalised CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)
);

COMMENT ON TABLE public.read_leads IS
  'Perception Read email-gate leads (one row per normalised email). consent_marketing is the separate unticked box; consent_at is when it was given. Service role only.';

CREATE UNIQUE INDEX IF NOT EXISTS read_leads_email_key ON public.read_leads (email);
CREATE INDEX IF NOT EXISTS idx_read_leads_session_id ON public.read_leads (session_id);
CREATE INDEX IF NOT EXISTS idx_read_leads_user_id ON public.read_leads (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_read_leads_created_at ON public.read_leads (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.product_sessions'::regclass AND conname = 'product_sessions_lead_id_fkey'
  ) THEN
    ALTER TABLE public.product_sessions
      ADD CONSTRAINT product_sessions_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.read_leads(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─── 3b. product_events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid REFERENCES public.product_sessions(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.read_leads(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  product_slug text NOT NULL,
  event text NOT NULL,
  step text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.product_events IS
  'Funnel events (Perception Read spec v3 §11). Never holds answer text. Service role only.';

CREATE INDEX IF NOT EXISTS idx_product_events_slug_event_created
  ON public.product_events (product_slug, event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_session_id
  ON public.product_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_events_lead_id
  ON public.product_events (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_events_user_id
  ON public.product_events (user_id) WHERE user_id IS NOT NULL;

-- ─── 3c. Lock both tables to the service role ────────────────────────────────
ALTER TABLE public.read_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.read_leads FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.product_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.read_leads TO service_role;
GRANT ALL ON public.product_events TO service_role;

-- ─── 4. Atomic answer save ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.read_save_answer(
  p_session_id uuid,
  p_question_id text,
  p_answer jsonb,
  p_step integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.product_sessions
  SET step_data = COALESCE(step_data, '{}'::jsonb) || jsonb_build_object(p_question_id, p_answer),
      current_step = GREATEST(COALESCE(current_step, 1), COALESCE(p_step, 1)),
      last_activity_at = now()
  WHERE id = p_session_id
    AND completed_at IS NULL
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.read_save_answer(uuid, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_save_answer(uuid, text, jsonb, integer) TO service_role;
