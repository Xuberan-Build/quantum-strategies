// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { GscApi, GscQueryRequest } from '../gsc';
import { runGscSync } from '../gsc-sync';

type Row = Record<string, unknown>;

/** Minimal supabase-js stand-in: reads from `tables`, records upserts/inserts/deletes. */
function fakeClient(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; rows?: Row[]; opts?: unknown }[] = [];
  const client = {
    from: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
        in: (c: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[c]))), q),
        lt: () => q,
        order: () => q,
        range: (a: number, b: number) => ((rows = rows.slice(a, b + 1)), q),
        upsert: async (r: Row[], opts: unknown) => (writes.push({ table, op: 'upsert', rows: r, opts }), { error: null }),
        insert: async (r: Row[]) => (writes.push({ table, op: 'insert', rows: r }), { error: null }),
        delete: () => (writes.push({ table, op: 'delete' }), q),
        then: (res: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, writes };
}

const topicRow = {
  id: 'topic:loa',
  type: 'topic',
  label: 'Law of attraction',
  summary: null,
  props: { level: 'topic', pillar_code: 'P1', search_volume: 1, head_term: { text: 'law of attraction', volume: 90000 }, assets: [{ kind: 'content_post', ref: 'content_post:loa', status: 'LIVE' }] },
  source_path: null,
  url: null,
  weight: 1,
  tier: null,
};

function api(): GscApi & { calls: GscQueryRequest[] } {
  const calls: GscQueryRequest[] = [];
  return {
    calls,
    async query(_s, body) {
      calls.push(body);
      const d = body.dimensions.join(',');
      if (d === 'date') return { rows: [{ keys: [body.startDate], clicks: 3, impressions: 50, position: 9 }] };
      if (d === 'date,page') return { rows: [{ keys: [body.startDate, 'https://quantumstrategies.online/articles/loa'], clicks: 3, impressions: 50, position: 9 }] };
      return { rows: [{ keys: [body.startDate, 'Law of Attraction', 'https://quantumstrategies.online/articles/loa/'], clicks: 2, impressions: 30, position: 8 }] };
    },
    inspect: vi.fn(async () => ({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed' } } })),
  };
}

const sitemap = `<urlset><url><loc>https://quantumstrategies.online/</loc></url><url><loc>https://quantumstrategies.online/articles/loa/</loc></url></urlset>`;
const fetchImpl = vi.fn(async () => new Response(sitemap, { status: 200 })) as unknown as typeof fetch;

describe('runGscSync', () => {
  it('daily: fetches the last 5 complete days at three grains, maps topics, inspects sitemap URLs', async () => {
    const { client, writes } = fakeClient({ kg_nodes: [topicRow], kg_edges: [], gsc_url_inspection_latest: [{ url: 'https://quantumstrategies.online/', inspected_at: '2026-10-17T00:00:00Z' }] });
    const a = api();
    const res = await runGscSync({ client, api: a, siteUrl: 'sc-domain:quantumstrategies.online', mode: 'daily', now: new Date('2026-10-18T20:00:00Z'), fetchImpl, inspectBudget: 10 });

    expect(res).toMatchObject({ startDate: '2026-10-11', endDate: '2026-10-15', rows: { site: 1, page: 1, query: 1 }, upserted: 3 });
    expect(a.calls.map((c) => c.dimensions.join(','))).toEqual(['date', 'date,page', 'date,query,page']);

    const sa = writes.filter((w) => w.table === 'gsc_search_analytics');
    expect(sa.every((w) => (w.opts as { onConflict: string }).onConflict === 'date,query,page,country,device')).toBe(true);
    expect(sa[2].rows![0]).toMatchObject({ grain: 'query', query_key: 'law of attraction', page: 'https://quantumstrategies.online/articles/loa/' });

    const qt = writes.find((w) => w.table === 'gsc_query_topics' && w.op === 'upsert');
    expect(qt?.rows).toEqual([expect.objectContaining({ query_key: 'law of attraction', topic_id: 'topic:loa', match: 'head_term' })]);
    const pt = writes.find((w) => w.table === 'gsc_page_topics' && w.op === 'upsert');
    expect(pt?.rows).toEqual([expect.objectContaining({ page: 'https://quantumstrategies.online/articles/loa/', topic_id: 'topic:loa' })]);

    // the home page was inspected yesterday, so only the article is due
    expect(a.inspect).toHaveBeenCalledTimes(1);
    expect(a.inspect).toHaveBeenCalledWith('sc-domain:quantumstrategies.online', 'https://quantumstrategies.online/articles/loa/');
    expect(res.inspection).toMatchObject({ attempted: 1, saved: 1, indexed: 1 });
  });

  it('dry run writes nothing', async () => {
    const { client, writes } = fakeClient({ kg_nodes: [topicRow] });
    const res = await runGscSync({ client, api: api(), siteUrl: 's', mode: 'daily', days: 1, inspectBudget: 0, dryRun: true, now: new Date('2026-10-18T20:00:00Z') });
    expect(writes).toEqual([]);
    expect(res.rows).toEqual({ site: 1, page: 1, query: 1 });
  });

  it('backfill walks 16 months in 30-day windows', async () => {
    const { client } = fakeClient({ kg_nodes: [topicRow] });
    const a = api();
    const res = await runGscSync({ client, api: a, siteUrl: 's', mode: 'backfill', inspectBudget: 0, now: new Date('2026-10-18T20:00:00Z') });
    expect(res.startDate).toBe('2025-06-16');
    expect(a.calls.length).toBe(17 * 3);
  });

  it('resubmits the sitemap, and a failed submit does not stop the sync', async () => {
    const { client } = fakeClient({ kg_nodes: [topicRow] });
    const submitSitemap = vi.fn(async () => {});
    const ok = await runGscSync({ client, api: { ...api(), submitSitemap }, siteUrl: 'sc-domain:quantumstrategies.online', mode: 'daily', days: 1, inspectBudget: 0, now: new Date('2026-10-18T20:00:00Z') });
    expect(submitSitemap).toHaveBeenCalledWith('sc-domain:quantumstrategies.online', 'https://quantumstrategies.online/sitemap.xml');
    expect(ok.sitemapSubmitted).toBe(true);

    const failing = vi.fn(async () => { throw new Error('403 insufficient permission'); });
    const res = await runGscSync({ client, api: { ...api(), submitSitemap: failing }, siteUrl: 's', mode: 'daily', days: 1, inspectBudget: 0, now: new Date('2026-10-18T20:00:00Z') });
    expect(res.sitemapSubmitted).toBe(false);
    expect(res.rows).toEqual({ site: 1, page: 1, query: 1 });
  });

  it('dry run does not submit the sitemap', async () => {
    const { client } = fakeClient({ kg_nodes: [topicRow] });
    const submitSitemap = vi.fn(async () => {});
    await runGscSync({ client, api: { ...api(), submitSitemap }, siteUrl: 's', mode: 'daily', days: 1, inspectBudget: 0, dryRun: true, now: new Date('2026-10-18T20:00:00Z') });
    expect(submitSitemap).not.toHaveBeenCalled();
  });
});
