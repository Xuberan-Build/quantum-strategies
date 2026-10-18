/**
 * Orchestration for build-topical-map.ts: seed the tree, harvest demand, cluster, score, and return the map.
 * Writing (JSON/MD files and graph rows) lives in write.ts so this stays testable without a database.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EVIDENCE_TIERS } from '../../../../src/lib/corpus/evidence';
import { QUEUE_MAX_COVERAGE, TOPIC_LEVELS, type TopicAsset, type TopicEvidence, type TopicIntent, type TopicNode, type TopicQuery, type TopicStance, type TopicalMap } from '../../../../src/lib/brain/topical-map-types';
import { loadGraphConfig, type GraphConfig } from '../graph/config';
import { extractGraph } from '../graph/build';
import { isSelf, loadExactPool, scorePool, type ExactPool } from '../graph/corpus';
import type { Architecture } from '../graph/extract-architecture';
import { nodeId, slugify } from '../graph/ids';
import { keywordMatchers, matchesAny, truncate } from '../graph/md';
import { restGetAll, type RestEnv } from '../graph/rest';
import type { Graph } from '../graph/types';
import { assignQueries, attachSubtopics, EMBED_THRESHOLDS, groupQueries, LEXICAL_THRESHOLDS, nearest, type Placement, type Thresholds } from './cluster';
import { dot, EmbedCache, unit } from './embed';
import { AcCache, expansions, Harvester, type AcRequest, type AcSource, type Fetcher } from './harvest';
import { dominantIntent, lexicalSim, mergeQueries, normalizeQuery, type HarvestedQuery, type RawQuery } from './queries';
import {
  assetWeight,
  audienceMass,
  competitionScore,
  competitorWeight,
  coverageScore,
  CTA_FIT,
  CTA_PRODUCTS,
  demandRaw,
  demandScore,
  priorityScore,
  productFitScore,
  proofScore,
  strengthValue,
  weightedMean,
} from './score';
import { loadSeeds, loadVidiq, type Seeds, type VidiqRow } from './seeds';
import { mapProblems, problemTopic, seedTree, type NodeCtx, type ProblemInfo } from './tree';

export const MAP_VERSION = 1;
export const CENTRAL_ENTITY = {
  label: 'The self-image as a learned set point',
  definition:
    'The picture you hold of yourself acts like a thermostat for behaviour: you drift back to it when you push past it. It was learned, so it can be read and changed. Austin\'s method works it through the Rites (Perception, Orientation, Declaration): see the self-image you run, design the one you would rather run, and integrate what holds the old one. The member becomes an Operator through Initiation and Activation.',
};
export const SOURCE_CONTEXT_BASE =
  'Quantum Strategies is Austin Santos\'s method for changing the self-image with a mechanism instead of magical thinking. The map is organised around his 8 pillars and the Spine (content/architecture.json). Demand decides priority. Creators are context, never the frame. Every topic routes to the free Perception quiz, a Rite or a scan where it can.';

/** The source context with this run's real figures (the UI shows it as is). */
export function sourceContext(f: { audienceItems: number; problems: number; acRequests: number; acCached: number; acQueries: number; vidiq: number; channels: number; claims: number; blocked: boolean }): string {
  return `${SOURCE_CONTEXT_BASE} Demand this run: ${f.audienceItems} coded audience items (YouTube comments, forum and Reddit posts) across ${f.problems} problems, ${f.acQueries} distinct autocomplete suggestions from ${f.acRequests + f.acCached} Google and YouTube autocomplete lookups (${f.acRequests} fetched this run, ${f.acCached} from cache${f.blocked ? ', harvest stopped early by a block' : ''}), and ${f.vidiq} vidIQ volume anchors. Proof: ${f.claims} claims from the thesis-evidence map. Competition: ${f.channels} tracked YouTube channels.`;
}

export const MAX_QUERIES_PER_NODE = 40;
export const MAX_NEW_SUBTOPICS_PER_TOPIC = 6;

interface Landscape {
  channels: { name: string; channel_id: string; category_label?: string; subscribers?: number; median_views_last_long_uploads?: number; top_outliers?: { title: string; video_id: string; views: number; outlier: number }[]; pillars?: string[]; problem_clusters?: string[]; audience_overlap?: string; role?: string; priority?: number }[];
}

export interface BuildTopicalOptions {
  brainDir: string;
  env: RestEnv | null;
  harvest: boolean;
  embed: boolean;
  maxRequests: number;
  expandTop?: number;
  today?: string;
  cacheRoot: string;
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  minDelayMs?: number;
  maxDelayMs?: number;
  log?: (m: string) => void;
}

export interface BuildTopicalReport {
  generatedAt: string;
  counts: Record<string, number>;
  origins: Record<string, number>;
  harvest: { requests: number; cacheHits: number; missing: number; blocked: unknown; errors: number; expandedTopics: string[] };
  queries: { total: number; placed: number; onSubtopics: number; inDemandTopics: number; unplaced: number; offTopic: number; bySource: Record<string, number> };
  embeddings: { enabled: boolean; embedded: number; cached: number; tokens: number; costUsd: number };
  proof: { mode: string; claimsWithEvidence: number; poolChunks: number };
  contentPosts: { total: number; linked: number };
  warnings: string[];
}

export interface BuildTopicalResult {
  map: TopicalMap;
  report: BuildTopicalReport;
  ctx: Map<string, NodeCtx>;
  /** inputs the graph writer needs */
  graphInputs: {
    problemLinks: Map<string, { topic: string; share: number; sim: number }[]>;
    claimLinks: { claim: string; topic: string; via: string; similarity: number | null }[];
    productLinks: { topic: string; product: string; fit: number; via: string }[];
    competitorLinks: { creator: string; channelId: string; name: string; topic: string; weight: number; outlier: number; via: string }[];
    queryLinks: { query: HarvestedQuery; node: string; sim: number; reason: string }[];
  };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** A group's label: a seeded probe/vidIQ phrase in it, else the shortest of its three strongest queries. */
export function groupLabel(members: HarvestedQuery[], seeded: Map<string, unknown>): string {
  const probe = members.find((m) => seeded.has(normalizeQuery(m.text)));
  const pick = probe ?? [...members].sort((a, b) => b.signal - a.signal).slice(0, 3).sort((a, b) => a.text.length - b.text.length)[0];
  return pick.text.charAt(0).toUpperCase() + pick.text.slice(1);
}

function readJson<T>(brainDir: string, rel: string): T | null {
  const p = path.join(brainDir, rel);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
}

/** Problem facts the map needs, read from the graph extractors' output (pure file reads). */
export function problemInfos(g: Graph, config: GraphConfig): ProblemInfo[] {
  const edges = [...g.edges.values()];
  const productStatus = new Map(config.products.map((p) => [nodeId('product', p.slug), p.status ?? null]));
  const out: ProblemInfo[] = [];
  for (const cfg of config.problems) {
    const id = nodeId('problem', cfg.slug);
    const n = g.nodes.get(id);
    if (!n) continue;
    const props = (n.props ?? {}) as Record<string, unknown>;
    const products: ProblemInfo['products'] = [];
    for (const e of edges) {
      if (e.type === 'routes_to' && e.src === id) products.push({ id: e.dst, via: 'routes_to', live: productStatus.get(e.dst) === 'LIVE' });
      if (e.type === 'addresses' && e.dst === id && !(e.props?.later === true)) products.push({ id: e.src, via: 'addresses', live: productStatus.get(e.src) === 'LIVE' });
      if (e.type === 'addresses' && e.dst === id && e.props?.later === true) products.push({ id: e.src, via: 'addresses', live: false });
    }
    const mech = edges.find((e) => e.type === 'explains' && e.dst === id)?.src ?? null;
    const claims = mech ? edges.filter((e) => e.type === 'supports' && e.dst === mech && e.src.startsWith('claim:')).map((e) => e.src) : [];
    const yt = (props.youtube as { likes?: number } | undefined)?.likes ?? 0;
    out.push({
      id,
      slug: cfg.slug,
      row: (props.row as string) ?? cfg.row,
      label: n.label,
      summary: n.summary ?? null,
      pillars: cfg.pillars,
      keywords: cfg.keywords,
      theirWords: ((props.their_words as string[]) ?? []).slice(0, 8),
      quoteCount: (props.quote_count as number) ?? (props.merged_n as number) ?? 0,
      likes: (props.youtube_likes as number) ?? yt ?? 0,
      forumScore: (props.forum_score as number) ?? 0,
      guardrail: !!cfg.guardrail,
      products: dedupeBy(products, (p) => `${p.id}|${p.via}`),
      claims: [...new Set(claims)],
      mechanism: mech,
    });
  }
  return out;
}

const dedupeBy = <T>(xs: T[], k: (x: T) => string) => [...new Map(xs.map((x) => [k(x), x])).values()];

/** Top coded quotes per problem (by likes/score), short. */
export function topQuotes(g: Graph, problemId: string, n = 3): string[] {
  const ids = [...g.edges.values()].filter((e) => e.type === 'voices' && e.dst === problemId).map((e) => e.src);
  return ids
    .map((id) => g.nodes.get(id))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, n)
    .map((q) => truncate(String((q.props?.text as string) ?? q.label), 140));
}

export async function buildTopicalMap(opts: BuildTopicalOptions): Promise<BuildTopicalResult> {
  const log = opts.log ?? (() => {});
  const generatedAt = new Date().toISOString();
  const today = opts.today ?? generatedAt.slice(0, 10);
  const warnings: string[] = [];

  // ---------------------------------------------------------------- 1. inputs
  const arch = readJson<Architecture>(opts.brainDir, 'content/architecture.json');
  if (!arch) throw new Error('content/architecture.json not found in the brain');
  const { config } = loadGraphConfig(opts.brainDir);
  const g = extractGraph(opts.brainDir, config);
  const { seeds, found: seedsFound } = loadSeeds(opts.brainDir);
  if (!seedsFound) warnings.push('content/topical-map-seeds.json not found; seeds derived from cluster names');
  const vidiq = loadVidiq(opts.brainDir);
  if (!vidiq.length) warnings.push('no vidIQ table found in research/language/audience-vocabulary.md');
  const landscape = readJson<Landscape>(opts.brainDir, 'research/creators/landscape.json');
  if (!landscape) warnings.push('research/creators/landscape.json not found; competition is 0');
  const problems = problemInfos(g, config);
  const claimNodes = new Map([...g.nodes.values()].filter((n) => n.type === 'claim').map((n) => [n.id, n]));
  const productIds = new Set([...g.nodes.values()].filter((n) => n.type === 'product').map((n) => n.id));

  const { nodes, ctx } = seedTree(arch, seeds.clusters);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = (id: string) => nodes.filter((n) => n.parent === id);
  const topicsAt = () => nodes.filter((n) => n.level === 'topic');

  // ---------------------------------------------------------------- 2. embeddings available?
  const embedOn = opts.embed && !!opts.env?.openaiKey;
  if (opts.embed && !embedOn) warnings.push('embeddings off: no OPENAI_API_KEY (lexical similarity used)');
  const cache = embedOn ? new EmbedCache(path.join(opts.cacheRoot, 'embeddings.jsonl')) : null;
  const vec = new Map<string, Float32Array>();
  const embedAll = async (texts: string[]) => {
    if (!cache || !opts.env) return;
    const got = await cache.ensure(opts.env, texts.filter((t) => !vec.has(t)));
    for (const [t, v] of got) vec.set(t, unit(v));
  };
  const cos = (a: string, b: string): number | null => {
    const va = vec.get(a);
    const vb = vec.get(b);
    return va && vb ? dot(va, vb) : null;
  };
  const nodeText = (id: string) => ctx.get(id)?.embedText ?? byId.get(id)?.label ?? id;
  /** Texts a node is compared through: its embed text, its label and its seed phrases (max similarity wins). */
  const nodeTexts = (id: string) => [nodeText(id), byId.get(id)?.label ?? '', ...(ctx.get(id)?.seedPhrases ?? []), ...(ctx.get(id)?.matchPhrases ?? [])].filter(Boolean);
  const maxCos = (text: string, id: string): number | null => {
    let best: number | null = null;
    for (const t of nodeTexts(id)) {
      const c = cos(text, t);
      if (c !== null && (best === null || c > best)) best = c;
    }
    return best;
  };
  const embedNodes = () => embedAll(nodes.flatMap((n) => nodeTexts(n.id)));
  const lexText = (id: string) => {
    const n = byId.get(id);
    const c = ctx.get(id);
    return [n?.label ?? '', ...(c?.seedPhrases ?? [])].join(' ');
  };
  const problemText = (p: ProblemInfo) => [p.label, p.summary, ...p.theirWords.slice(0, 2)].filter(Boolean).join('. ');

  // ---------------------------------------------------------------- 3. problems -> topics
  await embedNodes();
  await embedAll(problems.map(problemText));
  const problemSim = (p: ProblemInfo, t: TopicNode) => {
    const kw = matchesAny(`${t.label} ${lexText(t.id)} ${t.summary}`, keywordMatchers(p.keywords)) ? 0.08 : 0;
    const c = maxCos(problemText(p), t.id);
    return c !== null ? c + kw : lexicalSim(problemText(p), lexText(t.id)) + kw * 4;
  };
  const problemLinks = mapProblems(problems, topicsAt(), problemSim, embedOn ? { floor: 0.42, margin: 0.05, maxPerProblem: 3 } : { floor: 0.34, margin: 0.1, maxPerProblem: 3 });
  for (const p of problems) {
    if (p.guardrail || problemLinks.has(p.id)) continue;
    const pillar = p.pillars[0] ?? 'X';
    const sections = nodes.filter((n) => n.level === 'section' && (n.pillarCode === (pillar === 'X' ? 'SPINE' : pillar)));
    const best = nearest(sections, (s) => cos(problemText(p), nodeText(s.id)) ?? lexicalSim(problemText(p), `${s.label} ${s.summary}`));
    if (!best) continue;
    const t = problemTopic(p, best.item);
    nodes.push(t);
    byId.set(t.id, t);
    ctx.set(t.id, { code: null, seedPhrases: seeds.problems[p.slug] ?? [], embedText: problemText(p), cta: null, pieces: [], stance: 'use' });
    problemLinks.set(p.id, [{ topic: t.id, share: 1, sim: 1 }]);
    t.reasons = { placement: `no architecture cluster matched "${p.label}" closely enough, so it gets its own topic under "${best.item.label}" (nearest section, ${r3(best.s)})` };
    await embedAll([nodeText(t.id)]);
  }
  const problemsOfTopic = new Map<string, { p: ProblemInfo; share: number; sim: number }[]>();
  for (const [pid, links] of problemLinks) {
    const p = problems.find((x) => x.id === pid)!;
    for (const l of links) problemsOfTopic.set(l.topic, [...(problemsOfTopic.get(l.topic) ?? []), { p, share: l.share, sim: l.sim }]);
  }
  for (const [tid, ps] of problemsOfTopic) {
    const t = byId.get(tid)!;
    t.mapsTo.problems = [...new Set([...(t.mapsTo.problems ?? []), ...ps.map((x) => x.p.id)])];
    // the problem's own phrasing and search seeds become match phrases for the topic (not harvest seeds)
    const c = ctx.get(tid);
    if (c) c.matchPhrases = [...new Set([...(c.matchPhrases ?? []), ...ps.flatMap((x) => [...x.p.label.split(/\s*\/\s*/), ...(seeds.problems[x.p.slug] ?? [])])])];
  }
  await embedNodes();

  // ---------------------------------------------------------------- 4. harvest
  const harvester = new Harvester(new AcCache(path.join(opts.cacheRoot), today), {
    network: opts.harvest,
    maxRequests: opts.maxRequests,
    fetcher: opts.fetcher,
    sleep: opts.sleep,
    minDelayMs: opts.minDelayMs,
    maxDelayMs: opts.maxDelayMs,
    log,
  });
  const seedOwners = new Map<string, Set<string>>(); // normalised seed -> topic ids
  const own = (seed: string, topicIds: string[]) => {
    const k = normalizeQuery(seed);
    const s = seedOwners.get(k) ?? new Set<string>();
    for (const t of topicIds) s.add(t);
    seedOwners.set(k, s);
  };
  const req = (q: string, owner: string, phase: AcRequest['phase']): AcRequest[] => (['google_ac', 'youtube_ac'] as AcSource[]).map((source) => ({ source, q, owner, seed: q, phase }));
  const first: AcRequest[] = [];
  const second: AcRequest[] = [];
  for (const t of topicsAt()) {
    const s = ctx.get(t.id)?.seedPhrases ?? [];
    s.forEach((phrase, i) => {
      own(phrase, [t.id]);
      (i === 0 ? first : second).push(...req(phrase, t.id, i === 0 ? 'seed' : 'seed2'));
    });
  }
  for (const p of problems) {
    if (p.guardrail) continue;
    const topicIds = (problemLinks.get(p.id) ?? []).map((l) => l.topic);
    (seeds.problems[p.slug] ?? []).forEach((phrase, i) => {
      own(phrase, topicIds);
      (i === 0 ? first : second).push(...req(phrase, p.id, i === 0 ? 'seed' : 'seed2'));
    });
  }
  const probePlacement = new Map<string, { pillar: string; stance: TopicStance }>();
  for (const pr of seeds.probes) {
    probePlacement.set(normalizeQuery(pr.text), { pillar: pr.pillar, stance: pr.stance });
    first.push(...req(pr.text, `probe:${pr.pillar}`, 'seed'));
  }
  for (const v of vidiq) {
    const pl = seeds.vidiq[v.phrase];
    if (pl) probePlacement.set(normalizeQuery(v.phrase), { pillar: pl.pillar, stance: pl.stance });
    second.push(...req(v.phrase, `vidiq:${pl?.pillar ?? '?'}`, 'seed2'));
  }
  log(`harvest: ${first.length + second.length} seed requests planned (${opts.harvest ? `network on, cap ${opts.maxRequests}` : 'cache only'})`);
  await harvester.run([...first, ...second]);

  // Expansion for the top topics by early demand (suggestions seen × product fit)
  const early = new Map<string, number>();
  for (const r of harvester.results) {
    for (const t of seedOwners.get(normalizeQuery(r.request.seed)) ?? []) early.set(t, (early.get(t) ?? 0) + r.suggestions.length);
  }
  const ctaFit = (id: string) => CTA_FIT[ctx.get(id)?.cta ?? ''] ?? 0.3;
  const ranked = [...early].map(([t, n]) => ({ t, s: n * (0.4 + ctaFit(t)) })).sort((a, b) => b.s - a.s);
  const perTopic = 2 * expansions('x').length;
  // Cache-only runs try every topic's expansion (free; only what an earlier network run fetched comes back).
  const expandN = opts.harvest ? Math.max(0, Math.min(opts.expandTop ?? 5, Math.floor(harvester.budgetLeft / perTopic))) : ranked.length;
  const expanded: string[] = [];
  const expandReqs: AcRequest[] = [];
  for (const { t } of ranked) {
    if (expanded.length >= expandN) break;
    const seed = ctx.get(t)?.seedPhrases?.[0];
    if (!seed || !byId.get(t)) continue;
    expanded.push(t);
    for (const e of expansions(seed)) {
      for (const source of ['google_ac', 'youtube_ac'] as AcSource[]) expandReqs.push({ source, q: e, owner: t, seed, phase: 'expand' });
    }
  }
  if (expandReqs.length) {
    log(`harvest: expanding ${expanded.length} top topics a-z (${expandReqs.length} requests before cache)`);
    await harvester.run(expandReqs);
  }
  if (!opts.harvest) expanded.splice(0, expanded.length, ...[...new Set(harvester.results.filter((r) => r.request.phase === 'expand').map((r) => r.request.owner))]);
  log(`harvest: ${harvester.stats.requests} network requests, ${harvester.stats.cacheHits} cache hits, ${harvester.stats.missing} not fetched${harvester.stats.blocked ? ` · BLOCKED ${JSON.stringify(harvester.stats.blocked)}` : ''}`);

  // ---------------------------------------------------------------- 5. raw queries -> merged
  const raw: RawQuery[] = [];
  for (const r of harvester.results) r.suggestions.forEach((s, i) => raw.push({ text: s, source: r.request.source, rank: i, seed: r.request.seed }));
  for (const p of problems) {
    if (p.guardrail) continue;
    const phrases = p.label.split(/\s*\/\s*/).filter(Boolean);
    for (const ph of phrases) {
      raw.push({ text: ph, source: 'audience', quotes: Math.max(1, Math.round(p.quoteCount / phrases.length)), likes: Math.round((p.likes + p.forumScore) / phrases.length), seed: `audience:${p.id}` });
      own(`audience:${p.id}`, (problemLinks.get(p.id) ?? []).map((l) => l.topic));
    }
  }
  for (const v of vidiq) raw.push({ text: v.phrase, source: 'vidiq', monthly: v.monthly });
  const seedTopic = (seed: string) => [...(seedOwners.get(normalizeQuery(seed)) ?? [])];
  const queries = mergeQueries(raw, seedTopic);
  const bySource: Record<string, number> = {};
  for (const q of queries) for (const s of q.sources) bySource[s] = (bySource[s] ?? 0) + 1;
  log(`queries: ${queries.length} unique (${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(', ')})`);

  // ---------------------------------------------------------------- 6. cluster
  await embedAll(queries.map((q) => q.text));
  const th: Thresholds = embedOn ? EMBED_THRESHOLDS : LEXICAL_THRESHOLDS;
  const qSim = (q: HarvestedQuery, id: string) => maxCos(q.text, id) ?? lexicalSim(q.text, lexText(id));
  const qqSim = (a: HarvestedQuery, b: HarvestedQuery) => cos(a.text, b.text) ?? lexicalSim(a.text, b.text);
  const topicList = () => topicsAt().map((t) => ({ id: t.id, label: t.label }));
  const placements = assignQueries(queries, topicList(), qSim, th);
  const queryLinks: BuildTopicalResult['graphInputs']['queryLinks'] = [];

  // unplaced -> demand topics
  // Off-topic noise: queries matching a seed's exclude patterns, or too far from every node to belong to the map.
  const exclude = seeds.exclude.map((x) => new RegExp(`\\b(?:${x})\\b`, 'i'));
  let offTopic = 0;
  for (const p of placements) {
    const excluded = exclude.some((re) => re.test(p.query.text));
    if (excluded || (!p.topic && p.sim < th.relevance)) {
      if (p.topic) p.topic = null;
      p.reason = excluded ? 'excluded by a seeds exclude pattern (off-topic sense of the word)' : `off-topic: nearest node at ${p.sim} (relevance floor ${th.relevance})`;
      (p as Placement & { dropped?: boolean }).dropped = true;
      offTopic++;
    }
  }
  const unplaced = placements.filter((p) => !p.topic && !(p as Placement & { dropped?: boolean }).dropped).map((p) => p.query);
  const strongHead = (q: HarvestedQuery) => q.sources.includes('vidiq') || probePlacement.has(normalizeQuery(q.text));
  const { groups, rest } = groupQueries(unplaced, qqSim, { ...th, minGroupSignal: th.minTopicSignal, minGroupSize: th.minTopicSize }, strongHead);
  const sections = () => nodes.filter((n) => n.level === 'section');
  const GUARD = /\b(trauma|depress|adhd|suicid|numb|ptsd|bipolar|anxiety disorder)\b/;
  let inDemandTopics = 0;
  for (const grp of groups) {
    const placement = grp.members.map((m) => probePlacement.get(normalizeQuery(m.text))).find(Boolean) ?? null;
    const pillar = placement?.pillar === 'X' ? 'SPINE' : placement?.pillar;
    const pool = sections().filter((s) => !pillar || s.pillarCode === pillar);
    const best = nearest(pool.length ? pool : sections(), (s) => qSim(grp.head, s.id));
    if (!best) continue;
    const label = groupLabel(grp.members, probePlacement);
    const id = nodeId('topic', `d-${slugify(label, 100)}`);
    if (byId.has(id)) continue;
    const stance: TopicStance = GUARD.test(grp.head.text) ? 'guardrail' : (placement?.stance ?? 'use');
    const t: TopicNode = {
      id,
      level: 'topic',
      label,
      parent: best.item.id,
      pillarCode: best.item.pillarCode,
      intent: 'informational',
      summary: `Searched as "${grp.members.slice(0, 4).map((m) => m.text).join('", "')}". No cluster in Austin's architecture answers it yet.`,
      mapsTo: {},
      queries: [],
      scores: { demand: 0, proof: 0, coverage: 0, competition: 0, productFit: 0, priority: 0 },
      status: 'NONE',
      assets: [],
      competitors: [],
      notes: `origin: demand. ${grp.reason}.${stance !== 'use' ? ` Vocabulary stance: ${stance} (audience-vocabulary.md).` : ''}`,
      origin: 'demand',
      stance,
      reasons: { placement: `${placement ? `placed in ${placement.pillar} by the seed list; ` : ''}nearest section "${best.item.label}" at ${r3(best.s)}` },
    };
    nodes.push(t);
    byId.set(id, t);
    ctx.set(id, { code: null, seedPhrases: [grp.head.text], embedText: [label, ...grp.members.slice(0, 6).map((m) => m.text)].join('. '), cta: null, pieces: [], stance, pillarHint: placement?.pillar });
    for (const m of grp.members) {
      const p = placements.find((x) => x.query.key === m.key)!;
      p.topic = id;
      p.sim = r3(qqSim(m, grp.head));
      p.reason = `grouped into a new demand topic: ${grp.reason}`;
      inDemandTopics++;
    }
  }
  await embedNodes();

  // subtopics
  const subOf = (tid: string) => nodes.filter((n) => n.parent === tid && n.level === 'subtopic').map((n) => ({ id: n.id, label: n.label }));
  const subPlacement = attachSubtopics(placements.filter((p) => p.topic && byId.get(p.topic)?.origin !== 'demand'), subOf, qSim, th);
  // leftover queries on a topic -> new demand subtopics
  const leftoverByTopic = new Map<string, HarvestedQuery[]>();
  for (const p of placements) {
    if (!p.topic || subPlacement.has(p.query.key) || byId.get(p.topic)?.origin === 'demand') continue;
    leftoverByTopic.set(p.topic, [...(leftoverByTopic.get(p.topic) ?? []), p.query]);
  }
  for (const [tid, qs] of leftoverByTopic) {
    const parent = byId.get(tid)!;
    const { groups: sg } = groupQueries(qs, qqSim, { ...th, group: Math.min(0.95, th.group + 0.06) }, strongHead);
    for (const grp of sg.slice(0, MAX_NEW_SUBTOPICS_PER_TOPIC)) {
      const code = (ctx.get(tid)?.code ?? tid.replace(/^topic:/, '').slice(0, 30)).toLowerCase().replace(/\./g, '-');
      const id = nodeId('topic', `${code}-q-${slugify(groupLabel(grp.members, probePlacement), 90)}`);
      if (byId.has(id)) continue;
      const st: TopicNode = {
        id,
        level: 'subtopic',
        label: groupLabel(grp.members, probePlacement),
        parent: tid,
        pillarCode: parent.pillarCode,
        intent: 'informational',
        summary: `A question people search under "${parent.label}": ${grp.members.slice(0, 3).map((m) => `"${m.text}"`).join(', ')}.`,
        mapsTo: {},
        queries: [],
        scores: { demand: 0, proof: 0, coverage: 0, competition: 0, productFit: 0, priority: 0 },
        status: 'NONE',
        assets: [],
        competitors: [],
        notes: `origin: demand. ${grp.reason}.`,
        origin: 'demand',
        stance: GUARD.test(grp.head.text) ? 'guardrail' : 'use',
      };
      nodes.push(st);
      byId.set(id, st);
      ctx.set(id, { code: null, seedPhrases: [grp.head.text], embedText: [st.label, ...grp.members.slice(0, 5).map((m) => m.text)].join('. '), cta: ctx.get(tid)?.cta ?? null, pieces: [], stance: st.stance ?? 'use' });
      for (const m of grp.members) subPlacement.set(m.key, { query: m, topic: id, sim: r3(qqSim(m, grp.head)), reason: `grouped into a new subtopic of "${parent.label}": ${grp.reason}` });
    }
  }
  await embedNodes();

  // final placement per query: subtopic if any, else topic
  const ownQueries = new Map<string, HarvestedQuery[]>();
  for (const p of placements) {
    if (!p.topic) continue;
    const sp = subPlacement.get(p.query.key);
    const node = sp?.topic ?? p.topic;
    ownQueries.set(node, [...(ownQueries.get(node) ?? []), p.query]);
    queryLinks.push({ query: p.query, node, sim: sp?.sim ?? p.sim, reason: sp ? `${p.reason} → ${sp.reason}` : p.reason });
  }
  const descendants = (id: string): TopicNode[] => children(id).flatMap((c) => [c, ...descendants(c.id)]);
  const navNames = (landscape?.channels ?? []).map((c) => c.name);
  const toTQ = (q: HarvestedQuery): TopicQuery => ({ text: q.text, sources: q.sources, signal: q.signal });
  const allQueriesOf = (id: string) => {
    const set = new Map<string, HarvestedQuery>();
    for (const q of ownQueries.get(id) ?? []) set.set(q.key, q);
    for (const d of descendants(id)) for (const q of ownQueries.get(d.id) ?? []) set.set(q.key, q);
    return [...set.values()].sort((a, b) => b.signal - a.signal);
  };
  for (const n of nodes) {
    const qs = n.level === 'pillar' || n.level === 'section' ? allQueriesOf(n.id).slice(0, 15) : n.level === 'topic' ? allQueriesOf(n.id) : (ownQueries.get(n.id) ?? []).sort((a, b) => b.signal - a.signal);
    n.queries = qs.slice(0, MAX_QUERIES_PER_NODE).map(toTQ);
    const fallback: TopicIntent = n.origin === 'problem' ? 'problem' : 'informational';
    n.intent = dominantIntent(qs, fallback, navNames);
  }

  // ---------------------------------------------------------------- 7. signals
  // audience words
  for (const t of nodes.filter((n) => n.level === 'topic')) {
    const ps = problemsOfTopic.get(t.id) ?? [];
    t.audienceWords = [...new Set(ps.sort((a, b) => b.share - a.share).flatMap((x) => (x.p.theirWords.length >= 2 ? x.p.theirWords.slice(0, 3) : [...x.p.theirWords, ...topQuotes(g, x.p.id, 2)])))].slice(0, 6).map((w) => truncate(w, 160));
  }

  // proof
  const claimBest = new Map<string, { sim: number; source: string | null }>();
  let pool: ExactPool | null = null;
  let proofMode = 'claim grades only (no database)';
  if (opts.env) {
    try {
      const ev = await restGetAll<{ src: string; dst: string; props: { similarity?: number } }>(opts.env, 'kg_edges?select=src,dst,props&type=eq.evidences&dst=like.claim:*');
      for (const e of ev) {
        const s = e.props?.similarity ?? 0;
        if (s > (claimBest.get(e.dst)?.sim ?? -1)) claimBest.set(e.dst, { sim: s, source: e.src });
      }
      const best = await restGetAll<{ id: string; best: number | null; src: string | null }>(opts.env, 'kg_nodes?select=id,best:props->best_similarity,src:props->>best_source&type=eq.claim');
      for (const b of best) if (typeof b.best === 'number' && b.best > (claimBest.get(b.id)?.sim ?? -1)) claimBest.set(b.id, { sim: b.best, source: b.src });
      proofMode = 'claim evidence from the graph (exact small-tier scoring)';
      if (embedOn) {
        pool = await loadExactPool(opts.env, EVIDENCE_TIERS);
        proofMode += ` + each node scored exactly against ${pool.rows.length} chunks in tiers ${pool.tiers.join(', ')}`;
      }
    } catch (e) {
      warnings.push(`proof: could not read the graph (${e instanceof Error ? e.message.slice(0, 120) : e}); claim grades only`);
    }
  }
  const claimLinks: BuildTopicalResult['graphInputs']['claimLinks'] = [];
  const usableClaims = [...claimNodes.values()].filter((c) => c.props?.kind !== 'will_not_say');
  await embedAll(usableClaims.map((c) => c.label));
  for (const n of nodes) {
    if (n.level === 'pillar' || n.level === 'section') continue;
    const linked = new Map<string, string>();
    for (const c of n.mapsTo.claims ?? []) if (claimNodes.has(c)) linked.set(c, 'architecture source');
    for (const ps of problemsOfTopic.get(n.id) ?? []) for (const c of ps.p.claims) if (!linked.has(c)) linked.set(c, `mechanism of ${ps.p.id}`);
    if (embedOn && n.level === 'topic') {
      const sims = usableClaims.map((c) => ({ c, s: cos(nodeText(n.id), c.label) ?? 0 })).sort((a, b) => b.s - a.s);
      for (const x of sims.slice(0, 2)) if (x.s >= 0.5 && !linked.has(x.c.id)) linked.set(x.c.id, `similar text (${r3(x.s)})`);
    }
    n.mapsTo.claims = [...linked.keys()];
    const evidence: TopicEvidence[] = [];
    let bestSim: number | null = null;
    let bestStrength = 0;
    for (const [cid, via] of linked) {
      const c = claimNodes.get(cid)!;
      const cb = claimBest.get(cid) ?? null;
      const strength = (c.props?.strength as string) ?? null;
      bestStrength = Math.max(bestStrength, strengthValue(strength));
      if (cb && (bestSim === null || cb.sim > bestSim)) bestSim = cb.sim;
      evidence.push({ claim: cid, label: c.label, tier: c.tier ?? null, strength, similarity: cb ? r3(cb.sim) : null, source: cb?.source ?? null });
      claimLinks.push({ claim: cid, topic: n.id, via, similarity: cb ? r3(cb.sim) : null });
    }
    const v = vec.get(nodeText(n.id));
    if (pool && v) {
      const hit = scorePool(pool, Array.from(v)).find((h) => !isSelf(h));
      if (hit) {
        evidence.push({ claim: null, label: truncate(hit.content.replace(/\s+/g, ' '), 160), tier: hit.tier ?? null, strength: null, similarity: r3(hit.similarity), source: `${hit.author ? `${hit.author}: ` : ''}${hit.text_name}` });
        if (bestSim === null || hit.similarity > bestSim) bestSim = hit.similarity;
      }
    }
    evidence.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    n.evidence = evidence.slice(0, 6);
    n.scores.proof = proofScore(bestSim, bestStrength);
    n.reasons = { ...n.reasons, proof: `best corpus match ${bestSim === null ? 'not checked' : r3(bestSim)} (evidence floor 0.45), strongest claim grade ${bestStrength || 'none'} from ${linked.size} linked claim${linked.size === 1 ? '' : 's'}` };
  }

  // coverage
  const contentPosts: { slug: string; title: string; published: boolean }[] = [];
  if (opts.env) {
    try {
      const rows = await restGetAll<{ slug: string; title: string; is_published: boolean | null }>(opts.env, 'content_posts?select=slug,title,is_published&order=slug');
      for (const r of rows) if (r.title) contentPosts.push({ slug: r.slug, title: r.title, published: !!r.is_published });
    } catch (e) {
      warnings.push(`coverage: could not read content_posts (${e instanceof Error ? e.message.slice(0, 120) : e})`);
    }
  }
  await embedAll(contentPosts.map((p) => p.title));
  const archPieceAssets = (n: TopicNode): TopicAsset[] =>
    (ctx.get(n.id)?.pieces ?? []).map((p) => ({ kind: p.id.endsWith('-CS') ? 'cornerstone' : 'spoke', ref: nodeId(p.id.endsWith('-CS') ? 'cornerstone' : 'spoke', p.id), status: p.status ?? 'TO BUILD', label: p.title }));
  for (const n of nodes) if (n.level === 'topic' || n.level === 'subtopic') n.assets = archPieceAssets(n);
  let linkedPosts = 0;
  const postTargets = nodes.filter((n) => n.level === 'topic' || n.level === 'subtopic');
  for (const post of contentPosts.filter((p) => p.published)) {
    const best = nearest(postTargets, (n) => cos(post.title, nodeText(n.id)) ?? lexicalSim(post.title, `${n.label} ${lexText(n.id)}`));
    if (!best || best.s < (embedOn ? 0.6 : 0.6)) continue;
    linkedPosts++;
    const asset: TopicAsset = { kind: 'content_post', ref: `content_post:${post.slug}`, status: 'LIVE', label: post.title };
    best.item.assets.push(asset);
    if (best.item.level === 'subtopic' && best.item.parent) byId.get(best.item.parent)?.assets.push(asset);
  }
  // internal decks and docs that discuss the topic's problems
  const edges = [...g.edges.values()];
  for (const t of nodes.filter((n) => n.level === 'topic')) {
    const probs = new Set(t.mapsTo.problems ?? []);
    if (!probs.size) continue;
    const hits = edges.filter((e) => e.type === 'mentions' && probs.has(e.dst) && (e.src.startsWith('deck:') || e.src.startsWith('doc:'))).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    for (const e of dedupeBy(hits, (x) => x.src).slice(0, 3)) t.assets.push({ kind: e.src.split(':')[0], ref: e.src, status: 'internal', label: g.nodes.get(e.src)?.label });
  }
  for (const n of nodes) {
    if (n.level !== 'topic' && n.level !== 'subtopic') continue;
    // a topic's own coverage counts its subtopics' spokes through its assets list (all spokes are listed there)
    n.scores.coverage = coverageScore(n.assets);
    const live = n.assets.filter((a) => a.status !== 'TO BUILD' && a.status !== 'internal' && a.status !== 'BUILT');
    n.status = live.length ? 'LIVE' : n.assets.some((a) => a.status === 'BUILT') ? 'BUILT' : n.assets.some((a) => a.status === 'TO BUILD') ? 'TO BUILD' : 'NONE';
    const counted = n.assets.filter((a) => assetWeight(a.kind, a.status) > 0);
    const pub = counted.filter((a) => a.status !== 'internal');
    const internal = counted.length - pub.length;
    const planned = n.assets.filter((a) => a.status === 'TO BUILD').length;
    const parts: string[] = [];
    if (pub.length) parts.push(Object.entries(pub.reduce<Record<string, number>>((m, a) => ((m[`${a.kind.replace('_', ' ')} ${a.status}`] = (m[`${a.kind.replace('_', ' ')} ${a.status}`] ?? 0) + 1), m), {})).map(([k, v]) => `${v} ${k}`).join(', '));
    else parts.push('nothing public yet');
    if (internal) parts.push(`${internal} internal deck${internal === 1 ? '' : 's'} or doc${internal === 1 ? '' : 's'} discuss it`);
    if (planned) parts.push(`${planned} piece${planned === 1 ? '' : 's'} planned`);
    n.reasons = { ...n.reasons, coverage: parts.join('; ') };
  }

  // competition
  const competitorLinks: BuildTopicalResult['graphInputs']['competitorLinks'] = [];
  const channels = (landscape?.channels ?? []).filter((c) => c.role !== 'skip');
  await embedAll(channels.flatMap((c) => (c.top_outliers ?? []).map((o) => o.title)));
  const archPillar = (pc: string) => (pc === 'SPINE' ? 'X' : pc);
  for (const n of nodes) {
    if (n.level !== 'topic' && n.level !== 'subtopic') continue;
    const rows = new Set((n.mapsTo.problems ?? []).map((pid) => problems.find((p) => p.id === pid)?.row).filter(Boolean) as string[]);
    const ws: number[] = [];
    const comp: { id: string; w: number }[] = [];
    for (const ch of channels) {
      let outlier = 0;
      let via = '';
      if (n.level === 'topic' && (ch.pillars ?? []).includes(archPillar(n.pillarCode)) && (ch.problem_clusters ?? []).some((r) => rows.has(r))) {
        outlier = Math.max(...(ch.top_outliers ?? []).map((o) => o.outlier), 1);
        via = 'same pillar and problem';
      }
      for (const o of ch.top_outliers ?? []) {
        const s = maxCos(o.title, n.id) ?? lexicalSim(o.title, `${n.label} ${lexText(n.id)}`);
        if (s >= (embedOn ? 0.5 : 0.6) && o.outlier > outlier) {
          outlier = o.outlier;
          via = `outlier video "${truncate(o.title, 70)}" (${o.outlier}x median)`;
        }
      }
      if (!via) continue;
      const w = competitorWeight(ch.audience_overlap, outlier);
      ws.push(w);
      comp.push({ id: ch.channel_id, w });
      competitorLinks.push({ creator: nodeId('creator', slugify(ch.name, 60)), channelId: ch.channel_id, name: ch.name, topic: n.id, weight: r3(w), outlier, via });
    }
    n.scores.competition = competitionScore(ws);
    n.competitors = comp.sort((a, b) => b.w - a.w).slice(0, 8).map((c) => c.id);
    n.reasons = { ...n.reasons, competition: comp.length ? `${comp.length} landscape channel${comp.length === 1 ? '' : 's'} cover it` : 'no tracked channel covers it' };
  }

  // product fit
  const productLinks: BuildTopicalResult['graphInputs']['productLinks'] = [];
  const fitOf = (n: TopicNode): { fit: number; via: string; products: string[] }[] => {
    const routes: { fit: number; via: string; products: string[] }[] = [];
    for (const ps of problemsOfTopic.get(n.id) ?? []) {
      for (const pr of ps.p.products) {
        const fit = pr.via === 'routes_to' && pr.live ? 1 : pr.live ? 0.9 : 0.6;
        routes.push({ fit, via: `${ps.p.label} → ${pr.id.replace('product:', '')} (${pr.via}${pr.live ? ', LIVE' : ', TO BUILD'})`, products: [pr.id] });
      }
    }
    const cta = ctx.get(n.id)?.cta;
    if (cta && CTA_FIT[cta] !== undefined) routes.push({ fit: CTA_FIT[cta], via: `architecture CTA ${cta}`, products: CTA_PRODUCTS[cta] ?? [] });
    return routes;
  };
  for (const n of nodes) {
    if (n.level !== 'topic' && n.level !== 'subtopic') continue;
    let routes = fitOf(n);
    if (!routes.length && n.level === 'subtopic' && n.parent) routes = fitOf(byId.get(n.parent)!).map((r) => ({ ...r, via: `parent: ${r.via}` }));
    if (!routes.length && n.origin === 'demand' && n.level === 'topic') {
      const sib = nearest(children(n.parent!).filter((s) => s.level === 'topic' && s.id !== n.id && s.origin !== 'demand'), (s) => cos(nodeText(n.id), nodeText(s.id)) ?? lexicalSim(n.label, s.label));
      if (sib) routes = fitOf(sib.item).map((r) => ({ ...r, fit: r.fit * 0.9, via: `like nearest sibling "${sib.item.label}": ${r.via}` }));
    }
    n.scores.productFit = productFitScore(routes);
    const products = [...new Set(routes.flatMap((r) => r.products))].filter((p) => productIds.has(p));
    n.mapsTo.products = products;
    for (const p of products) productLinks.push({ topic: n.id, product: p, fit: Math.max(...routes.filter((r) => r.products.includes(p)).map((r) => r.fit)), via: routes.find((r) => r.products.includes(p))?.via ?? '' });
    const best = routes.sort((a, b) => b.fit - a.fit)[0];
    n.reasons = { ...n.reasons, productFit: best ? best.via : 'no route to a Rite or scan' };
  }

  // ---------------------------------------------------------------- 8. demand + priority
  const rawDemand = new Map<string, number>();
  for (const n of nodes) {
    if (n.level !== 'topic' && n.level !== 'subtopic') continue;
    const qs = n.level === 'topic' ? allQueriesOf(n.id) : ownQueries.get(n.id) ?? [];
    const mass = audienceMass((problemsOfTopic.get(n.id) ?? []).map((x) => ({ share: x.share, quotes: x.p.quoteCount, likes: x.p.likes, forumScore: x.p.forumScore })));
    rawDemand.set(n.id, demandRaw(qs.map((q) => q.signal), n.level === 'topic' ? mass : 0));
  }
  for (const level of ['topic', 'subtopic'] as const) {
    const at = nodes.filter((n) => n.level === level);
    const max = Math.max(0, ...at.map((n) => rawDemand.get(n.id) ?? 0));
    for (const n of at) {
      const rawD = rawDemand.get(n.id) ?? 0;
      n.scores.demand = demandScore(rawD, max);
      const qs = n.queries;
      n.reasons = {
        ...n.reasons,
        demand: `${qs.length} queries (${[...new Set(qs.flatMap((q) => q.sources))].join(', ') || 'none'}), raw ${Math.round(rawD * 10) / 10} vs level max ${Math.round(max * 10) / 10}${(problemsOfTopic.get(n.id) ?? []).length ? `, includes audience mass from ${(problemsOfTopic.get(n.id) ?? []).map((x) => x.p.slug).join(', ')}` : ''}`,
      };
    }
  }
  for (const n of nodes) {
    if (n.level !== 'topic' && n.level !== 'subtopic') continue;
    const stance = n.stance ?? ctx.get(n.id)?.stance ?? 'use';
    n.scores.priority = priorityScore(n.scores, stance);
    n.reasons = { ...n.reasons, priority: `D ${n.scores.demand} · P ${n.scores.proof} · C ${n.scores.coverage} · F ${n.scores.productFit} · K ${n.scores.competition}${stance !== 'use' ? ` · stance ${stance}` : ''}` };
  }
  // roll up: sections from topics, pillars from sections
  for (const level of ['section', 'pillar'] as const) {
    for (const n of nodes.filter((x) => x.level === level)) {
      const kids = children(n.id).filter((c) => c.level !== 'subtopic');
      const rawKids = kids.map((k) => (k.level === 'topic' ? rawDemand.get(k.id) ?? 0 : rawDemand.get(k.id) ?? 0));
      rawDemand.set(n.id, rawKids.reduce((s, x) => s + x, 0));
      const w = (k: TopicNode) => Math.max(1, k.scores.demand);
      n.scores.proof = weightedMean(kids.map((k) => ({ v: k.scores.proof, w: w(k) })));
      n.scores.coverage = weightedMean(kids.map((k) => ({ v: k.scores.coverage, w: w(k) })));
      n.scores.competition = weightedMean(kids.map((k) => ({ v: k.scores.competition, w: w(k) })));
      n.scores.productFit = kids.length ? Math.max(...kids.map((k) => k.scores.productFit)) : 0;
      n.status = kids.some((k) => k.status === 'LIVE') ? 'LIVE' : kids.some((k) => k.status === 'BUILT') ? 'BUILT' : kids.some((k) => k.status === 'TO BUILD') ? 'TO BUILD' : 'NONE';
      n.mapsTo.problems = [...new Set(kids.flatMap((k) => k.mapsTo.problems ?? []))];
      n.mapsTo.products = [...new Set(kids.flatMap((k) => k.mapsTo.products ?? []))];
      n.competitors = [...new Set(kids.flatMap((k) => k.competitors))].slice(0, 10);
    }
    const at = nodes.filter((x) => x.level === level);
    const max = Math.max(0, ...at.map((n) => rawDemand.get(n.id) ?? 0));
    for (const n of at) {
      n.scores.demand = demandScore(rawDemand.get(n.id) ?? 0, max);
      n.scores.priority = priorityScore(n.scores);
      n.reasons = { demand: `sum of ${children(n.id).length} children's raw demand`, priority: 'same formula on the rolled-up scores (coverage, proof and competition are demand-weighted means of the children; fit is the best child)' };
    }
  }

  // ---------------------------------------------------------------- 9. queue ranks
  const queue = nodes.filter((n) => n.level === 'topic' && n.scores.coverage < QUEUE_MAX_COVERAGE && n.stance !== 'guardrail').sort((a, b) => b.scores.priority - a.scores.priority || b.scores.demand - a.scores.demand);
  queue.forEach((n, i) => (n.queueRank = i + 1));
  for (const n of nodes) if (n.queueRank === undefined) n.queueRank = null;

  // order: tree order (pillars, then depth-first)
  const ordered: TopicNode[] = [];
  const walk = (id: string | null) => {
    const kids = nodes.filter((n) => n.parent === id).sort((a, b) => (a.level === 'subtopic' && b.level === 'subtopic' ? b.scores.priority - a.scores.priority : 0));
    for (const k of kids) {
      ordered.push(k);
      walk(k.id);
    }
  };
  walk(null);

  const counts: Record<string, number> = {};
  const origins: Record<string, number> = {};
  for (const n of ordered) {
    counts[n.level] = (counts[n.level] ?? 0) + 1;
    origins[`${n.level}:${n.origin ?? 'architecture'}`] = (origins[`${n.level}:${n.origin ?? 'architecture'}`] ?? 0) + 1;
  }
  const report: BuildTopicalReport = {
    generatedAt,
    counts,
    origins,
    harvest: { ...harvester.stats, expandedTopics: expanded },
    queries: { total: queries.length, placed: queryLinks.length, onSubtopics: subPlacement.size, inDemandTopics, unplaced: rest.length, offTopic, bySource },
    embeddings: { enabled: embedOn, embedded: cache?.embedded ?? 0, cached: cache?.hits ?? 0, tokens: cache?.tokens ?? 0, costUsd: cache?.costUsd ?? 0 },
    proof: { mode: proofMode, claimsWithEvidence: [...claimBest.values()].filter((c) => c.sim >= 0.45).length, poolChunks: pool?.rows.length ?? 0 },
    contentPosts: { total: contentPosts.length, linked: linkedPosts },
    warnings,
  };
  const map: TopicalMap = {
    version: MAP_VERSION,
    centralEntity: CENTRAL_ENTITY,
    sourceContext: sourceContext({
      audienceItems: [...g.nodes.values()].filter((n) => n.type === 'quote').length,
      problems: problems.filter((p) => !p.guardrail).length,
      acRequests: harvester.stats.requests,
      acCached: harvester.stats.cacheHits,
      acQueries: queries.filter((q) => q.sources.includes('google_ac') || q.sources.includes('youtube_ac')).length,
      vidiq: vidiq.length,
      channels: channels.length,
      claims: usableClaims.length,
      blocked: !!harvester.stats.blocked,
    }),
    generatedAt,
    levels: [...TOPIC_LEVELS],
    nodes: ordered,
    meta: {
      harvest: report.harvest,
      queries: report.queries,
      embeddings: { enabled: embedOn, model: 'text-embedding-3-small' },
      thresholds: th,
      proof: report.proof,
      unplacedSample: rest.slice(0, 25).map((q) => q.text),
      queueMaxCoverage: QUEUE_MAX_COVERAGE,
      sources: ['content/architecture.json', 'gtm/problem-solution-map.md', 'gtm/free-quiz-spec-v2.md', 'strategy/thesis-evidence-map.md', 'research/conversation/*.json', 'research/creators/landscape.json', 'research/language/audience-vocabulary.md', 'content/topical-map-seeds.json'],
    },
  };
  return { map, report, ctx, graphInputs: { problemLinks, claimLinks, productLinks, competitorLinks, queryLinks } };
}

export type { Seeds, VidiqRow, Placement, ProblemInfo };
