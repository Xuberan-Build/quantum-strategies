/**
 * Server data helpers for the knowledge graph. Pass a service-role client, only after
 * the admin check. kg_nodes.embedding is never selected.
 *
 * PostgREST caps a response at 1000 rows by default, so lists are paged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GRAPH_EDGE_CAP,
  KG_EDGES_TABLE,
  KG_NODES_TABLE,
  type EvidenceExcerpt,
  type GapRow,
  type GraphEdge,
  type GraphNode,
  type GraphQuery,
  type NeighbourLink,
  type NodeDetail,
  type NodeFull,
  type QuoteItem,
  truncate,
  withDegree,
} from './graph';

const PAGE = 1000;
const PARALLEL = 6;

export const NODE_LITE_COLUMNS = 'id, type, label, weight, tier';
export const NODE_FULL_COLUMNS = 'id, type, label, summary, props, source_path, url, weight, tier, built_at';
export const EDGE_LITE_COLUMNS = 'src, dst, type, weight';
export const EDGE_FULL_COLUMNS = 'id, src, dst, type, weight, props';
export const CHUNK_COLUMNS = 'id, content, text_name, tier, author, source_url';

export class GraphDataError extends Error {}

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : v == null ? null : String(v));

/* ---------------------------------------------------------------- full graph */

export async function loadGraph(client: SupabaseClient, q: GraphQuery) {
  // Nodes: heaviest first, paged up to the limit.
  const nodeRows: Row[] = [];
  for (let from = 0; from < q.limit; from += PAGE) {
    const to = Math.min(from + PAGE, q.limit) - 1;
    let query = client.from(KG_NODES_TABLE).select(NODE_LITE_COLUMNS);
    if (q.types.length) query = query.in('type', q.types);
    if (q.minWeight !== null) query = query.gte('weight', q.minWeight);
    const { data, error } = await query.order('weight', { ascending: false, nullsFirst: false }).order('id').range(from, to);
    if (error) throw new GraphDataError(error.message);
    const rows = (data ?? []) as Row[];
    nodeRows.push(...rows);
    if (rows.length < to - from + 1) break;
  }

  // Edges: count, then fetch pages in small parallel batches.
  const edgeQuery = () => {
    let query = client.from(KG_EDGES_TABLE).select(EDGE_LITE_COLUMNS);
    if (q.edgeTypes.length) query = query.in('type', q.edgeTypes);
    return query;
  };
  let countQuery = client.from(KG_EDGES_TABLE).select('src', { count: 'exact', head: true });
  if (q.edgeTypes.length) countQuery = countQuery.in('type', q.edgeTypes);
  const { count, error: countError } = await countQuery;
  if (countError) throw new GraphDataError(countError.message);
  const total = Math.min(count ?? 0, GRAPH_EDGE_CAP);
  const edgeRows: Row[] = [];
  const offsets: number[] = [];
  for (let from = 0; from < total; from += PAGE) offsets.push(from);
  for (let i = 0; i < offsets.length; i += PARALLEL) {
    const batch = await Promise.all(
      offsets.slice(i, i + PARALLEL).map((from) => edgeQuery().order('id').range(from, Math.min(from + PAGE, total) - 1)),
    );
    for (const { data, error } of batch) {
      if (error) throw new GraphDataError(error.message);
      edgeRows.push(...((data ?? []) as Row[]));
    }
  }

  const nodes = nodeRows.map((r) => ({
    id: String(r.id),
    type: String(r.type),
    label: str(r.label) || String(r.id),
    weight: num(r.weight),
    tier: str(r.tier),
  }));
  const edges: GraphEdge[] = edgeRows.map((r) => ({ src: String(r.src), dst: String(r.dst), type: String(r.type), weight: num(r.weight) }));
  const g = withDegree(nodes, edges);
  return {
    nodes: g.nodes as GraphNode[],
    edges: g.edges,
    truncated: { nodes: nodeRows.length >= q.limit, edges: (count ?? 0) > GRAPH_EDGE_CAP },
  };
}

/* ---------------------------------------------------------------- one node */

const chunkIdsOf = (props: unknown): string[] => {
  const ids = (props as { chunk_ids?: unknown } | null)?.chunk_ids;
  return Array.isArray(ids) ? ids.map((x) => String(x)).filter((x) => x && x.length <= 80) : [];
};

const similarityOf = (props: unknown): number | null => num((props as { similarity?: unknown } | null)?.similarity);

async function inChunks<T>(ids: string[], size: number, fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await fetch(ids.slice(i, i + size))));
  return out;
}

export interface NodeDetailOptions {
  /** brain-relative path → published doc slug */
  docSlugForPath?: (path: string) => Promise<string | null>;
  maxEvidence?: number;
  maxQuotes?: number;
}

export async function loadNodeDetail(client: SupabaseClient, id: string, opts: NodeDetailOptions = {}): Promise<NodeDetail | null> {
  const { data: nodeRow, error } = await client.from(KG_NODES_TABLE).select(NODE_FULL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new GraphDataError(error.message);
  if (!nodeRow) return null;
  const r = nodeRow as Row;
  const node: NodeFull = {
    id: String(r.id),
    type: String(r.type),
    label: str(r.label) || String(r.id),
    summary: str(r.summary),
    props: r.props && typeof r.props === 'object' ? (r.props as Record<string, unknown>) : null,
    source_path: str(r.source_path),
    url: str(r.url),
    weight: num(r.weight),
    tier: str(r.tier),
    built_at: str(r.built_at),
  };

  const [outRes, inRes] = await Promise.all([
    client.from(KG_EDGES_TABLE).select(EDGE_FULL_COLUMNS).eq('src', id).order('weight', { ascending: false, nullsFirst: false }).limit(1000),
    client.from(KG_EDGES_TABLE).select(EDGE_FULL_COLUMNS).eq('dst', id).order('weight', { ascending: false, nullsFirst: false }).limit(1000),
  ]);
  if (outRes.error) throw new GraphDataError(outRes.error.message);
  if (inRes.error) throw new GraphDataError(inRes.error.message);
  const outEdges = (outRes.data ?? []) as Row[];
  const inEdges = (inRes.data ?? []) as Row[];

  const neighbourIds = [...new Set([...outEdges.map((e) => String(e.dst)), ...inEdges.map((e) => String(e.src))])];
  const neighbours = new Map<string, Row>();
  const nRows = await inChunks(neighbourIds, 200, async (chunk) => {
    const { data, error: nErr } = await client.from(KG_NODES_TABLE).select(`${NODE_LITE_COLUMNS}, summary, props, url`).in('id', chunk);
    if (nErr) throw new GraphDataError(nErr.message);
    return (data ?? []) as Row[];
  });
  for (const n of nRows) neighbours.set(String(n.id), n);

  const toLink = (e: Row, direction: 'out' | 'in'): NeighbourLink => {
    const otherId = String(direction === 'out' ? e.dst : e.src);
    const other = neighbours.get(otherId);
    return {
      edgeType: String(e.type),
      direction,
      weight: num(e.weight),
      id: otherId,
      label: str(other?.label) || otherId,
      type: str(other?.type) || otherId.split(':')[0],
      tier: str(other?.tier),
      similarity: similarityOf(e.props),
    };
  };
  const outgoing = outEdges.map((e) => toLink(e, 'out'));
  const incoming = inEdges.map((e) => toLink(e, 'in'));

  // Corpus excerpts behind evidences edges (either direction).
  const evidenceEdges = [...outEdges.map((e) => ({ e, dir: 'out' as const })), ...inEdges.map((e) => ({ e, dir: 'in' as const }))].filter(
    ({ e }) => e.type === 'evidences',
  );
  const maxEvidence = opts.maxEvidence ?? 24;
  const wanted: { chunkId: string; via: string; similarity: number | null }[] = [];
  for (const { e, dir } of evidenceEdges) {
    for (const chunkId of chunkIdsOf(e.props)) {
      if (wanted.length >= maxEvidence) break;
      wanted.push({ chunkId, via: String(dir === 'out' ? e.dst : e.src), similarity: similarityOf(e.props) });
    }
  }
  let evidence: EvidenceExcerpt[] = [];
  if (wanted.length) {
    const { data: chunks, error: cErr } = await client
      .from('knowledge_chunks')
      .select(CHUNK_COLUMNS)
      .in('id', [...new Set(wanted.map((w) => w.chunkId))]);
    if (cErr) {
      console.error('[brain graph] chunk lookup failed:', cErr.message);
    } else {
      const byId = new Map(((chunks ?? []) as Row[]).map((c) => [String(c.id), c]));
      evidence = wanted
        .filter((w) => byId.has(w.chunkId))
        .map((w) => {
          const c = byId.get(w.chunkId)!;
          return {
            chunkId: w.chunkId,
            viaId: w.via,
            viaLabel: str(neighbours.get(w.via)?.label) || w.via,
            similarity: w.similarity,
            excerpt: truncate(str(c.content) ?? '', 400),
            sourceTitle: str(c.text_name),
            author: str(c.author),
            tier: str(c.tier),
            sourceUrl: str(c.source_url),
          };
        })
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    }
  }

  // Problems: the loudest quotes that voice them.
  let quotes: QuoteItem[] = [];
  if (node.type === 'problem') {
    quotes = neighbourIds
      .map((nid) => neighbours.get(nid))
      .filter((n): n is Row => !!n && n.type === 'quote')
      .map((q) => {
        const props = (q.props ?? {}) as Record<string, unknown>;
        return {
          id: String(q.id),
          label: str(q.label) || String(q.id),
          text: str(props.text) ?? str(q.summary),
          weight: num(q.weight),
          likes: num(props.likes),
          url: str(q.url),
        };
      })
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.likes ?? 0) - (a.likes ?? 0))
      .slice(0, opts.maxQuotes ?? 10);
  }

  let docHref: string | null = null;
  if (node.source_path && opts.docSlugForPath) {
    const slug = await opts.docSlugForPath(node.source_path).catch(() => null);
    if (slug) docHref = `/admin/brain/docs/${slug}`;
  }

  return { node, outgoing, incoming, evidence, quotes, docHref };
}

/* ---------------------------------------------------------------- gaps */

/** kg_gaps() rows; `available: false` when the function is missing or fails. */
export async function loadGaps(client: SupabaseClient): Promise<{ rows: GapRow[]; available: boolean }> {
  const { data, error } = await client.rpc('kg_gaps');
  if (error) return { rows: [], available: false };
  const rows = ((data ?? []) as Row[])
    .filter((r) => r && r.node_id != null)
    .map((r) => ({ kind: String(r.kind ?? 'gap'), node_id: String(r.node_id), label: str(r.label), detail: str(r.detail) }));
  return { rows, available: true };
}

/** Cheap probe: can kg_nodes be read at all? */
export async function graphTablesReachable(client: SupabaseClient): Promise<boolean> {
  const { error } = await client.from(KG_NODES_TABLE).select('id', { head: true, count: 'exact' }).limit(1);
  return !error;
}
