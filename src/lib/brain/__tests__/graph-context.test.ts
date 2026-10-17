// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { getNodeContext, getProblemContext } from '../graph-context';

type Row = Record<string, unknown>;

/** Minimal in-memory stand-in for the supabase-js query builder (select/eq/in/like/order/limit). */
function fakeClient(tables: Record<string, Row[]>): SupabaseClient {
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
      in: (c: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[c]))), q),
      like: (c: string, p: string) => ((rows = rows.filter((r) => String(r[c]).startsWith(p.replace(/%$/, '')))), q),
      order: (c: string, o?: { ascending?: boolean }) => ((rows = rows.sort((a, b) => (o?.ascending ? 1 : -1) * ((a[c] as number) - (b[c] as number)))), q),
      limit: (n: number) => ((rows = rows.slice(0, n)), q),
      then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const n = (id: string, weight = 1, props: Row = {}) => ({ id, type: id.split(':')[0], label: id, summary: null, props, source_path: null, url: null, weight, tier: null });
const e = (id: number, src: string, type: string, dst: string, props: Row = {}, weight = 1) => ({ id, src, dst, type, weight, props });

const db = {
  kg_nodes: [
    n('problem:p'), n('quote:a', 50, { text: 'A' }), n('quote:b', 5), n('mechanism:p'), n('claim:p1', 3), n('corpus_source:s'), n('corpus_source:m'),
    n('product:scan'), n('solution_type:p'), n('solution_type:tried-books'), n('pillar:x'),
  ],
  kg_edges: [
    e(1, 'quote:a', 'voices', 'problem:p'),
    e(2, 'quote:b', 'voices', 'problem:p'),
    e(3, 'mechanism:p', 'explains', 'problem:p'),
    e(4, 'claim:p1', 'supports', 'mechanism:p'),
    e(5, 'corpus_source:s', 'evidences', 'claim:p1', { similarity: 0.6, chunk_ids: ['c1', 'c2'], chunk_similarities: [0.6, 0.5] }, 0.6),
    e(6, 'product:scan', 'addresses', 'problem:p'),
    e(7, 'problem:p', 'routes_to', 'product:scan', { pattern: 'PAT', pattern_name: 'Pattern' }),
    e(8, 'solution_type:p', 'solves', 'problem:p'),
    e(9, 'quote:a', 'mentions', 'solution_type:tried-books'),
    e(10, 'corpus_source:m', 'evidences', 'problem:p', { similarity: 0.5, kind: 'demand' }),
    e(11, 'problem:p', 'belongs_to_pillar', 'pillar:x'),
  ],
  knowledge_chunks: [
    { id: 'c1', content: 'chunk one', author: 'Au', text_name: 't', tier: 'evidence', source_url: null },
    { id: 'c2', content: 'chunk two', author: 'Au', text_name: 't', tier: 'evidence', source_url: null },
  ],
};

describe('getProblemContext', () => {
  it('returns quotes by weight, mechanism, claims, evidence chunks, products and the quiz route', async () => {
    const ctx = await getProblemContext('p', { client: fakeClient(db) });
    expect(ctx).not.toBeNull();
    expect(ctx!.quotes.map((q) => q.id)).toEqual(['quote:a', 'quote:b']);
    expect(ctx!.mechanisms.map((m) => m.id)).toEqual(['mechanism:p']);
    expect(ctx!.claims.map((c) => c.id)).toEqual(['claim:p1']);
    expect(ctx!.evidence.map((x) => [x.chunk_id, x.similarity, x.supports])).toEqual([['c1', 0.6, 'claim:p1'], ['c2', 0.5, 'claim:p1']]);
    expect(ctx!.products.map((p) => p.via).sort()).toEqual(['addresses', 'routes_to']);
    expect(ctx!.quizRoute).toEqual({ product: 'product:scan', pattern: 'PAT', patternName: 'Pattern' });
    expect(ctx!.solutions.map((s) => s.id)).toEqual(['solution_type:p']);
    expect(ctx!.tried.map((s) => s.id)).toEqual(['solution_type:tried-books']);
    expect(ctx!.demand).toEqual([{ source: expect.objectContaining({ id: 'corpus_source:m' }), similarity: 0.5 }]);
  });
  it('null for an unknown problem', async () => {
    expect(await getProblemContext('nope', { client: fakeClient(db) })).toBeNull();
  });
});

describe('getNodeContext', () => {
  it('walks both directions to the given depth', async () => {
    const one = await getNodeContext('mechanism:p', 1, { client: fakeClient(db) });
    expect(one.nodes.map((x) => x.id).sort()).toEqual(['claim:p1', 'mechanism:p', 'problem:p']);
    expect(one.edges).toHaveLength(2);
    const two = await getNodeContext('mechanism:p', 2, { client: fakeClient(db) });
    expect(two.nodes.map((x) => x.id)).toEqual(expect.arrayContaining(['quote:a', 'corpus_source:s', 'pillar:x']));
    const capped = await getNodeContext('mechanism:p', 2, { client: fakeClient(db), maxNodes: 4 });
    expect(capped.nodes).toHaveLength(4);
    expect(capped.truncated).toBe(true);
    expect((await getNodeContext('missing:x', 2, { client: fakeClient(db) })).node).toBeNull();
  });
});
