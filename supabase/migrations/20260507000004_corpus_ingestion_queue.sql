-- Queue for ingesting new corpus sources (URL, PDF, raw text, YouTube).
-- Sources pass through evaluation before being ingested into knowledge_chunks.

CREATE TABLE IF NOT EXISTS corpus_ingestion_queue (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type           TEXT          NOT NULL CHECK (source_type IN ('url', 'pdf', 'text', 'youtube')),
  source_url            TEXT,
  source_filename       TEXT,
  raw_text              TEXT,
  tradition_tags        TEXT[]        DEFAULT '{}',
  pillar_id             UUID          REFERENCES content_pillars(id) ON DELETE SET NULL,
  status                TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN (
                                        'pending', 'evaluating', 'approved', 'rejected', 'ingested'
                                      )),
  evaluator_output      JSONB,
  quality_score         NUMERIC(3,2)  CHECK (quality_score BETWEEN 0 AND 1),
  rejection_reason      TEXT,
  approved_by           UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  ingested_chunk_ids    UUID[]        DEFAULT '{}',
  submitted_at          TIMESTAMPTZ   DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ,
  ingested_at           TIMESTAMPTZ,

  -- At least one source must be supplied.
  CONSTRAINT source_required CHECK (
    source_url IS NOT NULL OR source_filename IS NOT NULL OR raw_text IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_status
  ON corpus_ingestion_queue(status);

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_submitted
  ON corpus_ingestion_queue(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_queue_pillar
  ON corpus_ingestion_queue(pillar_id)
  WHERE pillar_id IS NOT NULL;

ALTER TABLE corpus_ingestion_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_ingestion_queue"
  ON corpus_ingestion_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role' = 'admin'
             OR u.raw_user_meta_data->>'role' = 'super_admin')
    )
  );
