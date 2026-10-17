-- Brain feedback: Austin's comments on brain decks, slides and docs from /admin/brain.
-- Additive and idempotent. RLS on with no anon/authenticated policies: the table is
-- reached only through admin API routes (validateAdminApiRequest) using the service
-- role, and by the local brain scripts (pull-feedback.ts, reply-feedback.ts).

create table if not exists public.brain_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  author_id uuid references public.users(id) on delete set null,
  target_type text not null default 'deck',
  target_id text not null,
  deck_id text,
  slide_id text,
  anchor jsonb,
  kind text not null,
  body text not null,
  status text not null default 'open',
  resolved_note text,
  reply text,
  replied_at timestamptz,
  synced_to_brain_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brain_feedback_target_type_check') then
    alter table public.brain_feedback
      add constraint brain_feedback_target_type_check check (target_type in ('deck', 'slide', 'doc'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_feedback_kind_check') then
    alter table public.brain_feedback
      add constraint brain_feedback_kind_check check (kind in ('agree', 'change', 'question', 'idea'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_feedback_status_check') then
    alter table public.brain_feedback
      add constraint brain_feedback_status_check check (status in ('open', 'answered', 'applied', 'resolved', 'dismissed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_feedback_body_length_check') then
    alter table public.brain_feedback
      add constraint brain_feedback_body_length_check check (char_length(body) between 1 and 4000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'brain_feedback_slide_target_check') then
    alter table public.brain_feedback
      add constraint brain_feedback_slide_target_check check ((target_type = 'slide') = (slide_id is not null));
  end if;
end $$;

create index if not exists brain_feedback_target_idx
  on public.brain_feedback (target_type, target_id, created_at);

create index if not exists brain_feedback_unsynced_idx
  on public.brain_feedback (created_at)
  where synced_to_brain_at is null;

create index if not exists brain_feedback_author_idx
  on public.brain_feedback (author_id);

alter table public.brain_feedback enable row level security;

revoke all on table public.brain_feedback from anon, authenticated;

comment on table public.brain_feedback is
  'Admin comments on brain decks/slides/docs. Service role only (admin API routes + brain scripts). No RLS policies by design.';
