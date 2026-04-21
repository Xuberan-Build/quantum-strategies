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

## INCIDENT HISTORY

**2026-01-30**: Database was destroyed by running `supabase db reset --linked` without confirming backups existed. All customer data, beta participants, and user progress was lost. This must NEVER happen again.
