// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
const runGscSync = vi.fn();
vi.mock('@/lib/seo/gsc-sync', () => ({ runGscSync: (...a: unknown[]) => runGscSync(...a) }));
vi.mock('@/lib/seo/gsc', async (orig) => ({ ...(await orig<typeof import('@/lib/seo/gsc')>()), createGscApi: vi.fn(async () => ({})) }));

import { GET } from '../route';
import { GET as keyFile } from '../../../indexnow-key/route';

const req = (auth?: string) => new NextRequest('http://localhost/api/cron/gsc-sync', { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  vi.unstubAllEnvs();
  runGscSync.mockReset();
});

describe('/api/cron/gsc-sync', () => {
  it('rejects requests without the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
  });

  it('skips cleanly when Search Console is not configured', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    vi.stubEnv('GSC_SITE_URL', '');
    const res = await GET(req('Bearer secret'));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toMatch(/not configured/);
    expect(runGscSync).not.toHaveBeenCalled();
  });

  it('runs the daily sync', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    vi.stubEnv('GSC_SITE_URL', 'sc-domain:quantumstrategies.online');
    vi.stubEnv('GSC_CLIENT_EMAIL', 'sa@example.iam.gserviceaccount.com');
    vi.stubEnv('GSC_PRIVATE_KEY', 'key');
    runGscSync.mockResolvedValue({ startDate: '2026-10-11', endDate: '2026-10-15' });
    const res = await GET(req('Bearer secret'));
    expect(res.status).toBe(200);
    expect(runGscSync).toHaveBeenCalledWith(expect.objectContaining({ mode: 'daily', siteUrl: 'sc-domain:quantumstrategies.online', inspectBudget: 100 }));
  });
});

describe('/api/indexnow-key', () => {
  it('serves the key as text, or 404 when unset', async () => {
    vi.stubEnv('INDEXNOW_KEY', '0123456789abcdef');
    const res = keyFile();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('0123456789abcdef');
    vi.stubEnv('INDEXNOW_KEY', '');
    expect(keyFile().status).toBe(404);
  });
});
