-- =====================================================
-- Knowledge Query Log
-- Append-only log of every RAG query against the corpus.
-- Captures what was asked, what was retrieved, and quality signals.
-- =====================================================

CREATE TABLE IF NOT EXISTS knowledge_query_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  query             text        NOT NULL,
  tradition_filter  text,                        -- null = all traditions
  threshold         numeric(4,3),
  match_count       int,
  chunks_returned   int,                         -- how many chunks actually came back
  model             text,
  answer            text,                        -- full synthesized response
  top_sources       jsonb,                       -- [{tradition, text_name, section, similarity}]
  latency_ms        int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_query_log_created_idx
  ON knowledge_query_log(created_at DESC);

CREATE INDEX IF NOT EXISTS knowledge_query_log_tradition_idx
  ON knowledge_query_log(tradition_filter);

-- Admin-only: no user-facing RLS needed (queries come from admin panel)
ALTER TABLE knowledge_query_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON knowledge_query_log
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE knowledge_query_log IS
  'Append-only log of every RAG corpus query. Tracks query text, retrieval params, sources hit, and synthesized answer.';
