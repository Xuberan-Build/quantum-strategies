# Lens: corpus bridge (weekly)

The corpus → brain half of the two-way bridge. For every claim the brain makes and every topic in
the content tree, record which corpus passages support it, how strongly, and where nothing does.
The other half (brain → corpus) is `scripts/brain/sync-brain-to-corpus.ts`, run by the tick's
`bridge` stage. This lens never writes to the corpus.

This file is structure only. The claims, topics, tiers and citation rules live in the private
brain. Read them there; don't restate them here.

## Inputs
- **Data file** (under **Run context**): JSON from `scripts/brain/lenses/40-corpus-bridge.data.ts`.
  Keys:
  - `inputs`: which claims file and taxonomy were parsed, and the counts.
  - `tier_filter`: whether retrieval was restricted to the evidence tiers or ran unfiltered. Read the `note`.
  - `thresholds`: `gap` and `strong` similarity lines.
  - `corpus_by_tier`: chunk counts per tier, or `{ tier_column: false, total }`.
  - `coverage`: `overall`, `claims`, `topics`, `by_pillar[]` (covered / total / pct / median_best) and `unassigned_pillar`.
  - `gaps[]`: items with no supporting passage above the gap line. Claims come first.
  - `items[]`: per claim/topic, `best_similarity`, `strength` (strong / moderate / weak / none),
    `self_hits` (QS's own material, which never counts as support) and up to 3 `passages`
    (`similarity`, `citation`, `tradition`, `content_type`, optional `tier` and `source_url`, `excerpt`).
  - optional `notes`, `rpc_errors`.
  Any item with `error` failed retrieval. Report it as a data gap and never call it a gap in the corpus.
- **Previous run:** `research/corpus-links.md` if it exists (its `## Bridge log` holds the last entry).

## Read first
`README.md`, `decisions/` (canon), `strategy/authority-playbook.md` (its evidence tiers, citation
standard, ingestion list and guardrails are the rules you apply), the claims file named in
`inputs.claims`, `content/taxonomy.md`.

## Steps
1. **Write `research/corpus-links.md`** (create it if missing, keeping these sections in this order):
   - Header: status line with today's date, the data-file source, the tier-filter mode in one line,
     and a sentence that this file is maintained by the corpus-bridge lens.
   - `## Summary`: machine-readable for the snapshot, so keep exactly these parts:
     - a line `Coverage: <covered>/<total> (<pct>%) · claims <pct>% · topics <pct>%`
     - a table `| Pillar | Covered | Total | % | Median best |` with one row per pillar, using the pillar
       **slug** from the data file
     - a table `| Tier | Chunks |` from `corpus_by_tier` (one row `total` when there's no tier column)
     - a list `Top gaps:` with up to 10 bullets `- <label> (<kind>, <pillar slug or "none">, best <sim>)`
   - `## Claims`: one entry per claim: the claim (short), its strength, then up to 3 supporting passages as
     `- <similarity> · <citation> · tier <tier or the playbook tier you infer, marked "(inferred)">`, with at
     most one short quote (under 25 words) taken from the excerpt. Say plainly when the best passage is
     lineage/echo rather than evidence, or a lexical false friend (the passage shares words, not meaning).
     Apply the playbook's tiers: lineage passages are resonance, never proof.
   - `## Topics`: grouped by pillar, as a compact table `| Topic | Strength | Best | Best source |`.
   - `## Gaps`: every item from `gaps[]`, grouped by pillar, each with the nearest passage and why it falls
     short. Mark items that only QS's own material reaches as "self-citation only".
   - `## Bridge log`: a dated entry at the top (newest first), under about 25 lines: coverage deltas vs the
     previous entry (per pillar, ±pct), claims that crossed the gap or strong lines, new and closed gaps,
     data gaps (errors, unfiltered mode), and at most 3 ranked next moves.
2. **Feed the authority playbook's ingestion list.** For each gap that is a claim, or a topic the brain
   leans on, check whether `strategy/authority-playbook.md`'s prioritised ingestion list already covers it
   (same source, author or mechanism). If it doesn't, add one row in the list's existing format: name a
   candidate source only if the brain or the playbook already points to one, otherwise write
   "source needed". Put the copyright status as "verify" unless you know it. Tag the row
   `(corpus-bridge <date>)`. Never mark an item landed; the authority lens owns that.
3. **Index discipline.** If you created `research/corpus-links.md`, add it to the `research/` entry of
   the brain `README.md`.

## Limits
- Files you may write: `research/corpus-links.md`, `strategy/authority-playbook.md` (the ingestion list
  only) and `README.md` (one index line). Nothing else.
- Quotes from passages under 25 words, at most one per passage. No chunk ids, no full excerpts.
- When `tier_filter.mode` is `unfiltered`, say so in the Summary and the log: coverage then includes
  contemplative canon that may be lineage only, so treat "covered" as an upper bound.
- Don't edit claims or the taxonomy to make coverage look better. If a claim is mis-phrased for
  retrieval, you may add a better query to `research/corpus-bridge-queries.json`
  (`[{"kind":"claim","label":"…","query":"…","pillar":"<slug>"}]`) and say so in the log.
  (That file is also a write you're allowed.)
- If the numbers, gaps and passages are the same as the last entry, reply `NO_CHANGES` with the reason.
