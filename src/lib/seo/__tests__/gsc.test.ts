// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { kpKey } from '../../../../scripts/brain/lib/topical-map/keyword-planner';
import {
  backfillStart,
  dateWindows,
  fetchAllRows,
  fetchGrain,
  gscConfigFromEnv,
  inspectUrls,
  isValidSiteUrl,
  lastCompleteDay,
  normalizePage,
  pacificDate,
  parseInspection,
  parseSitemapXml,
  pickUrlsToInspect,
  previousPeriod,
  toGscRows,
  type GscApi,
  type GscApiRow,
  type GscQueryRequest,
} from '../gsc';
import { keywordKey } from '../keyword-key';

function fakeApi(pages: GscApiRow[][], inspect?: GscApi['inspect']): GscApi & { calls: GscQueryRequest[] } {
  const calls: GscQueryRequest[] = [];
  return {
    calls,
    async query(_site, body) {
      calls.push(body);
      return { rows: pages[calls.length - 1] ?? [] };
    },
    inspect: inspect ?? (async () => ({})),
  };
}

const rows = (n: number, date = '2026-10-01'): GscApiRow[] => Array.from({ length: n }, (_, i) => ({ keys: [date, `q${i}`, 'https://quantumstrategies.online/a/'], clicks: 1, impressions: 2, ctr: 0.5, position: 3 }));

describe('keywordKey', () => {
  it('matches the Keyword Planner match key exactly', () => {
    for (const t of ['Psycho-Cybernetics book', "didn't work", 'Café & Crème', '  law of   attraction ', 'NLP: does it work?']) {
      expect(keywordKey(t)).toBe(kpKey(t));
    }
  });
});

describe('dates', () => {
  it('uses the Pacific day and a 3-day lag', () => {
    // 06:00 UTC on 18 Oct is still 17 Oct in Los Angeles
    const now = new Date('2026-10-18T06:00:00Z');
    expect(pacificDate(now)).toBe('2026-10-17');
    expect(lastCompleteDay(now)).toBe('2026-10-14');
    expect(lastCompleteDay(now, 2)).toBe('2026-10-15');
  });

  it('caps a backfill at 16 months', () => {
    expect(backfillStart('2026-10-14')).toBe('2025-06-15');
    expect(backfillStart('2026-10-14', 40)).toBe('2025-06-15');
    expect(backfillStart('2026-10-14', 1)).toBe('2026-09-15');
  });

  it('splits a range into windows and finds the previous period', () => {
    expect(dateWindows('2026-01-01', '2026-01-10', 4)).toEqual([
      { startDate: '2026-01-01', endDate: '2026-01-04' },
      { startDate: '2026-01-05', endDate: '2026-01-08' },
      { startDate: '2026-01-09', endDate: '2026-01-10' },
    ]);
    expect(dateWindows('2026-01-02', '2026-01-01')).toEqual([]);
    expect(previousPeriod('2026-10-01', '2026-10-28')).toEqual({ startDate: '2026-09-03', endDate: '2026-09-30' });
  });
});

describe('fetchAllRows', () => {
  it('pages with startRow until a short page', async () => {
    const api = fakeApi([rows(25000), rows(25000), rows(3)]);
    const out = await fetchAllRows(api, 'sc-domain:quantumstrategies.online', { startDate: '2026-10-01', endDate: '2026-10-01', dimensions: ['date', 'query', 'page'] });
    expect(out).toHaveLength(50003);
    expect(api.calls.map((c) => c.startRow)).toEqual([0, 25000, 50000]);
    expect(api.calls[0]).toMatchObject({ rowLimit: 25000, type: 'web', dataState: 'final' });
  });

  it('stops at maxPages', async () => {
    const api = fakeApi([rows(10), rows(10), rows(10)]);
    const out = await fetchAllRows(api, 's', { startDate: 'a', endDate: 'b', dimensions: ['date'], rowLimit: 10 }, { maxPages: 2 });
    expect(out).toHaveLength(20);
    expect(api.calls).toHaveLength(2);
  });
});

describe('toGscRows', () => {
  it('fills missing dimensions with "" and computes the match key', () => {
    const [r] = toGscRows([{ keys: ['2026-10-01', 'Law of Attraction?', 'http://www.quantumstrategies.online/articles/x?utm=1'], clicks: 2, impressions: 10, ctr: 0.2, position: 4.5 }], ['date', 'query', 'page'], 'query');
    expect(r).toMatchObject({ date: '2026-10-01', grain: 'query', query: 'Law of Attraction?', query_key: 'law of attraction', page: 'https://quantumstrategies.online/articles/x/', country: '', device: '', clicks: 2, impressions: 10, ctr: 0.2, position: 4.5 });
  });

  it('merges rows that normalise to the same page, weighting position by impressions', () => {
    const out = toGscRows(
      [
        { keys: ['2026-10-01', 'https://quantumstrategies.online/a/'], clicks: 1, impressions: 10, position: 2 },
        { keys: ['2026-10-01', 'https://www.quantumstrategies.online/a'], clicks: 1, impressions: 30, position: 6 },
      ],
      ['date', 'page'],
      'page',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ clicks: 2, impressions: 40, position: 5, ctr: 0.05, query: '', query_key: '' });
  });

  it('keeps file paths without a trailing slash', () => {
    expect(normalizePage('https://quantumstrategies.online/sitemap.xml')).toBe('https://quantumstrategies.online/sitemap.xml');
    expect(normalizePage('https://quantumstrategies.online')).toBe('https://quantumstrategies.online/');
  });
});

describe('fetchGrain', () => {
  it('adds country and device to the query grain only', async () => {
    const api = fakeApi([[{ keys: ['2026-10-01', 'q', 'https://quantumstrategies.online/', 'USA', 'MOBILE'], clicks: 1, impressions: 1, position: 1 }], []]);
    const q = await fetchGrain(api, 's', 'query', { startDate: '2026-10-01', endDate: '2026-10-01', extraDimensions: ['country', 'device'] });
    expect(api.calls[0].dimensions).toEqual(['date', 'query', 'page', 'country', 'device']);
    expect(q[0]).toMatchObject({ country: 'usa', device: 'MOBILE' });
    await fetchGrain(api, 's', 'site', { startDate: '2026-10-01', endDate: '2026-10-01', extraDimensions: ['country'] });
    expect(api.calls[1].dimensions).toEqual(['date']);
  });
});

describe('config', () => {
  it('validates both property formats', () => {
    expect(isValidSiteUrl('sc-domain:quantumstrategies.online')).toBe(true);
    expect(isValidSiteUrl('https://quantumstrategies.online/')).toBe(true);
    expect(isValidSiteUrl('https://quantumstrategies.online')).toBe(false);
    expect(isValidSiteUrl('quantumstrategies.online')).toBe(false);
  });

  it('prefers GSC_* credentials and falls back to the CRM service account', () => {
    expect(gscConfigFromEnv({ GSC_SITE_URL: 'sc-domain:quantumstrategies.online', GSC_CLIENT_EMAIL: 'a@x', GSC_PRIVATE_KEY: 'line1\\nline2', GOOGLE_CRM_CLIENT_EMAIL: 'b@x', GOOGLE_CRM_PRIVATE_KEY: 'k' })).toEqual({
      siteUrl: 'sc-domain:quantumstrategies.online',
      credentials: { clientEmail: 'a@x', privateKey: 'line1\nline2' },
      credentialSource: 'GSC_CLIENT_EMAIL/GSC_PRIVATE_KEY',
    });
    expect(gscConfigFromEnv({ GOOGLE_CRM_CLIENT_EMAIL: 'b@x', GOOGLE_CRM_PRIVATE_KEY: 'k' }).credentials?.clientEmail).toBe('b@x');
    expect(gscConfigFromEnv({ GSC_SERVICE_ACCOUNT_FILE: '/k.json' }, () => JSON.stringify({ client_email: 'c@x', private_key: 'pk' })).credentialSource).toBe('GSC_SERVICE_ACCOUNT_FILE');
    expect(gscConfigFromEnv({})).toEqual({ siteUrl: null, credentials: null, credentialSource: null });
  });
});

describe('URL inspection', () => {
  it('parses the index status and drops the never-crawled epoch', () => {
    const r = parseInspection('https://quantumstrategies.online/a/', {
      inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Discovered - currently not indexed', indexingState: 'INDEXING_ALLOWED', lastCrawlTime: '1970-01-01T00:00:00Z', userCanonical: 'https://quantumstrategies.online/a/' } },
    });
    expect(r).toMatchObject({ verdict: 'NEUTRAL', coverage_state: 'Discovered - currently not indexed', last_crawl_time: null, google_canonical: null, user_canonical: 'https://quantumstrategies.online/a/' });
  });

  it('picks never-inspected URLs first, then the stalest past the minimum age', () => {
    const now = new Date('2026-10-18T00:00:00Z');
    const last = new Map<string, string>([
      ['b', '2026-10-17T00:00:00Z'], // fresh: skipped
      ['c', '2026-09-01T00:00:00Z'],
      ['d', '2026-08-01T00:00:00Z'],
    ]);
    expect(pickUrlsToInspect(['a', 'b', 'c', 'd', 'e', 'a'], last, 10, { now })).toEqual(['a', 'e', 'd', 'c']);
    expect(pickUrlsToInspect(['a', 'b', 'c', 'd', 'e'], last, 2, { now })).toEqual(['a', 'e']);
  });

  it('stops at the first quota error and records other errors', async () => {
    const inspect = vi
      .fn<GscApi['inspect']>()
      .mockResolvedValueOnce({ inspectionResult: { indexStatusResult: { verdict: 'PASS' } } })
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(Object.assign(new Error('Quota exceeded'), { code: 429 }));
    const api = fakeApi([], inspect);
    const out = await inspectUrls(api, 's', ['u1', 'u2', 'u3', 'u4'], { delayMs: 0 });
    expect(out.rows.map((r) => r.verdict)).toEqual(['PASS']);
    expect(out.errors).toEqual([{ url: 'u2', message: 'boom' }]);
    expect(out.stoppedOnQuota).toBe(true);
    expect(inspect).toHaveBeenCalledTimes(3);
  });
});

describe('parseSitemapXml', () => {
  it('reads loc and lastmod', () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://quantumstrategies.online/</loc><lastmod>2026-04-27T00:00:00.000Z</lastmod></url><url><loc>https://quantumstrategies.online/a/?x=1&amp;y=2</loc></url></urlset>`;
    expect(parseSitemapXml(xml)).toEqual([
      { url: 'https://quantumstrategies.online/', lastModified: '2026-04-27T00:00:00.000Z' },
      { url: 'https://quantumstrategies.online/a/?x=1&y=2', lastModified: null },
    ]);
  });
});
