// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMetadata,
  createYoutubeAdapter,
  mapError,
  secondsUntilPacificMidnight,
  youtubeAdapter,
} from '../youtube';
import type { PublishContext, SocialPost, SocialPostTarget } from '../../types';

const KIB256 = 256 * 1024;
const MEDIA_URL = 'https://cdn.example.com/social-media/v.mp4';
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc';

function post(over: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'p1',
    piece_id: null,
    title: null,
    caption: 'First line of caption\nMore <b>text</b> here',
    media: [{ url: MEDIA_URL, type: 'video', mime: 'video/mp4', width: 1080, height: 1920, durationSec: 40 }],
    link: null,
    first_comment: null,
    tags: ['#astro', 'human design'],
    status: 'scheduled',
    scheduled_at: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

function target(over: Partial<SocialPostTarget> = {}): SocialPostTarget {
  return {
    id: 't1',
    post_id: 'p1',
    account_id: 'a1',
    platform: 'youtube',
    format: 'short',
    caption_override: null,
    options: {},
    status: 'pending',
    external_id: null,
    external_url: null,
    state: {},
    error: null,
    attempts: 0,
    next_attempt_at: null,
    published_at: null,
    metrics: {},
    metrics_synced_at: null,
    ...over,
  };
}

function ctx(p: SocialPost, t: SocialPostTarget): PublishContext {
  return {
    account: {
      id: 'a1', platform: 'youtube', external_id: 'UC1', handle: '@qs', display_name: 'QS', avatar_url: null,
      token_expires_at: null, scopes: [], meta: {}, status: 'connected', last_error: null, connected_at: '', updated_at: '',
      accessToken: 'AT', refreshToken: 'RT',
    },
    post: p,
    target: t,
    caption: t.caption_override ?? p.caption,
  };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** A fake source file + Google resumable endpoint. */
function fakeServers(size: number, opts: { failPutOnce?: number } = {}) {
  const source = new Uint8Array(size).map((_, i) => i % 251);
  const received = new Uint8Array(size);
  let committed = 0;
  let putCount = 0;
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  let initBody: any = null;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
    calls.push({ url, method, headers });

    if (url === MEDIA_URL && method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(size) } });
    if (url === MEDIA_URL) {
      const m = /bytes=(\d+)-(\d+)/.exec(headers.range ?? '')!;
      const s = Number(m[1]);
      const e = Number(m[2]);
      return new Response(source.slice(s, e + 1), { status: 206, headers: { 'content-range': `bytes ${s}-${e}/${size}` } });
    }
    if (url.startsWith('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable')) {
      initBody = JSON.parse(String(init.body));
      return new Response(null, { status: 200, headers: { location: UPLOAD_URL } });
    }
    if (url === UPLOAD_URL && method === 'PUT') {
      const cr = headers['content-range'];
      if (cr === `bytes */${size}`) {
        return committed >= size
          ? json({ id: 'VID123' })
          : new Response(null, { status: 308, headers: committed ? { range: `bytes=0-${committed - 1}` } : {} });
      }
      putCount++;
      if (opts.failPutOnce === putCount) return new Response('oops', { status: 503 });
      const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(cr)!;
      const s = Number(m[1]);
      const body = init.body as Uint8Array;
      expect(s).toBe(committed); // never skips or re-sends
      received.set(body, s);
      committed = s + body.length;
      if (committed >= size) return json({ id: 'VID123' }, 201);
      return new Response(null, { status: 308, headers: { range: `bytes=0-${committed - 1}` } });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  });

  return { fetchMock, calls, source, received, get initBody() { return initBody; }, get committed() { return committed; } };
}

beforeEach(() => {
  process.env.GOOGLE_SOCIAL_CLIENT_ID = 'cid';
  process.env.GOOGLE_SOCIAL_CLIENT_SECRET = 'secret';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('youtube auth', () => {
  it('builds an offline consent URL with upload + readonly scopes', () => {
    const u = new URL(youtubeAdapter.getAuthUrl({ state: 'st', redirectUri: 'https://x.test/cb' }));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('client_id')).toBe('cid');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('state')).toBe('st');
    expect(u.searchParams.get('response_type')).toBe('code');
    const scope = u.searchParams.get('scope')!;
    expect(scope).toContain('youtube.upload');
    expect(scope).toContain('youtube.readonly');
    expect(youtubeAdapter.usesPkce).toBe(false);
    expect(youtubeAdapter.requiredEnv).toEqual(['GOOGLE_SOCIAL_CLIENT_ID', 'GOOGLE_SOCIAL_CLIENT_SECRET']);
  });

  it('exchanges the code and returns one account per channel', async () => {
    const f = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'a b' });
      if (url.includes('/youtube/v3/channels')) {
        return json({ items: [{ id: 'UC1', snippet: { title: 'QS', customUrl: '@qs', thumbnails: { high: { url: 'https://img/a.jpg' } } }, statistics: { subscriberCount: '12' } }] });
      }
      throw new Error(url);
    });
    vi.stubGlobal('fetch', f);
    const accts = await youtubeAdapter.exchangeCode({ code: 'c', redirectUri: 'https://x.test/cb' });
    expect(accts).toHaveLength(1);
    expect(accts[0]).toMatchObject({ platform: 'youtube', external_id: 'UC1', handle: '@qs', display_name: 'QS', avatar_url: 'https://img/a.jpg', accessToken: 'AT', refreshToken: 'RT', scopes: ['a', 'b'] });
    expect(accts[0].meta?.subscriberCount).toBe(12);
    const body = new URLSearchParams(String((f.mock.calls[0][1] as RequestInit).body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('secret');
  });

  it('refresh keeps the existing refresh token when Google omits it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ access_token: 'AT2', expires_in: 3600 })));
    const upd = await youtubeAdapter.refreshToken!(ctx(post(), target()).account);
    expect(upd.accessToken).toBe('AT2');
    expect(upd.refreshToken).toBeUndefined();
    expect(upd.expiresAt).toBeInstanceOf(Date);
  });
});

describe('youtube metadata', () => {
  it('applies defaults, strips angle brackets, adds #Shorts for shorts', () => {
    const m = buildMetadata(post(), target(), post().caption);
    expect(m.snippet.title).toBe('First line of caption');
    expect(m.snippet.description).not.toMatch(/[<>]/);
    expect(m.snippet.description.endsWith('#Shorts')).toBe(true);
    expect(m.snippet.categoryId).toBe('22');
    expect(m.snippet.tags).toEqual(['astro', 'human design']);
    expect(m.status).toEqual({ privacyStatus: 'public', selfDeclaredMadeForKids: false });
  });

  it('does not add #Shorts twice or for long-form, and honours options', () => {
    const t = target({ options: { ytTitle: 'My #shorts title', ytPrivacy: 'unlisted', ytCategoryId: '27', ytMadeForKids: false } });
    const m = buildMetadata(post(), t, 'cap');
    expect(m.snippet.description).toBe('cap');
    expect(m.snippet.title).toBe('My #shorts title');
    expect(m.status.privacyStatus).toBe('unlisted');
    expect(m.snippet.categoryId).toBe('27');
    expect(buildMetadata(post(), target({ format: 'video' }), 'cap').snippet.description).toBe('cap');
  });

  it('truncates a caption-derived title to 100 chars and description to 5000', () => {
    const long = 'x'.repeat(300) + '\n' + 'y'.repeat(6000);
    const m = buildMetadata(post({ caption: long }), target(), long);
    expect(m.snippet.title.length).toBeLessThanOrEqual(100);
    expect(m.snippet.description.length).toBeLessThanOrEqual(5000);
    expect(m.snippet.description).toContain('#Shorts');
  });
});

describe('youtube validate', () => {
  it('passes a good short', () => {
    expect(youtubeAdapter.validate(post(), target())).toEqual([]);
  });
  it('needs exactly one video', () => {
    expect(youtubeAdapter.validate(post({ media: [] }), target()).length).toBe(1);
    expect(youtubeAdapter.validate(post({ media: [{ url: 'a', type: 'image' }] }), target()).length).toBe(1);
  });
  it('rejects long or landscape shorts, and long titles', () => {
    const p = post({ title: 't'.repeat(101), media: [{ url: 'a', type: 'video', width: 1920, height: 1080, durationSec: 200 }] });
    const probs = youtubeAdapter.validate(p, target());
    expect(probs).toHaveLength(3);
    expect(youtubeAdapter.validate(p, target({ format: 'video' }))).toHaveLength(1); // only the title
  });
});

describe('youtube resumable upload', () => {
  it('uploads in 256 KiB-multiple chunks and returns the shorts URL', async () => {
    const size = KIB256 * 2 + 1000;
    const s = fakeServers(size);
    vi.stubGlobal('fetch', s.fetchMock);
    const a = createYoutubeAdapter({ chunkSize: KIB256 });
    const r = await a.publish(ctx(post(), target()));
    expect(r).toMatchObject({ kind: 'published', externalId: 'VID123', url: 'https://www.youtube.com/shorts/VID123' });
    expect(s.received).toEqual(s.source);
    const puts = s.calls.filter((c) => c.url === UPLOAD_URL);
    expect(puts.map((c) => c.headers['content-range'])).toEqual([
      `bytes 0-${KIB256 - 1}/${size}`,
      `bytes ${KIB256}-${2 * KIB256 - 1}/${size}`,
      `bytes ${2 * KIB256}-${size - 1}/${size}`,
    ]);
    expect(s.initBody.snippet.description).toContain('#Shorts');
    const init = s.calls.find((c) => c.url.includes('uploadType=resumable'))!;
    expect(init.headers['x-upload-content-length']).toBe(String(size));
    expect(init.headers.authorization).toBe('Bearer AT');
  });

  it('long-form returns the watch URL', async () => {
    const s = fakeServers(1000);
    vi.stubGlobal('fetch', s.fetchMock);
    const r = await createYoutubeAdapter({ chunkSize: KIB256 }).publish(ctx(post(), target({ format: 'video' })));
    expect(r).toMatchObject({ kind: 'published', url: 'https://www.youtube.com/watch?v=VID123' });
  });

  it('stops at the time budget, persists state, and resumes via checkStatus with Range reads', async () => {
    const size = KIB256 * 3;
    const s = fakeServers(size);
    vi.stubGlobal('fetch', s.fetchMock);
    let t = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 1000));
    const a = createYoutubeAdapter({ chunkSize: KIB256, timeBudgetMs: 2500 });

    const r1 = await a.publish(ctx(post(), target()));
    expect(r1.kind).toBe('processing');
    const st1 = (r1 as { state: Record<string, unknown> }).state;
    expect(st1).toMatchObject({ uploadUrl: UPLOAD_URL, offset: KIB256, size });

    const r2 = await a.checkStatus!(ctx(post(), target({ state: st1 })));
    expect(r2.kind).toBe('processing');
    const st2 = (r2 as { state: Record<string, unknown> }).state;
    expect(st2.offset).toBe(2 * KIB256);
    // The resume asked Google for the committed offset first.
    expect(s.calls.some((c) => c.headers['content-range'] === `bytes */${size}`)).toBe(true);

    const r3 = await a.checkStatus!(ctx(post(), target({ state: st2 })));
    expect(r3).toMatchObject({ kind: 'published', externalId: 'VID123' });
    expect(s.received).toEqual(s.source);
    // Only one initiate across all three calls, and source ranges were never re-read.
    expect(s.calls.filter((c) => c.url.includes('uploadType=resumable'))).toHaveLength(1);
    const ranges = s.calls.filter((c) => c.url === MEDIA_URL && c.method === 'GET').map((c) => c.headers.range);
    expect(new Set(ranges).size).toBe(ranges.length);
  });

  it('a 5xx mid-upload keeps the session and returns processing', async () => {
    const size = KIB256 * 2;
    const s = fakeServers(size, { failPutOnce: 2 });
    vi.stubGlobal('fetch', s.fetchMock);
    const a = createYoutubeAdapter({ chunkSize: KIB256 });
    const r1 = await a.publish(ctx(post(), target()));
    expect(r1).toMatchObject({ kind: 'processing', state: { uploadUrl: UPLOAD_URL, offset: KIB256, chunkErrors: 1 } });
    const r2 = await a.checkStatus!(ctx(post(), target({ state: (r1 as any).state })));
    expect(r2).toMatchObject({ kind: 'published', externalId: 'VID123' });
  });

  it('sets a custom thumbnail and ignores its failure', async () => {
    const s = fakeServers(1000);
    const base = s.fetchMock.getMockImplementation()!;
    s.fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === 'https://img.test/cover.jpg') return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
      if (url.includes('/thumbnails/set')) return json({ error: { code: 403, message: 'no' } }, 403);
      return base(input, init);
    });
    vi.stubGlobal('fetch', s.fetchMock);
    const r = await createYoutubeAdapter().publish(ctx(post(), target({ options: { coverUrl: 'https://img.test/cover.jpg' } })));
    expect(r.kind).toBe('published');
    expect(s.fetchMock.mock.calls.some(([u]) => String(u).includes('/thumbnails/set?videoId=VID123'))).toBe(true);
  });
});

describe('youtube error mapping', () => {
  const initFails = (res: Response) => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (String(input) === MEDIA_URL && init.method === 'HEAD') return new Response(null, { headers: { 'content-length': '10' } });
      return res;
    }));
  };

  it('401 -> Reconnect YouTube, not retryable', async () => {
    initFails(json({ error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } }, 401));
    const r = await youtubeAdapter.publish(ctx(post(), target()));
    expect(r).toMatchObject({ kind: 'failed', retryable: false });
    expect((r as any).error).toMatch(/Reconnect YouTube/);
  });

  it('quotaExceeded -> retryable until Pacific midnight', async () => {
    initFails(json({ error: { code: 403, message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }, 403));
    const r = await youtubeAdapter.publish(ctx(post(), target()));
    expect(r).toMatchObject({ kind: 'failed', retryable: true });
    const sec = (r as any).retryAfterSec;
    expect(sec).toBeGreaterThan(0);
    expect(sec).toBeLessThanOrEqual(86400 + 300);
  });

  it('5xx -> retryable; other 4xx -> not', async () => {
    initFails(new Response('down', { status: 503 }));
    expect(await youtubeAdapter.publish(ctx(post(), target()))).toMatchObject({ kind: 'failed', retryable: true });
    initFails(json({ error: { code: 400, message: 'bad', errors: [{ reason: 'invalidTitle' }] } }, 400));
    expect(await youtubeAdapter.publish(ctx(post(), target()))).toMatchObject({ kind: 'failed', retryable: false });
  });

  it('network errors never throw out of publish', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    expect(await youtubeAdapter.publish(ctx(post(), target()))).toMatchObject({ kind: 'failed', retryable: true });
  });

  it('mapError handles non-Error values', () => {
    expect(mapError('x')).toMatchObject({ kind: 'failed', retryable: true });
  });

  it('secondsUntilPacificMidnight is within a day', () => {
    const s = secondsUntilPacificMidnight(new Date('2026-07-01T19:00:00Z')); // 12:00 PDT
    expect(s).toBe(12 * 3600 + 300);
  });
});

describe('youtube checkStatus + metrics', () => {
  it('reports published from videos.status, and rejected as failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [{ id: 'V', status: { uploadStatus: 'processed', privacyStatus: 'private' }, processingDetails: { processingStatus: 'succeeded' } }] })));
    const r = await youtubeAdapter.checkStatus!(ctx(post(), target({ format: 'video', external_id: 'V' })));
    expect(r).toMatchObject({ kind: 'published', externalId: 'V', url: 'https://www.youtube.com/watch?v=V' });
    expect((r as any).state.privacyStatus).toBe('private');

    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [{ id: 'V', status: { uploadStatus: 'rejected', rejectionReason: 'duplicate' } }] })));
    const r2 = await youtubeAdapter.checkStatus!(ctx(post(), target({ external_id: 'V' })));
    expect(r2).toMatchObject({ kind: 'failed', retryable: false });
  });

  it('fetchMetrics returns views, likes, comments', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ items: [{ statistics: { viewCount: '10', likeCount: '2', commentCount: '1' } }] })));
    expect(await youtubeAdapter.fetchMetrics!(ctx(post(), target({ external_id: 'V' })))).toEqual({ views: 10, likes: 2, comments: 1 });
  });
});
