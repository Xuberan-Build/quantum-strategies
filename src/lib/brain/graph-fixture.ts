/**
 * Synthetic knowledge-graph fixture for building and testing /admin/brain/graph
 * before kg_nodes / kg_edges exist. Deterministic, generic labels, no brain content.
 *
 * Served by the graph API only when NODE_ENV is development (fixtureAllowed()), so
 * production never shows it.
 */
import {
  type GapRow,
  type GraphEdge,
  type GraphPayload,
  type NeighbourLink,
  type NodeDetail,
  type NodeType,
  withDegree,
} from './graph';

/**
 * The synthetic fixture only replaces real data when explicitly switched on
 * (BRAIN_GRAPH_FIXTURE=1 in a dev environment). Silently falling back hid a real
 * load failure on 2026-10-17, so by default the API returns the error instead.
 */
export function fixtureAllowed(): boolean {
  return (
    process.env.BRAIN_GRAPH_FIXTURE === '1' &&
    process.env.NODE_ENV === 'development' &&
    process.env.VERCEL_ENV !== 'production'
  );
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FixtureNode {
  id: string;
  type: NodeType;
  label: string;
  weight: number;
  tier: string | null;
}

const TIERS = ['evidence', 'model', 'contested', 'lineage', 'market_signal'];

let cached: { nodes: FixtureNode[]; edges: GraphEdge[] } | null = null;

function build() {
  if (cached) return cached;
  const r = rng(42);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)];
  const nodes: FixtureNode[] = [];
  const edges: GraphEdge[] = [];
  const seq = new Map<NodeType, number>();
  const add = (type: NodeType, n: number, w: () => number = () => r()) => {
    const out: FixtureNode[] = [];
    const start = (seq.get(type) ?? 0) + 1;
    seq.set(type, start + n - 1);
    for (let i = start; i < start + n; i++) {
      const node = {
        id: `${type}:fixture-${type.replace(/_/g, '-')}-${i}`,
        type,
        label: `Sample ${type.replace(/_/g, ' ')} ${i}`,
        weight: Math.round(w() * 100) / 100,
        tier: type === 'corpus_source' || type === 'claim' ? pick(TIERS) : null,
      };
      nodes.push(node);
      out.push(node);
    }
    return out;
  };
  const link = (src: FixtureNode, dst: FixtureNode, type: string, weight = Math.round(r() * 100) / 100) => {
    if (src.id !== dst.id) edges.push({ src: src.id, dst: dst.id, type, weight });
  };

  const pillars = add('pillar', 5, () => 0.9 + r() * 0.1);
  const subs = add('sub_pillar', 12, () => 0.6 + r() * 0.3);
  const clusters = add('cluster', 10);
  const cornerstones = add('cornerstone', 6);
  const spokes = add('spoke', 14);
  const problems = add('problem', 14);
  const quotes = add('quote', 36, () => r() * r());
  const sources = add('source', 5);
  const communities = add('community', 6);
  const creators = add('creator', 8);
  const claims = add('claim', 12);
  const mechanisms = add('mechanism', 6);
  const solutions = add('solution_type', 5);
  const products = add('product', 3, () => 0.8);
  const rites = add('rite', 3, () => 0.85);
  const decisions = add('decision', 5);
  const principles = add('principle', 5);
  const decks = add('deck', 3);
  const docs = add('doc', 4);
  const corpus = add('corpus_source', 8);
  const segments = add('segment', 4);
  const notes = add('note', 10);
  add('note', 3, () => 0.05); // orphans (weight 0.05), for the orphan toggle

  subs.forEach((s, i) => link(s, pillars[i % pillars.length], 'part_of', 1));
  pillars.forEach((p, i) => link(p, rites[i % rites.length], 'routes_to', 0.8));
  clusters.forEach((c) => link(c, pick(subs), 'part_of'));
  cornerstones.forEach((c) => link(c, pick(clusters), 'part_of'));
  spokes.forEach((s) => {
    link(s, pick(cornerstones), 'part_of');
    link(s, pick(problems), 'addresses');
  });
  problems.forEach((p) => {
    link(p, pick(pillars), 'belongs_to_pillar');
    if (r() > 0.4) link(pick(solutions), p, 'solves');
  });
  quotes.forEach((q, i) => {
    link(q, problems[i % problems.length], 'voices');
    link(q, pick(sources), 'from_source', 1);
    link(q, pick(communities), 'in_community', 1);
    if (r() > 0.6) link(pick(creators), q, 'mentions');
  });
  claims.forEach((c) => {
    link(pick(corpus), c, 'evidences', Math.round((0.7 + r() * 0.25) * 100) / 100);
    if (r() > 0.3) link(c, pick(mechanisms), 'supports');
    if (r() > 0.8) link(c, pick(claims), 'contradicts');
  });
  mechanisms.forEach((m) => {
    link(m, pick(problems), 'explains');
    link(pick(corpus), m, 'evidences', Math.round((0.7 + r() * 0.25) * 100) / 100);
  });
  products.forEach((p, i) => {
    link(p, rites[i % rites.length], 'routes_to', 1);
    link(p, pick(problems), 'solves');
    link(p, pick(segments), 'addresses');
  });
  decisions.forEach((d) => link(d, pick(docs), 'decided_in', 1));
  principles.forEach((p) => link(p, pick(pillars), 'supports'));
  decks.forEach((d) => {
    link(d, pick(problems), 'mentions');
    link(d, pick(pillars), 'mentions');
  });
  docs.forEach((d) => link(d, pick(notes), 'links_to'));
  notes.forEach((n) => {
    link(n, pick(notes), 'links_to');
    if (r() > 0.5) link(n, pick(pillars), 'mentions');
  });
  creators.forEach((c) => link(c, pick(communities), 'in_community'));
  segments.forEach((s) => link(s, pick(problems), 'mentions'));

  cached = { nodes, edges };
  return cached;
}

export function fixtureGraph(): GraphPayload {
  const { nodes, edges } = build();
  const g = withDegree(nodes, edges);
  return { ...g, truncated: { nodes: false, edges: false }, fixture: true };
}

export function fixtureNodeDetail(id: string): NodeDetail | null {
  const { nodes, edges } = build();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const node = byId.get(id);
  if (!node) return null;
  const toLink = (e: GraphEdge, direction: 'out' | 'in'): NeighbourLink => {
    const other = byId.get(direction === 'out' ? e.dst : e.src)!;
    return {
      edgeType: e.type,
      direction,
      weight: e.weight,
      id: other.id,
      label: other.label,
      type: other.type,
      tier: other.tier,
      similarity: e.type === 'evidences' ? e.weight : null,
    };
  };
  const outgoing = edges.filter((e) => e.src === id).map((e) => toLink(e, 'out'));
  const incoming = edges.filter((e) => e.dst === id).map((e) => toLink(e, 'in'));
  const evidence = [...outgoing, ...incoming]
    .filter((l) => l.edgeType === 'evidences')
    .map((l, i) => ({
      chunkId: `fixture-chunk-${i + 1}`,
      viaId: l.id,
      viaLabel: l.label,
      similarity: l.similarity,
      excerpt: 'Synthetic excerpt. Real corpus passages appear here once kg_edges carries chunk_ids for evidences edges.',
      sourceTitle: l.label,
      author: null,
      tier: l.tier,
      sourceUrl: null,
    }));
  const quotes =
    node.type === 'problem'
      ? incoming
          .filter((l) => l.type === 'quote')
          .map((l) => byId.get(l.id)!)
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 8)
          .map((q) => ({
            id: q.id,
            label: q.label,
            text: 'A synthetic quote standing in for a real market voice.',
            weight: q.weight,
            likes: Math.round(q.weight * 400),
            url: null,
          }))
      : [];
  return {
    node: {
      id: node.id,
      type: node.type,
      label: node.label,
      summary: `Synthetic ${node.type.replace(/_/g, ' ')} from the dev fixture. Shown only in development while the knowledge graph tables are unavailable.`,
      props: { score: node.weight, stage: node.type === 'problem' ? 'aware' : undefined, fixture: true },
      source_path: null,
      url: null,
      weight: node.weight,
      tier: node.tier,
      built_at: null,
    },
    outgoing,
    incoming,
    evidence,
    quotes,
    docHref: null,
    fixture: true,
  };
}

export function fixtureGaps(): GapRow[] {
  const { nodes } = build();
  const pick = (type: NodeType, n: number) => nodes.filter((x) => x.type === type).slice(0, n);
  return [
    ...pick('problem', 3).map((p) => ({ kind: 'problem_without_solution', node_id: p.id, label: p.label, detail: 'No solves edge (fixture)' })),
    ...pick('claim', 2).map((c) => ({ kind: 'claim_without_evidence', node_id: c.id, label: c.label, detail: 'No evidences edge (fixture)' })),
    ...nodes
      .filter((x) => x.weight === 0.05)
      .map((o) => ({ kind: 'orphan', node_id: o.id, label: o.label, detail: 'No links (fixture)' })),
  ];
}
