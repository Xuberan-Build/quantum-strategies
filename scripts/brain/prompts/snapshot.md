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

## Founder feedback (read first)
Read `feedback/principles.md` and `feedback/open.md` before you write anything. They are the founder's
standing rules and his not-yet-done asks, in his own words. Let them steer choices the schema leaves open:
which slides lead a deck, how a slide is framed (his own thought leadership first, creators as context,
LIVE vs TO BUILD stated plainly, no AI prose), and the wording of `voicePack` rules where they agree with
the sources below. They never override the schema, the founder decisions or the data. Don't add fields
for them, and list both files in `sources`.

## The briefing standard (every deck must meet it)
Founder feedback, 2026-10-17: "Your briefings need work please ensure you give me a little more context
when bringing points and insights to the table". The daily briefing he read was a row of competitor
follower counts and scraper fetch counts with no meaning attached. Read `content/briefing-standard.md`
in full before writing any deck (if it isn't in this worktree yet, apply the rules below, which are its core),
and list it in `sources`. For every slide in every deck:
1. **The test.** The slide answers, in plain words for a reader who hasn't opened the brain since last week:
   what is this (who, what, when, where the number came from), why it matters to Austin's goals (his own
   thought leadership and authority, the Rites, the front door quiz, revenue), and what to do next. A point
   that moves none of those goals gets no slide.
2. **`takeaway` is required on every slide.** One or two plain sentences: the implication for Austin, then the
   next move (or the decision it feeds and what's missing). Never repeat the title or summarise the slide.
3. **Context before the number.** Titles are plain claims, never labels like "Day over day" or "Asset count".
   Say who and what before any figure. Never use an internal name, file, id or error code without a plain gloss
   (write "YouTube blocked our IP address", never `IpBlocked`).
4. **Every number has a baseline** (vs last run, the channel's own median, our target or the field), **its source**
   in words (e.g. "YouTube sweep, 17 Oct") plus the path in `sources`, and, where it informs a choice, what would
   change the decision. "31.57x" is written as "31.6 times his channel's median views".
5. **Austin is the subject.** Creators appear only as context for his move: a pattern to use, a gap to fill, a
   mistake to avoid, lineage to credit. Competitor follower counts and day-over-day drift never headline a slide;
   drop them unless they change what he does.
6. **Plumbing goes last.** Transcript, comment and upload fetch counts, blocks, retries and validator runs go on
   one final slide titled `Pipeline health` (kind `list`), each item saying what broke in plain words, whether
   any insight was lost, and what is being done (owner, or "unassigned"). Never mix them into insight slides or
   the deck `summary`. Every tick briefing deck ends with this slide when the sweep reported anything.
7. **LIVE / TO BUILD** on every asset a slide mentions, checked against `strategy/live-vs-build.md` and newer
   journal entries; "status unverified" if the brain doesn't say.
8. **Quotes** carry the speaker's role (never a username), where and when, and why it matters. Likes show
   attention and say nothing about agreement.
9. **One idea per slide,** and an `Evidence:` line at the end of each slide's `subtitle` or `body`
   (strong / medium / thin, with the sample behind it; mark inference "(inferred)").
10. **Voice:** `content/tonality.md`, no em-dashes, no "X, not Y" reveals.
Deck shape: slide 1 is the answer (what changed for Austin and the move it points to), then one insight per
slide ordered by impact on his goals, then next moves with LIVE / TO BUILD, then `Pipeline health`.

## Where each field comes from (read these files; never invent data)
- `decks`: newest first. `decks[0]` is the current briefing, built from the newest
  `briefings/*.md` (or, if there are no briefings, from `research/social-listening.md` +
  `content/video-concepts.md`). Include up to 4 decks (older briefings, then a standing
  "Market map" deck from `research/social-listening.md`). Use 5–10 slides per deck and vary the `kind`:
  `headline` for the thesis, `stats` for numbers, `quotes` for voices, `bars` for ranked numbers
  (outliers, pain counts), `list` for angles and next moves, `comparison` for QS vs a creator or
  an enemy. Tag slides with rite/pillar/domain where it's clear, and set `sources` to the
  brain-relative paths backing each slide. Every slide follows the briefing standard above, with a
  `takeaway` on each one. In the briefing deck, competitor stats appear only where they back one of
  Austin's angles, and the sweep's fetch counts and gaps go on the final `Pipeline health` slide.
  The worked example in `content/briefing-standard.md` §3 shows the 17 Oct "Day over day" slide rewritten. `period` is the ISO week (e.g. `2026-W42`) or the date.
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
  4. `content/tonality.md`: the founder's real voice, measured from his own writing, and the AI-prose
     kill list. It supplies `aiProsePatterns` and up to four `voiceRules` (its §10). Where it proposes
     changes to the spec or `language.md` (its §5), use them only once those files have adopted them.

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
  - `aiProsePatterns`: from the fenced ```` ```yaml ai-prose-patterns ```` block in `content/tonality.md`.
    Copy the `match` string **verbatim** (it is already in `/source/flags` or literal form) for every entry
    whose `severity` is `warn` or `error` (missing = `warn`) and whose `scope` is `line` (missing = `line`).
    Skip `info` and `paragraph` entries. Keep the file's order and don't invent or edit patterns. Omit the
    key if the block doesn't exist. These are matched against generated copy by the studio's voice
    calibration and the video-script validator.

  Keep the whole object compact (aim under ~12 KB, plus ~6 KB for `aiProsePatterns`): it is injected into model prompts.
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
