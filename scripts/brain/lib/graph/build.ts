/**
 * Orchestration for build-graph.ts: run the extractors, embed, bridge to the corpus, write kg_*.
 * The deterministic part (extractGraph) is pure file I/O; everything else takes a RestEnv.
 */
import { loadGraphConfig, type GraphConfig } from './config';
import type { ExtractContext } from './context';
import { EVIDENCE_TIERS } from '../../../../src/lib/corpus/evidence';
import { evidenceEdges, loadCorpusIndex, loadExactPool, matchFor } from './corpus';
import { extractArchitecture } from './extract-architecture';
import { extractAudience } from './extract-audience';
import { extractClaims } from './extract-claims';
import { extractNotes } from './extract-notes';
import { extractProblemMap } from './extract-problem-map';
import { extractRecords } from './extract-records';
import { contentHash } from './ids';
import { EMBED_MODEL, EMBED_PRICE_PER_M, embedTexts, estimateTokens, parseVector, restDelete, restGetAll, restUpsert, vectorLiteral, type RestEnv } from './rest';
import { Graph, type ExtractorName, type ExtractResult, type GraphEdge, type GraphNode, type NodeType } from './types';

export const EMBED_TYPES: readonly NodeType[] = ['problem', 'claim', 'mechanism', 'note'];
export const EMBED_MAX_CHARS = 8000;

/** Extractors in merge order: earlier ones win the label of a shared node (problem-map before audience). */
const PIPELINE: [ExtractorName, (ctx: ExtractContext) => ExtractResult][] = [
  ['notes', extractNotes],
  ['architecture', extractArchitecture],
  ['problem-map', extractProblemMap],
  ['claims', extractClaims],
  ['audience', extractAudience],
  ['records', extractRecords],
];

export function extractGraph(brainDir: string, config: GraphConfig): Graph {
  const ctx: ExtractContext = { brainDir, config };
  const g = new Graph();
  for (const [name, fn] of PIPELINE) g.add(fn(ctx), name);
  return g;
}

export function loadAndExtract(brainDir: string, configPath?: string): { graph: Graph; config: GraphConfig; configPath: string | null } {
  const { config, path } = loadGraphConfig(brainDir, configPath);
  return { graph: extractGraph(brainDir, config), config, configPath: path };
}

export const embedInput = (n: GraphNode) => (n.embedText ?? `${n.label}${n.summary ? `. ${n.summary}` : ''}`).slice(0, EMBED_MAX_CHARS);

export interface EmbedPlan {
  toEmbed: GraphNode[];
  cached: GraphNode[];
  tokens: number;
  costUsd: number;
}

/** Which nodes need a (new) embedding, given the hashes already stored in kg_nodes.props.embed_hash. */
export function planEmbeddings(nodes: Iterable<GraphNode>, existingHashes: Map<string, string>): EmbedPlan {
  const toEmbed: GraphNode[] = [];
  const cached: GraphNode[] = [];
  for (const n of nodes) {
    if (!EMBED_TYPES.includes(n.type)) continue;
    const h = contentHash(`${EMBED_MODEL}\n${embedInput(n)}`);
    n.props = { ...(n.props ?? {}), embed_hash_wanted: h };
    if (existingHashes.get(n.id) === h) cached.push(n);
    else toEmbed.push(n);
  }
  const tokens = toEmbed.reduce((s, n) => s + estimateTokens(embedInput(n)), 0);
  return { toEmbed, cached, tokens, costUsd: (tokens / 1e6) * EMBED_PRICE_PER_M };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface BuildOptions {
  dryRun: boolean;
  embed: boolean;
  only: ExtractorName | null;
  corpus: boolean;
  forcePrune: boolean;
  log: (msg: string) => void;
}

export interface BuildReport {
  builtAt: string;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  written: { nodes: number; edges: number };
  deleted: { nodes: number; edges: number };
  embeddings: { embedded: number; cached: number; skipped: number; tokens: number; costUsd: number; estimatedTokens: number; estimatedCostUsd: number };
  evidence: { edges: number; medianSimilarity: number | null; demandEdges: number; demandMedian: number | null; targets: number; targetsWithEvidence: number };
  danglingDropped: number;
  warnings: string[];
}

/** Full build: extract, embed, corpus bridge, write, prune. */
export async function buildGraph(brainDir: string, configPath: string | undefined, env: RestEnv | null, opts: BuildOptions): Promise<BuildReport> {
  const builtAt = new Date().toISOString();
  const { graph, configPath: cfgPath } = loadAndExtract(brainDir, configPath);
  opts.log(`brain: ${brainDir}${cfgPath ? ` · config: ${cfgPath}` : ' · no graph config (problems/products unmapped)'}`);
  const report: BuildReport = {
    builtAt,
    nodesByType: {},
    edgesByType: {},
    written: { nodes: 0, edges: 0 },
    deleted: { nodes: 0, edges: 0 },
    embeddings: { embedded: 0, cached: 0, skipped: 0, tokens: 0, costUsd: 0, estimatedTokens: 0, estimatedCostUsd: 0 },
    evidence: { edges: 0, medianSimilarity: null, demandEdges: 0, demandMedian: null, targets: 0, targetsWithEvidence: 0 },
    danglingDropped: 0,
    warnings: graph.warnings,
  };
  const runCorpus = opts.corpus && (!opts.only || opts.only === 'corpus');

  // Existing graph state (ids, embed hashes) when a database is available.
  let existing = new Map<string, { hash: string | null; extractors: string[] }>();
  if (env) {
    try {
      const rows = await restGetAll<{ id: string; embed_hash: string | null; extractors: string[] | null }>(env, 'kg_nodes?select=id,embed_hash:props->>embed_hash,extractors:props->extractors&order=id');
      existing = new Map(rows.map((r) => [r.id, { hash: r.embed_hash, extractors: r.extractors ?? [] }]));
    } catch (e) {
      if (!opts.dryRun) throw e;
      report.warnings.push(`could not read kg_nodes (${e instanceof Error ? e.message.slice(0, 120) : e}); estimates assume an empty graph`);
    }
  }

  // Corpus source nodes
  let corpusIdx: Awaited<ReturnType<typeof loadCorpusIndex>> | null = null;
  if (runCorpus && env) {
    corpusIdx = await loadCorpusIndex(env);
    for (const n of corpusIdx.nodes) graph.addNode(n, 'corpus');
    opts.log(`corpus: ${corpusIdx.nodes.length} source texts`);
  } else if (runCorpus) report.warnings.push('corpus bridge skipped: no NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  // Embeddings
  const hashes = new Map([...existing].filter(([, v]) => v.hash).map(([k, v]) => [k, v.hash as string]));
  const writeScope = (n: GraphNode) => !opts.only || ((n.props?.extractors as string[]) ?? []).includes(opts.only) || (opts.only === 'corpus' && EMBED_TYPES.includes(n.type) && n.type !== 'note');
  const plan = planEmbeddings([...graph.nodes.values()].filter((n) => writeScope(n)), hashes);
  report.embeddings.estimatedTokens = plan.tokens;
  report.embeddings.estimatedCostUsd = plan.costUsd;
  report.embeddings.cached = plan.cached.length;
  const vectors = new Map<string, number[]>();
  const fresh = new Set<string>();
  if (!opts.dryRun && env && opts.embed && plan.toEmbed.length) {
    const { vectors: vs, tokens } = await embedTexts(env, plan.toEmbed.map(embedInput));
    plan.toEmbed.forEach((n, i) => {
      vectors.set(n.id, vs[i]);
      fresh.add(n.id);
    });
    report.embeddings.embedded = vs.length;
    report.embeddings.tokens = tokens;
    report.embeddings.costUsd = (tokens / 1e6) * EMBED_PRICE_PER_M;
  } else report.embeddings.skipped = plan.toEmbed.length;
  for (const n of graph.nodes.values()) {
    if (!EMBED_TYPES.includes(n.type)) continue;
    const wanted = n.props?.embed_hash_wanted as string | undefined;
    delete n.props?.embed_hash_wanted;
    // embed_hash records the text the stored embedding was made from (kept as-is when not re-embedded).
    const stored = fresh.has(n.id) ? wanted : existing.get(n.id)?.hash ?? null;
    if (stored) n.props = { ...n.props, embed_hash: stored };
  }

  // Corpus bridge: evidences edges
  if (runCorpus && env && corpusIdx && !opts.dryRun) {
    const targets = [...graph.nodes.values()].filter((n) => n.type === 'claim' || n.type === 'mechanism' || n.type === 'problem').filter((n) => n.props?.kind !== 'will_not_say' && n.props?.clustered !== false);
    const needDb = targets.filter((n) => !vectors.has(n.id) && existing.get(n.id)?.hash);
    for (let i = 0; i < needDb.length; i += 50) {
      const ids = needDb.slice(i, i + 50).map((n) => `"${n.id}"`).join(',');
      const rows = await restGetAll<{ id: string; embedding: unknown }>(env, `kg_nodes?select=id,embedding&id=in.(${encodeURIComponent(ids)})`);
      for (const r of rows) {
        const v = parseVector(r.embedding);
        if (v) vectors.set(r.id, v);
      }
    }
    const pool = await loadExactPool(env, [...EVIDENCE_TIERS, 'market_signal']);
    opts.log(`corpus: exact scoring for tiers ${pool.tiers.join(', ') || 'none'} (${pool.rows.length} chunks); the rest via match_knowledge`);
    const sims: number[] = [];
    const demand: number[] = [];
    report.evidence.targets = targets.length;
    for (const t of targets) {
      const v = vectors.get(t.id);
      if (!v) {
        report.warnings.push(`no embedding for ${t.id}; evidence not linked (run without --no-embed)`);
        continue;
      }
      const kind = t.type === 'problem' ? 'demand' : 'evidence';
      const hits = await matchFor(env, v, kind, pool);
      const { edges, best } = evidenceEdges(t.id, hits, corpusIdx.idByKey, kind);
      t.props = { ...t.props, [kind === 'demand' ? 'best_demand_similarity' : 'best_similarity']: best?.similarity ?? null, [kind === 'demand' ? 'best_demand_source' : 'best_source']: best?.source ?? null };
      for (const e of edges) {
        graph.addEdge(e, 'corpus');
        (kind === 'demand' ? demand : sims).push(e.props?.similarity as number);
      }
      if (edges.length && kind === 'evidence') report.evidence.targetsWithEvidence++;
    }
    report.evidence.edges = sims.length;
    report.evidence.medianSimilarity = median(sims);
    report.evidence.demandEdges = demand.length;
    report.evidence.demandMedian = median(demand);
  }

  // Scope of this run
  const nodes = [...graph.nodes.values()].filter((n) => writeScope(n) || (opts.only === 'corpus' && n.type === 'corpus_source'));
  let edges = [...graph.edges.values()].filter((e) => !opts.only || e.props?.extractor === opts.only);
  const known = new Set<string>(opts.only ? existing.keys() : []);
  for (const n of nodes) known.add(n.id);
  const before = edges.length;
  edges = edges.filter((e) => known.has(e.src) && known.has(e.dst));
  report.danglingDropped = before - edges.length;
  if (report.danglingDropped) {
    const sample = [...graph.edges.values()].filter((e) => !known.has(e.src) || !known.has(e.dst)).slice(0, 5).map((e) => `${e.src} -${e.type}-> ${e.dst}`);
    report.warnings.push(`${report.danglingDropped} edges dropped (endpoint not in graph), e.g. ${sample.join('; ')}`);
  }
  report.nodesByType = graph.countBy(nodes);
  report.edgesByType = graph.countBy(edges);
  if (opts.dryRun || !env) return report;

  // Write nodes: two batches so rows without a fresh vector never touch the embedding column.
  const row = (n: GraphNode) => ({
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
  const withVec = nodes.filter((n) => fresh.has(n.id)).map((n) => ({ ...row(n), embedding: vectorLiteral(vectors.get(n.id)!) }));
  const without = nodes.filter((n) => !fresh.has(n.id)).map(row);
  await restUpsert(env, 'kg_nodes', without, 'id');
  await restUpsert(env, 'kg_nodes', withVec, 'id', 50);
  const edgeRows = edges.map((e: GraphEdge) => ({ src: e.src, dst: e.dst, type: e.type, weight: Number((e.weight ?? 1).toFixed(3)), props: e.props ?? {}, built_at: builtAt }));
  await restUpsert(env, 'kg_edges', edgeRows, 'src,dst,type', 500);
  report.written = { nodes: nodes.length, edges: edgeRows.length };

  // Prune what disappeared from the sources this run owns (never corpus tables; only kg_*).
  const ran: string[] = opts.only ? [opts.only] : [...PIPELINE.map(([n]) => n), ...(runCorpus && corpusIdx ? ['corpus'] : [])];
  const shrink = existing.size > 0 && nodes.length < existing.size * 0.5 && !opts.only;
  if (shrink && !opts.forcePrune) {
    report.warnings.push(`prune skipped: this build has ${nodes.length} nodes vs ${existing.size} in the database (<50%). Check --brain-dir, or pass --force-prune.`);
  } else {
    const ts = encodeURIComponent(builtAt);
    report.deleted.edges = await restDelete(env, 'kg_edges', `built_at=lt.${ts}&props->>extractor=in.(${ran.map((r) => `"${r}"`).join(',')})&select=id`);
    report.deleted.nodes = await restDelete(env, 'kg_nodes', `built_at=lt.${ts}&props->extractors=cd.${encodeURIComponent(JSON.stringify(ran))}&select=id`);
  }
  return report;
}
