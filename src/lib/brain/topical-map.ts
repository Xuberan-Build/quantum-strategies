/**
 * Topical map reads for server code (the admin topical map UI and its API routes).
 *
 * SERVICE ROLE ONLY. The map lives in kg_nodes (type 'topic' / 'query') and kg_edges, which have no anon or
 * authenticated access. Never import this into a client component. Every function takes an optional client so
 * tests (and scripts) can pass their own.
 *
 * - getTopicalMap()        the whole tree with scores (pillar -> section -> topic -> subtopic)
 * - getTopic(id)           one node's scorecard (any level): queries, problems + top quotes, claims + evidence,
 *                          assets, competitors, products, queue position
 * - getTopicalQueue(n)     topics with low coverage, by priority (what to make next)
 *
 * Written by scripts/brain/build-topical-map.ts (source of truth: brain/content/topical-map.json).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  QUEUE_MAX_COVERAGE,
  TOPIC_LEVELS,
  type PillarCode,
  type TopicAsset,
  type TopicEvidence,
  type TopicIntent,
  type TopicLevel,
  type TopicNode,
  type TopicQuery,
  type TopicScores,
  type TopicStatus,
  type TopicalMap,
} from './topical-map-types';

export type { TopicNode, TopicalMap, TopicQuery, TopicScores, TopicLevel, TopicStatus, PillarCode } from './topical-map-types';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/brain/topical-map.ts is server-only (service role)');
}

const NODES = 'kg_nodes';
const EDGES = 'kg_edges';
const NODE_COLUMNS = 'id,type,label,summary,props,source_path,url,weight,tier';
const EDGE_COLUMNS = 'id,src,dst,type,weight,props';
const SITE = 'https://quantumstrategies.online';

interface Row {
  id: string;
  type: string;
  label: string;
  summary: string | null;
  props: Record<string, unknown>;
  source_path: string | null;
  url: string | null;
  weight: number;
  tier: string | null;
}
interface EdgeRow {
  id?: number;
  src: string;
  dst: string;
  type: string;
  weight: number;
  props: Record<string, unknown>;
}

export interface TopicQueueRow {
  id: string;
  label: string;
  pillarCode: PillarCode;
  priority: number;
  demand: number;
  proof: number;
  coverage: number;
  status: TopicStatus;
  topQueries: string[];
}

export interface ScorecardAsset {
  kind: string;
  ref: string;
  status: TopicStatus;
  label?: string;
  /** a local /admin path or an http(s) URL */
  href?: string;
  /** the architecture's own status (REFRESH, MERGE, internal, ...) when it differs */
  detail?: string;
}

export interface ScorecardQuote {
  text: string;
  likes: number;
  source: string | null;
  url: string | null;
}

export interface ScorecardProblem {
  id: string;
  label: string;
  share: number | null;
  quoteCount: number | null;
  quotes: ScorecardQuote[];
}

export interface ScorecardEvidence {
  chunkId: string;
  source: string;
  similarity: number | null;
  tier: string | null;
  content: string;
  url: string | null;
}

export interface ScorecardClaim {
  id: string;
  label: string;
  tier: string | null;
  strength: string | null;
  similarity: number | null;
  via: string | null;
  evidence: ScorecardEvidence[];
}

export interface ScorecardCompetitor {
  /** landscape channel id (UC...) */
  id: string;
  creatorId: string;
  label: string;
  weight: number;
  outlier: number | null;
  via: string | null;
  url: string | null;
}

export interface ScorecardProduct {
  id: string;
  label: string;
  status: string | null;
  fit: number | null;
  via: string | null;
}

export interface TopicScorecard {
  topic: TopicNode;
  breadcrumb: { id: string; label: string; level: TopicLevel }[];
  children: TopicNode[];
  queries: TopicQuery[];
  problems: ScorecardProblem[];
  claims: ScorecardClaim[];
  /** the topic's own best corpus match (not via a claim), when the builder found one */
  evidence: TopicEvidence[];
  assets: ScorecardAsset[];
  competitors: ScorecardCompetitor[];
  products: ScorecardProduct[];
  queue: { position: number | null; size: number };
}

async function defaultClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  return supabaseAdmin;
}

const PILLARS = new Set(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'SPINE']);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** kg_nodes row (type 'topic') -> TopicNode. Tolerant of missing props. */
export function rowToTopic(r: Row): TopicNode {
  const p = r.props ?? {};
  const s = (p.scores ?? {}) as Partial<TopicScores>;
  const level = (TOPIC_LEVELS as readonly string[]).includes(String(p.level)) ? (p.level as TopicLevel) : 'topic';
  const pc = String(p.pillar_code ?? '');
  return {
    id: r.id,
    level,
    label: r.label,
    parent: str(p.parent),
    pillarCode: (PILLARS.has(pc) ? pc : 'SPINE') as PillarCode,
    intent: (str(p.intent) ?? 'informational') as TopicIntent,
    summary: r.summary ?? '',
    mapsTo: (p.maps_to ?? {}) as TopicNode['mapsTo'],
    queries: Array.isArray(p.top_queries) ? (p.top_queries as TopicQuery[]) : [],
    scores: {
      demand: num(s.demand),
      proof: num(s.proof),
      coverage: num(s.coverage),
      competition: num(s.competition),
      productFit: num(s.productFit),
      priority: num(s.priority),
      ...(typeof s.searchDemand === 'number' ? { searchDemand: s.searchDemand } : {}),
      ...(typeof s.audienceDemand === 'number' ? { audienceDemand: s.audienceDemand } : {}),
    },
    status: (['LIVE', 'BUILT', 'TO BUILD', 'NONE'].includes(String(p.status)) ? p.status : 'NONE') as TopicStatus,
    assets: Array.isArray(p.assets) ? (p.assets as TopicAsset[]) : [],
    competitors: Array.isArray(p.competitors) ? (p.competitors as string[]) : [],
    notes: str(p.notes) ?? '',
    origin: (str(p.origin) ?? 'architecture') as TopicNode['origin'],
    stance: (str(p.stance) ?? undefined) as TopicNode['stance'],
    reasons: (p.reasons ?? {}) as TopicNode['reasons'],
    evidence: Array.isArray(p.evidence) ? (p.evidence as TopicEvidence[]) : [],
    audienceWords: Array.isArray(p.audience_words) ? (p.audience_words as string[]) : [],
    queueRank: typeof p.queue_rank === 'number' ? p.queue_rank : null,
    // Keyword Planner split (absent on maps built without --keyword-planner)
    ...(typeof p.search_volume === 'number'
      ? {
          searchVolume: p.search_volume,
          searchTrend: (p.search_trend ?? undefined) as TopicNode['searchTrend'],
          commercial: (p.commercial ?? undefined) as TopicNode['commercial'],
          searchTerms: Array.isArray(p.search_terms) ? (p.search_terms as NonNullable<TopicNode['searchTerms']>) : [],
          channelFit: (p.channel_fit ?? undefined) as TopicNode['channelFit'],
          headTerm: (p.head_term ?? null) as TopicNode['headTerm'],
        }
      : {}),
    ...(p.audience && typeof p.audience === 'object' ? { audience: p.audience as TopicNode['audience'] } : {}),
  };
}

async function allTopicRows(sb: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from(NODES).select(NODE_COLUMNS).eq('type', 'topic').order('id', { ascending: true }).range(from, from + page - 1);
    if (error) throw new Error(`kg_nodes: ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

async function nodesByIds(sb: SupabaseClient, ids: string[]): Promise<Row[]> {
  const out: Row[] = [];
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 200) {
    const { data, error } = await sb.from(NODES).select(NODE_COLUMNS).in('id', uniq.slice(i, i + 200));
    if (error) throw new Error(`kg_nodes: ${error.message}`);
    out.push(...((data ?? []) as Row[]));
  }
  return out;
}

async function edgesWhere(sb: SupabaseClient, col: 'src' | 'dst', ids: string[], types: string[]): Promise<EdgeRow[]> {
  if (!ids.length) return [];
  const out: EdgeRow[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await sb.from(EDGES).select(EDGE_COLUMNS).in(col, ids.slice(i, i + 100)).in('type', types);
    if (error) throw new Error(`kg_edges: ${error.message}`);
    out.push(...((data ?? []) as EdgeRow[]));
  }
  return out;
}

/** Tree order: pillars by code, then depth-first, children by priority. */
function treeOrder(nodes: TopicNode[]): TopicNode[] {
  const kids = new Map<string | null, TopicNode[]>();
  for (const n of nodes) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  const pillarRank = (n: TopicNode) => (n.pillarCode === 'SPINE' ? 99 : Number(n.pillarCode.slice(1)));
  const out: TopicNode[] = [];
  const seen = new Set<string>();
  const walk = (id: string | null) => {
    const list = [...(kids.get(id) ?? [])].sort((a, b) => (id === null ? pillarRank(a) - pillarRank(b) : a.level === 'subtopic' ? b.scores.priority - a.scores.priority : 0) || a.id.localeCompare(b.id));
    for (const k of list) {
      if (seen.has(k.id)) continue;
      seen.add(k.id);
      out.push(k);
      walk(k.id);
    }
  };
  walk(null);
  // orphans (parent missing) go last so nothing disappears
  for (const n of nodes) if (!seen.has(n.id)) out.push(n);
  return out;
}

export async function getTopicalMap(opts: { client?: SupabaseClient } = {}): Promise<TopicalMap> {
  const sb = opts.client ?? (await defaultClient());
  const rows = await allTopicRows(sb);
  const nodes = treeOrder(rows.map(rowToTopic));
  const metaRow = rows.find((r) => r.props?.map_meta);
  const meta = (metaRow?.props?.map_meta ?? {}) as Partial<TopicalMap> & { meta?: Record<string, unknown> };
  return {
    version: num(meta.version, 1),
    centralEntity: meta.centralEntity ?? { label: '', definition: '' },
    sourceContext: meta.sourceContext ?? '',
    generatedAt: meta.generatedAt ?? '',
    levels: [...TOPIC_LEVELS],
    nodes,
    meta: meta.meta,
  };
}

/** Topics (level 'topic') under QUEUE_MAX_COVERAGE coverage, by priority. Guardrail topics are never queued. */
export function queueFrom(nodes: TopicNode[], maxCoverage = QUEUE_MAX_COVERAGE): TopicNode[] {
  return nodes
    .filter((n) => n.level === 'topic' && n.scores.coverage < maxCoverage && n.stance !== 'guardrail')
    .sort((a, b) => b.scores.priority - a.scores.priority || b.scores.demand - a.scores.demand || a.id.localeCompare(b.id));
}

export async function getTopicalQueue(limit = 20, opts: { client?: SupabaseClient; maxCoverage?: number } = {}): Promise<TopicQueueRow[]> {
  const map = await getTopicalMap(opts);
  return queueFrom(map.nodes, opts.maxCoverage)
    .slice(0, Math.max(0, limit))
    .map((n) => ({
      id: n.id,
      label: n.label,
      pillarCode: n.pillarCode,
      priority: n.scores.priority,
      demand: n.scores.demand,
      proof: n.scores.proof,
      coverage: n.scores.coverage,
      status: n.status,
      topQueries: n.queries.slice(0, 5).map((q) => q.text),
    }));
}

/** Normalise an asset's status to the four map statuses and give it a link. */
export function scorecardAsset(a: TopicAsset): ScorecardAsset {
  const raw = a.status;
  const status: TopicStatus = raw === 'TO BUILD' ? 'TO BUILD' : raw === 'BUILT' ? 'BUILT' : raw === 'NONE' ? 'NONE' : 'LIVE';
  let href: string | undefined;
  const [kind, ...rest] = a.ref.split(':');
  const slug = rest.join(':');
  if (kind === 'deck') href = `/admin/brain/deck/${encodeURIComponent(slug)}`;
  else if (kind === 'doc') href = `/admin/brain/docs/${encodeURIComponent(slug)}`;
  else if (kind === 'content_post') href = `${SITE}/articles/${encodeURIComponent(slug)}`;
  else if (kind === 'cornerstone' || kind === 'spoke') href = `/admin/brain/graph?node=${encodeURIComponent(a.ref)}`;
  return { kind: a.kind, ref: a.ref, status, label: a.label, href, detail: raw !== status ? raw : undefined };
}

export async function getTopic(id: string, opts: { client?: SupabaseClient; quotesPerProblem?: number; chunksPerClaim?: number } = {}): Promise<TopicScorecard | null> {
  const sb = opts.client ?? (await defaultClient());
  if (!/^topic:[a-z0-9][a-z0-9-]{0,119}$/.test(id)) return null;
  const all = (await allTopicRows(sb)).map(rowToTopic);
  const byId = new Map(all.map((n) => [n.id, n]));
  const topic = byId.get(id);
  if (!topic) return null;

  const breadcrumb: TopicScorecard['breadcrumb'] = [];
  for (let p = topic.parent ? byId.get(topic.parent) : undefined, guard = 0; p && guard < 6; p = p.parent ? byId.get(p.parent) : undefined, guard++) breadcrumb.unshift({ id: p.id, label: p.label, level: p.level });
  const children = all.filter((n) => n.parent === id).sort((a, b) => b.scores.priority - a.scores.priority);

  const inbound = await edgesWhere(sb, 'dst', [id], ['asks_about', 'mentions', 'supports', 'competes_on']);
  const outbound = await edgesWhere(sb, 'src', [id], ['routes_to', 'covered_by']);

  // queries
  const qEdges = inbound.filter((e) => e.type === 'asks_about');
  const qNodes = await nodesByIds(sb, qEdges.map((e) => e.src));
  let queries: TopicQuery[] = qNodes
    .map((q) => ({ text: str(q.props?.text) ?? q.label, sources: (q.props?.sources as TopicQuery['sources']) ?? [], signal: num(q.props?.signal, q.weight) }))
    .sort((a, b) => b.signal - a.signal);
  const seenQ = new Set(queries.map((q) => q.text));
  for (const q of topic.queries) if (!seenQ.has(q.text)) queries.push(q);
  queries = queries.sort((a, b) => b.signal - a.signal);

  // problems + quotes
  const probEdges = inbound.filter((e) => e.type === 'mentions' && e.src.startsWith('problem:'));
  const probIds = [...new Set([...probEdges.map((e) => e.src), ...(topic.mapsTo.problems ?? [])])];
  const probNodes = await nodesByIds(sb, probIds);
  const voices = await edgesWhere(sb, 'dst', probIds, ['voices']);
  const quoteNodes = await nodesByIds(sb, voices.map((v) => v.src));
  const quoteById = new Map(quoteNodes.map((q) => [q.id, q]));
  const problems: ScorecardProblem[] = probNodes
    .map((p) => {
      const e = probEdges.find((x) => x.src === p.id);
      const quotes = voices
        .filter((v) => v.dst === p.id)
        .map((v) => quoteById.get(v.src))
        .filter((q): q is Row => !!q)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, opts.quotesPerProblem ?? 3)
        .map((q) => ({ text: str(q.props?.text) ?? q.label, likes: num(q.props?.likes, q.weight), source: str(q.props?.source_kind), url: q.url }));
      return { id: p.id, label: p.label, share: e ? num(e.props?.share, e.weight) : null, quoteCount: typeof p.props?.quote_count === 'number' ? (p.props.quote_count as number) : null, quotes };
    })
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0));

  // claims + evidence chunks
  const claimEdges = inbound.filter((e) => e.type === 'supports' && e.src.startsWith('claim:'));
  const claimIds = [...new Set([...claimEdges.map((e) => e.src), ...(topic.mapsTo.claims ?? [])])];
  const claimNodes = await nodesByIds(sb, claimIds);
  const ev = await edgesWhere(sb, 'dst', claimIds, ['evidences']);
  const perClaim = opts.chunksPerClaim ?? 2;
  const chunkIds = [...new Set(ev.flatMap((e) => ((e.props?.chunk_ids as string[]) ?? []).slice(0, perClaim)))];
  const chunks = new Map<string, { id: string; content: string; tier: string | null; source_url: string | null }>();
  for (let i = 0; i < chunkIds.length; i += 100) {
    const { data, error } = await sb.from('knowledge_chunks').select('id,content,tier,source_url').in('id', chunkIds.slice(i, i + 100));
    if (error) throw new Error(`knowledge_chunks: ${error.message}`);
    for (const c of (data ?? []) as { id: string; content: string; tier: string | null; source_url: string | null }[]) chunks.set(c.id, c);
  }
  const srcNodes = new Map((await nodesByIds(sb, ev.map((e) => e.src))).map((n) => [n.id, n]));
  const claims: ScorecardClaim[] = claimNodes
    .filter((c) => c.props?.kind !== 'will_not_say')
    .map((c) => {
      const e = claimEdges.find((x) => x.src === c.id);
      const cev = ev.filter((x) => x.dst === c.id).sort((a, b) => num(b.props?.similarity) - num(a.props?.similarity));
      const evidence: ScorecardEvidence[] = cev.flatMap((x) =>
        ((x.props?.chunk_ids as string[]) ?? []).slice(0, perClaim).flatMap((cid, i) => {
          const ch = chunks.get(cid);
          if (!ch) return [];
          return [{ chunkId: cid, source: srcNodes.get(x.src)?.label ?? x.src, similarity: ((x.props?.chunk_similarities as number[]) ?? [])[i] ?? num(x.props?.similarity, 0), tier: ch.tier, content: ch.content, url: ch.source_url }];
        }),
      );
      const best = cev[0] ? num(cev[0].props?.similarity, 0) : typeof c.props?.best_similarity === 'number' ? (c.props.best_similarity as number) : null;
      return { id: c.id, label: c.label, tier: c.tier, strength: str(c.props?.strength), similarity: best, via: e ? str(e.props?.via) : 'maps_to', evidence };
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  // assets: from the node (keeps planned pieces) + covered_by edges not already listed
  const assets = topic.assets.map(scorecardAsset);
  const refs = new Set(assets.map((a) => a.ref));
  const coverNodes = new Map((await nodesByIds(sb, outbound.filter((e) => e.type === 'covered_by' && !refs.has(e.dst)).map((e) => e.dst))).map((n) => [n.id, n]));
  for (const e of outbound.filter((x) => x.type === 'covered_by' && !refs.has(x.dst))) {
    assets.push(scorecardAsset({ kind: e.dst.split(':')[0], ref: e.dst, status: str(e.props?.status) ?? 'LIVE', label: coverNodes.get(e.dst)?.label }));
  }

  // competitors
  const compEdges = inbound.filter((e) => e.type === 'competes_on');
  const creators = new Map((await nodesByIds(sb, compEdges.map((e) => e.src))).map((n) => [n.id, n]));
  const competitors: ScorecardCompetitor[] = compEdges
    .map((e) => {
      const c = creators.get(e.src);
      const channel = str(e.props?.channel_id) ?? str(c?.props?.channel_id) ?? e.src;
      return { id: channel, creatorId: e.src, label: c?.label ?? e.src.replace(/^creator:/, ''), weight: e.weight, outlier: typeof e.props?.outlier === 'number' ? (e.props.outlier as number) : null, via: str(e.props?.via), url: c?.url ?? (channel.startsWith('UC') ? `https://www.youtube.com/channel/${channel}` : null) };
    })
    .sort((a, b) => b.weight - a.weight);

  // products
  const prodEdges = outbound.filter((e) => e.type === 'routes_to');
  const prodIds = [...new Set([...prodEdges.map((e) => e.dst), ...(topic.mapsTo.products ?? [])])];
  const prodNodes = await nodesByIds(sb, prodIds);
  const products: ScorecardProduct[] = prodNodes
    .map((p) => {
      const e = prodEdges.find((x) => x.dst === p.id);
      return { id: p.id, label: p.label, status: str(p.props?.status), fit: e ? num(e.props?.fit, e.weight) : null, via: e ? str(e.props?.via) : null };
    })
    .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));

  const queue = queueFrom(all);
  const pos = queue.findIndex((n) => n.id === id);
  return {
    topic: { ...topic, queries },
    breadcrumb,
    children,
    queries,
    problems,
    claims,
    evidence: (topic.evidence ?? []).filter((x) => !x.claim),
    assets,
    competitors,
    products,
    queue: { position: pos >= 0 ? pos + 1 : null, size: queue.length },
  };
}
