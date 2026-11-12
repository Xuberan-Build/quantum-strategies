import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { instagramAdapter, mapError, InstagramApiError } from '../instagram';
import type { AccountWithTokens, Format, PublishContext, SocialMedia, SocialPost, SocialPostTarget } from '../../types';

type Call = { url: string; method: string; params: URLSearchParams };
let calls: Call[];
let responder: (c: Call) => { status?: number; body: unknown };

function mockFetch() {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const [base, qs] = String(input).split('?');
      const params = method === 'GET' ? new URLSearchParams(qs ?? '') : new URLSearchParams(String(init?.body ?? ''));
      const call = { url: base, method, params };
      calls.push(call);
      const { status = 200, body } = responder(call);
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

const video = (over: Partial<SocialMedia> = {}): SocialMedia => ({ url: 'https://cdn.example.com/v.mp4', type: 'video', ...over });
const image = (over: Partial<SocialMedia> = {}): SocialMedia => ({ url: 'https://cdn.example.com/i.jpg', type: 'image', ...over });

function makePost(media: SocialMedia[], over: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'post1', piece_id: null, title: null, caption: 'Hello #qs', media, link: null, first_comment: null, tags: [],
    status: 'scheduled', scheduled_at: null, created_by: null, created_at: '', updated_at: '', ...over,
  };
}
function makeTarget(format: Format, over: Partial<SocialPostTarget> = {}): SocialPostTarget {
  return {
    id: 't1', post_id: 'post1', account_id: 'a1', platform: 'instagram', format, caption_override: null, options: {},
    status: 'pending', external_id: null, external_url: null, state: {}, error: null, attempts: 0, next_attempt_at: null,
    published_at: null, metrics: {}, metrics_synced_at: null, ...over,
  };
}
const account: AccountWithTokens = {
  id: 'a1', platform: 'instagram', external_id: 'IG123', handle: 'qs', display_name: 'QS', avatar_url: null,
  token_expires_at: null, scopes: [], meta: {}, status: 'connected', last_error: null, connected_at: '', updated_at: '',
  accessToken: 'TOKEN', refreshToken: null,
};
function ctx(post: SocialPost, target: SocialPostTarget): PublishContext {
  return { account, post, target, caption: target.caption_override ?? post.caption };
}

beforeEach(() => {
  process.env.INSTAGRAM_APP_ID = 'APPID';
  process.env.INSTAGRAM_APP_SECRET = 'SECRET';
  mockFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('getAuthUrl', () => {
  it('builds the Instagram Login authorize URL with business scopes', () => {
    const url = new URL(instagramAdapter.getAuthUrl({ state: 'S1', redirectUri: 'https://qs.test/cb' }));
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('APPID');
    expect(url.searchParams.get('redirect_uri')).toBe('https://qs.test/cb');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('S1');
    expect(url.searchParams.get('scope')!.split(',')).toEqual([
      'instagram_business_basic',
      'instagram_business_content_publish',
      'instagram_business_manage_insights',
      'instagram_business_manage_comments',
    ]);
  });
});

describe('exchangeCode', () => {
  it('swaps short-lived for long-lived token and reads /me', async () => {
    responder = (c) => {
      if (c.url === 'https://api.instagram.com/oauth/access_token')
        return { body: { data: [{ access_token: 'SHORT', user_id: 999, permissions: 'instagram_business_basic,instagram_business_content_publish' }] } };
      if (c.url === 'https://graph.instagram.com/access_token') return { body: { access_token: 'LONG', expires_in: 5184000 } };
      if (c.url.endsWith('/me')) return { body: { id: 'APPSCOPED', user_id: '1789', username: 'qs', name: 'Quantum', profile_picture_url: 'https://x/p.jpg', account_type: 'BUSINESS' } };
      throw new Error(`unexpected ${c.url}`);
    };
    const [acc] = await instagramAdapter.exchangeCode({ code: 'CODE#_', redirectUri: 'https://qs.test/cb' });
    expect(calls[0].params.get('code')).toBe('CODE');
    expect(calls[0].params.get('grant_type')).toBe('authorization_code');
    expect(calls[1].params.get('grant_type')).toBe('ig_exchange_token');
    expect(calls[1].params.get('access_token')).toBe('SHORT');
    expect(acc).toMatchObject({ platform: 'instagram', external_id: '1789', handle: 'qs', accessToken: 'LONG' });
    expect(acc.scopes).toEqual(['instagram_business_basic', 'instagram_business_content_publish']);
    expect(acc.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 86400 * 1000);
  });

  it('refreshes via ig_refresh_token', async () => {
    responder = () => ({ body: { access_token: 'NEW', expires_in: 5184000 } });
    const res = await instagramAdapter.refreshToken!(account);
    expect(calls[0].url).toBe('https://graph.instagram.com/refresh_access_token');
    expect(calls[0].params.get('grant_type')).toBe('ig_refresh_token');
    expect(res.accessToken).toBe('NEW');
  });
});

describe('reel publish', () => {
  it('returns processing, then publishes via checkStatus and posts the first comment', async () => {
    let status = 'IN_PROGRESS';
    responder = (c) => {
      if (c.method === 'POST' && c.url.endsWith('/IG123/media')) return { body: { id: 'C1' } };
      if (c.method === 'GET' && c.url.endsWith('/C1')) return { body: { status_code: status } };
      if (c.url.endsWith('/content_publishing_limit')) return { body: { data: [{ quota_usage: 1, config: { quota_total: 100 } }] } };
      if (c.url.endsWith('/media_publish')) return { body: { id: 'M1' } };
      if (c.method === 'GET' && c.url.endsWith('/M1')) return { body: { permalink: 'https://www.instagram.com/reel/abc/' } };
      if (c.url.endsWith('/M1/comments')) return { body: { id: 'CM1' } };
      throw new Error(`unexpected ${c.method} ${c.url}`);
    };
    const post = makePost([video({ durationSec: 30 })], { first_comment: 'Link in bio' });
    const target = makeTarget('reel', { options: { shareToFeed: true } });

    const first = await instagramAdapter.publish(ctx(post, target));
    expect(first.kind).toBe('processing');
    const create = calls.find((c) => c.url.endsWith('/IG123/media'))!;
    expect(create.params.get('media_type')).toBe('REELS');
    expect(create.params.get('video_url')).toBe('https://cdn.example.com/v.mp4');
    expect(create.params.get('share_to_feed')).toBe('true');
    expect(create.params.get('trial_params')).toBeNull();
    if (first.kind !== 'processing') throw new Error();
    expect(first.state).toMatchObject({ step: 'container', containerId: 'C1' });

    status = 'FINISHED';
    const second = await instagramAdapter.checkStatus!(ctx(post, { ...target, state: first.state }));
    expect(second).toMatchObject({ kind: 'published', externalId: 'M1', url: 'https://www.instagram.com/reel/abc/' });
    expect(calls.find((c) => c.url.endsWith('/media_publish'))!.params.get('creation_id')).toBe('C1');
    expect(calls.find((c) => c.url.endsWith('/M1/comments'))!.params.get('message')).toBe('Link in bio');
    // Never recreated the container on resume
    expect(calls.filter((c) => c.url.endsWith('/IG123/media'))).toHaveLength(1);
  });

  it('a failing first comment does not fail the publish', async () => {
    responder = (c) => {
      if (c.url.endsWith('/IG123/media')) return { body: { id: 'C1' } };
      if (c.url.endsWith('/C1')) return { body: { status_code: 'FINISHED' } };
      if (c.url.endsWith('/content_publishing_limit')) return { body: { data: [] } };
      if (c.url.endsWith('/media_publish')) return { body: { id: 'M1' } };
      if (c.url.endsWith('/M1')) return { body: { permalink: 'https://www.instagram.com/p/x/' } };
      if (c.url.endsWith('/comments')) return { status: 400, body: { error: { message: 'nope', code: 100 } } };
      throw new Error(c.url);
    };
    const res = await instagramAdapter.publish(ctx(makePost([image()], { first_comment: 'hi' }), makeTarget('image')));
    expect(res.kind).toBe('published');
    if (res.kind === 'published') expect(res.state).toMatchObject({ commentError: 'nope' });
  });

  it('returns failed when the container errors', async () => {
    responder = (c) => {
      if (c.url.endsWith('/IG123/media')) return { body: { id: 'C1' } };
      return { body: { status_code: 'ERROR', status: 'Error: 2207026' } };
    };
    const res = await instagramAdapter.publish(ctx(makePost([video()]), makeTarget('reel')));
    expect(res).toMatchObject({ kind: 'failed', retryable: false });
    if (res.kind === 'failed') expect(res.error).toContain('2207026');
  });
});

describe('trial reel', () => {
  it('sends trial_params with the chosen graduation strategy and no share_to_feed', async () => {
    responder = (c) => (c.url.endsWith('/IG123/media') ? { body: { id: 'C1' } } : { body: { status_code: 'IN_PROGRESS' } });
    await instagramAdapter.publish(
      ctx(makePost([video()]), makeTarget('trial_reel', { options: { trialGraduation: 'SS_PERFORMANCE', shareToFeed: true } })),
    );
    const create = calls.find((c) => c.url.endsWith('/IG123/media'))!;
    expect(create.params.get('media_type')).toBe('REELS');
    expect(JSON.parse(create.params.get('trial_params')!)).toEqual({ graduation_strategy: 'SS_PERFORMANCE' });
    expect(create.params.get('share_to_feed')).toBeNull();
  });

  it('defaults graduation to MANUAL', async () => {
    responder = (c) => (c.url.endsWith('/IG123/media') ? { body: { id: 'C1' } } : { body: { status_code: 'IN_PROGRESS' } });
    await instagramAdapter.publish(ctx(makePost([video()]), makeTarget('trial_reel')));
    const create = calls.find((c) => c.url.endsWith('/IG123/media'))!;
    expect(JSON.parse(create.params.get('trial_params')!)).toEqual({ graduation_strategy: 'MANUAL' });
  });
});

describe('carousel', () => {
  it('creates children, waits for them, then creates the parent and publishes', async () => {
    let n = 0;
    let childStatus = 'IN_PROGRESS';
    responder = (c) => {
      if (c.method === 'POST' && c.url.endsWith('/IG123/media')) {
        if (c.params.get('media_type') === 'CAROUSEL') return { body: { id: 'PARENT' } };
        n += 1;
        return { body: { id: `CH${n}` } };
      }
      if (c.url.endsWith('/CH1') || c.url.endsWith('/CH2')) return { body: { status_code: c.url.endsWith('/CH1') ? 'FINISHED' : childStatus } };
      if (c.url.endsWith('/PARENT')) return { body: { status_code: 'FINISHED' } };
      if (c.url.endsWith('/content_publishing_limit')) return { body: { data: [] } };
      if (c.url.endsWith('/media_publish')) return { body: { id: 'M9' } };
      if (c.url.endsWith('/M9')) return { body: { permalink: 'https://www.instagram.com/p/c/' } };
      throw new Error(`unexpected ${c.method} ${c.url}`);
    };
    const post = makePost([image(), video()]);
    const target = makeTarget('carousel');

    const first = await instagramAdapter.publish(ctx(post, target));
    expect(first.kind).toBe('processing');
    const children = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/IG123/media'));
    expect(children).toHaveLength(2);
    expect(children[0].params.get('is_carousel_item')).toBe('true');
    expect(children[0].params.get('image_url')).toBe('https://cdn.example.com/i.jpg');
    expect(children[1].params.get('media_type')).toBe('VIDEO');
    expect(children[0].params.get('caption')).toBeNull();
    if (first.kind !== 'processing') throw new Error();
    expect(first.state).toMatchObject({ step: 'children', childIds: ['CH1', 'CH2'] });

    childStatus = 'FINISHED';
    const second = await instagramAdapter.checkStatus!(ctx(post, { ...target, state: first.state }));
    const parent = calls.find((c) => c.params.get('media_type') === 'CAROUSEL')!;
    expect(parent.params.get('children')).toBe('CH1,CH2');
    expect(parent.params.get('caption')).toBe('Hello #qs');
    expect(second).toMatchObject({ kind: 'published', externalId: 'M9' });
    expect(calls.find((c) => c.url.endsWith('/media_publish'))!.params.get('creation_id')).toBe('PARENT');
  });
});

describe('validate', () => {
  it('passes a good reel', () => {
    expect(instagramAdapter.validate(makePost([video({ durationSec: 20 })]), makeTarget('reel'))).toEqual([]);
  });
  it('flags reel problems', () => {
    const errs = instagramAdapter.validate(makePost([image(), video({ durationSec: 1000 })]), makeTarget('trial_reel'));
    expect(errs.join(' ')).toMatch(/exactly one video/);
    expect(errs.join(' ')).toMatch(/3 seconds to 15 minutes/);
  });
  it('flags carousel count, caption length, hashtags, non-https and PNG', () => {
    const caption = 'x'.repeat(2190) + Array.from({ length: 31 }, (_, i) => ` #t${i}`).join('');
    const errs = instagramAdapter.validate(
      makePost([image({ url: 'http://cdn.example.com/a.png' })], { caption }),
      makeTarget('carousel'),
    );
    const all = errs.join(' | ');
    expect(all).toMatch(/2 to 20 items/);
    expect(all).toMatch(/Instagram allows 2200/);
    expect(all).toMatch(/31 hashtags/);
    expect(all).toMatch(/public https/);
    expect(all).toMatch(/JPEG/);
  });
  it('flags missing media and long story video', () => {
    expect(instagramAdapter.validate(makePost([]), makeTarget('image')).join()).toMatch(/at least one/);
    expect(instagramAdapter.validate(makePost([video({ durationSec: 90 })]), makeTarget('story')).join()).toMatch(/3 to 60 seconds/);
  });
  it('rejects non-Instagram formats', () => {
    expect(instagramAdapter.validate(makePost([video()]), makeTarget('tweet')).join()).toMatch(/does not support/);
  });
});

describe('error mapping', () => {
  it('maps code 190 to non-retryable Reconnect Instagram', async () => {
    responder = () => ({ status: 400, body: { error: { message: 'Error validating access token: Session has expired', type: 'OAuthException', code: 190 } } });
    const res = await instagramAdapter.publish(ctx(makePost([image()]), makeTarget('image')));
    expect(res).toMatchObject({ kind: 'failed', retryable: false });
    if (res.kind === 'failed') expect(res.error).toMatch(/^Reconnect Instagram/);
  });
  it('maps rate limits and transient errors to retryable', () => {
    expect(mapError(new InstagramApiError('too many', 400, 4))).toMatchObject({ retryable: true, retryAfterSec: 900 });
    expect(mapError(new InstagramApiError('limit', 400, 9, 2207042))).toMatchObject({ retryable: true, retryAfterSec: 3600 });
    expect(mapError(new InstagramApiError('blip', 500, 2, undefined, true))).toMatchObject({ retryable: true });
    expect(mapError(new InstagramApiError('bad param', 400, 100))).toMatchObject({ retryable: false });
  });
  it('publish never throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET'); }));
    const res = await instagramAdapter.publish(ctx(makePost([image()]), makeTarget('image')));
    expect(res).toMatchObject({ kind: 'failed', retryable: true });
  });
});

describe('fetchMetrics', () => {
  it('requests current reel metrics (views, not plays/impressions) and normalises saved -> saves', async () => {
    responder = () => ({ body: { data: [{ name: 'views', values: [{ value: 120 }] }, { name: 'saved', values: [{ value: 4 }] }] } });
    const m = await instagramAdapter.fetchMetrics!(ctx(makePost([video()]), makeTarget('reel', { external_id: 'M1' })));
    const metric = calls[0].params.get('metric')!;
    expect(metric).toContain('views');
    expect(metric).not.toContain('plays');
    expect(metric).not.toContain('impressions');
    expect(m).toEqual({ views: 120, saves: 4 });
  });
});
