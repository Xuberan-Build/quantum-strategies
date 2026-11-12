import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishContext, SocialPost, SocialPostTarget } from '../../types';
import { planX, splitThread, xAdapter, xWeightedLength } from '../x';

function post(over: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'p1', piece_id: null, title: null, caption: 'hello', link: null, first_comment: null, tags: [], media: [],
    status: 'scheduled', scheduled_at: null, created_by: null, created_at: '', updated_at: '', ...over,
  };
}
function target(over: Partial<SocialPostTarget> = {}): SocialPostTarget {
  return {
    id: 't1', post_id: 'p1', account_id: 'a1', platform: 'x', format: 'tweet', caption_override: null, options: {},
    status: 'processing', external_id: null, external_url: null, state: {}, error: null, attempts: 1,
    next_attempt_at: null, published_at: null, metrics: {}, metrics_synced_at: null, ...over,
  };
}
function ctx(p = post(), t = target()): PublishContext {
  return {
    account: {
      id: 'a1', platform: 'x', external_id: 'u1', handle: 'austin', display_name: null, avatar_url: null,
      token_expires_at: null, scopes: [], meta: {}, status: 'connected', last_error: null, connected_at: '', updated_at: '',
      accessToken: 'tok', refreshToken: 'ref',
    },
    post: p, target: t, caption: t.caption_override ?? p.caption,
  };
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const created = (id: string) => json({ data: { id, text: '' } }, 201);
const tweetBodies = (m: ReturnType<typeof vi.fn>) =>
  m.mock.calls.filter((c) => c[0] === 'https://api.x.com/2/tweets').map((c) => JSON.parse(c[1].body));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.X_CLIENT_ID = 'cid';
  process.env.X_CLIENT_SECRET = 'sec';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('auth', () => {
  it('builds the authorize URL with PKCE', () => {
    const url = new URL(xAdapter.getAuthUrl({ state: 's', redirectUri: 'https://qs.test/cb', codeChallenge: 'abc_-' }));
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe('tweet.read tweet.write users.read offline.access media.write');
    expect(url.searchParams.get('code_challenge')).toBe('abc_-');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('cid');
  });

  it('exchanges the code with Basic auth and reads users/me', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 7200, scope: 'tweet.read tweet.write' }))
      .mockResolvedValueOnce(json({ data: { id: '42', username: 'austin', name: 'Austin' } }));
    const [acc] = await xAdapter.exchangeCode({ code: 'c', redirectUri: 'https://qs.test/cb', codeVerifier: 'v' });
    expect(acc).toMatchObject({ external_id: '42', handle: 'austin', refreshToken: 'rt', scopes: ['tweet.read', 'tweet.write'] });
    const [u, req] = fetchMock.mock.calls[0];
    expect(u).toBe('https://api.x.com/2/oauth2/token');
    expect(req.headers.Authorization).toBe(`Basic ${Buffer.from('cid:sec').toString('base64')}`);
    expect(new URLSearchParams(req.body).get('code_verifier')).toBe('v');
  });

  it('refresh returns the rotated refresh token', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'at2', refresh_token: 'rt2', expires_in: 7200 }));
    const u = await xAdapter.refreshToken!(ctx().account);
    expect(u).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2' });
  });
});

describe('text', () => {
  it('counts URLs as 23 and CJK/emoji as 2', () => {
    expect(xWeightedLength('hi https://example.com/a/very/long/path?x=1')).toBe(3 + 23);
    expect(xWeightedLength('日本')).toBe(4);
    expect(xWeightedLength('😀')).toBe(2);
  });
  it('splits a long caption into parts of <= 280', () => {
    const long = Array(80).fill('word').join(' ') + '.';
    const parts = splitThread(`First para.\n\n${long}`);
    expect(parts[0]).toBe('First para.');
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) expect(xWeightedLength(p)).toBeLessThanOrEqual(280);
  });
  it('validate flags overlong parts and too much media', () => {
    expect(xAdapter.validate(post(), target())).toEqual([]);
    expect(xAdapter.validate(post({ caption: 'x'.repeat(281) }), target()).join()).toMatch(/281 characters/);
    // a long URL still fits because it counts as 23
    expect(xAdapter.validate(post({ caption: 'x'.repeat(250) + ' https://example.com/' + 'y'.repeat(100) }), target())).toEqual([]);
    const img = { url: 'https://cdn/i.jpg', type: 'image' as const };
    expect(xAdapter.validate(post({ media: Array(5).fill(img) }), target()).join()).toMatch(/4 images/);
    expect(xAdapter.validate(post({ media: [{ url: 'https://cdn/v.mp4', type: 'video' }] }), target()).join()).toMatch(/images only/);
    expect(xAdapter.validate(post({ media: [{ url: 'https://cdn/m.gif', type: 'image', mime: 'image/gif' }, img] }), target()).join()).toMatch(/one GIF/);
    expect(xAdapter.validate(post({ media: [{ url: 'https://cdn/m.gif', type: 'image', mime: 'image/gif' }] }), target())).toEqual([]);
  });
  it('linkInReply strips the link from the main post', () => {
    const plan = planX(post({ caption: 'Read this https://qs.test/a', link: 'https://qs.test/a' }), target({ options: { linkInReply: true } }), 'Read this https://qs.test/a');
    expect(plan).toEqual({ parts: ['Read this'], linkReply: 'https://qs.test/a' });
    const inline = planX(post({ link: 'https://qs.test/a' }), target(), 'hello');
    expect(inline.parts[0]).toBe('hello\n\nhttps://qs.test/a');
  });
});

describe('publish', () => {
  it('posts a single tweet', async () => {
    fetchMock.mockResolvedValueOnce(created('100'));
    const r = await xAdapter.publish(ctx());
    expect(r).toMatchObject({ kind: 'published', externalId: '100', url: 'https://x.com/austin/status/100' });
  });

  it('chains a thread with in_reply_to and posts the link as a reply to the first post', async () => {
    fetchMock.mockResolvedValueOnce(created('1')).mockResolvedValueOnce(created('2')).mockResolvedValueOnce(created('3')).mockResolvedValueOnce(created('L'));
    const t = target({ format: 'thread', options: { threadParts: ['one', 'two', 'three'], linkInReply: true } });
    const r = await xAdapter.publish(ctx(post({ link: 'https://qs.test/a' }), t));
    expect(r.kind).toBe('published');
    const bodies = tweetBodies(fetchMock);
    expect(bodies[0]).toEqual({ text: 'one' });
    expect(bodies[1]).toEqual({ text: 'two', reply: { in_reply_to_tweet_id: '1' } });
    expect(bodies[2]).toEqual({ text: 'three', reply: { in_reply_to_tweet_id: '2' } });
    expect(bodies[3]).toEqual({ text: 'https://qs.test/a', reply: { in_reply_to_tweet_id: '1' } });
    expect((r as { state: Record<string, unknown> }).state).toMatchObject({ postedIds: ['1', '2', '3'], linkReplyId: 'L' });
  });

  it('keeps posted ids on a mid-thread failure and resumes without double-posting', async () => {
    fetchMock.mockResolvedValueOnce(created('1')).mockResolvedValueOnce(json({ title: 'Service Unavailable' }, 503));
    const t = target({ format: 'thread', options: { threadParts: ['one', 'two', 'three'] } });
    const r1 = await xAdapter.publish(ctx(post(), t));
    expect(r1.kind).toBe('processing');
    const state = (r1 as { state: Record<string, unknown> }).state;
    expect(state.postedIds).toEqual(['1']);

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(created('2')).mockResolvedValueOnce(created('3'));
    const r2 = await xAdapter.checkStatus!(ctx(post(), target({ ...t, state })));
    expect(r2).toMatchObject({ kind: 'published', externalId: '1' });
    const bodies = tweetBodies(fetchMock);
    expect(bodies.map((b) => b.text)).toEqual(['two', 'three']);
    expect(bodies[0].reply).toEqual({ in_reply_to_tweet_id: '1' });

    // a fully posted state never posts again
    fetchMock.mockReset();
    const r3 = await xAdapter.publish(ctx(post(), target({ ...t, state: (r2 as { state: Record<string, unknown> }).state })));
    expect(r3.kind).toBe('published');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non-retryable failure after a live part becomes needs_action with state', async () => {
    fetchMock.mockResolvedValueOnce(created('1')).mockResolvedValueOnce(json({ detail: 'duplicate content' }, 403));
    const t = target({ format: 'thread', options: { threadParts: ['one', 'two'] } });
    const r = await xAdapter.publish(ctx(post(), t));
    expect(r.kind).toBe('needs_action');
    expect((r as { state: Record<string, unknown> }).state.postedIds).toEqual(['1']);
  });

  it('429 is retryable with retryAfterSec from x-rate-limit-reset', async () => {
    const reset = Math.floor(Date.now() / 1000) + 120;
    fetchMock.mockResolvedValueOnce(json({ title: 'Too Many Requests' }, 429, { 'x-rate-limit-reset': String(reset) }));
    const r = await xAdapter.publish(ctx());
    expect(r).toMatchObject({ kind: 'failed', retryable: true });
    const after = (r as { retryAfterSec: number }).retryAfterSec;
    expect(after).toBeGreaterThan(100);
    expect(after).toBeLessThanOrEqual(121);
  });

  it('402 is credits exhausted, not retryable', async () => {
    fetchMock.mockResolvedValueOnce(json({ title: 'CreditsDepleted', detail: 'no credits' }, 402));
    expect(await xAdapter.publish(ctx())).toEqual({ kind: 'failed', error: 'X API credits exhausted', retryable: false });
  });

  it('uploads an image and attaches it to the first post', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(new Uint8Array(10), { headers: { 'content-type': 'image/png' } }))
      .mockResolvedValueOnce(json({ data: { id: '900', media_key: '3_900' } }))
      .mockResolvedValueOnce(created('1'));
    const r = await xAdapter.publish(ctx(post({ media: [{ url: 'https://cdn/i.png', type: 'image' }] })));
    expect(r.kind).toBe('published');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.x.com/2/media/upload');
    expect(tweetBodies(fetchMock)[0]).toEqual({ text: 'hello', media: { media_ids: ['900'] } });
  });

  it('never throws on network errors', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    expect(await xAdapter.publish(ctx())).toMatchObject({ kind: 'failed', retryable: true });
  });
});

describe('fetchMetrics', () => {
  it('maps public_metrics', async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { id: '1', public_metrics: { impression_count: 50, like_count: 3, retweet_count: 1, reply_count: 2, quote_count: 0 } } }));
    expect(await xAdapter.fetchMetrics!(ctx(post(), target({ external_id: '1' })))).toEqual({ impressions: 50, likes: 3, reposts: 1, replies: 2, quotes: 0 });
  });
});
