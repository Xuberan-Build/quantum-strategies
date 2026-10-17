# Brain tick

The self-running maintainer of the Quantum Strategies second brain. It journals working
sessions, digests YouTube research, refreshes the customer voice, runs analysis lenses,
distils everything into the admin snapshot, and ships the result as a rolling PR.

The brain itself is markdown in a **separate private repo** (`Xuberan-Build/quantum-brain`),
cloned at `brain/` and gitignored here. This folder (in the **public** app repo) holds only
orchestration code and prompts that describe structure. It contains no strategy content.

## Architecture

```
Claude Code session ends ──► on-session-end.sh ──► .queue/sessions.txt
                                    │ (nohup, detached, <0.1s)
launchd, Sunday 21:00 ──────────────┤
manual: tick.sh [flags] ────────────┘
                                    ▼
                                 tick.sh   (lock, log, worktree ~/.quantum-brain-auto @ auto, merge origin/main)
   a) journal    every tick    extract-transcript.py → claude(prompts/journal.md)      → journey/log/*, decisions/learnings/incidents/open-questions
   feedback      every tick    [pull-feedback.ts] + extract-feedback.py (founder messages after a per-session watermark) + feedback/inbox/*.md
                               → claude(prompts/feedback.md) → feedback/log.md, open.md, principles.md; inbox files → inbox/processed/
   b) research   ≥24h          youtube_sweep.py --fill-missing, then 2–3 rotating creators --top 3 (≤10 transcripts)
                               → stage_youtube_corpus.py + ingest dry run (real ingest only with BRAIN_YOUTUBE_CORPUS=1; see "YouTube → corpus")
                               → claude(prompts/research.md) → research/transcripts|creators|conversation, briefings/<date>.md
   c) customers  ≥7d           customer-signal.ts (read-only, anonymised JSON) → claude(prompts/customers.md) → research/conversation/customers.md
   lenses        ≥7d           for each prompts/lenses/*.md: [lenses/<name>.data.ts] → claude(lens prompt)
   bridge        every tick    sync-brain-to-corpus.ts --dry-run (real sync only with BRAIN_CORPUS_SYNC=1 + guards; see "Corpus bridge")
   commit        if changed    git commit in the worktree (before the snapshot, so brainCommit is exact)
   d) snapshot   if HEAD moved claude(prompts/snapshot.md) → .snapshots/latest.json → publish-snapshot.ts
                               (Zod-validate against src/lib/brain/snapshot.ts; one retry with the errors; upload to Storage `brain`)
   e) ship       if ahead      git push origin auto → open "Brain updates (rolling)" PR, or comment on the open one
   on failure                  gh issue create --label brain-tick (step + last 50 log lines)
```

| File | Role |
|---|---|
| `on-session-end.sh` | SessionEnd hook: recursion guard, queue the transcript, launch `tick.sh` detached |
| `tick.sh` | Orchestrator (all stages, flags, lock, logs, failure issues) |
| `extract-feedback.py` | Pulls only the founder's typed messages (incl. mid-turn messages and his own words in question answers) with timestamps and what he was reacting to; `--since` for the watermark |
| `extract-transcript.py` | Condenses a session `.jsonl` to user/assistant text plus edit markers, ~60k chars max (start + end kept) |
| `customer-signal.ts` | Read-only Supabase aggregate → anonymised JSON (no ids/names/emails, scrubbed short excerpts, test rows dropped) |
| `publish-snapshot.ts` | Validate with `BrainSnapshotSchema`, then upload `snapshots/latest.json` + `snapshots/<date>.json` to the private bucket `brain`. Afterwards it also publishes the deck archive and docs (below); those failures are logged, never fatal (`--no-archive` skips) |
| `publish-decks.ts` | `brain/decks/*.json` (`ArchivedDeckSchema`; plain `DeckSchema` is valid) → `decks/<id>.json` + `decks/index.json`. Never deletes remote decks; a deck named in another's `supersedes` shows as superseded. Feeds `/admin/brain/decks` |
| `publish-docs.ts` | Docs listed in `brain/docs.json` → `docs/<slug>.json` (latest), immutable `docs/<slug>/<hash>.json` (every version), `docs/index.json`. JSON envelopes because the bucket only accepts `application/json`. Feeds `/admin/brain/docs` |
| `pull-feedback.ts` | Unsynced `brain_feedback` rows (notes on slides, decks and doc sections) → append-only `$BRAIN_DIR/feedback/inbox/<date>.md`, then marks them synced. Idempotent via `feedback-id` markers (also checks `inbox/processed/`) |
| `reply-feedback.ts` | `reply-feedback.ts <id> --status applied\|answered [--reply "..."]`: posts Claude's reply/status back onto a note; it shows beside the note in the admin |
| `prompts/_rules.md` | Standing rules prepended to every claude call (tools, privacy, copyright, index discipline) |
| `prompts/{journal,feedback,research,customers,snapshot}.md` | Stage prompts. Run-specific paths are appended under `## Run context` |
| `prompts/lenses/*.md` + `lenses/*.data.ts` | Pluggable lenses (see `prompts/lenses/README.md`) |
| `sync-brain-to-corpus.ts` | Brain → corpus: stage brain notes as `internal`-tier chunks (dry run by default) |
| `../research/stage_youtube_corpus.py` | YouTube cache day → `market_signal` staging JSONL (transcripts + audience comments) |
| `ingest-staged-corpus.ts` | Staging JSONL → `knowledge_chunks` (dry run by default; `--execute` needs today's backup) |
| `com.quantumstrategies.brain-tick.plist` + `install-launchd.sh` | Weekly safety-net run |

## Triggers

1. **SessionEnd hook.** Every Claude Code session in this project queues its transcript and starts
   a tick. Stages that aren't due are skipped, so most of these ticks only run journal and snapshot.
   Wire it up in `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "SessionEnd": [
         { "hooks": [ { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/scripts/brain/on-session-end.sh", "timeout": 10 } ] }
       ]
     }
   }
   ```
2. **launchd,** weekly on Sunday at 21:00 local: `scripts/brain/install-launchd.sh` (it bakes the current
   PATH dirs for node/git/gh/jq/python3/claude into the plist).
3. **Manual:** `scripts/brain/tick.sh [flags]`.

## Flags

| Flag | Effect |
|---|---|
| `--dry-run` | Everything except claude calls, YouTube requests, state updates, commit, push, PR, issues and upload. It still creates/merges the worktree, condenses transcripts, runs `customer-signal.ts` (read-only) and validates an existing snapshot. It prints what would happen and leaves the queue intact. |
| `--force-research` | Run research even if under 24h since the last one |
| `--force-lenses` | Run lenses even if under 7 days since the last run |
| `--only journal\|feedback\|research\|customers\|lenses\|bridge\|snapshot` | Run just that stage (ignoring its timer). Commit and ship still run if anything changed. |
| `--no-upload` | Build and validate the snapshot but don't upload it |

Environment overrides: `BRAIN_MODEL` (default `opus`), `BRAIN_MAX_TURNS` (60), `BRAIN_MAX_BUDGET_USD`
(5 per claude call), `BRAIN_MIN_USER_TURNS` (5), `BRAIN_TRANSCRIPT_BUDGET` (10), `BRAIN_WORKTREE`
(`~/.quantum-brain-auto`), `CLAUDE_BIN` (`~/.local/bin/claude`), `BRAIN_CORPUS_SYNC` (unset; `1` lets the
bridge stage really sync, see below), `BRAIN_YOUTUBE_CORPUS` (unset; `1` lets the research stage really ingest
YouTube research, see "YouTube → corpus"). The tick exports `BRAIN_DIR` (its worktree) for data scripts.

**Journal skip rule:** a session is skipped when it has fewer than 5 user turns, or when it has no
file edits and fewer than 10 user turns. The journal prompt can also decline a session (`NO_CHANGES`).

## Safety model

- **Two repos, never mixed.** The tick runs git only against the brain repo, from inside its own worktree.
  It never runs git in the app repo, never touches the user's `brain/` checkout (on main), and only ever
  pushes `auto:auto` (it refuses unless HEAD is `auto`). Main changes only when a human merges the PR.
  Merge the rolling PR with a **merge commit**, not a squash, so `auto` keeps merging cleanly. If merging
  `origin/main` into `auto` conflicts, the tick aborts and opens an issue.
- **Headless claude is least-privilege.** Every call runs with:
  - `-p --output-format json`: non-interactive, with a parseable result (`subtype`, `is_error`, cost)
  - `--tools Read,Write,Edit,Glob,Grep` + `--allowedTools` (same list): no Bash, shell, web or MCP
    tools exist in the session at all. All fetching, git and uploading is done by `tick.sh`.
  - `--disallowedTools Bash WebFetch WebSearch Write(//<dir>/**) Edit(//<dir>/**)`: belt and braces,
    and makes every `--add-dir` read-only
  - `--permission-mode dontAsk`: pre-approved tools run, and anything else is denied instead of prompting
  - `--restricted`: ignores user/project/local settings (so no hooks or extra permissions), and
    confines the file tools to the working directories
  - `--strict-mcp-config`: no MCP servers
  - `--no-session-persistence`: the tick's own runs don't pile up in the transcript folder
  - `--max-turns 60 --max-budget-usd 5 --model opus`: bounded cost and runtime
  - cwd = the brain worktree, plus a read-only `--add-dir` only where needed: `scripts/research/.cache`
    for research, `src/lib/brain` for the snapshot
  - prompt on stdin (`--disallowedTools` is variadic, so a trailing argv prompt would be swallowed)
- **Recursion guard:** the tick exports `BRAIN_TICK=1`, and `on-session-end.sh` exits immediately when
  it's set. `--restricted` also means the headless runs don't load project hooks.
- **Database:** `customer-signal.ts` and lens data scripts are SELECT-only. `publish-snapshot.ts` writes
  only to Storage: it creates bucket `brain` as **private** if missing, refuses to upload if the bucket is
  public, and upserts the two snapshot objects.
- **Privacy and copyright** are enforced in `prompts/_rules.md`: no PII, customer quotes under 25 words and
  de-identified, creator/comment quotes short. Full transcripts stay in `scripts/research/.cache`
  (gitignored) and are never copied into the brain.
- **YouTube:** at most `BRAIN_TRANSCRIPT_BUDGET` (10) transcripts per tick. Fill-missing goes first, with
  `--limit`, and the remaining budget goes to 2–3 rotating creators at `--top 3`. The sweep stops at the first IP block.
  Local Whisper transcription is built into the sweep but not yet switched on in the tick: see "YouTube transcripts: local Whisper".
- **Concurrency:** `mkdir .lock`. A second tick exits, and locks older than 3h are cleared as stale.
- **Queue durability:** queued transcripts move to `.queue/inflight-*.txt` and are deleted only after the
  journal stage succeeds. A crashed tick's inflight file is picked up by the next one.

## Corpus bridge (brain ↔ corpus)

The knowledge corpus (`knowledge_chunks`, pgvector) and the brain feed each other.

**Corpus → brain:** the weekly lens `40-corpus-bridge`. `lenses/40-corpus-bridge.data.ts` takes the claims from
the brain's thesis/evidence map (any table with a `Claim` column; optional `Query`, `Pillar`, `#` columns) and the
topics from `content/taxonomy.md`. It falls back to `strategy/authority-probes.json` when there is no map yet, and
adds `research/corpus-bridge-queries.json` if present. It embeds each one and runs the read-only `match_knowledge` RPC.
When the `tier` column and `filter_tiers` exist, it restricts retrieval to the `evidence`/`lineage` tiers; otherwise
it runs unfiltered and says so. It outputs the top passages (similarity, citation, ≤200-char excerpt), coverage by
pillar, gaps (nothing from a non-QS source above 0.45) and chunk counts by tier. QS's own material (tradition `qs*`,
tier `internal`, origin `second_brain`) never counts as support. The lens prompt writes `research/corpus-links.md`
and appends uncovered gaps to the authority playbook's ingestion list. The snapshot stage copies that note's
`## Summary` into the optional `corpus` field of `snapshot.ts`.

**Brain → corpus:** `sync-brain-to-corpus.ts`. It selects strategy, content, research summaries, decisions and
journey learnings (no READMEs, raw logs, customer or commenter voice, briefings, or `research/corpus-links.md`,
which would be circular). It skips anything flagged private (frontmatter `private: true` / `corpus: false` /
`visibility: private`, or a `<!-- private -->` / `<!-- corpus:skip -->` marker). It chunks heading-aware at
≤400 words, hashes each chunk and writes staging JSONL to `<brain>/.snapshots/corpus-sync/` (gitignored in the
brain repo, never in this repo). Rows carry `tier: internal`, `tradition: qs_internal`,
`metadata.source_path`, `metadata.content_hash` and `metadata.not_evidence: true`. It reads the corpus's
existing `metadata.content_hash` per note (SELECT only), so only new or changed notes go to the ingest.

```bash
NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/sync-brain-to-corpus.ts --brain brain --verbose  # dry run
NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/lenses/40-corpus-bridge.data.ts > /tmp/bridge.json
scripts/brain/tick.sh --dry-run --only bridge
```

**Safety model for the write path** (all of these must hold, or nothing is written):
1. **Dry run by default.** The script and the tick's `bridge` stage only report counts, changed notes and the
   estimated embedding cost. The tick passes `--execute` only when `BRAIN_CORPUS_SYNC=1` and the tick is not `--dry-run`.
2. **Backup guard.** `--execute` refuses (exit 2) unless `backups/<today>T*/_manifest.json` exists with zero failed
   tables, so run `npm run backup` first (`CLAUDE.md`).
3. **Tier guard.** It refuses unless `knowledge_chunks.tier` exists, because without it internal notes would be
   indistinguishable from evidence. The column comes from the evidence-tiers migration (`*_corpus_evidence_tiers.sql`),
   which needs the founder's go-ahead.
4. **Delegated, replace-by-source write.** This script never writes to the DB. It calls
   `scripts/brain/ingest-staged-corpus.ts --file <changed.jsonl> --replace-by-source --execute` (and
   `--remove-sources <file>` for notes that left the brain, if the ingest script supports it).
5. **Financial denylist.** Files whose names match revenue/pricing/budget/forecast/valuation are skipped. Sections whose
   heading matches revenue, pricing, financials, forecast, budget, runway, margin, LTV/CAC, MRR/ARR and similar are dropped
   whole. Single lines with revenue terms or `$`-amounts with k/m or /mo are dropped. The filter is deliberately
   over-inclusive (it also drops "pre-revenue" status lines).
6. **Never evidence.** Internal chunks are context for QS's own tools. Any retrieval meant as evidence must filter
   them out (`filter_tiers` = evidence/lineage). Before turning the sync on, check that `knowledge_chunks` RLS stops
   non-admin users reading `tier = 'internal'` rows (today any authenticated user can SELECT the table).
7. **Failure isolation.** A refused or failed sync is logged and opens a `brain-tick` issue, but never fails the tick.

Optional per-brain override: `<brain>/.corpus-sync.json` `{"include": [...], "exclude": [...]}` (path prefixes; exclude wins).

## YouTube → corpus (market_signal)

Founder decision 2026-10-16: YouTube transcripts and audience comments go into the knowledge corpus, so the
second brain and the corpus share the same research. They go in as tier **`market_signal`**: they show what the
market says and responds to, and are never evidence for a mechanism.

**Staging:** `scripts/research/stage_youtube_corpus.py` (python3 -I, stdlib only) turns one cache day
(`scripts/research/.cache/youtube/<date>/*.json`) into `<brain>/.snapshots/corpus-youtube/<date>.jsonl`
(gitignored in the brain repo; nothing reaches either repo's git).
- **Transcripts:** ~300–400 words per chunk on caption-segment boundaries, with `start_s`/`end_s` kept and
  `source_url` = `watch?v=<id>&t=<start>s`. `text_name` `yt_<creator-key>`, `source_path` `youtube/<videoId>#<n>`,
  `origin: youtube_transcript`.
- **Comments:** per video, sorted by likes, ~25 per chunk (fewer if the chunk would pass 400 words).
  Comments under 30 characters are dropped, and so are links, the seeded book plugs and "quiz" plants, and promo codes.
  `@handles` are stripped, and the cache stores no author names. `text_name` `yt_comments_<creator-key>`,
  `source_path` `youtube/<videoId>/comments#<n>`, `origin: youtube_comments`.
- Every row: `tradition: creator_research`, `content_type: market_signal`, `metadata.tier: market_signal`,
  `not_evidence: true`, `copyright: third_party_internal_research_only`, plus video id/title, creator key,
  views, outlier and `swept_on`. `themes[]` comes from a small keyword map (self_image, manifestation, identity,
  willpower, habit, subconscious, nlp, frequency, values).

**In the tick:** after the research sweep, the tick stages the latest cache day and runs
`ingest-staged-corpus.ts --file <jsonl> --replace-by-source`. That is a dry run (SELECT only, no embeddings) unless
`BRAIN_YOUTUBE_CORPUS=1`, this isn't a `--dry-run` tick, and a successful backup from today exists. Then it adds
`--execute`. The ingest script needs today's backup even to plan, so with no backup the staging counts are the dry run.
Staging or ingest failures, or `BRAIN_YOUTUBE_CORPUS=1` without a backup, open a `brain-tick` issue but never fail the tick.
Re-ingesting a day is idempotent: unchanged chunks keep their hash and aren't re-embedded. Caveat: if a video
re-stages into fewer chunks, the higher-numbered `source_path`s stay until removed with `--replace-source`.

**Retrieval hygiene:** evidence-facing callers (citation cards, draft/section context labelled as sources) pass
`tiers: ['evidence','model','lineage']` to `vectorSearch`, so market_signal can't be cited. Market-research
callers (hooks, angles, voice of market) include `market_signal`.

```bash
python3 -I scripts/research/stage_youtube_corpus.py --date 2026-10-16          # stage + counts + cost
NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/ingest-staged-corpus.ts \
  --file brain/.snapshots/corpus-youtube/2026-10-16.jsonl --replace-by-source  # dry run
```

**Real ingest (only after the founder's go-ahead; not run by default):**

```bash
npm run backup && npm run backup:content -- backups/<that-folder> && \
NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/ingest-staged-corpus.ts \
  --file brain/.snapshots/corpus-youtube/2026-10-16.jsonl --replace-by-source --execute
```

`<that-folder>` is the `backups/<timestamp>/` folder that `npm run backup` just printed. After that, set
`BRAIN_YOUTUBE_CORPUS=1` in the tick's environment (launchd plist / shell) to keep ingesting new sweeps automatically.

## YouTube transcripts: local Whisper (proposed tick change)

YouTube's transcript endpoint blocks a home IP after ~15 requests an hour, and the block lasts hours
(2026-10-16 and 2026-10-17). `youtube_sweep.py` now has a local backend: yt-dlp downloads the audio only,
`mlx_whisper` (whisper-large-v3-turbo) transcribes it on this Mac, and the audio is deleted straight away.
The cache keeps text plus timestamped segments in the same shape as captions, with
`transcript_source: "whisper-large-v3-turbo"`. Staging labels those chunks "local Whisper" instead of "auto-captions".

Flags: `--transcripts auto|api|whisper` (default `auto`: API until the first block or a video with no captions,
then whisper for the rest of the run), `--max-transcripts N` (default 20, per run), `--max-minutes M` (no new
transcript or creator after M minutes), `--backfill-outliers N` (each selected creator's next N untranscribed
outliers from its latest cache file, added to that file's picks with `backfill: true`, no comments).
`--fill-missing` uses the same backends. Videos already transcribed on an earlier cache day are reused, not refetched.
Whisper paces 20–60s between downloads and stops at the first yt-dlp error (HTTP 429, "Sign in to confirm", or
anything else) or whisper failure. No cookies, proxies or logins.

**Proposed change to `tick.sh`** (not applied; lines 427 and 442). Replace

```bash
    else "$PY" -I "$SWEEP" --fill-missing "$last_day" --limit "$budget" || warn "fill-missing failed"; fi
...
    else "$PY" -I "$SWEEP" --only "$only" --top "$TOP_PER_CREATOR" || warn "sweep failed"; fi
```

with

```bash
    else perl -e 'alarm shift; exec @ARGV' 900 "$PY" -I "$SWEEP" --fill-missing "$last_day" --limit "$budget" \
           --transcripts auto --max-minutes 10 || warn "fill-missing failed or timed out"; fi
...
    else perl -e 'alarm shift; exec @ARGV' 1800 "$PY" -I "$SWEEP" --only "$only" --top "$TOP_PER_CREATOR" \
           --transcripts auto --max-transcripts 12 --backfill-outliers 2 --max-minutes 20 \
           || warn "sweep failed or timed out"; fi
```

(and update the matching `[dry-run] would run:` log lines). Why the wrapper: macOS has no `timeout`/`gtimeout` here,
so `perl -e 'alarm N; exec ...'` is the stock way to put a hard ceiling on a command. The alarm survives `exec`, and
SIGALRM kills the Python process.

**Timing and why it can't hang the tick.** Measured on this Mac: audio download 2–4s, whisper ~0.03x realtime
(44s for 27 minutes), plus 20–60s pacing. 12 videos of ~35 minutes is roughly 15–20 minutes. Three layers stop it:
1. `--max-minutes`: no new transcript or creator starts after the limit (the current one finishes).
2. Each `mlx_whisper` call has its own subprocess timeout (180s + 0.5x the audio length, capped by the deadline),
   and yt-dlp has a 30s socket timeout.
3. The perl alarm kills the whole sweep at 15 / 30 minutes no matter what. Cache files are written atomically
   (temp file + rename), so a kill loses at most the transcript in progress. A kill can leave an orphaned
   `mlx_whisper` (it ends on its own) and a `qs-whisper-*` temp folder in `$TMPDIR`.
A failed or killed sweep only logs a warning; the tick carries on to staging as before. The tick is detached
from SessionEnd, so a long research stage never blocks a Claude session, but it holds the tick lock while it runs.

**Headless PATH.** launchd's PATH is minimal. The sweep finds `mlx_whisper` via `$MLX_WHISPER_BIN`, then PATH, then
`~/.pyenv/versions/*/bin/mlx_whisper`, then the pyenv shim, and adds `/opt/homebrew/bin` (ffmpeg) for the
subprocess. If none is found, `auto` stays on the API and `whisper` fetches nothing (reported, not fatal).

## Deck archive, docs and feedback

- **Decks** live as files in the brain at `decks/<YYYY-MM-DD>-<slug>.json` (optional metadata: `source`, `createdAt`,
  `status` current|superseded|archived, `supersedes`, `externalUrl`, `tags`). `/admin/brain/decks` lists every
  retained deck; the presenter loads snapshot decks first, then archived ones from Storage.
  Every deck meets `brain/content/briefing-standard.md`: a `takeaway` ("Why it matters") on every slide, context and a
  baseline before every number, competitors only as context, and pipeline stats on a final "Pipeline health" slide.
- **Docs** to publish are listed in `brain/docs.json` (`{"docs": ["gtm/free-quiz-spec.md", "research/language/*.md"]}`).
  `/admin/brain/docs` renders them split into sections; notes anchor on heading path + quoted text + version hash,
  so they are re-found after edits (or listed as unplaced if the text is gone).
- **Publishing** needs no tick change: `publish-snapshot.ts` runs both after the snapshot upload, with the brain dir
  from `$BRAIN_DIR` (the tick exports it). To publish without a snapshot:
  `run_ts scripts/brain/publish-decks.ts --brain-dir "$WT"` and `run_ts scripts/brain/publish-docs.ts --brain-dir "$WT" --commit "$HEAD_SHA"`.
- **Feedback** (`brain_feedback` table, service role only behind the admin check). In tick, before the commit step:
  `run_ts scripts/brain/pull-feedback.ts --brain-dir "$WT"` (it also honours `$BRAIN_DIR`). Writes
  `feedback/inbox/<date>.md`; exit 0 = ok or nothing new, 4 = DB/IO failure (warn and continue).
  After acting on a note: `run_ts scripts/brain/reply-feedback.ts <id> --status applied --reply "..."`.
  The loop is documented in the brain at `feedback/README.md`.

## Run it manually

```bash
scripts/brain/tick.sh --dry-run                       # see what would happen
scripts/brain/tick.sh --only journal                  # journal whatever is queued
scripts/brain/tick.sh --dry-run --only feedback       # show which founder messages / inbox files the feedback stage would log
scripts/brain/tick.sh --force-research --no-upload    # research now, snapshot built but not uploaded
scripts/brain/tick.sh --only snapshot                 # rebuild + upload the snapshot

# pieces on their own
python3 -I scripts/brain/extract-transcript.py <session.jsonl> --stats
NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/customer-signal.ts --summary
NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/publish-snapshot.ts ~/.quantum-brain-auto/.snapshots/latest.json --no-upload
```

## State, logs and files

- `logs/tick-<timestamp>.log`: one per tick, last 30 kept. `logs/launcher.log` (hook) and
  `logs/launchd.log` (weekly job) are capped at about 1 MB. When run from a terminal, output is also teed to the screen.
- `.state.json`: `research_last`, `research_rotation`, `customers_last`, `lenses_last` (epoch seconds),
  `snapshot_commit`. Delete a key to make that stage due.
- `.queue/`: pending transcripts. `.lock/`: the running tick's lock.
- `~/.quantum-brain-auto/.snapshots/`: gitignored in the brain repo. `latest.json` is the last
  snapshot, and `work/` holds condensed transcripts, prompts, claude outputs and data JSON (pruned after 7 days).
- Failures: GitHub issues on `Xuberan-Build/quantum-brain` labelled `brain-tick`.

All of the above except the worktree are gitignored in the app repo.

## Uninstall

```bash
scripts/brain/install-launchd.sh --uninstall          # remove the weekly job
# remove the SessionEnd hook entry from .claude/settings.json
git -C brain worktree remove --force ~/.quantum-brain-auto && git -C brain branch -D auto   # optional
rm -rf scripts/brain/.queue scripts/brain/.lock scripts/brain/logs scripts/brain/.state.json
```
