-- Content pipeline job queue
-- Workers claim jobs atomically via claim_content_job() RPC

CREATE TABLE IF NOT EXISTS public.content_jobs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  angle_id     UUID        REFERENCES public.content_angles(id) ON DELETE CASCADE,
  job_type     TEXT        NOT NULL CHECK (job_type IN ('research','outline','draft','distribute','full_pipeline')),
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','done','error','skipped')),
  priority     INT         DEFAULT 5,
  worker_id    TEXT,
  params       JSONB       DEFAULT '{}',
  result       JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS content_jobs_queue_idx  ON public.content_jobs (status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS content_jobs_angle_idx  ON public.content_jobs (angle_id);

-- Atomic job claim using SKIP LOCKED to prevent double-processing
CREATE OR REPLACE FUNCTION public.claim_content_job(p_worker_id TEXT)
RETURNS SETOF public.content_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.content_jobs
  SET
    status     = 'running',
    worker_id  = p_worker_id,
    started_at = NOW()
  WHERE id = (
    SELECT id FROM public.content_jobs
    WHERE status = 'pending'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- RLS
ALTER TABLE public.content_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to content_jobs"
  ON public.content_jobs TO service_role
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
