/**
 * Synthetic topical-map fixture for building and testing /admin/brain/map without
 * reading production. Deterministic, generic labels, no brain content. Shapes match the
 * data layer exactly (TopicalMap / TopicScorecard from topical-map.ts).
 *
 * Served by the map API only when fixtureAllowed() (development, never production),
 * mirroring graph-fixture.ts.
 */
import { fixtureAllowed } from './graph-fixture';
import type { TopicScorecard } from './topical-map';
import { QUEUE_MAX_COVERAGE, TOPIC_LEVELS, type PillarCode, type TopicalMap, type TopicNode, type TopicQuery } from './topical-map-types';
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
const PILLARS: PillarCode[] = ['SPINE', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
const SOURCES: TopicQuery['sources'][] = [['google_ac', 'youtube_ac'], ['audience'], ['vidiq', 'google_ac'], ['youtube_ac']];

let cached: TopicalMap | null = null;

export function fixtureTopicalMap(): TopicalMap & { fixture: true } {
  if (!cached) {
    const r = rng(7);
    const score = (bias = 0) => Math.max(0, Math.min(100, Math.round(r() * 100 * 0.85 + bias)));
    const nodes: TopicNode[] = [];
    const make = (id: string, level: TopicNode['level'], label: string, parent: string | null, pillarCode: PillarCode): TopicNode => {
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
        mapsTo: {},
        queries: Array.from({ length: Math.min(6, Math.round(demand / 15 + r() * 3)) }, (_, i) => ({
          text: `sample search phrasing ${i + 1}`,
          sources: SOURCES[i % SOURCES.length],
          signal: Math.round(r() * 60) / 10,
        })),
        scores: { demand, proof, coverage, competition, productFit, priority },
        status,
        assets: [],
        competitors: [],
        notes: level === 'topic' ? 'Synthetic note from the dev fixture.' : '',
        origin: 'architecture',
        reasons: { placement: `Synthetic ${level}, placed by the dev fixture.` },
        evidence: [],
        audienceWords: [],
        queueRank: null,
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
      version: 1,
      centralEntity: {
        label: 'Sample central entity',
        definition: 'Synthetic definition from the dev fixture. The real map puts the method at the centre here.',
      },
      sourceContext: 'Dev fixture: synthetic scores, no real searches or comments.',
      generatedAt: '2026-10-17T00:00:00.000Z',
      levels: [...TOPIC_LEVELS],
      nodes,
      meta: { fixture: true },
    };
  }
  return { ...cached, fixture: true };
}

/** Mirrors queueFrom() in topical-map.ts: topic-level nodes under the coverage cap, never guardrails, by priority. */
function fixtureQueueNodes(): TopicNode[] {
  return fixtureTopicalMap()
    .nodes.filter((n) => n.level === 'topic' && n.scores.coverage < QUEUE_MAX_COVERAGE && n.stance !== 'guardrail')
    .sort((a, b) => b.scores.priority - a.scores.priority || b.scores.demand - a.scores.demand || a.id.localeCompare(b.id));
}

export function fixtureQueue(limit = 20): QueueItem[] {
  return fixtureQueueNodes()
    .slice(0, Math.max(1, limit))
    .map((n) => ({
      id: n.id,
      label: n.label,
      pillarCode: n.pillarCode,
      priority: n.scores.priority,
      demand: n.scores.demand,
      proof: n.scores.proof,
      coverage: n.scores.coverage,
      status: n.status,
      topQueries: n.queries.slice(0, 5).map((q) => q.text),
    }));
}

export function fixtureTopic(id: string): (TopicScorecard & { fixture: true }) | null {
  const map = fixtureTopicalMap();
  const byId = new Map(map.nodes.map((x) => [x.id, x]));
  const n = byId.get(id);
  if (!n) return null;
  const r = rng(id.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11));
  const k = (max: number) => Math.floor(r() * (max + 1));
  const sim = () => Math.round((0.4 + r() * 0.45) * 1000) / 1000;
  const queue = fixtureQueueNodes();
  const pos = queue.findIndex((q) => q.id === id);
  const breadcrumb: TopicScorecard['breadcrumb'] = [];
  for (let p = n.parent ? byId.get(n.parent) : undefined; p; p = p.parent ? byId.get(p.parent) : undefined) breadcrumb.unshift({ id: p.id, label: p.label, level: p.level });
  const assetStatus = n.status === 'NONE' ? null : n.status;
  return {
    topic: n,
    breadcrumb,
    children: map.nodes.filter((x) => x.parent === id).sort((a, b) => b.scores.priority - a.scores.priority),
    queries: n.queries,
    problems: Array.from({ length: k(2) + 1 }, (_, i) => ({
      id: `problem:fixture-problem-${i + 1}`,
      label: `Sample problem ${i + 1}`,
      share: Math.round((0.3 + r() * 0.7) * 100) / 100,
      quoteCount: 3 + k(20),
      quotes: [
        { text: `Sample audience quote ${i + 1}a.`, likes: k(400), source: 'youtube', url: 'https://example.com/sample-video' },
        { text: `Sample audience quote ${i + 1}b.`, likes: k(80), source: 'forum', url: null },
      ],
    })),
    claims: Array.from({ length: k(3) }, (_, i) => {
      const s = i === 2 ? null : sim();
      return {
        id: `claim:fixture-claim-${i + 1}`,
        label: `Sample claim ${i + 1}`,
        tier: ['evidence', 'model', 'contested'][i % 3],
        strength: ['Strong', 'Moderate', 'Weak'][i % 3],
        similarity: s,
        via: 'architecture source',
        evidence:
          s == null
            ? []
            : [{ chunkId: `fixture-chunk-${i + 1}`, source: 'Sample source', similarity: s, tier: 'evidence', content: 'Synthetic corpus excerpt from the dev fixture.', url: null }],
      };
    }),
    evidence: [],
    assets: assetStatus
      ? [
          { kind: 'doc', ref: 'doc:sample-doc', status: assetStatus, label: 'Sample doc', href: '/admin/brain/docs/sample-doc' },
          { kind: 'spoke', ref: 'spoke:sample-spoke', status: 'TO BUILD', label: 'Sample spoke' },
        ]
      : [],
    competitors: Array.from({ length: k(3) }, (_, i) => ({
      id: `UCfixture${i + 1}`,
      creatorId: `creator:fixture-creator-${i + 1}`,
      label: `Sample creator ${i + 1}`,
      weight: Math.round((0.4 + r() * 0.6) * 1000) / 1000,
      outlier: Math.round((1 + r() * 20) * 10) / 10,
      via: 'same pillar and problem',
      url: 'https://example.com/sample-channel',
    })),
    products: n.scores.productFit > 50 ? [{ id: 'product:fixture-product-1', label: 'Sample product 1', status: 'LIVE', fit: 0.8, via: 'sample route' }] : [],
    queue: { position: pos >= 0 ? pos + 1 : null, size: queue.length },
    fixture: true,
  };
}
