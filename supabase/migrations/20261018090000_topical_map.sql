-- Topical map on the knowledge graph (scripts/brain/build-topical-map.ts). Additive and idempotent.
-- Touches no existing rows.
--
-- 1. kg_nodes.type gains 'topic' and 'query'; kg_edges.type gains 'asks_about', 'covered_by', 'competes_on'.
--    The CHECK constraints from 20261017170000_knowledge_graph.sql (kg_nodes_type_check, kg_edges_type_check)
--    are replaced with supersets, only when the new value is missing, so re-running is a no-op.
-- 2. topical_map_queue(): topics with low coverage, by priority (what to make next). Service role only.

do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conrelid = 'public.kg_nodes'::regclass and conname = 'kg_nodes_type_check';

  if def is null or def not like '%''topic''%' or def not like '%''query''%' then
    if def is not null then
      alter table public.kg_nodes drop constraint kg_nodes_type_check;
    end if;
    alter table public.kg_nodes add constraint kg_nodes_type_check check (type in (
      'note', 'pillar', 'sub_pillar', 'cluster', 'cornerstone', 'spoke', 'problem', 'quote', 'source',
      'community', 'creator', 'claim', 'mechanism', 'solution_type', 'product', 'rite', 'decision',
      'principle', 'deck', 'doc', 'corpus_source', 'segment',
      'topic', 'query'));
  end if;

  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conrelid = 'public.kg_edges'::regclass and conname = 'kg_edges_type_check';

  if def is null or def not like '%''asks_about''%' or def not like '%''covered_by''%' or def not like '%''competes_on''%' then
    if def is not null then
      alter table public.kg_edges drop constraint kg_edges_type_check;
    end if;
    alter table public.kg_edges add constraint kg_edges_type_check check (type in (
      'links_to', 'part_of', 'mentions', 'voices', 'from_source', 'in_community', 'evidences',
      'supports', 'contradicts', 'explains', 'solves', 'addresses', 'routes_to', 'belongs_to_pillar',
      'decided_in', 'feedback_on',
      'asks_about', 'covered_by', 'competes_on'));
  end if;
end $$;

-- Topic nodes are read by level (props->>'level'); a small expression index keeps the queue cheap.
create index if not exists kg_nodes_topic_level_idx
  on public.kg_nodes ((props->>'level'))
  where type = 'topic';

-- ---------------------------------------------------------------------
-- Content queue: topics (level 'topic') whose coverage is under max_coverage, highest priority first.
-- Guardrail topics (props.stance = 'guardrail') are never queued.
-- top_queries: the five strongest queries asking about the topic or its subtopics
-- ([{text, signal, sources}]), falling back to props.top_queries when no query edges exist.
-- ---------------------------------------------------------------------
create or replace function public.topical_map_queue(max_coverage numeric default 40, max_rows integer default 100)
returns table (
  id text,
  label text,
  pillar_code text,
  priority numeric,
  demand numeric,
  proof numeric,
  coverage numeric,
  status text,
  top_queries jsonb
)
language sql
stable
set search_path = public
as $$
  with topics as (
    select n.id, n.label, n.props
    from kg_nodes n
    where n.type = 'topic'
      and n.props->>'level' = 'topic'
      and coalesce(n.props->>'stance', '') <> 'guardrail'
      and coalesce((n.props->'scores'->>'coverage')::numeric, 0) < max_coverage
  )
  select
    t.id,
    t.label,
    t.props->>'pillar_code',
    coalesce((t.props->'scores'->>'priority')::numeric, 0),
    coalesce((t.props->'scores'->>'demand')::numeric, 0),
    coalesce((t.props->'scores'->>'proof')::numeric, 0),
    coalesce((t.props->'scores'->>'coverage')::numeric, 0),
    t.props->>'status',
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('text', q.text, 'signal', q.signal, 'sources', q.sources) order by q.signal desc)
        from (
          select d.text, d.signal, d.sources
          from (
            select distinct on (qn.id)
              coalesce(qn.props->>'text', qn.label) as text,
              coalesce((qn.props->>'signal')::numeric, qn.weight::numeric) as signal,
              qn.props->'sources' as sources
            from kg_edges e
            join kg_nodes qn on qn.id = e.src and qn.type = 'query'
            where e.type = 'asks_about'
              and (e.dst = t.id
                   or e.dst in (select s.id from kg_nodes s where s.type = 'topic' and s.props->>'parent' = t.id))
            order by qn.id
          ) d
          where d.signal is not null
          order by d.signal desc
          limit 5
        ) q
      ),
      (select jsonb_agg(y.x) from (select x from jsonb_array_elements(coalesce(t.props->'top_queries', '[]'::jsonb)) as x limit 5) y),
      '[]'::jsonb
    )
  from topics t
  order by coalesce((t.props->'scores'->>'priority')::numeric, 0) desc,
           coalesce((t.props->'scores'->>'demand')::numeric, 0) desc,
           t.id
  limit greatest(0, max_rows);
$$;

revoke execute on function public.topical_map_queue(numeric, integer) from public, anon, authenticated;
grant execute on function public.topical_map_queue(numeric, integer) to service_role;

comment on function public.topical_map_queue(numeric, integer) is
  'Topical map content queue: topics under max_coverage (default 40) coverage, by priority, with their top 5 queries. Built by scripts/brain/build-topical-map.ts. Service role only.';

notify pgrst, 'reload schema';
