import { describe, expect, it } from 'vitest';
import { fixtureTopic, fixtureTopicalMap } from '../topical-map-fixture';
import {
  ROOT_ID,
  arcFor,
  arcPath,
  buildTree,
  descendants,
  isTopicId,
  litIds,
  mapViewFromParams,
  mapViewToQuery,
  parseQueueLimit,
  rampColor,
  scoreWhy,
  whyNow,
  type TopicNode,
} from '../topical-map-view';

const node = (id: string, parent: string | null, demand: number, extra: Partial<TopicNode> = {}): TopicNode => ({
  id,
  level: 'topic',
  label: id,
  parent,
  pillarCode: 'P1',
  intent: 'problem',
  scores: { demand, proof: 50, coverage: 10, competition: 20, productFit: 60, priority: 70 },
  status: 'TO BUILD',
  queryCount: 3,
  ...extra,
});

describe('buildTree', () => {
  it('sizes leaves by demand, sums parents and lays angles out in order', () => {
    const { root, byId } = buildTree([node('topic:p', null, 0, { level: 'pillar' }), node('topic:a', 'topic:p', 30), node('topic:b', 'topic:p', 10)]);
    const p = byId.get('topic:p')!;
    expect(p.value).toBe(40);
    expect(root.value).toBe(40);
    expect(p.children.map((c) => c.id)).toEqual(['topic:a', 'topic:b']);
    expect(byId.get('topic:a')!.x1 - byId.get('topic:a')!.x0).toBeCloseTo(Math.PI * 2 * 0.75);
    expect(byId.get('topic:a')!.depth).toBe(2);
  });

  it('keeps orphans and breaks cycles by attaching them to the root', () => {
    const { root, byId } = buildTree([node('topic:x', 'topic:missing', 5), node('topic:c1', 'topic:c2', 5), node('topic:c2', 'topic:c1', 5)]);
    expect(descendants(root).length).toBe(4);
    expect(byId.get('topic:x')!.parent!.id).toBe(ROOT_ID);
    expect(root.value).toBeGreaterThan(0);
  });

  it('handles the full fixture', () => {
    const map = fixtureTopicalMap();
    const { root, byId } = buildTree(map.nodes);
    expect(byId.size).toBe(map.nodes.length);
    expect(root.children.every((c) => c.node?.level === 'pillar')).toBe(true);
    expect(root.children[0].node?.pillarCode).toBe('SPINE');
    const p = root.children[1];
    const a = arcFor(p.children[0], p);
    expect(a.r).toBe(1);
    expect(a.a0).toBe(0);
  });
});

describe('geometry and colour', () => {
  it('draws annular sectors and full rings', () => {
    expect(arcPath(0, 1, 10, 20)).toMatch(/^M.*A20,20 .*L.*A10,10 .*Z$/);
    expect(arcPath(0, Math.PI * 2, 10, 20).match(/A/g)).toHaveLength(4);
    expect(arcPath(1, 1, 10, 20)).toBe('');
  });

  it('ramps from dark to light', () => {
    expect(rampColor(0)).toBe('rgb(46, 34, 24)');
    expect(rampColor(100)).toBe('rgb(240, 207, 143)');
    expect(rampColor(NaN)).toBe(rampColor(0));
  });
});

describe('filters', () => {
  it('lights matches and their ancestors only', () => {
    const { byId } = buildTree([
      node('topic:p', null, 0, { level: 'pillar', pillarCode: 'P2' }),
      node('topic:a', 'topic:p', 30, { status: 'LIVE', pillarCode: 'P2' }),
      node('topic:b', 'topic:p', 10, { pillarCode: 'P2' }),
    ]);
    expect(litIds(byId, { pillar: null, statuses: null, intents: null, minPriority: 0 })).toBeNull();
    const lit = litIds(byId, { pillar: null, statuses: ['LIVE'], intents: null, minPriority: 0 })!;
    expect([...lit].sort()).toEqual([ROOT_ID, 'topic:a', 'topic:p'].sort());
  });
});

describe('URL state', () => {
  it('round-trips and drops junk', () => {
    const v = mapViewFromParams(new URLSearchParams('topic=topic%3Aa&metric=proof&pillar=P3&status=LIVE,TO_BUILD,bogus&intent=problem,nope&min=40'));
    expect(v).toEqual({ topic: 'topic:a', metric: 'proof', pillar: 'P3', statuses: ['LIVE', 'TO BUILD'], intents: ['problem'], minPriority: 40 });
    expect(mapViewFromParams(new URLSearchParams(mapViewToQuery(v)))).toEqual(v);
    const junk = mapViewFromParams(new URLSearchParams('topic=node:x&metric=evil&pillar=<script>&min=-1'));
    expect(junk).toEqual({ topic: null, metric: 'priority', pillar: null, statuses: null, intents: null, minPriority: 0 });
    expect(mapViewToQuery(junk)).toBe('');
  });

  it('validates topic ids and queue limits', () => {
    expect(isTopicId('topic:a/b')).toBe(true);
    expect(isTopicId('topic:../x')).toBe(false);
    expect(isTopicId('claim:a')).toBe(false);
    expect(parseQueueLimit(null)).toBe(20);
    expect(parseQueueLimit('7.9')).toBe(7);
    expect(parseQueueLimit('abc')).toBe(20);
  });
});

describe('plain-words lines', () => {
  it('explains why now from demand, coverage and proof', () => {
    expect(whyNow({ demand: 85, proof: 70, coverage: 5, status: 'TO BUILD' })).toBe(
      'People ask about it a lot (demand 85), nothing LIVE covers it, the corpus already backs it.',
    );
    expect(whyNow({ demand: 20, proof: 10, coverage: 50, status: 'BUILT' })).toBe(
      'Demand is low (20), an asset is BUILT and waiting to ship, proof needs work first.',
    );
  });

  it('gives every score a one-line why', () => {
    const t = fixtureTopic('topic:fixture-topic-2-1-1')!;
    for (const k of ['demand', 'proof', 'coverage', 'competition', 'productFit', 'priority'] as const) {
      const line = scoreWhy(k, t);
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toContain('—');
    }
    const empty = { ...t, queryCount: 0, problems: [], claims: [], assets: [], competitors: [], products: [], queuePosition: null };
    expect(scoreWhy('demand', empty)).toMatch(/No searches/);
    expect(scoreWhy('proof', empty)).toMatch(/No claim/);
    expect(scoreWhy('coverage', empty)).toMatch(/Nothing made/);
    expect(scoreWhy('competition', empty)).toMatch(/Context only/);
    expect(scoreWhy('priority', empty)).toMatch(/^Not in the make-next queue/);
  });
});
