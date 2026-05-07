-- Corpus Ingestion Queue
-- Editorial gate for new knowledge sources before they enter the RAG corpus

CREATE TABLE IF NOT EXISTS public.corpus_ingestion_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type      TEXT NOT NULL CHECK (source_type IN ('url', 'pdf', 'text', 'youtube')),
  source_url       TEXT,
  source_name      TEXT,
  raw_text         TEXT,
  tradition_tags   TEXT[] DEFAULT '{}',
  pillar_id        UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL,

  -- Evaluation outputs
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'evaluating', 'approved', 'rejected', 'ingested')
  ),
  evaluator_output JSONB,
  quality_score    NUMERIC(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
  rejection_reason TEXT,

  -- Review tracking
  approved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ingestion results
  ingested_chunk_ids UUID[] DEFAULT '{}',

  -- Timestamps
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  ingested_at      TIMESTAMPTZ
);

-- Fast lookups by status for the admin queue view
CREATE INDEX IF NOT EXISTS idx_corpus_ingestion_queue_status
  ON public.corpus_ingestion_queue (status, submitted_at DESC);

-- RLS: admin-only access
ALTER TABLE public.corpus_ingestion_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_corpus_ingestion_queue"
  ON public.corpus_ingestion_queue
  FOR ALL
  USING (auth.role() = 'service_role');
