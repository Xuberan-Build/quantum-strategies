import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin/auth', () => ({ validateAdminApiRequest: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('@/lib/brain/load', () => ({
  listBrainDocs: vi.fn(async () => ({ docs: [{ slug: 'notes--guide', path: 'notes/guide.md', title: 'Guide' }] })),
}));

import { GET as getGraph } from '../route';
import { GET as getNode } from '../node/[...id]/route';
import { GET as getGaps } from '../gaps/route';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const ADMIN = { id: '9c1d2e3f-0000-4000-8000-000000000001', email: 'admin@example.com', name: 'Admin' };

type Call = [string, unknown[]];
type Handler = (table: string, calls: Call[]) => unknown;

/** A chainable, thenable stand-in for a PostgREST query that records its calls. */
function chain(table: string, handler: Handler) {
  const calls: Call[] = [];
  const obj: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === 'then') return (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve(handler(table, calls)).then(ok, err);
        if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve(handler(table, [...calls, [prop, []]]));
        return (...args: unknown[]) => {
          calls.push([prop, args]);
          return obj;
        };
      },
    },
  );
  return obj;
}

const has = (calls: Call[], name: string, first?: unknown) => calls.some(([n, a]) => n === name && (first === undefined || a[0] === first));
const arg = (calls: Call[], name: string) => calls.find(([n]) => n === name)?.[1];

function useDb(handler: Handler) {
  vi.mocked(supabaseAdmin.from).mockImplementation(((table: string) => chain(table, handler)) as never);
}

const NODES = [
  { id: 'pillar:alpha', type: 'pillar', label: 'Alpha', weight: 0.9, tier: null },
  { id: 'problem:p1', type: 'problem', label: 'Problem one', weight: 0.6, tier: null },
  { id: 'note:lonely', type: 'note', label: 'Lonely', weight: 0.1, tier: null },
];
const EDGES = [
  { src: 'problem:p1', dst: 'pillar:alpha', type: 'belongs_to_pillar', weight: 1 },
  { src: 'problem:p1', dst: 'missing:x', type: 'mentions', weight: 1 },
];

describe('/api/admin/brain/graph', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
    vi.mocked(supabaseAdmin.rpc).mockReset();
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('401s every route without an admin session, before touching the database', async () => {
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: null, error: 'Not authenticated' });
    const res = await Promise.all([
      getGraph(new NextRequest('http://localhost/api/admin/brain/graph')),
      getNode(new NextRequest('http://localhost/x'), { params: Promise.resolve({ id: ['pillar:alpha'] }) }),
      getGaps(),
    ]);
    expect(res.map((r) => r.status)).toEqual([401, 401, 401]);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it('returns lightweight nodes with degree and only edges between returned nodes', async () => {
    const seen: { table: string; calls: Call[] }[] = [];
    useDb((table, calls) => {
      seen.push({ table, calls });
      if (table === 'kg_nodes') return { data: NODES, error: null };
      if (has(calls, 'select') && (arg(calls, 'select')?.[1] as { head?: boolean } | undefined)?.head) return { count: EDGES.length, error: null };
      return { data: EDGES, error: null };
    });
    const res = await getGraph(new NextRequest('http://localhost/api/admin/brain/graph?types=pillar,problem,bogus&minWeight=0.2&limit=10'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nodes).toEqual([
      { id: 'pillar:alpha', type: 'pillar', label: 'Alpha', weight: 0.9, tier: null, degree: 1 },
      { id: 'problem:p1', type: 'problem', label: 'Problem one', weight: 0.6, tier: null, degree: 1 },
      { id: 'note:lonely', type: 'note', label: 'Lonely', weight: 0.1, tier: null, degree: 0 },
    ]);
    expect(json.edges).toEqual([{ src: 'problem:p1', dst: 'pillar:alpha', type: 'belongs_to_pillar', weight: 1 }]);
    expect(json.fixture).toBeUndefined();

    const nodeQuery = seen.find((s) => s.table === 'kg_nodes')!.calls;
    expect(arg(nodeQuery, 'select')?.[0]).toBe('id, type, label, weight, tier'); // never the embedding
    expect(arg(nodeQuery, 'in')).toEqual(['type', ['pillar', 'problem']]); // unknown types dropped
    expect(arg(nodeQuery, 'gte')).toEqual(['weight', 0.2]);
    expect(arg(nodeQuery, 'range')).toEqual([0, 9]);
  });

  it('never serves the fixture outside development', async () => {
    useDb(() => ({ data: null, error: { message: 'relation "kg_nodes" does not exist' } }));
    vi.stubEnv('NODE_ENV', 'production');
    const prod = await getGraph(new NextRequest('http://localhost/api/admin/brain/graph'));
    expect(prod.status).toBe(500);
    const body = await prod.json();
    expect(body.fixture).toBeUndefined();
    expect(body.nodes).toEqual([]);

    vi.stubEnv('NODE_ENV', 'development');
    const dev = await getGraph(new NextRequest('http://localhost/api/admin/brain/graph'));
    expect(dev.status).toBe(200);
    const devBody = await dev.json();
    expect(devBody.fixture).toBe(true);
    expect(devBody.nodes.length).toBeGreaterThan(50);
  });
});

describe('/api/admin/brain/graph/node/[...id]', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  const ctx = (...id: string[]) => ({ params: Promise.resolve({ id }) });

  it('400s a malformed id without querying', async () => {
    for (const bad of [['nope'], ['pillar:a b'], ['pillar:a,b'], ['pillar:..', 'x']]) {
      const res = await getNode(new NextRequest('http://localhost/x'), ctx(...bad));
      expect(res.status).toBe(400);
    }
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('404s an unknown node in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    useDb(() => ({ data: null, error: null }));
    const res = await getNode(new NextRequest('http://localhost/x'), ctx('pillar:ghost'));
    expect(res.status).toBe(404);
  });

  it('returns the node, grouped neighbours, corpus excerpts, top quotes and the doc link', async () => {
    const longText = 'x'.repeat(900);
    useDb((table, calls) => {
      if (table === 'kg_nodes' && has(calls, 'maybeSingle')) {
        return {
          data: {
            id: 'problem:p1',
            type: 'problem',
            label: 'Problem one',
            summary: 'A synthetic problem.',
            props: { score: 0.7, stage: 'aware' },
            source_path: 'notes/guide.md',
            url: null,
            weight: 0.6,
            tier: null,
            built_at: '2026-10-17T00:00:00Z',
          },
          error: null,
        };
      }
      if (table === 'kg_nodes') {
        return {
          data: [
            { id: 'pillar:alpha', type: 'pillar', label: 'Alpha', weight: 0.9, tier: null },
            { id: 'quote:q1', type: 'quote', label: 'Quote one', weight: 0.2, tier: null, props: { likes: 12, text: 'Low' } },
            { id: 'quote:q2', type: 'quote', label: 'Quote two', weight: 0.8, tier: null, props: { likes: 400, text: 'Loud' } },
            { id: 'claim:c1', type: 'claim', label: 'Claim one', weight: 0.5, tier: 'evidence' },
          ],
          error: null,
        };
      }
      if (table === 'kg_edges' && has(calls, 'eq', 'src')) {
        return {
          data: [
            { id: 'e1', src: 'problem:p1', dst: 'pillar:alpha', type: 'belongs_to_pillar', weight: 1, props: {} },
            { id: 'e2', src: 'problem:p1', dst: 'claim:c1', type: 'evidences', weight: 0.8, props: { similarity: 0.83, chunk_ids: ['chunk-1'] } },
          ],
          error: null,
        };
      }
      if (table === 'kg_edges') {
        return {
          data: [
            { id: 'e3', src: 'quote:q1', dst: 'problem:p1', type: 'voices', weight: 1, props: {} },
            { id: 'e4', src: 'quote:q2', dst: 'problem:p1', type: 'voices', weight: 1, props: {} },
          ],
          error: null,
        };
      }
      if (table === 'knowledge_chunks') {
        return { data: [{ id: 'chunk-1', content: longText, text_name: 'Sample source', tier: 'evidence', author: null, source_url: null }], error: null };
      }
      return { data: [], error: null };
    });

    const res = await getNode(new NextRequest('http://localhost/x'), ctx('problem%3Ap1'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.node).toMatchObject({ id: 'problem:p1', summary: 'A synthetic problem.', props: { score: 0.7 } });
    expect(json.node.embedding).toBeUndefined();
    expect(json.outgoing.map((l: { id: string; edgeType: string }) => [l.edgeType, l.id])).toEqual([
      ['belongs_to_pillar', 'pillar:alpha'],
      ['evidences', 'claim:c1'],
    ]);
    expect(json.incoming).toEqual(
      expect.arrayContaining([expect.objectContaining({ direction: 'in', edgeType: 'voices', id: 'quote:q2', label: 'Quote two', type: 'quote' })]),
    );
    expect(json.evidence).toHaveLength(1);
    expect(json.evidence[0]).toMatchObject({ chunkId: 'chunk-1', similarity: 0.83, sourceTitle: 'Sample source', tier: 'evidence', viaLabel: 'Claim one' });
    expect(json.evidence[0].excerpt.length).toBeLessThanOrEqual(400);
    expect(json.quotes.map((q: { id: string }) => q.id)).toEqual(['quote:q2', 'quote:q1']);
    expect(json.quotes[0]).toMatchObject({ likes: 400, text: 'Loud' });
    expect(json.docHref).toBe('/admin/brain/docs/notes--guide');
  });
});

describe('/api/admin/brain/graph/gaps', () => {
  beforeEach(() => {
    vi.mocked(supabaseAdmin.from).mockReset();
    vi.mocked(supabaseAdmin.rpc).mockReset();
    vi.mocked(validateAdminApiRequest).mockResolvedValue({ admin: ADMIN, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns kg_gaps() rows', async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [{ kind: 'orphan', node_id: 'note:lonely', label: 'Lonely', detail: null }], error: null } as never);
    const json = await (await getGaps()).json();
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('kg_gaps');
    expect(json).toEqual({ rows: [{ kind: 'orphan', node_id: 'note:lonely', label: 'Lonely', detail: null }], available: true });
  });

  it('degrades to an empty list when kg_gaps() is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: { message: 'function kg_gaps() does not exist' } } as never);
    const res = await getGaps();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows: [], available: false });
  });
});
