// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { TopicalMap, TopicNode } from '../../../../../src/lib/brain/topical-map-types';
import { assignQueries, attachSubtopics, groupQueries, LEXICAL_THRESHOLDS } from '../cluster';
import { AcCache, expansions, Harvester, parseSuggest } from '../harvest';
import { isUsableQuery, lexicalSim, mergeQueries, normalizeQuery, queryIntent, queryKey, type HarvestedQuery } from '../queries';
import { buildQueue, shortQuote } from '../queue';
import { renderTopicalMapMd } from '../render';
import { audienceMass, competitionScore, competitorWeight, coverageScore, demandRaw, demandScore, priorityScore, productFitScore, proofScore } from '../score';
import { parseVidiqTable, parseVolume } from '../seeds';
import { derivedSeed, mapProblems, pieceStatus, problemTopic, seedTree, type ProblemInfo } from '../tree';
import { ARCH } from './fixtures/architecture';

describe('seedTree', () => {
  const { nodes, ctx } = seedTree(ARCH, { 'P1.1a': ['self image', 'old self'] });
  const by = (l: string) => nodes.filter((n) => n.level === l);

  it('builds pillar -> section -> topic -> subtopic from the architecture, plus the Spine', () => {
    expect(by('pillar').map((n) => n.pillarCode)).toEqual(['P1', 'SPINE']);
    expect(by('section')).toHaveLength(2);
    expect(by('topic')).toHaveLength(2);
    expect(by('subtopic')).toHaveLength(3);
    const topic = nodes.find((n) => n.id.startsWith('topic:p1-1a-'))!;
    expect(topic.parent).toBe(by('section')[0].id);
    expect(nodes.filter((n) => n.parent === topic.id).every((s) => s.level === 'subtopic')).toBe(true);
  });

  it('uses stable, valid ids and maps to the graph nodes', () => {
    for (const n of nodes) expect(n.id).toMatch(/^topic:[a-z0-9][a-z0-9-]{0,119}$/);
    const topic = nodes.find((n) => n.id.startsWith('topic:p1-1a-'))!;
    expect(topic.id).toBe('topic:p1-1a-why-you-snap-back-to-the-old-you');
    expect(topic.mapsTo).toMatchObject({ cluster: 'cluster:p1-1a', cornerstone: 'cornerstone:p1-1a-cs', spokes: ['spoke:p1-1a-01', 'spoke:p1-1a-02'] });
    expect(topic.mapsTo.claims).toEqual(['claim:p1', 'claim:p2']);
    expect(seedTree(ARCH).nodes.map((n) => n.id)).toEqual(nodes.map((n) => n.id));
  });

  it('keeps seeds and CTA in ctx, with a derived seed when none is configured', () => {
    const topic = nodes.find((n) => n.id.startsWith('topic:p1-1a-'))!;
    expect(ctx.get(topic.id)!.seedPhrases).toEqual(['self image', 'old self']);
    expect(ctx.get(topic.id)!.cta).toBe('quiz>I');
    const spine = nodes.find((n) => n.level === 'topic' && n.pillarCode === 'SPINE')!;
    expect(ctx.get(spine.id)!.seedPhrases).toEqual([derivedSeed('The Contested File')]);
  });

  it('maps piece statuses (needs-work pages count as LIVE)', () => {
    expect(pieceStatus('REFRESH')).toBe('LIVE');
    expect(pieceStatus('BUILT')).toBe('BUILT');
    expect(pieceStatus(undefined)).toBe('NONE');
    const built = nodes.find((n) => n.label === 'How your self-image runs your life')!;
    expect(built.status).toBe('BUILT');
  });

  it('maps problems to topics within their pillars and makes topics for uncovered ones', () => {
    const p = (slug: string, pillars: string[], label: string, guardrail = false): ProblemInfo => ({ id: `problem:${slug}`, slug, row: '1', label, summary: null, pillars, keywords: [], theirWords: [], quoteCount: 10, likes: 100, forumScore: 5, guardrail, products: [], claims: [], mechanism: null });
    const topics = by('topic');
    const sim = (pr: ProblemInfo, t: TopicNode) => lexicalSim(pr.label, t.label);
    const links = mapProblems([p('snap', ['P1'], 'snap back to old you'), p('trauma', [], 'trauma', true), p('money', ['P1'], 'I undercharge')], topics, sim, { floor: 0.4, margin: 0.1 });
    expect(links.get('problem:snap')![0].topic).toBe('topic:p1-1a-why-you-snap-back-to-the-old-you');
    expect(links.has('problem:trauma')).toBe(false);
    expect(links.has('problem:money')).toBe(false);
    const t = problemTopic(p('money', ['P1'], 'I undercharge'), by('section')[0]);
    expect(t).toMatchObject({ id: 'topic:prob-money', level: 'topic', origin: 'problem', intent: 'problem', pillarCode: 'P1' });
  });
});

describe('query normalisation and dedupe', () => {
  it('normalises case, accents, punctuation and apostrophes', () => {
    expect(normalizeQuery('  Why Do I SELF-Sabotage?? ')).toBe('why do i self sabotage');
    expect(normalizeQuery('Can’t say “no”')).toBe("can't say no");
    expect(normalizeQuery('Café & crème')).toBe('cafe and creme');
  });
  it('dedupe keys ignore articles, apostrophes and a trailing plural', () => {
    expect(queryKey('limiting beliefs')).toBe(queryKey('Limiting belief'));
    expect(queryKey("can't say no")).toBe(queryKey('cant say no'));
    expect(queryKey('the self image')).toBe(queryKey('self image'));
    expect(queryKey('stress')).toBe('stress');
  });
  it('drops junk', () => {
    expect(isUsableQuery('ab')).toBe(false);
    expect(isUsableQuery('12345')).toBe(false);
    expect(isUsableQuery('self image www com')).toBe(false);
    expect(isUsableQuery('self image')).toBe(true);
  });
  it('merges sightings across sources and seeds, summing signal per source', () => {
    const merged = mergeQueries(
      [
        { text: 'Self Image', source: 'google_ac', rank: 0, seed: 'self image' },
        { text: 'self image', source: 'google_ac', rank: 4, seed: 'self concept' },
        { text: 'self-image', source: 'youtube_ac', rank: 2, seed: 'self image' },
        { text: 'self image', source: 'vidiq', monthly: 45000 },
        { text: 'xy', source: 'google_ac', rank: 0, seed: 'x' },
      ],
      (seed) => (seed === 'self image' ? ['topic:a'] : []),
    );
    expect(merged).toHaveLength(1);
    const q = merged[0];
    expect(q.text).toBe('self image');
    expect(q.sources).toEqual(['google_ac', 'vidiq', 'youtube_ac']);
    expect(q.perSource.google_ac).toBe(1.1); // rank 0 = 1.0, +0.1 for a second seed
    expect(q.perSource.youtube_ac).toBe(0.9);
    expect(q.perSource.vidiq).toBeCloseTo(Math.log10(45000) - 2, 2);
    expect(q.seedTopics).toEqual(['topic:a']);
    expect(q.signal).toBeCloseTo(1.1 + 0.9 + (Math.log10(45000) - 2), 1);
  });
  it('classifies intent', () => {
    expect(queryIntent('why do i self sabotage')).toBe('problem');
    expect(queryIntent('self concept vs self esteem')).toBe('comparison');
    expect(queryIntent('best self help books')).toBe('commercial');
    expect(queryIntent('what is the reticular activating system')).toBe('informational');
    expect(queryIntent('dan koe one person business', ['Dan Koe'])).toBe('navigational');
  });
});

const hq = (text: string, signal = 1, seedTopics: string[] = [], sources: HarvestedQuery['sources'] = ['google_ac']): HarvestedQuery => ({ key: queryKey(text), text, signal, sources, seeds: [], seedTopics, perSource: {} });

describe('clustering', () => {
  const topics = [
    { id: 'topic:a', label: 'self image snap back' },
    { id: 'topic:b', label: 'people pleasing boundaries' },
  ];
  const text: Record<string, string> = { 'topic:a': 'self image snap back old self', 'topic:b': 'people pleasing boundaries say no', 'topic:a-1': 'diagram of the loop' };
  const sim = (q: HarvestedQuery, id: string) => lexicalSim(q.text, text[id] ?? '');

  it('assigns each query to its nearest topic with a reason, and leaves far ones unplaced', () => {
    const out = assignQueries([hq('how to set boundaries'), hq('self image psychology'), hq('minecraft seeds')], topics, sim, LEXICAL_THRESHOLDS);
    expect(out.map((p) => p.topic)).toEqual(['topic:b', 'topic:a', null]);
    expect(out[0].reason).toMatch(/nearest topic "people pleasing boundaries"/);
    expect(out[2].reason).toMatch(/no topic close enough/);
  });

  it('a topic\'s own seed pulls an ambiguous query toward it', () => {
    const q = hq('old habits', 1, ['topic:b']);
    const [p] = assignQueries([q], topics, () => 0.3, LEXICAL_THRESHOLDS);
    expect(p.topic).toBe('topic:b');
    expect(p.reason).toMatch(/its own seed surfaced it/);
  });

  it('moves a query down to the closest subtopic over the threshold', () => {
    const placed = assignQueries([hq('loop diagram self image'), hq('self image test')], topics, sim, LEXICAL_THRESHOLDS);
    expect(placed.map((p) => p.topic)).toEqual(['topic:a', 'topic:a']);
    const subs = attachSubtopics(placed, (t) => (t === 'topic:a' ? [{ id: 'topic:a-1', label: 'diagram' }] : []), sim, LEXICAL_THRESHOLDS);
    expect(subs.get(queryKey('loop diagram self image'))!.topic).toBe('topic:a-1');
    expect(subs.has(queryKey('self image test'))).toBe(false);
  });

  it('groups leftovers greedily; small or weak groups stay loose', () => {
    const qs = [hq('shadow work prompts', 2), hq('shadow work journal', 1.5), hq('shadow work', 1, [], ['vidiq']), hq('random thing', 3)];
    const { groups, rest } = groupQueries(qs, (a, b) => lexicalSim(a.text, b.text), { ...LEXICAL_THRESHOLDS, minGroupSignal: 3 });
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.text).sort()).toEqual(['shadow work', 'shadow work journal', 'shadow work prompts']);
    expect(groups[0].reason).toMatch(/3 queries/);
    expect(rest.map((r) => r.text)).toEqual(['random thing']);
  });
});

describe('scoring', () => {
  it('demand is log-scaled against the level max', () => {
    expect(demandScore(10, 10)).toBe(100);
    expect(demandScore(0, 10)).toBe(0);
    expect(demandScore(1, 100)).toBe(Math.round((100 * Math.log1p(1)) / Math.log1p(100)));
    expect(demandRaw([1, 2, 3], 0.5)).toBe(6.5);
    expect(demandRaw(Array(20).fill(1), 0)).toBe(15);
    expect(audienceMass([{ share: 0.5, quotes: 3, likes: 99, forumScore: 0 }])).toBeCloseTo(0.5 * (2 * 2 + 2), 5);
  });
  it('proof rewards similarity over the floor and the claim grade', () => {
    expect(proofScore(null, 0)).toBe(0);
    expect(proofScore(0.6, 1)).toBe(100);
    expect(proofScore(0.45, 0.7)).toBe(Math.round(100 * (0.65 * 0.5 + 0.35 * 0.7)));
    expect(proofScore(0.2, 0.4)).toBe(14);
  });
  it('coverage saturates and caps internal docs', () => {
    expect(coverageScore([])).toBe(0);
    expect(coverageScore([{ kind: 'cornerstone', status: 'LIVE' }])).toBe(63);
    expect(coverageScore([{ kind: 'spoke', status: 'TO BUILD' }])).toBe(0);
    const docs = Array(10).fill({ kind: 'deck', status: 'internal' });
    expect(coverageScore(docs)).toBe(Math.round(100 * (1 - Math.exp(-0.3))));
  });
  it('competition weights overlap and outlier strength', () => {
    expect(competitorWeight('high', 50)).toBeCloseTo(1, 5);
    expect(competitorWeight('low', 0)).toBeCloseTo(0.16, 5);
    expect(competitionScore([])).toBe(0);
    expect(competitionScore([1, 1, 1])).toBe(Math.round(100 * (1 - Math.exp(-3 / 2.5))));
  });
  it('product fit takes the best route, with a floor for none', () => {
    expect(productFitScore([])).toBe(15);
    expect(productFitScore([{ fit: 0.6 }, { fit: 1 }])).toBe(100);
  });
  it('priority favours demand × proof × low coverage × fit, tempered by competition and stance', () => {
    const base = { demand: 80, proof: 60, coverage: 0, productFit: 100, competition: 0 };
    const p = priorityScore(base);
    expect(priorityScore({ ...base, coverage: 90 })).toBeLessThan(p);
    expect(Math.abs(priorityScore({ ...base, competition: 100 }) - p * 0.7)).toBeLessThanOrEqual(1);
    expect(priorityScore({ ...base, demand: 20 })).toBeLessThan(p);
    expect(priorityScore({ ...base, proof: 0 })).toBeLessThan(p);
    expect(Math.abs(priorityScore(base, 'avoid') - p * 0.5)).toBeLessThanOrEqual(1);
    expect(priorityScore({ ...base, demand: 100, proof: 100, productFit: 100 })).toBe(100);
    expect(priorityScore({ ...base, demand: 0 })).toBe(0);
  });
});

describe('vidIQ anchors', () => {
  it('parses volumes and the table', () => {
    expect(parseVolume('~670K')).toBe(670000);
    expect(parseVolume('~3.3K')).toBe(3300);
    expect(parseVolume('n/a')).toBeNull();
    const md = '## 2\n\n| Phrase | Monthly searches | 30-day change | Read |\n|---|---|---|---|\n| manifestation | ~670K | **+16%** | Big |\n| shadow work | ~199K | +24% | Rising |\n';
    expect(parseVidiqTable(md)).toEqual([
      { phrase: 'manifestation', monthly: 670000, change: '+16%', read: 'Big' },
      { phrase: 'shadow work', monthly: 199000, change: '+24%', read: 'Rising' },
    ]);
  });
});

describe('harvest', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tm-cache-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('parses suggest answers and rejects block pages', () => {
    expect(parseSuggest('["q",["a","b"],[],{}]')).toEqual(['a', 'b']);
    expect(parseSuggest('<html>captcha</html>')).toBeNull();
  });

  it('caches, reuses, caps and stops at the first block', async () => {
    let calls = 0;
    const fetcher = async (url: string) => {
      calls++;
      if (url.includes('blocked')) return { status: 429, text: 'Too Many Requests' };
      return { status: 200, text: JSON.stringify(['q', [`${decodeURIComponent(url.split('q=')[1])} one`, 'two']]) };
    };
    const cache = new AcCache(dir, '2026-10-17');
    const h = new Harvester(cache, { network: true, maxRequests: 3, fetcher, sleep: async () => {}, minDelayMs: 0, maxDelayMs: 0 });
    await h.run([
      { source: 'google_ac', q: 'alpha', owner: 't', seed: 'alpha', phase: 'seed' },
      { source: 'google_ac', q: 'Alpha', owner: 't2', seed: 'alpha', phase: 'seed' },
      { source: 'youtube_ac', q: 'blocked', owner: 't', seed: 'blocked', phase: 'seed' },
      { source: 'google_ac', q: 'beta', owner: 't', seed: 'beta', phase: 'seed' },
    ]);
    expect(calls).toBe(2);
    expect(h.stats.requests).toBe(2);
    expect(h.stats.blocked).toMatchObject({ source: 'youtube_ac', status: 429 });
    expect(h.stats.missing).toBe(1);
    expect(h.results.map((r) => r.request.owner)).toEqual(['t', 't2']);

    // a second run reads the cache without the network
    const h2 = new Harvester(new AcCache(dir, '2026-10-18'), { network: false, maxRequests: 10, fetcher });
    await h2.run([{ source: 'google_ac', q: 'alpha', owner: 't', seed: 'alpha', phase: 'seed' }]);
    expect(h2.stats).toMatchObject({ requests: 0, cacheHits: 1 });
    expect(h2.results[0].suggestions).toEqual(['alpha one', 'two']);
    expect(calls).toBe(2);
  });

  it('expands a seed a-z plus question prefixes', () => {
    const e = expansions('Self Image');
    expect(e).toHaveLength(29);
    expect(e[0]).toBe('self image a');
    expect(e).toContain('why self image');
  });
});

describe('queue and render', () => {
  const node = (id: string, level: TopicNode['level'], parent: string | null, s: Partial<TopicNode['scores']>, extra: Partial<TopicNode> = {}): TopicNode => ({
    id, level, label: id.replace('topic:', ''), parent, pillarCode: 'P1', intent: 'problem', summary: '', mapsTo: { products: ['product:signal-awareness'] },
    queries: [{ text: `${id} q`, sources: ['google_ac', 'youtube_ac'], signal: 2 }],
    scores: { demand: 50, proof: 50, coverage: 0, competition: 0, productFit: 80, priority: 50, ...s }, status: 'TO BUILD', assets: [], competitors: [], notes: '', ...extra,
  });
  const map: TopicalMap = {
    version: 1, centralEntity: { label: 'Self-image', definition: 'def' }, sourceContext: 'ctx', generatedAt: '2026-10-17T00:00:00Z', levels: ['pillar', 'section', 'topic', 'subtopic'],
    nodes: [
      node('topic:p', 'pillar', null, {}),
      node('topic:s', 'section', 'topic:p', {}),
      node('topic:t1', 'topic', 'topic:s', { priority: 70 }),
      node('topic:t2', 'topic', 'topic:s', { priority: 90, coverage: 80 }),
      node('topic:t3', 'topic', 'topic:s', { priority: 95 }, { stance: 'guardrail' }),
      node('topic:t4', 'topic', 'topic:s', { priority: 40 }, { origin: 'demand' }),
      node('topic:t1-a', 'subtopic', 'topic:t1', { priority: 60 }, { notes: 'Format: long_video', status: 'BUILT' }),
      node('topic:t1-b', 'subtopic', 'topic:t1', { priority: 55 }),
      node('topic:t1-c', 'subtopic', 'topic:t1', { priority: 50 }),
    ],
  };
  const products = new Map([['product:signal-awareness', { label: 'Signal Awareness', status: 'LIVE' }]]);

  it('queues low-coverage topics by priority, never guardrails, then fills with subtopics (two per family)', () => {
    const q = buildQueue(map, products, 5);
    expect(q.map((x) => x.node.id)).toEqual(['topic:t1', 'topic:t1-a', 'topic:t4']);
    expect(q[0].format).toMatch(/is BUILT; shoot it/);
    expect(q[0].products).toEqual([{ id: 'product:signal-awareness', label: 'Signal Awareness', status: 'LIVE' }]);
    expect(q[0].whyNow).toMatch(/Nothing on it is published yet/);
  });

  it('keeps quotes under 25 words with their attribution', () => {
    expect(shortQuote('"I can\'t say no" (619 likes · YouTube, Clark Kegley)')).toBe('"I can\'t say no" (619 likes · YouTube, Clark Kegley)');
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    expect(shortQuote(long).split(' ')).toHaveLength(24);
  });

  it('renders the map markdown with the tree and the top table', () => {
    const md = renderTopicalMapMd(map);
    expect(md).toContain('# Topical map');
    expect(md).toContain('## Top 25 topics by priority');
    expect(md).toContain('### P1 · p');
    expect(md).not.toContain('—');
  });
});
