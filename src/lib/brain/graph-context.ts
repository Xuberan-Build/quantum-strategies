/**
 * Knowledge graph reads for server code: content generators, the quiz and the admin graph API.
 *
 * SERVICE ROLE ONLY. kg_nodes / kg_edges / knowledge_chunks have no anon or authenticated access,
 * so these helpers use the service-role client and must never be imported into client components.
 * Every function takes an optional client so tests (and scripts) can pass their own.
 *
 * - getNodeContext(id, depth)    a node and its neighbourhood (breadth-first, both directions)
 * - getProblemContext(slug)      what a generator needs for one problem, in the audience's words:
 *                                top quotes, mechanism(s), supporting claims, evidence chunks, products,
 *                                the quiz route and the solution category
 */
import type { SupabaseClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/brain/graph-context.ts is server-only (service role)');
}

export const KG_NODES = 'kg_nodes';
export const KG_EDGES = 'kg_edges';

export interface KgNode {
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

export interface KgEdge {
  id?: number;
  src: string;
  dst: string;
  type: string;
  weight: number;
  props: Record<string, unknown>;
}

export interface NodeContext {
  node: KgNode | null;
  nodes: KgNode[];
  edges: KgEdge[];
  truncated: boolean;
}

export interface EvidenceChunk {
  chunk_id: string;
  source_id: string;
  source_label: string;
  similarity: number | null;
  tier: string | null;
  author: string | null;
  text_name: string | null;
  content: string;
  source_url: string | null;
  supports: string; // claim or mechanism id
}

export interface ProblemContext {
  problem: KgNode;
  quotes: KgNode[];
  mechanisms: KgNode[];
  claims: KgNode[];
  evidence: EvidenceChunk[];
  products: { node: KgNode; via: 'addresses' | 'routes_to'; props: Record<string, unknown> }[];
  quizRoute: { product: string; pattern: string | null; patternName: string | null } | null;
  solutions: KgNode[];
  tried: KgNode[];
  demand: { source: KgNode; similarity: number | null }[];
}

const NODE_COLUMNS = 'id,type,label,summary,props,source_path,url,weight,tier';
const EDGE_COLUMNS = 'id,src,dst,type,weight,props';

async function defaultClient(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import('@/lib/supabase/server');
  return supabaseAdmin;
}

async function nodesByIds(sb: SupabaseClient, ids: string[]): Promise<KgNode[]> {
  const out: KgNode[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from(KG_NODES).select(NODE_COLUMNS).in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`kg_nodes: ${error.message}`);
    out.push(...((data ?? []) as KgNode[]));
  }
  return out;
}

async function edgesTouching(sb: SupabaseClient, ids: string[], limit: number): Promise<KgEdge[]> {
  const out = new Map<number | string, KgEdge>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    for (const col of ['src', 'dst'] as const) {
      const { data, error } = await sb.from(KG_EDGES).select(EDGE_COLUMNS).in(col, chunk).order('weight', { ascending: false }).limit(limit);
      if (error) throw new Error(`kg_edges: ${error.message}`);
      for (const e of (data ?? []) as KgEdge[]) out.set(e.id ?? `${e.src}>${e.dst}>${e.type}`, e);
    }
  }
  return [...out.values()];
}

/**
 * A node plus everything within `depth` hops (edges in either direction). `maxNodes` caps the result;
 * when hit, the heaviest edges win and `truncated` is true.
 */
export async function getNodeContext(id: string, depth = 2, opts: { client?: SupabaseClient; maxNodes?: number; edgeTypes?: string[] } = {}): Promise<NodeContext> {
  const sb = opts.client ?? (await defaultClient());
  const maxNodes = opts.maxNodes ?? 300;
  const [root] = await nodesByIds(sb, [id]);
  if (!root) return { node: null, nodes: [], edges: [], truncated: false };
  const seen = new Set([id]);
  const edges = new Map<string, KgEdge>();
  let frontier = [id];
  let truncated = false;
  for (let d = 0; d < Math.max(0, depth) && frontier.length; d++) {
    let found = await edgesTouching(sb, frontier, maxNodes * 2);
    if (opts.edgeTypes?.length) found = found.filter((e) => opts.edgeTypes!.includes(e.type));
    found.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    const next: string[] = [];
    for (const e of found) {
      const other = seen.has(e.src) ? e.dst : e.src;
      if (!seen.has(other)) {
        if (seen.size >= maxNodes) {
          truncated = true;
          continue;
        }
        seen.add(other);
        next.push(other);
      }
      if (seen.has(e.src) && seen.has(e.dst)) edges.set(`${e.src}>${e.dst}>${e.type}`, e);
    }
    frontier = next;
  }
  const nodes = await nodesByIds(sb, [...seen]);
  return { node: root, nodes, edges: [...edges.values()], truncated };
}

/** Everything a generator or the quiz needs for one problem, in the audience's own words. */
export async function getProblemContext(problemSlug: string, opts: { client?: SupabaseClient; quotes?: number; chunksPerNode?: number } = {}): Promise<ProblemContext | null> {
  const sb = opts.client ?? (await defaultClient());
  const id = problemSlug.startsWith('problem:') ? problemSlug : `problem:${problemSlug}`;
  const [problem] = await nodesByIds(sb, [id]);
  if (!problem) return null;

  const { data: inData, error: inErr } = await sb.from(KG_EDGES).select(EDGE_COLUMNS).eq('dst', id).in('type', ['voices', 'explains', 'addresses', 'solves', 'evidences']);
  if (inErr) throw new Error(`kg_edges: ${inErr.message}`);
  const { data: outData, error: outErr } = await sb.from(KG_EDGES).select(EDGE_COLUMNS).eq('src', id).in('type', ['routes_to']);
  if (outErr) throw new Error(`kg_edges: ${outErr.message}`);
  const inbound = (inData ?? []) as KgEdge[];
  const outbound = (outData ?? []) as KgEdge[];

  const ofType = (t: string) => inbound.filter((e) => e.type === t);
  // Top quotes by weight (likes / score). Fetch more than needed, then sort.
  const voiceIds = ofType('voices').map((e) => e.src);
  const quoteNodes = (await nodesByIds(sb, voiceIds)).sort((a, b) => b.weight - a.weight).slice(0, opts.quotes ?? 12);

  const mechIds = ofType('explains').map((e) => e.src);
  const productEdges = [...ofType('addresses').map((e) => ({ id: e.src, via: 'addresses' as const, props: e.props })), ...outbound.map((e) => ({ id: e.dst, via: 'routes_to' as const, props: e.props }))];
  const solutionIds = ofType('solves').map((e) => e.src);
  const demandEdges = ofType('evidences');

  // Claims that support the mechanisms
  let claimEdges: KgEdge[] = [];
  if (mechIds.length) {
    const { data, error } = await sb.from(KG_EDGES).select(EDGE_COLUMNS).in('dst', mechIds).eq('type', 'supports');
    if (error) throw new Error(`kg_edges: ${error.message}`);
    claimEdges = ((data ?? []) as KgEdge[]).filter((e) => e.src.startsWith('claim:'));
  }
  const claimIds = [...new Set(claimEdges.map((e) => e.src))];

  // Evidence edges into the mechanisms and their claims
  const evidenceTargets = [...mechIds, ...claimIds];
  let evEdges: KgEdge[] = [];
  if (evidenceTargets.length) {
    const { data, error } = await sb.from(KG_EDGES).select(EDGE_COLUMNS).in('dst', evidenceTargets).eq('type', 'evidences').order('weight', { ascending: false });
    if (error) throw new Error(`kg_edges: ${error.message}`);
    evEdges = (data ?? []) as KgEdge[];
  }

  // Tried approaches named by the quotes
  let triedIds: string[] = [];
  if (voiceIds.length) {
    const { data, error } = await sb.from(KG_EDGES).select('src,dst').in('src', voiceIds.slice(0, 500)).eq('type', 'mentions').like('dst', 'solution_type:tried-%');
    if (error) throw new Error(`kg_edges: ${error.message}`);
    const counts = new Map<string, number>();
    for (const e of (data ?? []) as { dst: string }[]) counts.set(e.dst, (counts.get(e.dst) ?? 0) + 1);
    triedIds = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }

  const related = await nodesByIds(sb, [...new Set([...mechIds, ...claimIds, ...productEdges.map((p) => p.id), ...solutionIds, ...triedIds, ...evEdges.map((e) => e.src), ...demandEdges.map((e) => e.src)])]);
  const byId = new Map(related.map((n) => [n.id, n]));

  // Evidence chunks (via chunk ids on the evidences edges)
  const perNode = opts.chunksPerNode ?? 3;
  const wanted = evEdges.flatMap((e) => ((e.props.chunk_ids as string[]) ?? []).slice(0, perNode).map((cid, i) => ({ cid, e, sim: ((e.props.chunk_similarities as number[]) ?? [])[i] ?? (e.props.similarity as number) ?? null })));
  const chunkIds = [...new Set(wanted.map((w) => w.cid))];
  const chunks = new Map<string, { id: string; content: string; author: string | null; text_name: string | null; tier: string | null; source_url: string | null }>();
  for (let i = 0; i < chunkIds.length; i += 100) {
    const { data, error } = await sb.from('knowledge_chunks').select('id,content,author,text_name,tier,source_url').in('id', chunkIds.slice(i, i + 100));
    if (error) throw new Error(`knowledge_chunks: ${error.message}`);
    for (const c of data ?? []) chunks.set(c.id as string, c as never);
  }
  const evidence: EvidenceChunk[] = [];
  const seenChunk = new Set<string>();
  for (const w of wanted) {
    const c = chunks.get(w.cid);
    if (!c || seenChunk.has(w.cid)) continue;
    seenChunk.add(w.cid);
    evidence.push({
      chunk_id: w.cid,
      source_id: w.e.src,
      source_label: byId.get(w.e.src)?.label ?? w.e.src,
      similarity: w.sim,
      tier: c.tier,
      author: c.author,
      text_name: c.text_name,
      content: c.content,
      source_url: c.source_url,
      supports: w.e.dst,
    });
  }
  evidence.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  const route = outbound[0];
  return {
    problem,
    quotes: quoteNodes,
    mechanisms: mechIds.map((m) => byId.get(m)).filter((n): n is KgNode => !!n),
    claims: claimIds.map((c) => byId.get(c)).filter((n): n is KgNode => !!n).sort((a, b) => b.weight - a.weight),
    evidence,
    products: productEdges.map((p) => ({ node: byId.get(p.id)!, via: p.via, props: p.props })).filter((p) => !!p.node),
    quizRoute: route ? { product: route.dst, pattern: (route.props.pattern as string) ?? null, patternName: (route.props.pattern_name as string) ?? null } : null,
    solutions: solutionIds.map((s) => byId.get(s)).filter((n): n is KgNode => !!n),
    tried: triedIds.map((t) => byId.get(t)).filter((n): n is KgNode => !!n),
    demand: demandEdges.map((e) => ({ source: byId.get(e.src)!, similarity: (e.props.similarity as number) ?? null })).filter((d) => !!d.source),
  };
}
