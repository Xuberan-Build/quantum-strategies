-- Progress emails: per-user email preferences, a send log that doubles as the
-- idempotency claim, and an optional phone number so Austin can call people who
-- fall behind.
--
-- Additive only: one nullable column and two new tables. No data is changed.

-- ─── 1. users.phone ──────────────────────────────────────────────────────────
-- Optional. Set by the user in dashboard settings or by an admin.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.users.phone IS
  'Optional phone number for personal follow-up calls. Free text as entered.';

-- ─── 2. email_preferences ────────────────────────────────────────────────────
-- No row means every topic is on (all users get emails, with one-click opt-out).
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  progress boolean NOT NULL DEFAULT true,
  newsletter boolean NOT NULL DEFAULT true,
  updated_via text NOT NULL DEFAULT 'dashboard'
    CHECK (updated_via IN ('dashboard', 'one_click', 'admin')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_preferences IS
  'Which optional emails a user receives. Missing row = all on. Transactional email is not affected.';

-- Writes go through the server (dashboard API and one-click opt-out), never the client.
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_preferences_select_own" ON public.email_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.email_preferences FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.email_preferences FROM authenticated;

-- ─── 3. email_sends ──────────────────────────────────────────────────────────
-- One row per (user, dedupe_key). Inserting the row IS the claim: the unique
-- constraint lets exactly one concurrent run send a given email. A failed send
-- deletes its claim so the next run retries.
-- dedupe_key examples: 'reentry', 'weekly:2026-W45', 'nudge4:2026-10-20',
-- 'complete:perception', 'alert:2026-10-20' (founder alert about this user).
CREATE TABLE IF NOT EXISTS public.email_sends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'claimed'
    CHECK (status IN ('claimed', 'sent')),
  mode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT email_sends_user_key_unique UNIQUE (user_id, dedupe_key)
);

COMMENT ON TABLE public.email_sends IS
  'Log and idempotency claim for progress emails and founder alerts. Service role only.';

CREATE INDEX IF NOT EXISTS idx_email_sends_user_created
  ON public.email_sends (user_id, created_at DESC);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_sends FROM anon, authenticated, PUBLIC;
