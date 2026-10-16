# Lens: authority (weekly)

Keep the brain's authority playbook current: what the knowledge corpus can and can't back, which
claims in recent brain content lack a source, and where drafts break the citation standard.

This file is structure only. All strategy (the citation standard, evidence tiers, the source list
and the formats) lives in the private brain. Read it there; don't restate it here.

## Inputs
- **Data file** (under **Run context**): JSON from `scripts/brain/lenses/20-authority.data.ts`.
  Aggregates only. Keys: `corpus` (totals, `by_tradition`, `by_content_type`, `tradition_x_type_priority`,
  `texts_top60`, `source_url`, `metadata_gaps`, `chunk_chars`, `near_duplicates_by_text`, `themes_top40`,
  `cross_tradition_tags_top30`, `ingested_by_month`), `sources`, `query_log`, `user_queries`,
  `content_corpus_links`, `ingestion_queue`, `retrieval_probes` (per probe: `label`, `top1_similarity`,
  `hits_over_0_45`, `hits_over_0_55`, `top_hits`) and `table_counts`. Any section may be `{ "error": … }`
  or `{ "skipped": … }`. Report that as a data gap; never guess the numbers.
- **Research notes:** any research paths listed under **Run context**, plus brain notes dated after the
  newest entry in the playbook's `## Lens log`: `briefings/*.md`, `## Sweep <date>` sections in
  `research/creators/*.md`, new files in `research/transcripts/` and `research/conversation/`, and
  `journey/log/*.md`. If the log is empty, use the last 14 days.
- **Content drafts:** everything under `content/`.

## Read first
`README.md`, `strategy/authority-playbook.md` (all of it: its citation standard, tiers, ingestion
list and guardrails are the rules you apply), `strategy/authority-probes.json`, `strategy/the-mechanism.md`,
`content/taxonomy.md`.

## Steps
1. **Refresh the corpus audit.** In the playbook's corpus-audit section, update the numbers that changed
   (chunks, texts, traditions and types, usage counts, duplicates, metadata gaps) and the retrieval-test
   table from `retrieval_probes`. Keep the table's columns. State the date and that the source is the
   data file. If a probe's top-1 similarity moved by ≥0.05, or a probe crossed the 0.45 or 0.55 lines,
   say so in one line. Don't rewrite the verdict unless the probe numbers justify it, and if they do,
   explain why.
2. **Track the ingestion list.** For each item on the playbook's prioritised ingestion list, look for evidence
   it has landed (new text names or traditions in `texts_top60` / `texts_all_names` / `sources`). Mark
   landed items `✓ (date)`. Never mark an item done without that evidence.
3. **New coverage gaps from fresh research.** Read the new research notes. List each mechanism, technique,
   study, author or lineage they name that (a) a brain strategy note leans on, or the sphere is using as
   a credibility move, and (b) isn't covered by the corpus or the ingestion list. Add each to the ingestion
   list with its copyright status (public domain / open-access licence / in copyright, so summary and short
   quotes only, or "verify"). If you don't know the status, write "verify" and don't guess.
4. **Unsourced claims in recent brain content.** In recent notes and in `content/`, find factual claims
   (numbers, "studies show", neuroscience or physics statements, historical attributions, named-author
   claims) that carry no source and no evidence tier as the playbook defines them. Quote each one briefly
   (under 25 words), with its file path.
5. **Citation-standard violations in drafts.** Check every file in `content/` against the playbook's
   citation standard and guardrails: unlabelled metaphor terms, tier inflation, contested findings cited
   as support, self-citation, missing lineage credit, tradition-only citations, and copyright limits
   on quotes. For each, give the file, a short quote, the rule it breaks and a suggested fix. Don't edit
   the drafts; report only.
6. **Write the log entry.** Add a dated entry at the top of `## Lens log` in
   `strategy/authority-playbook.md` with these subsections: *Corpus deltas*, *Probe deltas*, *Ingestion
   progress*, *New gaps*, *Unsourced claims*, *Violations*, *Recommended next moves* (at most 3,
   ranked). Keep it under about 60 lines. If an issue from the previous entry is still open, carry it
   forward as "still open since <date>" instead of repeating it in full.
7. If you change other sections of the playbook (the audit numbers, ingestion list status, new gaps),
   edit them in place. Don't append duplicates. Leave every other section alone unless the evidence
   clearly contradicts it. If it does, add a clearly marked `> Lens note (<date>):` rather than rewriting
   human text.

## Limits
- Files you may write: `strategy/authority-playbook.md`, and `strategy/authority-probes.json` (only to
  add a probe for a new gap from step 3; never remove or reword existing probes). Nothing else.
- Aggregates only: no chunk text, row IDs or user data. Short quotes only (under 25 words).
- Mark inference "(inferred)". Show sample sizes. Leave the probe list alone when nothing new appeared.
- If nothing changed (same numbers, no new research, no new drafts), reply `NO_CHANGES` with the reason.
