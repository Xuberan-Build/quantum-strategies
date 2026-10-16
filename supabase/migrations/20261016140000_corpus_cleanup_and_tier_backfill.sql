-- Corpus clean-up and tier backfill (data migration).
--
-- Approved by the founder on 2026-10-16, after `npm run backup` and
-- `npm run backup:content` (full JSONL export of knowledge_chunks, embeddings
-- included). Runs as one transaction: every step checks its row count against
-- the read-only measurement taken the same day and RAISES on any mismatch, which
-- rolls back the whole migration, so nothing changes unless everything matches.
--
-- Steps:
--   A  in-house synthesis docs out of "science"      -> tradition qs_doctrine, tier internal  (29)
--   B  internal business doc removed from the corpus  -> DELETE                               (27; its corpus links cascade)
--   C  1908 New Thought text mislabelled as Hermetica -> tradition new_thought, tier enemy    (129)
--   D  exact duplicate chunks from a double ingestion -> DELETE, keeping linked/oldest copy  (649)
--   E  contested consciousness theories               -> tier contested                       (91)
--   F  backfill: science papers -> evidence (273), canon + commentary -> lineage (7,905)
-- Expected end state: 8,427 rows, none unclassified.

DO $$
DECLARE
  n integer;
BEGIN
  -- A ------------------------------------------------------------------
  UPDATE public.knowledge_chunks
  SET tradition = 'qs_doctrine',
      tier      = 'internal',
      metadata  = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'tier', 'internal',
                    'reclassified_from', jsonb_build_object('tradition', 'science'),
                    'reclassified_on', '2026-10-16',
                    'reclass_reason', 'In-house synthesis: retrievable as context, never cited as evidence')
  WHERE tradition = 'science' AND content_type = 'synthesis';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 29 THEN RAISE EXCEPTION 'Op A expected 29 rows, got %', n; END IF;

  UPDATE public.knowledge_sources SET tradition = 'qs_doctrine'
  WHERE tradition = 'science' AND text_name LIKE 'qs\_%';

  -- B ------------------------------------------------------------------
  DELETE FROM public.knowledge_chunks WHERE text_name = 'cult_os_blueprint';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 27 THEN RAISE EXCEPTION 'Op B expected 27 rows, got %', n; END IF;

  UPDATE public.knowledge_sources
  SET status = 'skipped', chunk_count = 0,
      notes = 'Removed 2026-10-16: internal business document, kept only in the private brain'
  WHERE text_name = 'cult_os_blueprint';

  -- C ------------------------------------------------------------------
  UPDATE public.knowledge_chunks
  SET tradition = 'new_thought',
      tier      = 'enemy',
      metadata  = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'tier', 'enemy',
                    'reclassified_from', jsonb_build_object('tradition', 'hermeticism'),
                    'reclassified_on', '2026-10-16',
                    'attribution_note', 'New Thought text (Chicago, 1908), commonly attributed to William Walker Atkinson; not ancient Hermetica',
                    'retrieval_rule', 'searchable explicitly; never retrieved as support')
  WHERE text_name = 'kybalion';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 129 THEN RAISE EXCEPTION 'Op C expected 129 rows, got %', n; END IF;

  UPDATE public.knowledge_sources SET tradition = 'new_thought' WHERE text_name = 'kybalion';

  -- D ------------------------------------------------------------------
  -- Per (text_name, content) group keep a linked copy if any, else the oldest.
  WITH linked AS (SELECT DISTINCT chunk_id FROM public.content_corpus_links),
  ranked AS (
    SELECT kc.id,
           row_number() OVER (
             PARTITION BY kc.text_name, md5(kc.content)
             ORDER BY (l.chunk_id IS NOT NULL) DESC, kc.created_at, kc.id) AS rn
    FROM public.knowledge_chunks kc
    LEFT JOIN linked l ON l.chunk_id = kc.id
    WHERE kc.text_name IN ('zhuangzi_outer', 'fusus_al_hikam', 'corpus_hermeticum'))
  DELETE FROM public.knowledge_chunks k
  USING ranked r
  WHERE k.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 649 THEN RAISE EXCEPTION 'Op D expected 649 rows, got %', n; END IF;

  UPDATE public.knowledge_sources SET chunk_count = 262 WHERE text_name = 'fusus_al_hikam';
  UPDATE public.knowledge_sources SET chunk_count = 267 WHERE text_name = 'corpus_hermeticum';

  -- E ------------------------------------------------------------------
  UPDATE public.knowledge_chunks
  SET tier     = 'contested',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                   'tier', 'contested',
                   'evidence_grade', 'E3',
                   'contested_note', CASE text_name
                     WHEN 'iit' THEN 'Integrated Information Theory: contested consciousness theory. Mention as an open question; never as support for a technique.'
                     ELSE 'Orch OR: fringe quantum-consciousness hypothesis. Never support for a technique; quantum is metaphor only.' END,
                   'labelled_on', '2026-10-16')
  WHERE text_name IN ('iit', 'orch_or');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 91 THEN RAISE EXCEPTION 'Op E expected 91 rows, got %', n; END IF;

  -- F ------------------------------------------------------------------
  UPDATE public.knowledge_chunks SET tier = 'evidence'
  WHERE tier = 'unclassified' AND content_type = 'science_paper';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 273 THEN RAISE EXCEPTION 'Step F (evidence) expected 273 rows, got %', n; END IF;

  UPDATE public.knowledge_chunks SET tier = 'lineage'
  WHERE tier = 'unclassified' AND content_type IN ('primary_canon', 'secondary_commentary');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 7905 THEN RAISE EXCEPTION 'Step F (lineage) expected 7905 rows, got %', n; END IF;

  -- Notes on specific evidence sources (no count guard: annotations only).
  UPDATE public.knowledge_chunks
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'evidence_note', 'Real arousal neuroscience. Does NOT support the pop claim that the RAS filters what you focus on.')
  WHERE text_name = 'ras_consciousness';
  UPDATE public.knowledge_chunks
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('evidence_grade', 'E2')
  WHERE text_name = 'rebus_model';

  -- End state ----------------------------------------------------------
  SELECT count(*) INTO n FROM public.knowledge_chunks;
  IF n <> 8427 THEN RAISE EXCEPTION 'Expected 8427 chunks after clean-up, got %', n; END IF;
  SELECT count(*) INTO n FROM public.knowledge_chunks WHERE tier = 'unclassified';
  IF n <> 0 THEN RAISE EXCEPTION 'Expected 0 unclassified chunks, got %', n; END IF;
END $$;
