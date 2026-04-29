-- Replace IVFFlat with HNSW for knowledge_chunks embeddings.
-- IVFFlat with lists=64 and probes=1 (default) only scans ~1/64th of the corpus,
-- causing near-zero recall on cross-domain queries. HNSW has no probe tuning issue
-- and maintains high accuracy across the full 9K+ vector space.
DROP INDEX IF EXISTS knowledge_chunks_embedding_idx;

CREATE INDEX knowledge_chunks_embedding_idx
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
