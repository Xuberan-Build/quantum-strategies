# Claude Code Rules for Quantum Strategies

## CRITICAL DATABASE RULES

### NEVER RUN THESE COMMANDS:
- `supabase db reset` - DESTROYS ALL PRODUCTION DATA
- `supabase db reset --linked` - DESTROYS ALL PRODUCTION DATA
- Any command with `DROP DATABASE`
- Any command with `TRUNCATE` on production tables

### BEFORE ANY DATABASE MIGRATION:
1. ALWAYS run `npm run backup` first and confirm it completed successfully
2. ALWAYS ask: "Is this a production database with real customer data?"
3. NEVER run destructive commands without explicit user confirmation
4. NEVER assume a database can be reset

### BACKUP PROTOCOL:
Run this command before ANY database work:
```bash
npm run backup
```

This exports all critical tables to CSV files in `backups/<timestamp>/`:
- users, product_sessions, conversations, product_access
- product_definitions, prompts
- beta_participants, all feedback tables
- affiliate_transactions, referral_hierarchy
- course_enrollments, course_progress

Before touching the content engine or the knowledge corpus (knowledge_chunks/sources, content_pillars/topics/angles/sections/pieces/posts, corpus links, agent runs, ingestion queue), ALSO run:
```bash
npm run backup:content -- backups/<same-timestamp>
```
This exports those tables, including embeddings, as JSONL, and fails if any row count doesn't match.

Backups are stored locally in the `backups/` folder (gitignored).
The script will FAIL if any critical table cannot be backed up.

### SAFE DATABASE COMMANDS:
- `supabase db push` - Apply pending migrations (SAFE)
- `supabase db push --dry-run` - Preview migrations (SAFE)
- `supabase migration list` - View migration status (SAFE)
- `supabase db pull` - Pull remote schema (SAFE)

## PROJECT CONTEXT

This is a production SaaS application with:
- Real paying customers
- Beta program participants
- Stripe payment integration
- User session data that cannot be recovered

## WORKTREE CLEANUP RULES

Agent worktrees accumulate in `.claude/worktrees/` and can slow the dev server to a crawl (each is a full copy of the source tree). After every agent task that used a worktree:

1. Run `git worktree remove -f -f .claude/worktrees/<agent-id>` to deregister and delete it.
2. Run `git branch -D worktree-<agent-id>` to delete the associated branch.
3. Or to bulk-remove all stale ones at once:
   ```bash
   git worktree list --porcelain | grep "^worktree.*agent-" | awk '{print $2}' | xargs -I{} git worktree remove -f -f {}
   git branch | grep "worktree-agent-" | xargs git branch -D
   ```

**Do NOT leave worktrees around.** They are watched by Next.js and compiled by TypeScript, adding seconds of latency per page load per worktree.

## BUILD JOURNAL (brain/journey/)

The second brain at `brain/` is the strategy source of truth. `brain/journey/` is the running record of building QS.
At the end of any meaningful session (a feature, fix, investigation, decision, or failure):

1. Add `brain/journey/log/YYYY-MM-DD-short-slug.md` using the template in `brain/journey/README.md`. Cover the goal, the approaches tried (including dead ends), hurdles, decisions, learnings, outcome and open questions.
2. Fold anything durable into `brain/journey/decisions.md`, `learnings.md`, `incidents.md` or `open-questions.md`.
3. Be honest. Failures are the most valuable entries. Tag build-in-public candidates with `#content`.
4. Never include secrets, keys, env values, or customer PII.

## INCIDENT HISTORY

**2026-01-30**: Database was destroyed by running `supabase db reset --linked` without confirming backups existed. All customer data, beta participants, and user progress was lost. This must NEVER happen again.

**2026-05-07**: 28 stale agent worktrees (3 GB) accumulated in `.claude/worktrees/`, making every admin page load extremely slow and causing Supabase query timeouts.
