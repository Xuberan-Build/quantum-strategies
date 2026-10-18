/**
 * Synthetic topical-map fixture for building and testing /admin/brain/map before the
 * data layer is live. Deterministic, generic labels, no brain content.
 *
 * Served by the map API only when fixtureAllowed() (development, never production),
 * mirroring graph-fixture.ts.
 */
import { fixtureAllowed } from './graph-fixture';
import type { TopicalMap, TopicNode, TopicScorecard } from './topical-map';
import type { QueueItem } from './topical-map-view';

export { fixtureAllowed };

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

const INTENTS: TopicNode['intent'][] = ['informational', 'problem', 'comparison', 'commercial', 'navigational'];
const STATUSES: TopicNode['status'][] = ['LIVE', 'BUILT', 'TO BUILD', 'NONE', 'NONE', 'TO BUILD'];
const PILLARS = ['SPINE', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];

let cached: TopicalMap | null = null;

export function fixtureTopicalMap(): TopicalMap & { fixture: true } {
  if (!cached) {
    const r = rng(7);
    const score = (bias = 0) => Math.max(0, Math.min(100, Math.round(r() * 100 * 0.85 + bias)));
    const nodes: TopicNode[] = [];
    const make = (id: string, level: TopicNode['level'], label: string, parent: string | null, pillarCode: string): TopicNode => {
      const demand = score(level === 'subtopic' ? -10 : 5);
      const coverage = score(-20);
      const proof = score();
      const competition = score();
      const productFit = score();
      const priority = Math.max(0, Math.min(100, Math.round(0.4 * demand + 0.25 * productFit + 0.2 * (100 - coverage) + 0.15 * (100 - competition))));
      const status = coverage > 70 ? 'LIVE' : STATUSES[Math.floor(r() * STATUSES.length)];
      const node: TopicNode = {
        id,
        level,
        label,
        parent,
        pillarCode,
        intent: INTENTS[Math.floor(r() * INTENTS.length)],
        summary: `Synthetic ${level} from the dev fixture.`,
        scores: { demand, proof, coverage, competition, productFit, priority },
        status,
        queryCount: Math.round(demand / 4 + r() * 6),
      };
      nodes.push(node);
      return node;
    };
    PILLARS.forEach((code, pi) => {
      const p = make(`topic:fixture-pillar-${pi + 1}`, 'pillar', `Sample pillar ${pi + 1}`, null, code);
      const sections = code === 'SPINE' ? 2 : 3 + Math.floor(r() * 3);
      for (let si = 1; si <= sections; si++) {
        const s = make(`topic:fixture-section-${pi + 1}-${si}`, 'section', `Sample section ${pi + 1}.${si}`, p.id, code);
        const topics = 4 + Math.floor(r() * 7);
        for (let ti = 1; ti <= topics; ti++) {
          const t = make(`topic:fixture-topic-${pi + 1}-${si}-${ti}`, 'topic', `Sample topic ${pi + 1}.${si}.${ti}`, s.id, code);
          const subs = Math.floor(r() * 5);
          for (let ui = 1; ui <= subs; ui++) make(`topic:fixture-subtopic-${pi + 1}-${si}-${ti}-${ui}`, 'subtopic', `Sample subtopic ${pi + 1}.${si}.${ti}.${ui}`, t.id, code);
        }
      }
    });
    cached = {
      centralEntity: {
        label: 'Sample central entity',
        definition: 'Synthetic definition from the dev fixture. The real map puts the method at the centre here.',
      },
      sourceContext: 'Dev fixture: synthetic scores, no real searches or comments.',
      generatedAt: '2026-10-17T00:00:00.000Z',
      nodes,
    };
  }
  return { ...cached, fixture: true };
}

export function fixtureQueue(limit = 20): QueueItem[] {
  const map = fixtureTopicalMap();
  const byParent = new Map<string, number>();
  for (const n of map.nodes) if (n.parent) byParent.set(n.parent, (byParent.get(n.parent) ?? 0) + 1);
  return map.nodes
    .filter((n) => (n.level === 'topic' || n.level === 'subtopic') && n.status !== 'LIVE')
    .sort((a, b) => b.scores.priority - a.scores.priority || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, limit))
    .map((n, i) => ({
      id: n.id,
      label: n.label,
      pillarCode: n.pillarCode,
      priority: n.scores.priority,
      demand: n.scores.demand,
      proof: n.scores.proof,
      coverage: n.scores.coverage,
      status: n.status,
      topQueries: [`sample query ${i + 1} a`, `sample query ${i + 1} b`, `sample query ${i + 1} c`],
    }));
}

export function fixtureTopic(id: string): (TopicScorecard & { fixture: true }) | null {
  const map = fixtureTopicalMap();
  const n = map.nodes.find((x) => x.id === id);
  if (!n) return null;
  const r = rng(id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11));
  const queue = fixtureQueue(1000);
  const pos = queue.findIndex((q) => q.id === id);
  const k = (max: number) => Math.floor(r() * (max + 1));
  return {
    ...n,
    queries: Array.from({ length: Math.min(n.queryCount, 6) }, (_, i) => ({
      text: `sample search phrasing ${i + 1}`,
      sources: i % 2 ? ['autocomplete'] : ['autocomplete', 'comments'],
      signal: Math.round(r() * 100),
    })),
    problems: Array.from({ length: k(2) + 1 }, (_, i) => ({
      id: `problem:fixture-problem-${i + 1}`,
      label: `Sample problem ${i + 1}`,
      quoteCount: 3 + k(20),
      topQuotes: [
        { text: `Sample audience quote ${i + 1}a.`, likes: k(400), source: 'a viewer under a sample video' },
        { text: `Sample audience quote ${i + 1}b.`, likes: k(80), source: 'a sample forum thread' },
      ],
    })),
    claims: Array.from({ length: k(3) }, (_, i) => ({
      id: `claim:fixture-claim-${i + 1}`,
      label: `Sample claim ${i + 1}`,
      tier: ['evidence', 'model', 'contested'][i % 3],
      bestSimilarity: i === 2 ? null : Math.round((0.55 + r() * 0.4) * 100) / 100,
      excerpt: 'Synthetic corpus excerpt from the dev fixture.',
    })),
    assets:
      n.status === 'NONE'
        ? []
        : [
            { kind: 'article', ref: 'sample-article', status: n.status, href: n.status === 'LIVE' ? '/articles/sample' : undefined },
            { kind: 'script', ref: 'sample-script', status: 'TO BUILD' },
          ],
    competitors: Array.from({ length: k(3) }, (_, i) => ({
      id: `creator:fixture-creator-${i + 1}`,
      label: `Sample creator ${i + 1}`,
      outlier: Math.round((1 + r() * 20) * 10) / 10,
      url: 'https://example.com/sample-video',
    })),
    products: n.scores.productFit > 50 ? [{ id: 'product:fixture-product-1', label: 'Sample product 1' }] : [],
    queuePosition: pos >= 0 ? pos + 1 : null,
    fixture: true,
  };
}
