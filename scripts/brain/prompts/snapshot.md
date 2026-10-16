# Task: distil the brain into the admin snapshot JSON

The admin dashboards (`/admin/brain`) render one JSON file built from this brain. Write it to
**`.snapshots/latest.json`** in the working directory (that folder is gitignored). Write
nothing else.

## The contract
The schema is the Zod file whose path is given under **Run context** (`snapshot.ts`). Read it
first, in full. The JSON must conform **exactly**: every required field present, enums spelled
exactly, no extra top-level keys, `version: 1`, and `generatedAt` set to the ISO datetime under
Run context. Quote `text` is at most 400 characters (aim for under 25 words anyway). `url`
fields must be valid URLs or omitted. Integers must be integers. Use `null` only where the
schema says `.nullable()`.

## Where each field comes from (read these files; never invent data)
- `decks`: newest first. `decks[0]` is the current briefing, built from the newest
  `briefings/*.md` (or, if there are no briefings, from `research/social-listening.md` +
  `content/video-concepts.md`). Include up to 4 decks (older briefings, then a standing
  "Market map" deck from `research/social-listening.md`). Use 5–10 slides per deck and vary the `kind`:
  `headline` for the thesis, `stats` for numbers, `quotes` for voices, `bars` for ranked numbers
  (outliers, pain counts), `list` for angles and next moves, `comparison` for QS vs a creator or
  an enemy. Tag slides with rite/pillar/domain where it's clear, and set `sources` to the
  brain-relative paths backing each slide. `period` is the ISO week (e.g. `2026-W42`) or the date.
- `marketVoice`: one entry per pillar slug that has evidence, from
  `research/conversation/*.md`, `research/social-listening.md` and `content/pillars.md`. Map the
  taxonomy's pillar names to slugs: Architecture of Self → `architecture-of-self`,
  Value as Waveform → `value-as-waveform`, Direction Over Outcome → `direction-over-outcome`,
  State Engineering → `state-engineering`, Anchored → Ascended → `anchored-ascended`.
  `evidence.sources` = how many distinct source files back it, `evidence.items` = how many quotes or data points.
  `enemy` comes from the Conflict layer of `strategy/cult-os-blueprint.md` and `content/pillars.md`.
- `creators`: one per `research/creators/*.md` dossier for a named creator (skip `adjacent.md`
  unless it profiles a single creator). Take followers and median views from the latest sweep
  section (`null` if unknown), and outliers from the dossier and `research/transcripts/README.md`
  (`id` = the YouTube video id if known, otherwise a slug). `stance` is one line.
- `taxonomy`: from `content/taxonomy.md`: rites, pillars (with belief + lazy version),
  domains (slug = kebab-case title), topics (with angle counts; `proposed: true` for proposed ones).
  `status` is `"proposal"` unless the file says it's approved.
- `customers`: from `research/conversation/customers.md`. `counts` = the row-count table
  (source → rows), `topPains` = the pain clusters with counts, `lands` / `stuck` = short lines,
  `quotes` with source "Beta user", and `caveat` from the file.
- `hooks`: from `content/hooks-and-titles.md` and the newest briefing's angles. Tag each one.
  `status` is `"validated"` only where the file shows performance evidence.
- `journey`: from `journey/timeline.md` (eras), `journey/incidents.md`, `journey/learnings.md`
  and `journey/open-questions.md`. Use empty arrays if a file doesn't exist.
- `voicePack` (optional in the schema, but always build it): the runtime voice contract every
  content generator in the studio loads. It is **runtime rules, not research**: no audience quotes,
  no translation tables, no strategy commentary. Sources, in priority order (a later source never
  overrides an earlier one):
  1. `decisions/*.md` founder decisions (canon; newest wins). These settle identity vocabulary and
     how charts may be used.
  2. `content/language.md`: the voice rules section, the canon lines / owned terms tables, and the
     banned and handle-with-care section, including its machine-readable YAML block and the CTA
     spam-pattern rules. Apply its recorded conflict resolutions, not the superseded wording.
  3. The public voice spec (`documents/AUSTIN_VOICE_SPEC.md` in the app repo), if it is readable from
     a directory listed under Run context. If it isn't, rely on `content/language.md`, which already
     synthesises it.

  Field by field:
  - `version`: the language doc's version/status date, or the run date (`YYYY-MM-DD`).
  - `voiceRules`: one imperative sentence per rule, self-contained (a model reads them with no other
    context). Include the citation rule as the sources resolve it. 10–20 rules.
  - `canon`: one entry per canon line and owned term: `term`, `meaning`, `use` (when to use it),
    `avoid` (when not to). Keep each field to one or two sentences.
  - `bannedTerms`: the exact-match list, lowercase, one phrase per entry (the YAML block's
    `banned_exact`, plus any hard-stop phrase the sources add). Phrases only, no regex, no commentary.
  - `handleWithCare`: `{ term, rule }` per allowed-with-a-condition word or phrase; `rule` states the
    condition in one sentence.
  - `ctaSpamPatterns`: phrases that make CTA copy resemble spam or testimonial plants. Each entry is
    either a literal phrase (matched case-insensitively) or a regex written as `/source/flags`.
  - `outcomeTimeboxPatterns`: phrases or `/regex/` entries that promise how fast an outcome arrives
    (as opposed to how long a practice takes).
  - `identity`: `brand`; `identityTerm` (the identity the reader becomes, per the founder
    decisions); `stages` (the ordered journey stages that lead to it); `audience` (one sentence);
    `positioning` (one or two sentences: what the brand stands for and against, mechanism first).
  - `chartPolicy`: one or two sentences on how chart / profile data may and may not be used.
  - `systemPreamble`: 2–4 sentences that open every content system prompt: who is writing, for whom,
    and the single most important rule. No banned phrases, no hype.

  Keep the whole object compact (aim under ~12 KB): it is injected into model prompts.
- `sources`: every brain file you read, as `{ "path": "<brain-relative>", "updatedAt": "<date>" }`.
  Use the newest date stated in the file, or the run date.
- `corpus` (optional): only from the `## Summary` section of `research/corpus-links.md`. Omit the key
  entirely if that file or section doesn't exist; never derive these numbers from anywhere else.
  `asOf` = the date of the newest `## Bridge log` entry. `tierFilter` = `"unfiltered"` if the file says
  retrieval was unfiltered, otherwise `"evidence_tiers"`. `coverage` = the `Coverage:` line (`covered`,
  `total`, `pct`, plus `claimsPct` / `topicsPct`). `byPillar` = the pillar table (pillar slugs only; skip
  rows whose pillar isn't a schema slug). `topGaps` = the `Top gaps:` list, up to 10 (omit `pillar` when it
  says "none"). `chunksByTier` = the tier table (`{ "total": n }` when there's no tier column). `note` = one
  line, e.g. that unfiltered coverage is an upper bound.

Omit `brainCommit`; the tick stamps it.

If **Run context** includes validation errors from a previous attempt, read the existing
`.snapshots/latest.json`, fix exactly those issues and rewrite the file.
