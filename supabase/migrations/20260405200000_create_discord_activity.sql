-- Discord activity log — records every significant Discord event for a member
-- Keyed to discord_id so it works even before a QS account is linked
-- Join to users via users.discord_id for full cross-platform view

CREATE TABLE IF NOT EXISTS "public"."discord_activity" (
  "id"           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "discord_id"   text NOT NULL,
  "user_id"      uuid REFERENCES users(id) ON DELETE SET NULL,  -- null until linked
  "event_type"   text NOT NULL,  -- joined, agreed, introduced, doctrine_read, rite_purchased, results_posted, dm_sent, dm_received, escalated, beta_opted_in
  "event_data"   jsonb DEFAULT '{}',  -- flexible payload: stage, message preview, hesitation type, etc.
  "sequence_stage" integer,
  "created_at"   timestamptz DEFAULT now() NOT NULL
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS discord_activity_discord_id_idx ON discord_activity (discord_id);
CREATE INDEX IF NOT EXISTS discord_activity_user_id_idx    ON discord_activity (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS discord_activity_event_type_idx ON discord_activity (event_type);
CREATE INDEX IF NOT EXISTS discord_activity_created_at_idx ON discord_activity (created_at DESC);

-- RLS
ALTER TABLE discord_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_access" ON discord_activity
  TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE discord_activity IS 'Append-only log of Discord events — powers Discord-as-CRM view';
COMMENT ON COLUMN discord_activity.event_type IS 'joined | agreed | introduced | doctrine_read | rite_purchased | results_posted | dm_sent | dm_received | escalated | beta_opted_in | nudged';
COMMENT ON COLUMN discord_activity.event_data IS 'Flexible JSON payload per event type';
