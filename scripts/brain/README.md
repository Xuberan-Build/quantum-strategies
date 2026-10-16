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
   b) research   ≥24h          youtube_sweep.py --fill-missing, then 2–3 rotating creators --top 3 (≤10 transcripts)
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
| `extract-transcript.py` | Condenses a session `.jsonl` to user/assistant text plus edit markers, ~60k chars max (start + end kept) |
| `customer-signal.ts` | Read-only Supabase aggregate → anonymised JSON (no ids/names/emails, scrubbed short excerpts, test rows dropped) |
| `publish-snapshot.ts` | Validate with `BrainSnapshotSchema`, then upload `snapshots/latest.json` + `snapshots/<date>.json` to the private bucket `brain` |
| `prompts/_rules.md` | Standing rules prepended to every claude call (tools, privacy, copyright, index discipline) |
| `prompts/{journal,research,customers,snapshot}.md` | Stage prompts. Run-specific paths are appended under `## Run context` |
| `prompts/lenses/*.md` + `lenses/*.data.ts` | Pluggable lenses (see `prompts/lenses/README.md`) |
| `sync-brain-to-corpus.ts` | Brain → corpus: stage brain notes as `internal`-tier chunks (dry run by default) |
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
| `--only journal\|research\|customers\|lenses\|bridge\|snapshot` | Run just that stage (ignoring its timer). Commit and ship still run if anything changed. |
| `--no-upload` | Build and validate the snapshot but don't upload it |

Environment overrides: `BRAIN_MODEL` (default `opus`), `BRAIN_MAX_TURNS` (60), `BRAIN_MAX_BUDGET_USD`
(5 per claude call), `BRAIN_MIN_USER_TURNS` (5), `BRAIN_TRANSCRIPT_BUDGET` (10), `BRAIN_WORKTREE`
(`~/.quantum-brain-auto`), `CLAUDE_BIN` (`~/.local/bin/claude`), `BRAIN_CORPUS_SYNC` (unset; `1` lets the
bridge stage really sync, see below). The tick exports `BRAIN_DIR` (its worktree) for data scripts.

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

## Run it manually

```bash
scripts/brain/tick.sh --dry-run                       # see what would happen
scripts/brain/tick.sh --only journal                  # journal whatever is queued
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
