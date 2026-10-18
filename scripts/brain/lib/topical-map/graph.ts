/**
 * Topical map -> kg_nodes / kg_edges. Every row this writes carries props.extractor(s) = 'topical-map', so the
 * graph builder's pruning never touches it and this pruning never touches the graph builder's rows.
 *
 * Nodes: `topic` (every map node; props hold the scorecard), `query` (top queries per node), and `creator` nodes
 * for landscape channels the graph doesn't have yet (never overwrites an existing node).
 * Edges: part_of (topic -> parent topic), asks_about (query -> topic), mentions (problem -> topic, via 'about';
 * topic -> cluster / sub_pillar / pillar, via 'maps_to'), supports (claim -> topic), routes_to (topic -> product),
 * competes_on (creator -> topic), covered_by (topic -> cornerstone / spoke / deck / doc).
 */
import type { TopicalMap, TopicNode } from '../../../../src/lib/brain/topical-map-types';
import { nodeId, slugify } from '../graph/ids';
import { restDelete, restGetAll, restUpsert, type RestEnv } from '../graph/rest';
import type { GraphEdge, GraphNode } from '../graph/types';
import type { BuildTopicalResult } from './build';

export const EXTRACTOR = 'topical-map';
export const QUERIES_PER_NODE_IN_GRAPH = 5;
export const SOURCE_PATH = 'content/topical-map.json';

export function topicGraphNode(n: TopicNode, map: TopicalMap): GraphNode {
  return {
    id: n.id,
    type: 'topic',
    label: n.label,
    summary: n.summary || null,
    source_path: SOURCE_PATH,
    weight: Math.max(1, Math.round(n.scores.priority) / 10),
    props: {
      level: n.level,
      parent: n.parent,
      pillar_code: n.pillarCode,
      intent: n.intent,
      status: n.status,
      origin: n.origin ?? 'architecture',
      stance: n.stance ?? null,
      scores: n.scores,
      maps_to: n.mapsTo,
      assets: n.assets,
      competitors: n.competitors,
      top_queries: n.queries.slice(0, 10),
      query_count: n.queries.length,
      reasons: n.reasons ?? {},
      evidence: n.evidence ?? [],
      audience_words: n.audienceWords ?? [],
      queue_rank: n.queueRank ?? null,
      notes: n.notes,
      ...(n.level === 'pillar' ? { map_meta: { version: map.version, centralEntity: map.centralEntity, sourceContext: map.sourceContext, generatedAt: map.generatedAt, levels: map.levels, meta: map.meta } } : {}),
    },
  };
}

export const queryNodeId = (text: string) => nodeId('query', slugify(text, 110));

export function graphRows(result: BuildTopicalResult, landscapeNames: Map<string, { name: string; channelId: string }>): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { map, graphInputs } = result;
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const edge = (e: GraphEdge) => {
    if (e.src === e.dst) return;
    const k = `${e.src}\u0000${e.dst}\u0000${e.type}`;
    const prev = edges.get(k);
    if (!prev || (e.weight ?? 1) > (prev.weight ?? 1)) edges.set(k, { ...e, props: { ...(e.props ?? {}), extractor: EXTRACTOR } });
  };
  for (const n of map.nodes) {
    nodes.set(n.id, topicGraphNode(n, map));
    if (n.parent) edge({ src: n.id, dst: n.parent, type: 'part_of', props: { level: n.level } });
    if (n.mapsTo.cluster) edge({ src: n.id, dst: n.mapsTo.cluster, type: 'mentions', props: { via: 'maps_to' } });
    if (n.level === 'pillar' || n.level === 'section') {
      // architecture node with the same code (pillar:<slug> / sub_pillar:<code>) is linked by the writer when it exists
    }
    for (const a of n.assets) {
      if (a.kind === 'content_post' || a.status === 'TO BUILD') continue;
      edge({ src: n.id, dst: a.ref, type: 'covered_by', props: { kind: a.kind, status: a.status } });
    }
    if (n.mapsTo.cornerstone) edge({ src: n.id, dst: n.mapsTo.cornerstone, type: 'mentions', props: { via: 'maps_to', role: 'cornerstone' } });
  }
  // queries: the top ones per node
  const perNode = new Map<string, typeof graphInputs.queryLinks>();
  for (const l of graphInputs.queryLinks) perNode.set(l.node, [...(perNode.get(l.node) ?? []), l]);
  for (const [node, links] of perNode) {
    for (const l of links.sort((a, b) => b.query.signal - a.query.signal).slice(0, QUERIES_PER_NODE_IN_GRAPH)) {
      const qid = queryNodeId(l.query.text);
      if (!nodes.has(qid)) {
        nodes.set(qid, {
          id: qid,
          type: 'query',
          label: l.query.text,
          source_path: SOURCE_PATH,
          weight: Math.max(1, l.query.signal),
          props: { text: l.query.text, sources: l.query.sources, signal: l.query.signal, per_source: l.query.perSource, monthly: l.query.monthly ?? null, seeds: l.query.seeds.slice(0, 5) },
        });
      }
      edge({ src: qid, dst: node, type: 'asks_about', weight: Math.max(0.1, l.query.signal), props: { similarity: l.sim, reason: l.reason } });
    }
  }
  for (const [pid, links] of graphInputs.problemLinks) for (const l of links) edge({ src: pid, dst: l.topic, type: 'mentions', weight: l.share, props: { via: 'about', share: l.share, similarity: l.sim } });
  for (const c of graphInputs.claimLinks) edge({ src: c.claim, dst: c.topic, type: 'supports', weight: c.similarity ?? 0.5, props: { via: c.via, similarity: c.similarity } });
  for (const p of graphInputs.productLinks) edge({ src: p.topic, dst: p.product, type: 'routes_to', weight: p.fit, props: { fit: p.fit, via: p.via } });
  for (const c of graphInputs.competitorLinks) {
    edge({ src: c.creator, dst: c.topic, type: 'competes_on', weight: c.weight, props: { channel_id: c.channelId, outlier: c.outlier, via: c.via } });
    if (!nodes.has(c.creator)) {
      const meta = landscapeNames.get(c.creator);
      nodes.set(c.creator, { id: c.creator, type: 'creator', label: meta?.name ?? c.name, url: `https://www.youtube.com/channel/${c.channelId}`, weight: 1, props: { platform: 'youtube', channel_id: c.channelId, from: 'landscape' }, source_path: 'research/creators/landscape.json' });
    }
  }
  for (const n of nodes.values()) n.props = { ...(n.props ?? {}), extractors: [EXTRACTOR] };
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export interface WriteReport {
  nodes: number;
  edges: number;
  skippedExistingCreators: number;
  dangling: number;
  danglingSample: string[];
  pruned: { nodes: number; edges: number };
}

/** Upsert into kg_nodes / kg_edges and prune this extractor's stale rows. Never overwrites another extractor's node. */
export async function writeGraph(env: RestEnv, rows: { nodes: GraphNode[]; edges: GraphEdge[] }, builtAt: string, opts: { forcePrune?: boolean } = {}): Promise<WriteReport> {
  const existing = await restGetAll<{ id: string; ex: string | null }>(env, 'kg_nodes?select=id,ex:props->>extractors&order=id');
  const owner = new Map(existing.map((r) => [r.id, r.ex]));
  const mine = (id: string) => owner.get(id) === JSON.stringify([EXTRACTOR]);
  let skippedExistingCreators = 0;
  const nodes = rows.nodes.filter((n) => {
    if (n.type === 'topic' || n.type === 'query') return !owner.has(n.id) || mine(n.id) || owner.get(n.id) === null;
    if (owner.has(n.id) && !mine(n.id)) {
      skippedExistingCreators++;
      return false;
    }
    return true;
  });
  const known = new Set([...existing.map((r) => r.id), ...nodes.map((n) => n.id)]);
  const edges = rows.edges.filter((e) => known.has(e.src) && known.has(e.dst));
  const danglingList = rows.edges.filter((e) => !known.has(e.src) || !known.has(e.dst));

  const nodeRow = (n: GraphNode) => ({
    id: n.id,
    type: n.type,
    label: n.label.slice(0, 500),
    summary: n.summary ?? null,
    props: n.props ?? {},
    source_path: n.source_path ?? null,
    url: n.url ?? null,
    weight: Number((n.weight ?? 1).toFixed(3)),
    tier: n.tier ?? null,
    updated_at: builtAt,
    built_at: builtAt,
  });
  await restUpsert(env, 'kg_nodes', nodes.map(nodeRow), 'id');
  await restUpsert(env, 'kg_edges', edges.map((e) => ({ src: e.src, dst: e.dst, type: e.type, weight: Number((e.weight ?? 1).toFixed(3)), props: e.props ?? {}, built_at: builtAt })), 'src,dst,type', 500);

  const prevTopics = existing.filter((r) => r.id.startsWith('topic:') && mine(r.id)).length;
  const newTopics = nodes.filter((n) => n.type === 'topic').length;
  const pruned = { nodes: 0, edges: 0 };
  if (prevTopics > 0 && newTopics < prevTopics * 0.5 && !opts.forcePrune) {
    // a much smaller map usually means a wrong --brain-dir; keep the old rows
  } else {
    const ts = encodeURIComponent(builtAt);
    pruned.edges = await restDelete(env, 'kg_edges', `built_at=lt.${ts}&props->>extractor=eq.${EXTRACTOR}&select=id`);
    pruned.nodes = await restDelete(env, 'kg_nodes', `built_at=lt.${ts}&props->>extractors=eq.${encodeURIComponent(JSON.stringify([EXTRACTOR]))}&type=in.(topic,query,creator)&select=id`);
  }
  return { nodes: nodes.length, edges: edges.length, skippedExistingCreators, dangling: danglingList.length, danglingSample: danglingList.slice(0, 5).map((e) => `${e.src} -${e.type}-> ${e.dst}`), pruned };
}

export function landscapeIndex(channels: { name: string; channel_id: string }[]): Map<string, { name: string; channelId: string }> {
  return new Map(channels.map((c) => [nodeId('creator', slugify(c.name, 60)), { name: c.name, channelId: c.channel_id }]));
}
