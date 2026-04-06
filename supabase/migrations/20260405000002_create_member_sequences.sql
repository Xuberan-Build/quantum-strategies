-- Discord onboarding sequence state table
-- Tracks every member's position in the 10-day DM sequence
-- Standalone table — discord_id is the primary key, not a FK to users
-- Link to QS users table is via users.discord_id (set when member verifies email)

CREATE TABLE IF NOT EXISTS public.member_sequences (
  discord_id TEXT PRIMARY KEY,
  username TEXT,
  name_detected TEXT,
  joined_at TIMESTAMPTZ,

  -- Gate
  agreements_acknowledged BOOLEAN DEFAULT FALSE,
  agreements_timestamp TIMESTAMPTZ,
  role TEXT DEFAULT 'Guest',

  -- Stage 1
  introduced BOOLEAN DEFAULT FALSE,
  intro_content TEXT,
  intro_timestamp TIMESTAMPTZ,
  keywords_detected TEXT[],

  -- Stage 2
  doctrine_engaged BOOLEAN DEFAULT FALSE,
  doctrine_response TEXT,
  doctrine_timestamp TIMESTAMPTZ,

  -- Stage 3
  rite_link_clicked BOOLEAN DEFAULT FALSE,
  rite_purchased BOOLEAN DEFAULT FALSE,
  rite_purchased_product TEXT,
  rite_purchase_timestamp TIMESTAMPTZ,
  rite_results_posted BOOLEAN DEFAULT FALSE,

  -- Stage 4
  day10_replied BOOLEAN DEFAULT FALSE,
  day10_response TEXT,
  day10_timestamp TIMESTAMPTZ,

  -- Psychological profile
  hesitation_type TEXT CHECK (hesitation_type IN ('confusion', 'overwhelm', 'avoidance', 'skepticism', 'high_agency')),
  member_type TEXT CHECK (member_type IN ('operator', 'creator', 'seeker')),
  escalate_to_austin BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,

  -- Sequence state
  sequence_stage INTEGER DEFAULT 0,
  sequence_complete BOOLEAN DEFAULT FALSE,
  last_message_sent TIMESTAMPTZ,
  engaged BOOLEAN DEFAULT FALSE,

  -- ATL flag
  atl_member BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_member_sequences_stage
  ON public.member_sequences (sequence_stage)
  WHERE sequence_complete = FALSE;

CREATE INDEX IF NOT EXISTS idx_member_sequences_escalate
  ON public.member_sequences (escalate_to_austin)
  WHERE escalate_to_austin = TRUE;

CREATE INDEX IF NOT EXISTS idx_member_sequences_atl
  ON public.member_sequences (atl_member)
  WHERE atl_member = TRUE;

CREATE INDEX IF NOT EXISTS idx_member_sequences_last_message
  ON public.member_sequences (last_message_sent);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_member_sequences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_update_member_sequences_updated_at
  BEFORE UPDATE ON public.member_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_member_sequences_updated_at();

-- RLS: service role only (bot uses service role key)
ALTER TABLE public.member_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to member_sequences"
  ON public.member_sequences
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.member_sequences IS 'Discord member onboarding sequence state — one row per Discord user';
