/**
 * corpus bridge: knowledge corpus -> graph. READ-ONLY on corpus tables (knowledge_sources,
 * knowledge_chunks, match_knowledge); it only writes kg_* rows through the builder.
 *
 * - One `corpus_source` node per source text (a knowledge_sources row, or a tradition/text_name group of
 *   chunks with no knowledge_sources row). Never one node per chunk.
 * - For each claim / mechanism (evidence tiers) and problem (market_signal tier, i.e. demand), run
 *   match_knowledge on its embedding and link the parent sources whose best chunk clears the 0.45 floor:
 *   corpus_source -evidences-> node, props.similarity + props.chunk_ids (top 3 chunks).
 */
import { EVIDENCE_SIMILARITY_FLOOR, EVIDENCE_TIERS } from '../../../../src/lib/corpus/evidence';
import { nodeId, slugify } from './ids';
import { truncate } from './md';
import { restGetAll, restRpc, type RestEnv } from './rest';
import type { GraphEdge, GraphNode } from './types';

export const MATCH_THRESHOLD = 0.25;
export const MATCH_COUNT = 30;
export const CHUNKS_PER_EDGE = 3;
export const MAX_SOURCES_PER_NODE = 8;

interface SourceRow { id: string; tradition: string; text_name: string; display_name: string | null; author: string | null; source_url: string | null; chunk_count: number | null; status: string | null }
interface ChunkRow { tradition: string; text_name: string; author: string | null; tier: string | null; source_url: string | null }
export interface Hit { id: string; tradition: string; text_name: string; author: string | null; content: string; similarity: number; tier?: string | null; metadata?: Record<string, unknown> | null; source_url?: string | null }

export const sourceKey = (tradition: string, textName: string) => `${tradition}\u0000${textName}`;

export interface CorpusIndex {
  nodes: GraphNode[];
  idByKey: Map<string, string>;
}

const humanise = (s: string) => s.replace(/^yt_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Build corpus_source nodes from knowledge_sources rows and chunk groups. Pure (rows in, nodes out). */
export function corpusSourceNodes(sources: SourceRow[], chunks: ChunkRow[]): CorpusIndex {
  const groups = new Map<string, { tradition: string; text_name: string; author: string | null; count: number; tiers: Record<string, number>; url: string | null }>();
  for (const c of chunks) {
    const k = sourceKey(c.tradition, c.text_name);
    const g = groups.get(k) ?? { tradition: c.tradition, text_name: c.text_name, author: c.author, count: 0, tiers: {}, url: c.source_url };
    g.count++;
    const t = c.tier ?? 'unclassified';
    g.tiers[t] = (g.tiers[t] ?? 0) + 1;
    g.author ??= c.author;
    groups.set(k, g);
  }
  const rowByKey = new Map(sources.map((s) => [sourceKey(s.tradition, s.text_name), s]));
  const nodes: GraphNode[] = [];
  const idByKey = new Map<string, string>();
  for (const [k, g] of groups) {
    const row = rowByKey.get(k);
    const id = row ? nodeId('corpus_source', row.id) : nodeId('corpus_source', `${slugify(g.tradition, 40)}.${slugify(g.text_name, 70)}`);
    const tier = Object.entries(g.tiers).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const author = row?.author ?? g.author;
    const label = row?.display_name ?? `${author && !humanise(g.text_name).includes(author) ? `${author}: ` : ''}${humanise(g.text_name)}`;
    idByKey.set(k, id);
    nodes.push({
      id,
      type: 'corpus_source',
      label: truncate(label, 160),
      url: row?.source_url ?? (g.url && !/youtube\.com\/watch/.test(g.url) ? g.url : null),
      tier,
      weight: Math.max(1, Math.log2(1 + g.count)),
      props: { tradition: g.tradition, text_name: g.text_name, author, chunk_count: g.count, tiers: g.tiers, registered: !!row, status: row?.status ?? null },
    });
  }
  return { nodes, idByKey };
}

export async function loadCorpusIndex(env: RestEnv): Promise<CorpusIndex> {
  const [sources, chunks] = await Promise.all([
    restGetAll<SourceRow>(env, 'knowledge_sources?select=id,tradition,text_name,display_name,author,source_url,chunk_count,status&order=id'),
    restGetAll<ChunkRow>(env, 'knowledge_chunks?select=tradition,text_name,author,tier,source_url&order=id'),
  ]);
  return corpusSourceNodes(sources, chunks);
}

/** QS's own material never counts as evidence (mirrors lenses/40-corpus-bridge.data.ts). */
export const isSelf = (h: Pick<Hit, 'tradition' | 'tier' | 'metadata'>) =>
  /^qs/i.test(h.tradition) || h.tier === 'internal' || (h.metadata as { origin?: string } | null)?.origin === 'second_brain';

export interface EvidenceResult {
  edges: GraphEdge[];
  best: { similarity: number; source: string; chunk: string } | null;
}

/** Group hits by parent source and turn the ones above the floor into evidences edges. Pure. */
export function evidenceEdges(targetId: string, hits: Hit[], idByKey: Map<string, string>, kind: 'evidence' | 'demand', floor = EVIDENCE_SIMILARITY_FLOOR): EvidenceResult {
  const usable = hits.filter((h) => !isSelf(h)).sort((a, b) => b.similarity - a.similarity);
  const bySource = new Map<string, Hit[]>();
  for (const h of usable) {
    const sid = idByKey.get(sourceKey(h.tradition, h.text_name));
    if (!sid) continue;
    bySource.set(sid, [...(bySource.get(sid) ?? []), h]);
  }
  const best = usable[0] ? { similarity: round(usable[0].similarity), source: idByKey.get(sourceKey(usable[0].tradition, usable[0].text_name)) ?? '', chunk: usable[0].id } : null;
  const edges: GraphEdge[] = [];
  for (const [sid, hs] of bySource) {
    const top = hs.slice(0, CHUNKS_PER_EDGE);
    if (top[0].similarity < floor) continue;
    edges.push({
      src: sid,
      dst: targetId,
      type: 'evidences',
      weight: round(top[0].similarity),
      props: {
        kind,
        similarity: round(top[0].similarity),
        chunk_ids: top.map((h) => h.id),
        chunk_similarities: top.map((h) => round(h.similarity)),
        tier: top[0].tier ?? null,
        excerpt: truncate(top[0].content.replace(/\s+/g, ' ').trim(), 200),
      },
    });
  }
  edges.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  return { edges: edges.slice(0, MAX_SOURCES_PER_NODE), best };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Small tiers scored exactly, client-side. match_knowledge runs on an HNSW index and applies the tier filter
 * to its ~40 nearest candidates, so a narrow tier (evidence is ~3% of the corpus) is often filtered to nothing
 * even when a chunk clears the floor. Tiers under EXACT_MAX_ROWS are loaded once and scored by cosine here.
 */
export const EXACT_MAX_ROWS = 3000;

export interface ExactPool {
  tiers: string[];
  rows: (Omit<Hit, 'similarity'> & { vec: Float32Array; norm: number })[];
}

export async function loadExactPool(env: RestEnv, tiers: readonly string[]): Promise<ExactPool> {
  const pool: ExactPool = { tiers: [], rows: [] };
  for (const tier of tiers) {
    const head = await fetch(`${env.url}/rest/v1/knowledge_chunks?select=id&tier=eq.${tier}`, { method: 'HEAD', headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, Prefer: 'count=exact', Range: '0-0' } });
    const total = Number(head.headers.get('content-range')?.split('/')[1] ?? 'NaN');
    if (!Number.isFinite(total) || total > EXACT_MAX_ROWS) continue;
    const rows = await restGetAll<{ id: string; tradition: string; text_name: string; author: string | null; content: string; tier: string; metadata: Record<string, unknown> | null; source_url: string | null; embedding: unknown }>(
      env,
      `knowledge_chunks?select=id,tradition,text_name,author,content,tier,metadata,source_url,embedding&tier=eq.${tier}&embedding=not.is.null&order=id`,
      200,
    );
    for (const r of rows) {
      const v = typeof r.embedding === 'string' ? (JSON.parse(r.embedding) as number[]) : (r.embedding as number[] | null);
      if (!v) continue;
      const vec = Float32Array.from(v);
      pool.rows.push({ id: r.id, tradition: r.tradition, text_name: r.text_name, author: r.author, content: r.content, tier: r.tier, metadata: r.metadata, source_url: r.source_url, vec, norm: Math.hypot(...vec) });
    }
    pool.tiers.push(tier);
  }
  return pool;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>, normA?: number, normB?: number): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    if (normA === undefined) na += a[i] * a[i];
    if (normB === undefined) nb += b[i] * b[i];
  }
  return dot / ((normA ?? Math.sqrt(na)) * (normB ?? Math.sqrt(nb)) || 1);
}

export function scorePool(pool: ExactPool, embedding: number[], threshold = MATCH_THRESHOLD, count = MATCH_COUNT): Hit[] {
  const q = Float32Array.from(embedding);
  const qn = Math.hypot(...q);
  const out: Hit[] = [];
  for (const r of pool.rows) {
    const similarity = cosine(q, r.vec, qn, r.norm);
    if (similarity > threshold) out.push({ id: r.id, tradition: r.tradition, text_name: r.text_name, author: r.author, content: r.content, tier: r.tier, metadata: r.metadata, source_url: r.source_url, similarity });
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, count);
}

export async function matchFor(env: RestEnv, embedding: number[], kind: 'evidence' | 'demand', pool?: ExactPool): Promise<Hit[]> {
  const allTiers = kind === 'demand' ? ['market_signal'] : [...EVIDENCE_TIERS];
  const exact = pool ? scorePool({ ...pool, rows: pool.rows.filter((r) => allTiers.includes(r.tier ?? '')) }, embedding) : [];
  const tiers = allTiers.filter((t) => !pool?.tiers.includes(t));
  if (!tiers.length) return exact;
  const hits = await restRpc<Hit[]>(env, 'match_knowledge', {
    query_embedding: embedding,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
    filter_tradition: null,
    filter_priority: null,
    filter_themes: null,
    filter_tiers: tiers,
  });
  const rpc = (Array.isArray(hits) ? hits : []).filter((h) => typeof h.tier !== 'string' || tiers.includes(h.tier));
  const seen = new Set(exact.map((h) => h.id));
  return [...exact, ...rpc.filter((h) => !seen.has(h.id))].sort((a, b) => b.similarity - a.similarity);
}
