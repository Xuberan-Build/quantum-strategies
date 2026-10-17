/**
 * Knowledge graph (kg_nodes / kg_edges) for /admin/brain/graph.
 *
 * Client-safe, pure module: the node/edge vocabulary, payload types, id validation,
 * query parsing, degree + neighbourhood helpers and the type palette. No brain content.
 * Server data access lives in graph-data.ts; the synthetic dev fixture in graph-fixture.ts.
 */

export const KG_NODES_TABLE = 'kg_nodes';
export const KG_EDGES_TABLE = 'kg_edges';

export const NODE_TYPES = [
  'note',
  'pillar',
  'sub_pillar',
  'cluster',
  'cornerstone',
  'spoke',
  'problem',
  'quote',
  'source',
  'community',
  'creator',
  'claim',
  'mechanism',
  'solution_type',
  'product',
  'rite',
  'decision',
  'principle',
  'deck',
  'doc',
  'corpus_source',
  'segment',
] as const;

export const EDGE_TYPES = [
  'links_to',
  'part_of',
  'mentions',
  'voices',
  'from_source',
  'in_community',
  'evidences',
  'supports',
  'contradicts',
  'explains',
  'solves',
  'addresses',
  'routes_to',
  'belongs_to_pillar',
  'decided_in',
  'feedback_on',
] as const;

export type NodeType = (typeof NODE_TYPES)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];

export const isNodeType = (v: string): v is NodeType => (NODE_TYPES as readonly string[]).includes(v);
export const isEdgeType = (v: string): v is EdgeType => (EDGE_TYPES as readonly string[]).includes(v);

/**
 * Node ids are `<type>:<slug>`. Slugs may carry dots, slashes (brain paths) and a few
 * punctuation marks, but never whitespace, quotes, commas or parentheses, so an id is
 * always safe in a URL, a PostgREST `in.(...)` list and a feedback target_id.
 */
export const NODE_ID = /^[a-z_]{2,24}:[A-Za-z0-9][A-Za-z0-9._:/@+~-]{0,239}$/;
export const isNodeId = (v: unknown): v is string => typeof v === 'string' && NODE_ID.test(v) && !v.includes('..');

/** Path for the node detail API (catch-all route, so slugs with slashes survive). */
export const nodeApiPath = (id: string) => `/api/admin/brain/graph/node/${id.split('/').map(encodeURIComponent).join('/')}`;

/* ---------------------------------------------------------------- payloads */

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  weight: number | null;
  tier: string | null;
  degree: number;
}

export interface GraphEdge {
  src: string;
  dst: string;
  type: string;
  weight: number | null;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated?: { nodes: boolean; edges: boolean };
  /** True only for the synthetic dev fixture. Never set in production. */
  fixture?: boolean;
  error?: string;
}

export interface NeighbourLink {
  edgeType: string;
  direction: 'out' | 'in';
  weight: number | null;
  id: string;
  label: string;
  type: string;
  tier: string | null;
  similarity: number | null;
}

export interface EvidenceExcerpt {
  chunkId: string;
  /** The node on the other end of the evidences edge. */
  viaId: string;
  viaLabel: string;
  similarity: number | null;
  excerpt: string;
  sourceTitle: string | null;
  author: string | null;
  tier: string | null;
  sourceUrl: string | null;
}

export interface QuoteItem {
  id: string;
  label: string;
  text: string | null;
  weight: number | null;
  likes: number | null;
  url: string | null;
}

export interface NodeFull {
  id: string;
  type: string;
  label: string;
  summary: string | null;
  props: Record<string, unknown> | null;
  source_path: string | null;
  url: string | null;
  weight: number | null;
  tier: string | null;
  built_at: string | null;
}

export interface NodeDetail {
  node: NodeFull;
  outgoing: NeighbourLink[];
  incoming: NeighbourLink[];
  evidence: EvidenceExcerpt[];
  quotes: QuoteItem[];
  /** /admin/brain/docs/<slug> when source_path is a published brain doc. */
  docHref: string | null;
  fixture?: boolean;
}

export interface GapRow {
  kind: string;
  node_id: string;
  label: string | null;
  detail: string | null;
}

export interface GapsPayload {
  rows: GapRow[];
  available: boolean;
  fixture?: boolean;
}

/* ---------------------------------------------------------------- query parsing */

export const GRAPH_NODE_CAP = 5000;
export const GRAPH_EDGE_CAP = 40000;

export interface GraphQuery {
  types: NodeType[];
  edgeTypes: EdgeType[];
  minWeight: number | null;
  limit: number;
}

const csv = (v: string | null) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** Unknown types are dropped (never passed to the database). */
export function parseGraphQuery(params: URLSearchParams): GraphQuery {
  const types = [...new Set(csv(params.get('types')).filter(isNodeType))];
  const edgeTypes = [...new Set(csv(params.get('edgeTypes')).filter(isEdgeType))];
  const mw = params.get('minWeight');
  const minWeight = mw !== null && mw !== '' && Number.isFinite(Number(mw)) ? Number(mw) : null;
  const lim = Number(params.get('limit'));
  const limit = Number.isFinite(lim) && lim > 0 ? Math.min(Math.floor(lim), GRAPH_NODE_CAP) : GRAPH_NODE_CAP;
  return { types, edgeTypes, minWeight, limit };
}

/* ---------------------------------------------------------------- graph helpers */

/** Keeps only edges whose ends are both present, and counts degree over them. */
export function withDegree(
  nodes: Omit<GraphNode, 'degree'>[],
  edges: GraphEdge[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const deg = new Map<string, number>();
  for (const n of nodes) deg.set(n.id, 0);
  const kept: GraphEdge[] = [];
  for (const e of edges) {
    if (e.src === e.dst || !deg.has(e.src) || !deg.has(e.dst)) continue;
    kept.push(e);
    deg.set(e.src, (deg.get(e.src) ?? 0) + 1);
    deg.set(e.dst, (deg.get(e.dst) ?? 0) + 1);
  }
  return { nodes: nodes.map((n) => ({ ...n, degree: deg.get(n.id) ?? 0 })), edges: kept };
}

/** Undirected adjacency over the given edges. */
export function adjacency(edges: readonly GraphEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) adj.set(a, (s = new Set()));
    s.add(b);
  };
  for (const e of edges) {
    add(e.src, e.dst);
    add(e.dst, e.src);
  }
  return adj;
}

/** Ids within `depth` hops of `id` (inclusive of `id`), breadth first, capped. */
export function neighbourhood(adj: Map<string, Set<string>>, id: string, depth: number, cap = 400): Set<string> {
  const seen = new Set<string>([id]);
  let frontier = [id];
  for (let d = 0; d < depth && frontier.length && seen.size < cap; d++) {
    const next: string[] = [];
    for (const n of frontier) {
      for (const m of adj.get(n) ?? []) {
        if (seen.has(m)) continue;
        seen.add(m);
        next.push(m);
        if (seen.size >= cap) break;
      }
      if (seen.size >= cap) break;
    }
    frontier = next;
  }
  return seen;
}

export function groupLinks(links: readonly NeighbourLink[]): [string, NeighbourLink[]][] {
  const by = new Map<string, NeighbourLink[]>();
  for (const l of links) {
    const arr = by.get(l.edgeType) ?? [];
    arr.push(l);
    by.set(l.edgeType, arr);
  }
  for (const arr of by.values()) arr.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || a.label.localeCompare(b.label));
  return [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

export const humanize = (s: string) => s.replace(/_/g, ' ');

export const truncate = (s: string, max: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
};

/* ---------------------------------------------------------------- palette */

/**
 * Colour groups, Obsidian style. Families share a hue range so the graph reads in
 * regions: strategy (bronze/amber), market voice (verdigris/teal), reasoning
 * (amethyst/blue), offer (rose/garnet), artefacts (bone/ink), corpus (slate).
 * The warning amber (#fab219) is reserved for gap highlighting and never used here.
 */
export const NODE_TYPE_COLOR: Record<NodeType, string> = {
  pillar: '#e08a46',
  sub_pillar: '#c9773a',
  cluster: '#d9a066',
  cornerstone: '#f0b98a',
  spoke: '#a8703f',
  problem: '#3fbf9f',
  quote: '#7fd6c0',
  source: '#2f8f7e',
  community: '#5aa9b8',
  creator: '#8fc7d6',
  claim: '#a98bff',
  mechanism: '#7f8cff',
  solution_type: '#c2a6ff',
  principle: '#9d7be0',
  product: '#e0607e',
  rite: '#f08fa6',
  segment: '#c4507a',
  decision: '#e8dcc6',
  note: '#b8ab96',
  deck: '#d8c7a4',
  doc: '#cfc0a8',
  corpus_source: '#7d8a99',
};

export const GAP_COLOR = '#fab219';
export const FALLBACK_NODE_COLOR = '#968b7b';

export const colorForType = (t: string) => (isNodeType(t) ? NODE_TYPE_COLOR[t] : FALLBACK_NODE_COLOR);

export const NODE_TYPE_LABEL: Record<NodeType, string> = Object.fromEntries(
  NODE_TYPES.map((t) => [t, t === 'corpus_source' ? 'corpus source' : humanize(t)]),
) as Record<NodeType, string>;

/** Rendered node size from weight and degree (both normalised against the visible max). */
export function nodeSize(weight: number | null, degree: number, maxWeight: number, maxDegree: number, scale = 1): number {
  const w = maxWeight > 0 ? Math.max(0, weight ?? 0) / maxWeight : 0;
  const d = maxDegree > 0 ? Math.log1p(degree) / Math.log1p(maxDegree) : 0;
  return (2.2 + 9 * Math.sqrt(0.45 * w + 0.55 * d)) * scale;
}

/* ---------------------------------------------------------------- URL state */

export interface GraphViewState {
  node: string | null;
  types: NodeType[] | null; // null = all
  edgeTypes: EdgeType[] | null; // null = all
  minWeight: number;
  tier: string | null;
  orphans: boolean;
  gaps: boolean;
  depth: number;
  local: boolean;
}

export const DEFAULT_VIEW: GraphViewState = {
  node: null,
  types: null,
  edgeTypes: null,
  minWeight: 0,
  tier: null,
  orphans: true,
  gaps: false,
  depth: 1,
  local: false,
};

const SAFE_TOKEN = /^[A-Za-z0-9_-]{1,40}$/;

export function viewFromParams(params: Pick<URLSearchParams, 'get'>): GraphViewState {
  const node = params.get('node');
  const types = params.get('types');
  const edges = params.get('edges');
  const mw = Number(params.get('minWeight'));
  const tier = params.get('tier');
  const depth = Number(params.get('depth'));
  return {
    node: isNodeId(node) ? node : null,
    types: types == null ? null : csv(types).filter(isNodeType),
    edgeTypes: edges == null ? null : csv(edges).filter(isEdgeType),
    minWeight: Number.isFinite(mw) && mw > 0 ? mw : 0,
    tier: tier && SAFE_TOKEN.test(tier) ? tier : null,
    orphans: params.get('orphans') !== '0',
    gaps: params.get('gaps') === '1',
    depth: depth === 2 || depth === 3 ? depth : 1,
    local: params.get('local') === '1',
  };
}

/** Only non-default values are written, so a plain view has a plain URL. */
export function viewToQuery(v: GraphViewState): string {
  const q = new URLSearchParams();
  if (v.node) q.set('node', v.node);
  if (v.types) q.set('types', v.types.join(','));
  if (v.edgeTypes) q.set('edges', v.edgeTypes.join(','));
  if (v.minWeight > 0) q.set('minWeight', String(v.minWeight));
  if (v.tier) q.set('tier', v.tier);
  if (!v.orphans) q.set('orphans', '0');
  if (v.gaps) q.set('gaps', '1');
  if (v.depth !== 1) q.set('depth', String(v.depth));
  if (v.local) q.set('local', '1');
  return q.toString();
}
