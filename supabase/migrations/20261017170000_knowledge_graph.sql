-- Knowledge graph: nodes and edges extracted from the private brain (scripts/brain/build-graph.ts)
-- and linked to the knowledge corpus. Additive and idempotent. Touches no existing rows.
--
-- Service role only, like the corpus: RLS on, no anon/authenticated policies, privileges revoked.
-- Reached by the admin graph API (validateAdminApiRequest + service role), the builder script,
-- and src/lib/brain/graph.ts (server-only helper for content generators and the quiz).
--
-- Also widens brain_feedback.target_type to allow 'node' (the founder comments on graph nodes).

create extension if not exists vector;

-- ---------------------------------------------------------------------
-- 1. Nodes
-- ---------------------------------------------------------------------
create table if not exists public.kg_nodes (
  id          text primary key,                 -- '<type>:<slug>', stable across builds
  type        text not null,
  label       text not null,
  summary     text,
  props       jsonb not null default '{}'::jsonb,
  source_path text,                             -- brain-relative path
  url         text,
  weight      real not null default 1,          -- importance (likes, counts, degree)
  tier        text,                             -- corpus evidence tier where relevant
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  built_at    timestamptz                       -- set by each build run
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kg_nodes_type_check') then
    alter table public.kg_nodes add constraint kg_nodes_type_check check (type in (
      'note', 'pillar', 'sub_pillar', 'cluster', 'cornerstone', 'spoke', 'problem', 'quote', 'source',
      'community', 'creator', 'claim', 'mechanism', 'solution_type', 'product', 'rite', 'decision',
      'principle', 'deck', 'doc', 'corpus_source', 'segment'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'kg_nodes_id_prefix_check') then
    alter table public.kg_nodes add constraint kg_nodes_id_prefix_check check (id like type || ':%');
  end if;
end $$;

create index if not exists kg_nodes_type_idx on public.kg_nodes (type);
create index if not exists kg_nodes_built_at_idx on public.kg_nodes (built_at);
create index if not exists kg_nodes_embedding_hnsw_idx
  on public.kg_nodes using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- 2. Edges
-- ---------------------------------------------------------------------
create table if not exists public.kg_edges (
  id       bigserial primary key,
  src      text not null references public.kg_nodes(id) on delete cascade,
  dst      text not null references public.kg_nodes(id) on delete cascade,
  type     text not null,
  weight   real not null default 1,
  props    jsonb not null default '{}'::jsonb,   -- similarity, quote ids, chunk ids, extractor
  built_at timestamptz,
  constraint kg_edges_src_dst_type_key unique (src, dst, type)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kg_edges_type_check') then
    alter table public.kg_edges add constraint kg_edges_type_check check (type in (
      'links_to', 'part_of', 'mentions', 'voices', 'from_source', 'in_community', 'evidences',
      'supports', 'contradicts', 'explains', 'solves', 'addresses', 'routes_to', 'belongs_to_pillar',
      'decided_in', 'feedback_on'));
  end if;
end $$;

create index if not exists kg_edges_type_idx on public.kg_edges (type);
create index if not exists kg_edges_src_idx on public.kg_edges (src);
create index if not exists kg_edges_dst_idx on public.kg_edges (dst);
create index if not exists kg_edges_type_src_idx on public.kg_edges (type, src);
create index if not exists kg_edges_built_at_idx on public.kg_edges (built_at);

-- ---------------------------------------------------------------------
-- 3. Lock down: service role only
-- ---------------------------------------------------------------------
alter table public.kg_nodes enable row level security;
alter table public.kg_edges enable row level security;
revoke all on table public.kg_nodes from anon, authenticated;
revoke all on table public.kg_edges from anon, authenticated;
revoke all on sequence public.kg_edges_id_seq from anon, authenticated;

comment on table public.kg_nodes is
  'Knowledge graph nodes built from the private brain by scripts/brain/build-graph.ts. Service role only. Rebuilt idempotently; never edit by hand.';
comment on table public.kg_edges is
  'Knowledge graph edges (src -> dst, typed). props.extractor names the builder stage that owns the edge. Service role only.';

-- ---------------------------------------------------------------------
-- 4. Gaps: what the graph says is missing
-- ---------------------------------------------------------------------
-- kind (detail.node_type carries the node's type):
--   claim_weak_evidence      claim with no evidences edge at or above the 0.45 floor
--                            (src/lib/corpus/evidence.ts EVIDENCE_SIMILARITY_FLOOR). Refused claims excluded.
--   mechanism_weak_evidence  same, for mechanisms
--   problem_no_product       problem (not a guardrail) with no addresses or routes_to edge
--   problem_no_content       problem (not a guardrail) with no edge from a deck, doc, spoke or cornerstone
--   pillar_no_demand         pillar where no quote voices any problem that belongs to it
create or replace function public.kg_gaps()
returns table (kind text, node_id text, label text, detail jsonb)
language sql
stable
set search_path = public
as $$
  with cfg as (select 0.45::float8 as floor_v)
  -- claims and mechanisms without evidence above the floor
  select
    case when n.type = 'claim' then 'claim_weak_evidence' else 'mechanism_weak_evidence' end,
    n.id, n.label,
    jsonb_build_object(
      'node_type', n.type,
      'tier', n.tier,
      'best_similarity', (
        select max((e.props->>'similarity')::float8) from kg_edges e
        where e.dst = n.id and e.type = 'evidences'),
      'best_below_floor', n.props->'best_similarity',
      'evidence_edges', (select count(*) from kg_edges e where e.dst = n.id and e.type = 'evidences'),
      'source_path', n.source_path)
  from kg_nodes n
  where n.type in ('claim', 'mechanism')
    and coalesce(n.props->>'kind', '') <> 'will_not_say'
    and not exists (
      select 1 from kg_edges e, cfg
      where e.dst = n.id and e.type = 'evidences'
        and coalesce((e.props->>'similarity')::float8, 0) >= cfg.floor_v)

  union all
  -- problems with no product
  select 'problem_no_product', n.id, n.label,
    jsonb_build_object('node_type', n.type, 'weight', n.weight, 'merged_n', n.props->'merged_n')
  from kg_nodes n
  where n.type = 'problem'
    and coalesce((n.props->>'guardrail')::boolean, false) = false
    and coalesce((n.props->>'clustered')::boolean, true) = true
    and not exists (select 1 from kg_edges e where e.dst = n.id and e.type = 'addresses')
    and not exists (select 1 from kg_edges e where e.src = n.id and e.type = 'routes_to')

  union all
  -- problems with no content
  select 'problem_no_content', n.id, n.label,
    jsonb_build_object('node_type', n.type, 'weight', n.weight, 'merged_n', n.props->'merged_n')
  from kg_nodes n
  where n.type = 'problem'
    and coalesce((n.props->>'guardrail')::boolean, false) = false
    and coalesce((n.props->>'clustered')::boolean, true) = true
    and not exists (
      select 1 from kg_edges e join kg_nodes s on s.id = e.src
      where e.dst = n.id and s.type in ('deck', 'doc', 'spoke', 'cornerstone'))

  union all
  -- pillars with no audience voice in their problems
  select 'pillar_no_demand', p.id, p.label,
    jsonb_build_object(
      'node_type', p.type,
      'problems', (select count(*) from kg_edges b where b.dst = p.id and b.type = 'belongs_to_pillar'),
      'slug', p.props->>'slug')
  from kg_nodes p
  where p.type = 'pillar'
    and not exists (
      select 1
      from kg_edges b
      join kg_edges v on v.dst = b.src and v.type = 'voices'
      where b.dst = p.id and b.type = 'belongs_to_pillar');
$$;

revoke execute on function public.kg_gaps() from public, anon, authenticated;
grant execute on function public.kg_gaps() to service_role;

comment on function public.kg_gaps() is
  'Gap rows from the knowledge graph: weak-evidence claims/mechanisms (0.45 floor), problems with no product or content, pillars with no demand. Service role only.';

-- ---------------------------------------------------------------------
-- 5. brain_feedback: allow comments on graph nodes
-- ---------------------------------------------------------------------
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conrelid = 'public.brain_feedback'::regclass and conname = 'brain_feedback_target_type_check';

  if def is null or def not like '%''node''%' then
    if def is not null then
      alter table public.brain_feedback drop constraint brain_feedback_target_type_check;
    end if;
    alter table public.brain_feedback
      add constraint brain_feedback_target_type_check check (target_type in ('deck', 'slide', 'doc', 'node'));
  end if;
end $$;

notify pgrst, 'reload schema';
