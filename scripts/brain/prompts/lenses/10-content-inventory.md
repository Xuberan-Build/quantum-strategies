# Lens: content inventory (weekly)

Keep the brain's content inventory current: what content assets exist, how mature each one is,
what changed since the last run, what needs cleaning up, and which assets could ship next.

This file is structure only. All strategy (the content tree, the funnel, the offers, the
priorities and which assets matter) lives in the private brain. Read it there; don't restate it here.

## Inputs
- **Data file** (under **Run context**): JSON from `scripts/brain/lenses/10-content-inventory.data.ts`.
  Aggregates and asset titles only, with no row bodies, IDs or user data. Top-level keys:
  - `table_counts`: row count per content table. `null` means the table is missing or unreadable.
  - `corpus`: knowledge chunks: `total`, `missing_embedding`, `distinct_text_names`, `by_tradition`,
    `by_content_type`, `by_priority`, `tradition_x_content_type`, `top_text_names`, `newest_chunk_at`,
    `added_last_7d`, `added_last_30d`.
  - `knowledge_sources`: the source register: `by_status`, `by_tradition`, `by_format`,
    `declared_chunk_count_sum`, `sources_not_in_corpus`, `corpus_text_names_without_source`, `duplicate_text_names`.
  - `content_tree`: `pillars` (topic and angle counts each), `topics` (`list`, `duplicate_titles`,
    `without_angles`), `angles` (`by_status`, `by_format`, `by_tone`, `by_lead_magnet_type`, `by_pillar`,
    `without_topic`, `duplicate_titles`, `with_corpus_links`, `with_sections`, `with_agent_runs`,
    `created_last_7d`, `updated_last_7d`, `titles_with_status`), `sections`, `pieces`, `corpus_links`,
    `agent_runs`, `jobs`.
  - `content_posts`: `by_type`, `type_x_published`, word totals and median, `empty_body`,
    `under_300_words`, `with_topic`, `tag_counts_top`, `duplicate_titles`, `published_last_30d`,
    `updated_last_7d`, `list` (slug, title, type, published, words).
  - `products`: `list` (slug, name, group, price, step counts, `steps_mismatch`, active and purchasable flags,
    prompt word counts, landing-page status, prompt versions, questions), `landing_pages`, `prompts`,
    `question_pool`, `suggestions`.
  - `email`: `campaigns`, `campaign_steps`, `email_sequences_rows`.
  - `courses_and_workshops`.
  - `drive_index`: the Drive file index. When `schema_matches_drive_indexer` is true: `by_kind`,
    `by_folder`, `last_synced_at`, `modified_last_30d`. When false, the index is broken; report that.
  - `repo`: app-repo content files (you can't read the app repo, so this is your only view of it):
    `mdx` (`by_collection`, `glossary_entries`, `list` with words), `stray_backup_files`,
    `public_assets.by_ext`, `email_templates`, `product_marketing_pages`, `documents`, `docs_markdown`.

  Any section may be `{ "available": false }` or carry an `error`. Report that as a data gap; never
  guess the numbers.
- **Brain content:** everything under `content/`, `research/`, `journey/` (especially
  `journey/content-candidates.md` and new `journey/log/*.md` entries), `strategy/` and `gtm/`.
  "New since last run" means files or `## Sweep <date>` sections dated after the newest entry in the
  inventory's `## Change log`.

## Read first
`README.md`, `00-north-star.md`, `content/taxonomy.md` (the tree and its placements: use them, and
note in the inventory if the taxonomy's status has changed), then all of `content/inventory.md`.

## Steps
1. **Compute deltas.** Compare the data file against the inventory's `## Appendix: raw counts`
   (that is the previous run). List every count that changed, with old → new values. Ignore
   `generated_at`. If nothing changed and no brain content is new, stop and reply `NO_CHANGES`.
2. **New assets.** From the deltas and the new brain files, identify assets that didn't exist last run
   (new posts, angles, products, emails, MDX files, research notes, video concepts, story candidates).
   Add or adjust their rows in `## Asset map` (count, maturity, location, owner system, quality notes),
   and place them in `## Map to the tree` using the taxonomy's placements. If an asset doesn't fit
   the tree, say so; don't force it.
3. **Maturity moves.** Note assets that moved stage (idea → draft → published → live in product), and
   assets that went backwards or were removed. Pipeline activity (sections with bodies, pieces, agent runs,
   human approvals, curated corpus links) counts as movement. Update the affected rows.
4. **Hygiene.** Re-check every item in `## Dead weight and hygiene`. Mark a resolved item
   `✓ resolved (<date>)` only with evidence from the data file or the brain, and keep the line. Add new
   issues: duplicate titles, missing tables (`null` counts), orphans (angles without topic, topics without
   angles), drift between the source register and the corpus, `steps_mismatch`, stray backup files,
   thin posts, tag-casing duplicates, a broken Drive index, and stale assets (no update in 90+ days where
   the data shows dates). Keep the "data-quality alarms" list to the issues that block content work.
5. **Quick wins.** Refresh `## Quick wins` as a ranked top 10: assets that could ship as content within a
   week. Each row gives the asset, its source (table or file), a format, and a CTA to one of the funnel
   destinations that the private strategy names. Drop items that have shipped (and say so in the change
   log), and promote new assets that beat existing rows. Prefer reusing existing assets over new writing.
6. **Gaps and opportunities.** Re-check `## Gaps` against the data; mark closed gaps `✓ (<date>)` with
   evidence. Update the executive summary's "biggest opportunities" only if the evidence has changed; say
   why in the change log.
7. **Replace the appendix.** Rewrite `## Appendix: raw counts` with the new numbers in the same layout,
   dated today. That makes it the baseline for next week.
8. **Change log.** Add a dated entry at the top of `## Change log` (newest first) with these
   subsections: *Count deltas*, *New assets*, *Maturity moves*, *Hygiene* (new / resolved / still open
   since <date>), *Quick-win changes*, and *Data gaps*. Keep it under about 40 lines.

## Limits
- Files you may write: `content/inventory.md` only.
- Cite the source for every number: a table name, a data-file key, or a brain file path.
- Aggregates and titles only: no row bodies, IDs (database, Stripe, Drive or user), emails or customer details.
- Edit sections in place; keep the existing headings and table columns. Don't delete human-written
  notes. If the data contradicts one, add `> Lens note (<date>):` beneath it.
- Mark inference "(inferred)". When the data file and a brain note disagree, trust the data file
  for counts, and the brain note for intent and strategy.
