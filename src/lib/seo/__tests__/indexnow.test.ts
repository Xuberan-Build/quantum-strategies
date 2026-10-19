// @vitest-environment node
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { articleChangeUrls, indexNowKey, keyLocation, notifyIndexNow, sameHostUrls, selectChanged, submitToIndexNow } from '../indexnow';

const KEY = '0123456789abcdef0123456789abcdef';

function fakeFetch(status = 200, body = '') {
  return vi.fn(async (_url: string, _init: { method: string; headers: Record<string, string>; body: string }) => ({ status, ok: status < 300, text: async () => body }));
}

/** Records inserts; answers selects on indexnow_submissions with `history`. */
function fakeClient(history: { url: string; submitted_at: string }[] = []) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: () => {
      let rows = [...history];
      const q = {
        insert: async (r: Record<string, unknown>[]) => (inserted.push(...r), { error: null }),
        select: () => q,
        in: (c: string, vs: unknown[]) => (c === 'url' && (rows = rows.filter((r) => vs.includes(r.url))), q),
        order: () => q,
        then: (res: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { client, inserted };
}

afterEach(() => vi.unstubAllEnvs());

describe('key', () => {
  it('accepts 8-128 of [a-zA-Z0-9-] only', () => {
    expect(indexNowKey({ INDEXNOW_KEY: KEY })).toBe(KEY);
    expect(indexNowKey({ INDEXNOW_KEY: 'short' })).toBeNull();
    expect(indexNowKey({ INDEXNOW_KEY: 'has space in it' })).toBeNull();
    expect(indexNowKey({})).toBeNull();
    expect(keyLocation(KEY)).toBe(`https://quantumstrategies.online/${KEY}.txt`);
  });
});

describe('sameHostUrls', () => {
  it('keeps https URLs on the host, once', () => {
    expect(sameHostUrls(['https://quantumstrategies.online/a/', 'https://quantumstrategies.online/a/#x', 'http://quantumstrategies.online/b/', 'https://evil.example/c/', 'nope'])).toEqual(['https://quantumstrategies.online/a/']);
  });
});

describe('selectChanged', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  const last = new Map<string, string>([
    ['recent', '2026-10-18T11:55:00Z'],
    ['old', '2026-10-01T00:00:00Z'],
  ]);
  it('submits new URLs and URLs modified since their last submission', () => {
    const out = selectChanged(
      [
        { url: 'new' },
        { url: 'old', lastModified: '2026-10-10' },
        { url: 'recent', lastModified: '2026-10-18T11:59:00Z' },
      ],
      last,
      { now },
    );
    expect(out).toEqual(['new', 'old']);
  });
  it('skips unchanged URLs unless forced, and never resubmits inside the interval', () => {
    expect(selectChanged([{ url: 'old', lastModified: '2026-09-01' }, { url: 'old' }], last, { now })).toEqual([]);
    expect(selectChanged([{ url: 'old' }, { url: 'recent' }], last, { now, force: true })).toEqual(['old']);
  });
});

describe('submitToIndexNow', () => {
  it('posts host, key, keyLocation and urlList, and logs each URL', async () => {
    const f = fakeFetch(202);
    const { client, inserted } = fakeClient();
    const res = await submitToIndexNow(['https://quantumstrategies.online/a/', 'https://other.example/'], { key: KEY, fetchImpl: f, client, trigger: 'script' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.indexnow.org/indexnow');
    expect(JSON.parse(init.body)).toEqual({ host: 'quantumstrategies.online', key: KEY, keyLocation: `https://quantumstrategies.online/${KEY}.txt`, urlList: ['https://quantumstrategies.online/a/'] });
    expect(res).toMatchObject({ submitted: 1, skipped: null, batches: [{ size: 1, status: 202, ok: true }] });
    expect(inserted).toEqual([{ url: 'https://quantumstrategies.online/a/', engine: 'indexnow', endpoint: 'https://api.indexnow.org/indexnow', status_code: 202, response: null, trigger: 'script' }]);
  });

  it('batches at 10,000 URLs', async () => {
    const f = fakeFetch(200);
    const urls = Array.from({ length: 10_001 }, (_, i) => `https://quantumstrategies.online/p${i}/`);
    const res = await submitToIndexNow(urls, { key: KEY, fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(2);
    expect(res.batches.map((b) => b.size)).toEqual([10_000, 1]);
  });

  it('reports rejections and network errors without throwing', async () => {
    const res = await submitToIndexNow(['https://quantumstrategies.online/a/'], { key: KEY, fetchImpl: fakeFetch(403, 'key not found') });
    expect(res).toMatchObject({ submitted: 0, batches: [{ status: 403, ok: false, response: 'key not found' }] });
    const down = await submitToIndexNow(['https://quantumstrategies.online/a/'], { key: KEY, fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(down.batches[0]).toMatchObject({ status: null, ok: false });
  });

  it('skips without a key', async () => {
    const f = fakeFetch();
    expect(await submitToIndexNow(['https://quantumstrategies.online/a/'], { key: null, fetchImpl: f })).toMatchObject({ skipped: 'INDEXNOW_KEY is not set' });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('notifyIndexNow', () => {
  it('is a no-op without a key', async () => {
    vi.stubEnv('INDEXNOW_KEY', '');
    const f = fakeFetch();
    expect(await notifyIndexNow(articleChangeUrls('x'), { client: null, fetchImpl: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('pings the article and listing, skipping URLs pinged in the last 10 minutes', async () => {
    vi.stubEnv('INDEXNOW_KEY', KEY);
    const f = fakeFetch(200);
    const recent = new Date(Date.now() - 60_000).toISOString();
    const { client } = fakeClient([{ url: 'https://quantumstrategies.online/articles/', submitted_at: recent }]);
    const res = await notifyIndexNow(articleChangeUrls('my-post'), { client, fetchImpl: f });
    expect(JSON.parse(f.mock.calls[0][1].body).urlList).toEqual(['https://quantumstrategies.online/articles/my-post/']);
    expect(res?.submitted).toBe(1);
  });

  it('never throws', async () => {
    vi.stubEnv('INDEXNOW_KEY', KEY);
    const broken = { from: () => { throw new Error('db down'); } } as unknown as SupabaseClient;
    const res = await notifyIndexNow(articleChangeUrls('x'), { client: broken, fetchImpl: fakeFetch(200) });
    expect(res?.submitted).toBe(2);
  });
});
