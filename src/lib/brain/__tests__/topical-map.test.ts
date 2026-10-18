// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getTopic, getTopicalMap, getTopicalQueue, rowToTopic, scorecardAsset } from '../topical-map';

type Row = Record<string, unknown>;

/** In-memory stand-in for the supabase-js query builder (select/eq/in/order/range/limit). */
function fakeClient(tables: Record<string, Row[]>): SupabaseClient {
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
      in: (c: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[c]))), q),
      order: (c: string, o?: { ascending?: boolean }) => ((rows = rows.sort((a, b) => (o?.ascending === false ? -1 : 1) * String(a[c]).localeCompare(String(b[c])))), q),
      range: (a: number, b: number) => ((rows = rows.slice(a, b + 1)), q),
      limit: (n: number) => ((rows = rows.slice(0, n)), q),
      then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const scores = (priority: number, coverage = 0, demand = 50) => ({ demand, proof: 40, coverage, competition: 10, productFit: 80, priority });
const topic = (id: string, level: string, parent: string | null, s: Row, extra: Row = {}) => ({
  id,
  type: 'topic',
  label: id.replace('topic:', ''),
  summary: 's',
  source_path: 'content/topical-map.json',
  url: null,
  weight: 1,
  tier: null,
  props: { level, parent, pillar_code: 'P1', intent: 'problem', status: 'TO BUILD', scores: s, maps_to: {}, assets: [], competitors: [], top_queries: [{ text: `${id} q`, sources: ['google_ac'], signal: 1 }], ...extra },
});
const n = (id: string, props: Row = {}, weight = 1, label = id) => ({ id, type: id.split(':')[0], label, summary: null, props, source_path: null, url: null, weight, tier: null });
const e = (id: number, src: string, type: string, dst: string, props: Row = {}, weight = 1) => ({ id, src, dst, type, weight, props });

const db = {
  kg_nodes: [
    topic('topic:p1-x', 'pillar', null, scores(50), { map_meta: { version: 1, centralEntity: { label: 'Self-image', definition: 'd' }, sourceContext: '680 audience items', generatedAt: '2026-10-17', levels: ['pillar'] } }),
    topic('topic:p1-1-s', 'section', 'topic:p1-x', scores(50)),
    topic('topic:p1-1a-t', 'topic', 'topic:p1-1-s', scores(80), {
      assets: [
        { kind: 'cornerstone', ref: 'cornerstone:p1-1a-cs', status: 'TO BUILD' },
        { kind: 'spoke', ref: 'spoke:p1-1a-02', status: 'REFRESH' },
        { kind: 'deck', ref: 'deck:2026-10-17-x', status: 'internal' },
      ],
      maps_to: { problems: ['problem:snap'], claims: ['claim:p1'], products: ['product:scan'] },
      evidence: [{ claim: null, label: 'passage', tier: 'evidence', strength: null, similarity: 0.5, source: 'Au: t' }],
    }),
    topic('topic:p1-1a-t-01-sub', 'subtopic', 'topic:p1-1a-t', scores(30)),
    topic('topic:p1-1b-covered', 'topic', 'topic:p1-1-s', scores(95, 70)),
    topic('topic:p1-1c-guard', 'topic', 'topic:p1-1-s', scores(99), { stance: 'guardrail' }),
    topic('topic:p1-1d-next', 'topic', 'topic:p1-1-s', scores(60)),
    n('query:self-image', { text: 'self image', sources: ['google_ac', 'youtube_ac'], signal: 2.1 }, 2.1),
    n('query:old-self', { text: 'old self', sources: ['youtube_ac'], signal: 0.9 }, 0.9),
    n('problem:snap', { quote_count: 18 }, 18, 'Back to my old self'),
    n('quote:a', { text: 'I slip back every time', likes: 300, source_kind: 'youtube' }, 300),
    n('quote:b', { text: 'b', likes: 2 }, 2),
    n('claim:p1', { strength: 'Moderate' }, 2, 'Behaviour tracks the picture'),
    n('claim:x1', { kind: 'will_not_say' }, 1, 'Quantum'),
    n('corpus_source:s', {}, 1, 'Maltz: Psycho-Cybernetics'),
    n('creator:show-nemoto', { channel_id: 'UCabc' }, 1, 'SHOW NEMOTO'),
    n('product:scan', { status: 'LIVE' }, 2, 'Signal Awareness'),
    n('cornerstone:p1-1a-cs'),
  ],
  kg_edges: [
    e(1, 'query:self-image', 'asks_about', 'topic:p1-1a-t', {}, 2.1),
    e(2, 'query:old-self', 'asks_about', 'topic:p1-1a-t', {}, 0.9),
    e(3, 'problem:snap', 'mentions', 'topic:p1-1a-t', { via: 'about', share: 0.6 }),
    e(4, 'quote:a', 'voices', 'problem:snap'),
    e(5, 'quote:b', 'voices', 'problem:snap'),
    e(6, 'claim:p1', 'supports', 'topic:p1-1a-t', { via: 'architecture source' }),
    e(7, 'claim:x1', 'supports', 'topic:p1-1a-t'),
    e(8, 'corpus_source:s', 'evidences', 'claim:p1', { similarity: 0.52, chunk_ids: ['c1'], chunk_similarities: [0.52] }, 0.52),
    e(9, 'creator:show-nemoto', 'competes_on', 'topic:p1-1a-t', { channel_id: 'UCabc', outlier: 68.9, via: 'outlier video' }, 0.9),
    e(10, 'topic:p1-1a-t', 'routes_to', 'product:scan', { fit: 1, via: 'quiz route' }, 1),
    e(11, 'topic:p1-1a-t', 'covered_by', 'cornerstone:p1-1a-cs', { status: 'BUILT' }),
  ],
  knowledge_chunks: [{ id: 'c1', content: 'chunk one', tier: 'evidence', source_url: null }],
};

describe('rowToTopic', () => {
  it('fills defaults and clamps the pillar code', () => {
    const t = rowToTopic({ id: 'topic:x', type: 'topic', label: 'X', summary: null, props: { pillar_code: 'P9' }, source_path: null, url: null, weight: 1, tier: null });
    expect(t).toMatchObject({ level: 'topic', pillarCode: 'SPINE', status: 'NONE', queries: [], scores: { priority: 0 } });
  });
});

describe('getTopicalMap', () => {
  it('returns the tree in order with the map meta', async () => {
    const map = await getTopicalMap({ client: fakeClient(db) });
    expect(map.centralEntity.label).toBe('Self-image');
    expect(map.sourceContext).toBe('680 audience items');
    expect(map.nodes[0].id).toBe('topic:p1-x');
    expect(map.nodes[1].id).toBe('topic:p1-1-s');
    expect(map.nodes).toHaveLength(7);
    const t = map.nodes.find((x) => x.id === 'topic:p1-1a-t')!;
    expect(map.nodes.indexOf(map.nodes.find((x) => x.id === 'topic:p1-1a-t-01-sub')!)).toBe(map.nodes.indexOf(t) + 1);
  });
});

describe('getTopicalQueue', () => {
  it('lists low-coverage topics by priority, skipping guardrails and covered topics', async () => {
    const q = await getTopicalQueue(10, { client: fakeClient(db) });
    expect(q.map((r) => r.id)).toEqual(['topic:p1-1a-t', 'topic:p1-1d-next']);
    expect(q[0]).toEqual({ id: 'topic:p1-1a-t', label: 'p1-1a-t', pillarCode: 'P1', priority: 80, demand: 50, proof: 40, coverage: 0, status: 'TO BUILD', topQueries: ['topic:p1-1a-t q'] });
    expect(await getTopicalQueue(1, { client: fakeClient(db) })).toHaveLength(1);
  });
});

describe('getTopic', () => {
  it('returns the full scorecard for a topic', async () => {
    const c = await getTopic('topic:p1-1a-t', { client: fakeClient(db) });
    expect(c).not.toBeNull();
    expect(c!.breadcrumb.map((b) => b.id)).toEqual(['topic:p1-x', 'topic:p1-1-s']);
    expect(c!.children.map((x) => x.id)).toEqual(['topic:p1-1a-t-01-sub']);
    expect(c!.queries.map((q) => q.text)).toEqual(['self image', 'topic:p1-1a-t q', 'old self']);
    expect(c!.problems).toEqual([{ id: 'problem:snap', label: 'Back to my old self', share: 0.6, quoteCount: 18, quotes: [{ text: 'I slip back every time', likes: 300, source: 'youtube', url: null }, { text: 'b', likes: 2, source: null, url: null }] }]);
    expect(c!.claims).toHaveLength(1);
    expect(c!.claims[0]).toMatchObject({ id: 'claim:p1', similarity: 0.52, via: 'architecture source', evidence: [{ chunkId: 'c1', source: 'Maltz: Psycho-Cybernetics', similarity: 0.52, content: 'chunk one' }] });
    expect(c!.evidence).toHaveLength(1);
    expect(c!.competitors).toEqual([{ id: 'UCabc', creatorId: 'creator:show-nemoto', label: 'SHOW NEMOTO', weight: 0.9, outlier: 68.9, via: 'outlier video', url: 'https://www.youtube.com/channel/UCabc' }]);
    expect(c!.products).toEqual([{ id: 'product:scan', label: 'Signal Awareness', status: 'LIVE', fit: 1, via: 'quiz route' }]);
    expect(c!.queue).toEqual({ position: 1, size: 2 });
    expect(c!.assets.map((a) => [a.ref, a.status, a.detail])).toEqual([
      ['cornerstone:p1-1a-cs', 'TO BUILD', undefined],
      ['spoke:p1-1a-02', 'LIVE', 'REFRESH'],
      ['deck:2026-10-17-x', 'LIVE', 'internal'],
    ]);
  });

  it('accepts pillar and section ids, and returns null for unknown or malformed ids', async () => {
    const p = await getTopic('topic:p1-x', { client: fakeClient(db) });
    expect(p!.topic.level).toBe('pillar');
    expect(p!.children.map((x) => x.id)).toEqual(['topic:p1-1-s']);
    expect(p!.queue.position).toBeNull();
    expect((await getTopic('topic:p1-1-s', { client: fakeClient(db) }))!.breadcrumb).toHaveLength(1);
    expect(await getTopic('topic:nope', { client: fakeClient(db) })).toBeNull();
    expect(await getTopic('problem:snap', { client: fakeClient(db) })).toBeNull();
  });
});

describe('scorecardAsset', () => {
  it('normalises status and links each kind', () => {
    expect(scorecardAsset({ kind: 'deck', ref: 'deck:d1', status: 'internal' })).toMatchObject({ status: 'LIVE', href: '/admin/brain/deck/d1' });
    expect(scorecardAsset({ kind: 'doc', ref: 'doc:gtm--map', status: 'internal' }).href).toBe('/admin/brain/docs/gtm--map');
    expect(scorecardAsset({ kind: 'content_post', ref: 'content_post:my-post', status: 'LIVE' }).href).toBe('https://quantumstrategies.online/articles/my-post');
    expect(scorecardAsset({ kind: 'spoke', ref: 'spoke:p1-1a-01', status: 'BUILT' })).toMatchObject({ status: 'BUILT', href: '/admin/brain/graph?node=spoke%3Ap1-1a-01' });
  });
});
