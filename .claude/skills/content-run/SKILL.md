---
name: content-run
description: Run the Quantum Strategies content pipeline on one topical-map queue item - brief, Austin's first-hand material and questions, approval point 1, draft, what's-missing QA with up to 2 revision loops, approval point 2 (script and storyboard), approval point 3 (before a manual publish). Use when Austin says /content-run, "run the next topic", "brief queue #N", or to resume a run in brain/content/pipeline/runs/. Never publishes.
---

# /content-run

Runs `content-brief` → `content-experience` → ⏸ A1 → `content-writer` → `content-qa` (→ writer revision, at most 2 loops) → ⏸ A2 → ⏸ A3. Contract and rules: `brain/content/pipeline/README.md`. Design: `brain/content/content-system.md` §3, §4 and §9.

## Arguments
- `<queue-rank>` (for example `1`) or `<topic-id>`: start a new run.
- `<run-folder-name>`: resume (for example `2026-10-18-ras-myth-attentional-set`).
- `--dry-qa`: after the experience stage, also run content-qa in dry-run mode against the brief.
- No argument: take the top queue item in `brain/content/topical-map-queue.md` that has no run folder yet.

## Hard limits
- No database writes, no `supabase` or `vercel` commands, no publishing, no posting to Reddit, YouTube, email or anywhere else. Publish is always Austin's, by hand or through the existing studio route.
- Agents write only inside the run folder. Don't touch `src/` or uncommitted app files.
- Never generate media (Artlist, vidIQ generation) without Austin's spend go-ahead.
- Never invent first-hand material for Austin (README §3).

## Steps

### 0. Set up or resume
1. Resolve the topic from `topical-map-queue.md` and `topical-map.json`. Ignore Content Studio `content_angles` (superseded, see content-system §10.6).
2. Folder: `brain/content/pipeline/runs/<YYYY-MM-DD>-<slug>/`. If it exists, read `status.json` and continue from `stage`.
3. Write or update `status.json` (schema in README §2). Record `defaultsAssumed` (README §6) and `corpusSearch: "down until the Voyage migration"`.

### 1. Brief
Spawn the `content-brief` agent with the topic id, queue rank and run folder path. Check `brief.md` exists and has all 13 sections (section 13 is the awareness and micro-moments plan, `.claude/skills/awareness-moments/SKILL.md`). Update `status.json`.

### 2. Experience
Spawn `content-experience` with the run folder. Check `experience.md` and `questions-for-austin.md` exist, that there are 3 to 6 questions, and that no first-person claim appears without a file locator.

If `--dry-qa`: spawn `content-qa` in dry-run mode. It writes `qa-dry-run.md`.

### ⏸ A1: Austin approves the brief and answers the questions
Stop. Show Austin one screen:
- The topic, head term and volume, and why it's next (from the queue).
- The angle in one sentence, the tie-in pick and the CTA route, each with LIVE / BUILT / TO BUILD.
- The first-hand verdict from `experience.md` (none / thin / usable / strong).
- The questions from `questions-for-austin.md`, quoted in full.
- Open decisions from the brief, each with its default.
- The file paths.

Then wait. When he replies: record his words verbatim in `approvals.md` under A1, and log feedback to `brain/feedback/log.md` (newest first, next F-id). Transcribe his voice memo or text into `input.md` verbatim, with ids `A1`, `A2`… and a type per item (story, opinion with a reason, client example with consent noted, his own number). If he changes the brief, re-run only the stage his feedback touches.

Don't continue to step 3 until `input.md` has at least one usable first-hand item, or Austin explicitly says to draft with placeholders (then QA will block at A2 until they're filled).

### 3. Draft
Spawn `content-writer` with the run folder. It writes `draft.md`, plus `script.md` when the queue format is video-first.

### 4. QA loop
Spawn `content-qa`. Its check 11 is the Cult OS pass (README §7): it runs on every article and script, including updates to published pieces, and it blocks. Read the verdict in the newest `qa.md` section.
- **PASS:** go to A2.
- **FAIL, fixes for agents:** spawn `content-writer` in revision mode with the fix list, then `content-qa` again. At most 2 revision loops (`stages.qa.loops` in `status.json`).
- **FAIL, fixes for Austin:** pause and ask him those questions only. Add his answers to `input.md`, then revise.
- **Still failing after loop 2:** stop. Show Austin the open fix list and wait.

### ⏸ A2: Austin approves the draft, script and storyboard
Show: the verdict, what QA said is missing (if anything), the first-hand lines with their anchors, the title and meta, the tie-in sentence, the link list, and for video the storyboard summary (shot mix, lettering lines, B-roll prompts and whether any need disclosure or paid generation). Ask G11: "Would you send this to someone who asked you this in a DM?" Record his words in `approvals.md`. Feedback that applies to every topic goes into the owning agent's file and `feedback/principles.md` when he repeats it.

### ⏸ A3: Austin approves publish
Before he publishes: re-run `content-qa` on the final text, check every link resolves, the CTA URL and UTMs, the "How this was made" line, and the ramp limit (about 2 new indexable pages a week, content-system §5.2). Show the checklist. **Publishing is manual or through the existing studio route, by Austin.** Record A3 verbatim. Set `stage` to `a3-waiting` until he confirms it's live, then `published-by-austin` with the URL.

## After each session
Add a build-journal entry in `brain/journey/log/` per the app repo's `CLAUDE.md` if the run taught anything (a gate that misfired, a question that worked).
