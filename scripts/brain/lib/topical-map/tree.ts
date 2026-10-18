/**
 * Seed the topical map tree from Austin's architecture (content/architecture.json) and the problem map.
 * Pure: data in, nodes out.
 *
 *   pillar   (8 + the Spine)       <- architecture pillars
 *   section  (sub-pillars)         <- architecture sub-pillars (demand topics attach to the nearest one)
 *   topic    (clusters)            <- architecture clusters, + problem topics the clusters don't cover, + demand topics
 *   subtopic (spokes + questions)  <- architecture spokes, + groups of harvested queries
 *
 * Ids are stable across builds: `topic:<architecture code>-<slug of the name>`.
 */
import type { PillarCode, TopicNode, TopicStance } from '../../../../src/lib/brain/topical-map-types';
import { claimRefs, type Architecture } from '../graph/extract-architecture';
import { nodeId, slugify } from '../graph/ids';
import { truncate } from '../graph/md';

export interface ArchPiece {
  id: string;
  title: string;
  format?: string;
  stage?: string;
  cta?: string;
  status?: string;
  source?: string | null;
  location?: string | null;
  misbelief?: string;
}

export interface ArchCluster {
  id: string;
  name: string;
  misbelief?: string;
  angle?: string;
  domains?: string[];
  cornerstone?: ArchPiece | null;
  spokes?: ArchPiece[];
}

/** Internal per-node context the builder needs but the JSON contract doesn't carry. */
export interface NodeCtx {
  code: string | null;
  seedPhrases: string[];
  /** extra phrases a node is matched through (its problems' words); never harvested */
  matchPhrases?: string[];
  embedText: string;
  cta: string | null;
  pieces: ArchPiece[];
  stance: TopicStance;
  /** pillar code hint for demand nodes */
  pillarHint?: string;
}

export interface SeededTree {
  nodes: TopicNode[];
  ctx: Map<string, NodeCtx>;
}

export const pillarCodeOf = (archId: string): PillarCode => (archId === 'X' ? 'SPINE' : (archId as PillarCode));

/** topic:<code>-<slug>; dots in codes become hyphens. */
export function topicId(code: string, name: string): string {
  const c = code.toLowerCase().replace(/\./g, '-');
  return nodeId('topic', `${c}-${slugify(name, Math.max(20, 110 - c.length))}`);
}

/** Search-shaped fallback seed from a cluster name: lowercased, leading "why you"/"the" dropped, max 5 words. */
export function derivedSeed(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/^(why|how|the|a|an|your|you)\s+/, '')
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 5).join(' ');
}

const empty = (): Pick<TopicNode, 'queries' | 'scores' | 'assets' | 'competitors'> => ({
  queries: [],
  scores: { demand: 0, proof: 0, coverage: 0, competition: 0, productFit: 0, priority: 0 },
  assets: [],
  competitors: [],
});

const STATUS_KEEP = new Set(['LIVE', 'BUILT', 'TO BUILD']);
/** Architecture piece status -> node status. REFRESH / MERGE / REWRITE pieces are live pages that need work. */
export const pieceStatus = (s: string | undefined): TopicNode['status'] => (!s ? 'NONE' : STATUS_KEEP.has(s) ? (s as TopicNode['status']) : 'LIVE');

export function seedTree(arch: Architecture & { pillars?: unknown[] }, seedClusters: Record<string, string[]> = {}): SeededTree {
  const nodes: TopicNode[] = [];
  const ctx = new Map<string, NodeCtx>();
  const pillars = [...(arch.pillars ?? []), ...(arch.spine ? [arch.spine] : [])] as (NonNullable<Architecture['spine']> & { audience?: string })[];

  for (const p of pillars) {
    const pc = pillarCodeOf(p.id);
    const pid = topicId(p.id === 'X' ? 'x' : p.id, p.name.replace(/\(.*\)/, '').trim());
    nodes.push({
      id: pid,
      level: 'pillar',
      label: p.name,
      parent: null,
      pillarCode: pc,
      intent: 'informational',
      summary: truncate(p.job ?? p.pov ?? p.law ?? '', 400),
      mapsTo: { cluster: undefined },
      status: 'NONE',
      notes: [p.law ? `Law: ${p.law}` : null, p.misbelief ? `Misbelief it answers: ${p.misbelief}` : null, p.product ? `Routes to: ${p.product}` : null].filter(Boolean).join(' · '),
      origin: 'architecture',
      ...empty(),
    });
    ctx.set(pid, { code: p.id, seedPhrases: [], embedText: `${p.name}. ${p.job ?? ''} ${p.misbelief ?? ''}`, cta: null, pieces: [], stance: 'use' });

    for (const sp of p.subpillars ?? []) {
      const sid = topicId(sp.id, sp.name);
      const clusters = (sp.clusters ?? []) as ArchCluster[];
      nodes.push({
        id: sid,
        level: 'section',
        label: sp.name,
        parent: pid,
        pillarCode: pc,
        intent: 'informational',
        summary: truncate(clusters.map((c) => c.name).join(' · '), 400),
        mapsTo: {},
        status: 'NONE',
        notes: `Sub-pillar ${sp.id}`,
        origin: 'architecture',
        ...empty(),
      });
      ctx.set(sid, { code: sp.id, seedPhrases: [], embedText: `${sp.name}. ${clusters.map((c) => `${c.name} ${c.misbelief ?? ''}`).join('. ')}`, cta: null, pieces: [], stance: 'use' });

      for (const c of clusters) {
        const tid = topicId(c.id, c.name);
        const cs = c.cornerstone ?? null;
        const spokes = c.spokes ?? [];
        const claims = [...new Set([cs, ...spokes].flatMap((x) => claimRefs(x?.source)))].map((x) => nodeId('claim', x));
        const seeds = seedClusters[c.id]?.length ? seedClusters[c.id] : [derivedSeed(c.name)];
        nodes.push({
          id: tid,
          level: 'topic',
          label: c.name,
          parent: sid,
          pillarCode: pc,
          intent: 'informational',
          summary: truncate([c.misbelief ? `Misbelief: "${c.misbelief}"` : null, c.angle ?? null].filter(Boolean).join(' '), 600),
          mapsTo: {
            cluster: nodeId('cluster', c.id),
            cornerstone: cs ? nodeId('cornerstone', cs.id) : undefined,
            spokes: spokes.map((s) => nodeId('spoke', s.id)),
            claims,
          },
          status: 'NONE',
          notes: [cs ? `Cornerstone: "${cs.title}" (${cs.status ?? 'status unknown'})` : null, c.domains?.length ? `Domains: ${c.domains.join(', ')}` : null].filter(Boolean).join(' · '),
          origin: 'architecture',
          ...empty(),
        });
        ctx.set(tid, {
          code: c.id,
          seedPhrases: seeds,
          embedText: [c.name, c.misbelief, cs?.title, seeds.join(', ')].filter(Boolean).join('. '),
          cta: cs?.cta ?? spokes[0]?.cta ?? null,
          pieces: [...(cs ? [cs] : []), ...spokes],
          stance: 'use',
        });

        for (const s of spokes) {
          const code = s.id.replace(/^.*-(\d+)$/, '$1');
          const stid = topicId(`${c.id}-${code}`, s.title);
          nodes.push({
            id: stid,
            level: 'subtopic',
            label: s.title,
            parent: tid,
            pillarCode: pc,
            intent: 'informational',
            summary: truncate(s.misbelief ? `Answers the misbelief "${s.misbelief}"` : '', 400),
            mapsTo: { spokes: [nodeId('spoke', s.id)], claims: claimRefs(s.source).map((x) => nodeId('claim', x)) },
            status: pieceStatus(s.status),
            notes: [s.format ? `Format: ${s.format}` : null, s.stage ? `Stage: ${s.stage}` : null, s.source ? `Source: ${s.source}` : null].filter(Boolean).join(' · '),
            origin: 'architecture',
            ...empty(),
          });
          ctx.set(stid, { code: s.id, seedPhrases: [], embedText: [s.title, s.misbelief].filter(Boolean).join('. '), cta: s.cta ?? cs?.cta ?? null, pieces: [s], stance: 'use' });
        }
      }
    }
  }
  return { nodes, ctx };
}

export interface ProblemInfo {
  id: string; // problem:<slug>
  slug: string;
  row: string | null;
  label: string;
  summary: string | null;
  pillars: string[]; // architecture codes P1..P8 / X
  keywords: string[];
  theirWords: string[];
  quoteCount: number;
  likes: number;
  forumScore: number;
  guardrail: boolean;
  products: { id: string; via: 'routes_to' | 'addresses'; live: boolean }[];
  claims: string[];
  mechanism: string | null;
}

/**
 * Map problems to topics. `sim(problem, topic)` is cosine on embeddings (or lexical when embeddings are off).
 * A problem attaches to every topic within `margin` of its best match that clears `floor`, restricted to the
 * problem's pillars when it has any (falls back to all pillars when none clears). Guardrail problems never attach.
 */
export function mapProblems(
  problems: ProblemInfo[],
  topics: TopicNode[],
  sim: (p: ProblemInfo, t: TopicNode) => number,
  opts: { floor: number; margin: number; maxPerProblem?: number },
): Map<string, { topic: string; share: number; sim: number }[]> {
  const out = new Map<string, { topic: string; share: number; sim: number }[]>();
  const archCode = (pc: string) => (pc === 'SPINE' ? 'X' : pc);
  for (const p of problems) {
    if (p.guardrail) continue;
    const scored = (inPillars: boolean) =>
      topics
        .filter((t) => !inPillars || !p.pillars.length || p.pillars.includes(archCode(t.pillarCode)))
        .map((t) => ({ t, s: sim(p, t) }))
        .sort((a, b) => b.s - a.s);
    let ranked = scored(true);
    if (!ranked.length || ranked[0].s < opts.floor) ranked = scored(false);
    if (!ranked.length || ranked[0].s < opts.floor) continue;
    const best = ranked[0].s;
    const picked = ranked.filter((x) => x.s >= opts.floor && x.s >= best - opts.margin).slice(0, opts.maxPerProblem ?? 4);
    const total = picked.reduce((s, x) => s + x.s, 0) || 1;
    out.set(
      p.id,
      picked.map((x) => ({ topic: x.t.id, share: Math.round((x.s / total) * 1000) / 1000, sim: Math.round(x.s * 1000) / 1000 })),
    );
  }
  return out;
}

/** A topic for a problem the architecture doesn't cover, under the nearest section of the problem's first pillar. */
export function problemTopic(p: ProblemInfo, section: TopicNode): TopicNode {
  return {
    id: nodeId('topic', `prob-${p.slug}`),
    level: 'topic',
    label: p.label,
    parent: section.id,
    pillarCode: section.pillarCode,
    intent: 'problem',
    summary: truncate(p.summary ?? p.label, 600),
    mapsTo: { problems: [p.id], claims: p.claims, products: p.products.map((x) => x.id) },
    status: 'NONE',
    notes: 'origin: problem. A problem from the problem map that no architecture cluster covers.',
    origin: 'problem',
    ...empty(),
  };
}
