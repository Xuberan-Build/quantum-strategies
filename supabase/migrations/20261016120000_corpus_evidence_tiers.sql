-- =====================================================================
-- Corpus evidence tiers
--
-- Purpose: let every knowledge chunk carry an epistemic tier, so that
-- retrieval can ask for "evidence only" or "evidence + lineage" and never
-- confuse a practitioner model, a market signal or an internal note with
-- evidence.
--
-- ADDITIVE ONLY:
--   * adds one column (with a default) plus two indexes
--   * widens (never narrows) any CHECK constraint on tradition/content_type
--   * replaces match_knowledge with a superset signature: every existing
--     named-argument call keeps working and returns the same rows
-- No rows are updated or deleted. Backfilling tiers on existing rows is a
-- separate, reviewed data step, not part of this migration.
--
-- Reviewed and approved by the founder 2026-10-16.
-- Depends on: 20261016110000_lock_knowledge_corpus.sql (must be applied first).
-- Apply only after a backup and an explicit go-ahead (see CLAUDE.md).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. The tier column
-- ---------------------------------------------------------------------
-- Values:
--   evidence       empirical research: meta-analyses, replications, studies
--   model          practitioner frameworks (e.g. self-concept models, NLP);
--                  useful, but never presented as a lab finding
--   contested      claims with failed/mixed replications or fringe theories;
--                  retrieved only to tell the story of how an idea went wrong
--   lineage        historical and contemplative sources: resonance, not proof
--   market_signal  creator and audience research: proves demand, never mechanism
--   internal       notes and in-house synthesis docs: retrievable as context,
--                  never cited as evidence
--   enemy          sources of the ideas the brand argues against; searchable
--                  explicitly, never retrieved as support
--   unclassified   default for rows nobody has graded yet
--
-- ADD COLUMN with a constant default is a metadata-only change in
-- Postgres 11+, so existing rows read as 'unclassified' with no table
-- rewrite and no long lock.
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'unclassified';

-- Constrain the new column only. Every existing row holds the default,
-- so validation can't fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.knowledge_chunks'::regclass
      AND conname  = 'knowledge_chunks_tier_check'
  ) THEN
    ALTER TABLE public.knowledge_chunks
      ADD CONSTRAINT knowledge_chunks_tier_check CHECK (tier IN (
        'evidence', 'model', 'contested', 'lineage',
        'market_signal', 'internal', 'enemy', 'unclassified'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.knowledge_chunks.tier IS
  'Epistemic tier: evidence | model | contested | lineage | market_signal | internal | enemy | unclassified. Only evidence (and, labelled, model) may back a claim.';


-- ---------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------
-- Plain btree on tier for filtered scans and admin counts.
CREATE INDEX IF NOT EXISTS knowledge_chunks_tier_idx
  ON public.knowledge_chunks (tier);

-- Expression index on metadata->>'source_path'. The staged-corpus ingester
-- uses source_path as the upsert key (one source file or source card ->
-- many chunks), so re-syncing a changed note can find and replace its old
-- chunks without a full-table scan. Partial: most legacy rows have no
-- source_path.
CREATE INDEX IF NOT EXISTS knowledge_chunks_source_path_idx
  ON public.knowledge_chunks ((metadata->>'source_path'))
  WHERE metadata ? 'source_path';


-- ---------------------------------------------------------------------
-- 3. Widen CHECK constraints on tradition and content_type, if any exist
-- ---------------------------------------------------------------------
-- The repo's migrations define no CHECK on these columns (they are
-- free-text, documented only in comments), so on a database built from
-- the migrations this block is a no-op. If a constraint was added out of
-- band, it is replaced by a wider one: the union of
--   (a) every value already present in the table, and
--   (b) the values the tiered corpus needs.
-- Because (a) is included, the new constraint always validates.
--
-- New tradition values:    psychology, creator_research, new_thought
-- New content_type values: summary_by_qs (QS-written summary of an
--   in-copyright source), public_domain_text (verbatim PD excerpt),
--   market_signal (creator/audience research), brain_note (internal note)
DO $$
DECLARE
  c          RECORD;
  vals       TEXT[];
  needed_tr  TEXT[] := ARRAY[
    'taoism','kabbalah','tantra','sufism','christian_mysticism','hermeticism',
    'rosicrucianism','science','hinduism','buddhism','qs_doctrine',
    'psychology','creator_research','new_thought'];
  needed_ct  TEXT[] := ARRAY[
    'primary_canon','commentary','scholarly','synthesis','science',
    'secondary_commentary','science_paper',
    'summary_by_qs','public_domain_text','market_signal','brain_note'];
  col        TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['tradition', 'content_type'] LOOP
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      WHERE con.conrelid = 'public.knowledge_chunks'::regclass
        AND con.contype  = 'c'
        AND con.conname <> 'knowledge_chunks_tier_check'
        AND pg_get_constraintdef(con.oid) ~ ('\m' || col || '\M')
    LOOP
      EXECUTE format('SELECT array_agg(DISTINCT v) FROM (SELECT %I AS v FROM public.knowledge_chunks WHERE %I IS NOT NULL UNION SELECT unnest($1)) s',
                     col, col)
        INTO vals
        USING CASE WHEN col = 'tradition' THEN needed_tr ELSE needed_ct END;
      EXECUTE format('ALTER TABLE public.knowledge_chunks DROP CONSTRAINT %I', c.conname);
      EXECUTE format('ALTER TABLE public.knowledge_chunks ADD CONSTRAINT %I CHECK (%I IS NULL OR %I = ANY (%L::text[]))',
                     'knowledge_chunks_' || col || '_check', col, col, vals);
      RAISE NOTICE 'Widened CHECK on knowledge_chunks.% (was %)', col, c.conname;
    END LOOP;
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 4. match_knowledge with an optional tier filter
-- ---------------------------------------------------------------------
-- Why DROP + CREATE rather than CREATE OR REPLACE: the argument list and
-- the RETURNS TABLE both change. CREATE OR REPLACE can't change a return
-- type, and creating a second overload would make PostgREST calls that
-- pass only the old named arguments ambiguous ("could not choose the best
-- candidate function"). Dropping the old signature and recreating it as a
-- strict superset inside this migration's transaction avoids both.
--
-- Backward compatibility:
--   * all six original parameters keep their names, types, order and
--     defaults, so every existing caller (admin knowledge query, studio
--     research, deep research, corpus vector search, the authority lens)
--     works unchanged (they all use the service role, which keeps EXECUTE);
--   * filter_tiers defaults to NULL = no tier filtering = today's results;
--   * the result gains one trailing column (tier). Callers that read
--     columns by name are unaffected.
--
-- filter_tiers is an array so callers can ask for evidence only
-- (ARRAY['evidence']) or several tiers (ARRAY['evidence','model','lineage']).
--
-- Note on recall: the HNSW index is searched first and the WHERE filter is
-- applied to its candidates. With a narrow tier filter, a query may return
-- fewer than match_count rows. If that bites, raise hnsw.ef_search for the
-- session, or enable pgvector's iterative scan (0.8+), in the caller.
-- Drop every existing overload by name (not by one hard-coded signature), so a
-- signature that drifted in production can't survive as a second, ambiguous
-- overload next to the new function.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'match_knowledge'
  LOOP
    EXECUTE format('DROP FUNCTION %s', fn);
  END LOOP;
END $$;

CREATE FUNCTION public.match_knowledge(
  query_embedding  vector(1536),
  match_threshold  FLOAT   DEFAULT 0.65,
  match_count      INT     DEFAULT 8,
  filter_tradition TEXT    DEFAULT NULL,
  filter_priority  INTEGER DEFAULT NULL,
  filter_themes    TEXT[]  DEFAULT NULL,
  filter_tiers     TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  tradition            TEXT,
  text_name            TEXT,
  author               TEXT,
  chapter              TEXT,
  verse                TEXT,
  lines                TEXT,
  technique_number     INTEGER,
  section              TEXT,
  content              TEXT,
  themes               TEXT[],
  cross_tradition_tags TEXT[],
  source_url           TEXT,
  priority             INTEGER,
  content_type         TEXT,
  metadata             JSONB,
  similarity           FLOAT,
  tier                 TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.tradition,
    kc.text_name,
    kc.author,
    kc.chapter,
    kc.verse,
    kc.lines,
    kc.technique_number,
    kc.section,
    kc.content,
    kc.themes,
    kc.cross_tradition_tags,
    kc.source_url,
    kc.priority,
    kc.content_type,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.tier
  FROM public.knowledge_chunks kc
  WHERE
    -- Tradition filter (NULL = search all), unchanged
    (filter_tradition IS NULL OR kc.tradition = filter_tradition)
    -- Priority filter (NULL = all priorities), unchanged
    AND (filter_priority IS NULL OR kc.priority <= filter_priority)
    -- Theme filter, unchanged: chunk must contain ALL requested themes
    AND (filter_themes IS NULL OR kc.themes @> filter_themes OR kc.cross_tradition_tags @> filter_themes)
    -- NEW tier filter (NULL = all tiers, i.e. the old behaviour)
    AND (filter_tiers IS NULL OR kc.tier = ANY (filter_tiers))
    -- Similarity threshold, unchanged
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_knowledge(vector, double precision, integer, text, integer, text[], text[]) IS
  'Vector search over knowledge_chunks. filter_tiers (optional) restricts to tiers, e.g. {evidence} or {evidence,model,lineage}. NULL = all tiers.';

-- Privileges. This draft assumes 20261016110000_lock_knowledge_corpus.sql is
-- applied first: the corpus is admin/service-role only, and match_knowledge is
-- not executable by anon or authenticated. A dropped-and-recreated function
-- loses its old grants, and Supabase's default privileges would hand EXECUTE to
-- anon and authenticated again on CREATE. So: revoke those explicitly and grant
-- only service_role, matching the lock. (SECURITY INVOKER, the default, still
-- applies, and knowledge_chunks RLS still decides which rows a caller sees.)
REVOKE EXECUTE ON FUNCTION public.match_knowledge(vector, double precision, integer, text, integer, text[], text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, double precision, integer, text, integer, text[], text[])
  TO service_role;

-- Ask PostgREST to reload its schema cache so the new signature is
-- callable immediately.
NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------
-- Not done here (needs a decision, not a migration):
--   * Backfilling tiers for the existing ~9,100 rows (see the corpus
--     clean-up plan): canon -> lineage, science papers -> evidence or
--     contested, in-house synthesis -> internal, Kybalion -> enemy.
-- ---------------------------------------------------------------------
