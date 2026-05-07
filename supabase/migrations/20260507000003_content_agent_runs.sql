-- Tracks every AI agent invocation in the Studio pipeline.
-- Stores input/output per agent type, human approval state, and timing.

CREATE TABLE IF NOT EXISTS content_agent_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_angle_id  UUID        NOT NULL REFERENCES content_angles(id) ON DELETE CASCADE,
  agent_type        TEXT        NOT NULL CHECK (agent_type IN (
                                  'brief', 'corpus_researcher', 'gap_analyst',
                                  'source_evaluator', 'outline', 'section_writer',
                                  'voice_calibration', 'format_adapter'
                                )),
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN (
                                  'pending', 'running', 'completed', 'failed', 'rejected'
                                )),
  input             JSONB,
  output            JSONB,
  feedback          TEXT,
  human_approved    BOOLEAN,
  approved_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  run_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_angle_type
  ON content_agent_runs(content_angle_id, agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_runs_active_status
  ON content_agent_runs(status)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_agent_runs_angle_recent
  ON content_agent_runs(content_angle_id, created_at DESC);

ALTER TABLE content_agent_runs ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default — no explicit policy needed for it.
-- Admin users can read all runs.
CREATE POLICY "admin_select_agent_runs"
  ON content_agent_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  );

CREATE POLICY "admin_insert_agent_runs"
  ON content_agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  );

CREATE POLICY "admin_update_agent_runs"
  ON content_agent_runs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  );
