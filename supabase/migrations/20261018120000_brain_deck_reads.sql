-- Brain deck reads: per-admin read receipts for the /admin/brain deck archive.
-- One row per (user, deck). read_at null = not read (or marked unread); content_hash is
-- the deck content hash at the moment it was marked read, so a later republish with
-- different content shows as "Updated since you read it". last_slide (0-based) lets the
-- presenter resume where the reader stopped.
--
-- Additive and idempotent. Kept out of brain_feedback on purpose: read receipts are not
-- feedback, and pull-feedback.ts (which pulls every unsynced brain_feedback row into the
-- brain) must never see them.
--
-- RLS on with no anon/authenticated policies, the same as brain_feedback: the table is
-- reached only through the admin API route /api/admin/brain/deck-reads
-- (validateAdminApiRequest) and the admin server pages, both with the service role.

create table if not exists public.brain_deck_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  deck_id text not null,
  content_hash text,
  read_at timestamptz,
  last_slide integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brain_deck_reads_user_deck_key') then
    alter table public.brain_deck_reads
      add constraint brain_deck_reads_user_deck_key unique (user_id, deck_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_deck_reads_deck_id_check') then
    alter table public.brain_deck_reads
      add constraint brain_deck_reads_deck_id_check check (char_length(deck_id) between 1 and 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_deck_reads_last_slide_check') then
    alter table public.brain_deck_reads
      add constraint brain_deck_reads_last_slide_check check (last_slide between 0 and 999);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_deck_reads_hash_length_check') then
    alter table public.brain_deck_reads
      add constraint brain_deck_reads_hash_length_check check (content_hash is null or char_length(content_hash) <= 80);
  end if;
end $$;

-- The unique constraint's index serves lookups by user_id (leading column).
create index if not exists brain_deck_reads_deck_idx
  on public.brain_deck_reads (deck_id);

alter table public.brain_deck_reads enable row level security;

revoke all on table public.brain_deck_reads from anon, authenticated;

comment on table public.brain_deck_reads is
  'Per-admin read receipts for brain decks (read_at, content_hash at read time, last_slide). Service role only (admin API route + admin pages). No RLS policies by design. Never pulled into the brain as feedback.';

notify pgrst, 'reload schema';
