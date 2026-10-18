/**
 * Knowledge graph model shared by the extractors and the builder.
 * Mirrors kg_nodes / kg_edges (supabase/migrations/20261017170000_knowledge_graph.sql).
 */

export const NODE_TYPES = [
  'note', 'pillar', 'sub_pillar', 'cluster', 'cornerstone', 'spoke', 'problem', 'quote', 'source',
  'community', 'creator', 'claim', 'mechanism', 'solution_type', 'product', 'rite', 'decision',
  'principle', 'deck', 'doc', 'corpus_source', 'segment', 'topic', 'query',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const EDGE_TYPES = [
  'links_to', 'part_of', 'mentions', 'voices', 'from_source', 'in_community', 'evidences', 'supports',
  'contradicts', 'explains', 'solves', 'addresses', 'routes_to', 'belongs_to_pillar', 'decided_in', 'feedback_on',
  'asks_about', 'covered_by', 'competes_on',
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export const EXTRACTORS = ['notes', 'architecture', 'audience', 'problem-map', 'claims', 'records', 'corpus'] as const;
export type ExtractorName = (typeof EXTRACTORS)[number];

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  summary?: string | null;
  props?: Record<string, unknown>;
  source_path?: string | null;
  url?: string | null;
  weight?: number;
  tier?: string | null;
  /** Text that gets embedded (problem/claim/mechanism/note). Not stored as a column. */
  embedText?: string;
}

export interface GraphEdge {
  src: string;
  dst: string;
  type: EdgeType;
  weight?: number;
  props?: Record<string, unknown>;
}

export interface ExtractResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings?: string[];
}

const edgeKey = (e: Pick<GraphEdge, 'src' | 'dst' | 'type'>) => `${e.src}\u0000${e.dst}\u0000${e.type}`;

/**
 * In-memory graph with merge semantics:
 * - a node seen twice keeps the first label/type, merges props (later keys win), keeps the max weight
 *   and fills empty fields; props.extractors collects every extractor that emitted it.
 * - an edge seen twice (same src, dst, type) keeps the max weight and merges props.
 */
export class Graph {
  nodes = new Map<string, GraphNode>();
  edges = new Map<string, GraphEdge>();
  warnings: string[] = [];

  add(result: ExtractResult, extractor: ExtractorName): void {
    for (const n of result.nodes) this.addNode(n, extractor);
    for (const e of result.edges) this.addEdge(e, extractor);
    if (result.warnings) this.warnings.push(...result.warnings.map((w) => `[${extractor}] ${w}`));
  }

  addNode(n: GraphNode, extractor: ExtractorName): void {
    const prev = this.nodes.get(n.id);
    if (!prev) {
      this.nodes.set(n.id, { ...n, props: { ...(n.props ?? {}), extractors: [extractor] } });
      return;
    }
    const extractors = new Set([...((prev.props?.extractors as string[]) ?? []), extractor]);
    prev.props = { ...(prev.props ?? {}), ...(n.props ?? {}), extractors: [...extractors].sort() };
    prev.weight = Math.max(prev.weight ?? 1, n.weight ?? 1);
    prev.summary ??= n.summary;
    prev.source_path ??= n.source_path;
    prev.url ??= n.url;
    prev.tier ??= n.tier;
    prev.embedText ??= n.embedText;
  }

  addEdge(e: GraphEdge, extractor: ExtractorName): void {
    if (e.src === e.dst) return;
    const k = edgeKey(e);
    const prev = this.edges.get(k);
    if (!prev) {
      this.edges.set(k, { ...e, props: { ...(e.props ?? {}), extractor } });
      return;
    }
    prev.weight = Math.max(prev.weight ?? 1, e.weight ?? 1);
    prev.props = { ...(prev.props ?? {}), ...(e.props ?? {}), extractor: prev.props?.extractor ?? extractor };
  }

  /** Drop edges whose endpoints are not in this graph or in `known` (ids already in the database). */
  pruneDangling(known: Set<string> = new Set()): number {
    let dropped = 0;
    for (const [k, e] of this.edges) {
      const ok = (id: string) => this.nodes.has(id) || known.has(id);
      if (!ok(e.src) || !ok(e.dst)) {
        this.edges.delete(k);
        dropped++;
      }
    }
    return dropped;
  }

  countBy<T extends { type: string }>(xs: Iterable<T>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const x of xs) out[x.type] = (out[x.type] ?? 0) + 1;
    return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
  }
}
