import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pkcePair } from '../../crypto';
import type { PublishContext, SocialPost, SocialPostTarget } from '../../types';
import { planChunks, tiktokAdapter, tiktokChallenge, TIKTOK_CHUNK_SIZE } from '../tiktok';

const MB = 1024 * 1024;

function post(over: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'p1', piece_id: null, title: null, caption: 'hello #tiktok', link: null, first_comment: null, tags: [],
    media: [{ url: 'https://cdn.example.com/v.mp4', type: 'video', mime: 'video/mp4', durationSec: 30 }],
    status: 'scheduled', scheduled_at: null, created_by: null, created_at: '', updated_at: '', ...over,
  };
}
function target(over: Partial<SocialPostTarget> = {}): SocialPostTarget {
  return {
    id: 't1', post_id: 'p1', account_id: 'a1', platform: 'tiktok', format: 'tiktok_video', caption_override: null,
    options: {}, status: 'processing', external_id: null, external_url: null, state: {}, error: null, attempts: 1,
    next_attempt_at: null, published_at: null, metrics: {}, metrics_synced_at: null, ...over,
  };
}
function ctx(p = post(), t = target()): PublishContext {
  return {
    account: {
      id: 'a1', platform: 'tiktok', external_id: 'open1', handle: 'austin', display_name: null, avatar_url: null,
      token_expires_at: null, scopes: [], meta: {}, status: 'connected', last_error: null, connected_at: '', updated_at: '',
      accessToken: 'tok', refreshToken: 'ref',
    },
    post: p, target: t, caption: t.caption_override ?? p.caption,
  };
}
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data, error: { code: 'ok', message: '', log_id: 'x' } }), { status, headers: { 'content-type': 'application/json' } });
const err = (code: string, status: number) =>
  new Response(JSON.stringify({ data: {}, error: { code, message: code, log_id: 'x' } }), { status });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.TIKTOK_CLIENT_KEY = 'ck';
  process.env.TIKTOK_CLIENT_SECRET = 'cs';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('auth', () => {
  it('builds the authorize URL with comma scopes and a hex PKCE challenge', () => {
    const { verifier, challenge } = pkcePair();
    const url = new URL(tiktokAdapter.getAuthUrl({ state: 's1', redirectUri: 'https://qs.test/cb', codeChallenge: challenge }));
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('client_key')).toBe('ck');
    expect(url.searchParams.get('scope')).toContain('video.publish,video.upload');
    expect(url.searchParams.get('scope')).toContain('video.list');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('hex'));
  });

  it('tiktokChallenge leaves hex alone', () => {
    const hex = 'a'.repeat(64);
    expect(tiktokChallenge(hex)).toBe(hex);
  });

  it('exchanges the code and reads the user', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 86400, open_id: 'o1', scope: 'user.info.basic,video.publish' })))
      .mockResolvedValueOnce(ok({ user: { open_id: 'o1', display_name: 'Austin', avatar_url: 'https://a', username: 'austin' } }));
    const [acc] = await tiktokAdapter.exchangeCode({ code: 'c', redirectUri: 'https://qs.test/cb', codeVerifier: 'v' });
    expect(acc).toMatchObject({ external_id: 'o1', handle: 'austin', accessToken: 'at', refreshToken: 'rt', scopes: ['user.info.basic', 'video.publish'] });
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.tiktokapis.com/v2/oauth/token/');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('v');
  });
});

describe('planChunks', () => {
  it('uploads small files whole', () => {
    expect(planChunks(3 * MB)).toEqual({ chunkSize: 3 * MB, totalChunkCount: 1, ranges: [{ start: 0, end: 3 * MB - 1 }] });
    expect(planChunks(TIKTOK_CHUNK_SIZE).totalChunkCount).toBe(1);
  });
  it('floors the chunk count and folds the remainder into the last chunk', () => {
    const size = 25 * MB + 123;
    const plan = planChunks(size);
    expect(plan.chunkSize).toBe(10 * MB);
    expect(plan.totalChunkCount).toBe(2);
    expect(plan.ranges[0]).toEqual({ start: 0, end: 10 * MB - 1 });
    expect(plan.ranges[1]).toEqual({ start: 10 * MB, end: size - 1 });
    const last = plan.ranges[1].end - plan.ranges[1].start + 1;
    expect(last).toBeGreaterThanOrEqual(5 * MB);
    expect(last).toBeLessThanOrEqual(128 * MB);
  });
  it('stays under 1000 chunks for huge files', () => {
    const plan = planChunks(12_000 * MB);
    expect(plan.totalChunkCount).toBeLessThanOrEqual(1000);
    expect(plan.ranges.at(-1)!.end).toBe(12_000 * MB - 1);
  });
});

describe('validate', () => {
  it('needs exactly one video and caption <= 2200', () => {
    expect(tiktokAdapter.validate(post(), target())).toEqual([]);
    expect(tiktokAdapter.validate(post({ media: [] }), target()).join()).toMatch(/exactly one video/);
    expect(tiktokAdapter.validate(post({ caption: 'x'.repeat(2201) }), target()).join()).toMatch(/2200/);
  });
  it('photo posts need 1-35 images and a title <= 90', () => {
    const img = { url: 'https://cdn/x.jpg', type: 'image' as const };
    const t = target({ format: 'tiktok_photo' });
    expect(tiktokAdapter.validate(post({ media: [img] }), t)).toEqual([]);
    expect(tiktokAdapter.validate(post({ media: Array(36).fill(img) }), t).join()).toMatch(/1-35/);
    expect(tiktokAdapter.validate(post({ media: [img], title: 't'.repeat(91) }), t).join()).toMatch(/90/);
  });
});

describe('publish', () => {
  it('queries creator info, inits FILE_UPLOAD and PUTs the chunks', async () => {
    const size = 12 * MB;
    fetchMock
      .mockResolvedValueOnce(ok({ privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'], max_video_post_duration_sec: 600, comment_disabled: true }))
      .mockResolvedValueOnce(new Response(new Uint8Array(size), { headers: { 'content-type': 'video/mp4' } }))
      .mockResolvedValueOnce(ok({ publish_id: 'pub1', upload_url: 'https://upload.tiktok/u?x=1' }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    const r = await tiktokAdapter.publish(ctx(post(), target({ options: { ttPrivacy: 'PUBLIC_TO_EVERYONE' } })));
    expect(r).toEqual({ kind: 'processing', state: { publishId: 'pub1', mode: 'direct', kind: 'video' }, retryAfterSec: 30 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.tiktokapis.com/v2/post/publish/creator_info/query/');
    const [initUrl, initReq] = fetchMock.mock.calls[2];
    expect(initUrl).toBe('https://open.tiktokapis.com/v2/post/publish/video/init/');
    const initBody = JSON.parse(initReq.body);
    // 12 MB with a 10 MB chunk: floor(12/10) = 1 chunk, which carries the whole file (last chunk absorbs the rest)
    expect(initBody.source_info).toEqual({ source: 'FILE_UPLOAD', video_size: size, chunk_size: 10 * MB, total_chunk_count: 1 });
    expect(initBody.post_info).toMatchObject({ privacy_level: 'PUBLIC_TO_EVERYONE', disable_comment: true, title: 'hello #tiktok' });
    const [putUrl, put] = fetchMock.mock.calls[3];
    expect(putUrl).toBe('https://upload.tiktok/u?x=1');
    expect(put.method).toBe('PUT');
    expect(put.headers['Content-Range']).toBe(`bytes 0-${size - 1}/${size}`);
  });

  it('draft mode uses the inbox endpoint without post_info', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ privacy_level_options: ['SELF_ONLY'] }))
      .mockResolvedValueOnce(new Response(new Uint8Array(1000)))
      .mockResolvedValueOnce(ok({ publish_id: 'pub2', upload_url: 'https://up' }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    const r = await tiktokAdapter.publish(ctx(post(), target({ options: { ttMode: 'draft' } })));
    expect(r.kind).toBe('processing');
    expect(fetchMock.mock.calls[2][0]).toBe('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).post_info).toBeUndefined();
  });

  it('fails clearly when the privacy level is not allowed', async () => {
    fetchMock.mockResolvedValueOnce(ok({ privacy_level_options: ['SELF_ONLY'] }));
    const r = await tiktokAdapter.publish(ctx(post(), target({ options: { ttPrivacy: 'PUBLIC_TO_EVERYONE' } })));
    expect(r).toMatchObject({ kind: 'failed', retryable: false });
    expect((r as { error: string }).error).toMatch(/not allowed.*SELF_ONLY/);
  });

  it('maps the unaudited-client error', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'] }))
      .mockResolvedValueOnce(new Response(new Uint8Array(10)))
      .mockResolvedValueOnce(err('unaudited_client_can_only_post_to_private_accounts', 403));
    const r = await tiktokAdapter.publish(ctx(post(), target({ options: { ttPrivacy: 'PUBLIC_TO_EVERYONE' } })));
    expect(r).toEqual({ kind: 'failed', error: 'TikTok app not audited yet: post as SELF_ONLY or use draft mode', retryable: false });
  });

  it('photo posts use content/init with PULL_FROM_URL', async () => {
    fetchMock.mockResolvedValueOnce(ok({ privacy_level_options: ['SELF_ONLY'] })).mockResolvedValueOnce(ok({ publish_id: 'ph1' }));
    const img = { url: 'https://cdn/x.jpg', type: 'image' as const };
    const r = await tiktokAdapter.publish(ctx(post({ media: [img, img], title: 'Hi' }), target({ format: 'tiktok_photo' })));
    expect(r.kind).toBe('processing');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][0]).toBe('https://open.tiktokapis.com/v2/post/publish/content/init/');
    expect(body).toMatchObject({ media_type: 'PHOTO', post_mode: 'DIRECT_POST', source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0 } });
    expect(body.post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('never throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const r = await tiktokAdapter.publish(ctx());
    expect(r).toMatchObject({ kind: 'failed', retryable: true });
  });
});

describe('checkStatus', () => {
  const withId = () => ctx(post(), target({ state: { publishId: 'pub1' } }));
  it('PUBLISH_COMPLETE -> published with the public post id', async () => {
    // raw int64 in the body: must not be rounded by JSON.parse
    fetchMock.mockResolvedValueOnce(new Response('{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7300000000000000001]},"error":{"code":"ok","message":"","log_id":"202210112248442CB9319E1FB30C1073F3"}}'));
    const r = await tiktokAdapter.checkStatus!(withId());
    expect(r).toMatchObject({ kind: 'published', externalId: '7300000000000000001', url: 'https://www.tiktok.com/@austin/video/7300000000000000001' });
  });
  it('SEND_TO_USER_INBOX -> needs_action', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 'SEND_TO_USER_INBOX' }));
    expect(await tiktokAdapter.checkStatus!(withId())).toEqual({ kind: 'needs_action', message: 'Open TikTok inbox to finish posting', state: { publishId: 'pub1' } });
  });
  it('FAILED -> failed with fail_reason', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 'FAILED', fail_reason: 'picture_size_check_failed' }));
    expect(await tiktokAdapter.checkStatus!(withId())).toMatchObject({ kind: 'failed', error: expect.stringContaining('picture_size_check_failed'), retryable: false });
  });
  it('anything else -> processing', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 'PROCESSING_UPLOAD' }));
    expect((await tiktokAdapter.checkStatus!(withId())).kind).toBe('processing');
  });
  it('publish with an existing publishId polls instead of re-uploading', async () => {
    fetchMock.mockResolvedValueOnce(ok({ status: 'PROCESSING_DOWNLOAD' }));
    expect((await tiktokAdapter.publish(withId())).kind).toBe('processing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.tiktokapis.com/v2/post/publish/status/fetch/');
  });
});

describe('fetchMetrics', () => {
  it('maps video counts and skips gracefully on error', async () => {
    fetchMock.mockResolvedValueOnce(ok({ videos: [{ id: 'v1', view_count: 10, like_count: 2, comment_count: 1, share_count: 0 }] }));
    const c = ctx(post(), target({ external_id: 'v1', state: { publishId: 'pub1', postId: 'v1' } }));
    expect(await tiktokAdapter.fetchMetrics!(c)).toEqual({ views: 10, likes: 2, comments: 1, shares: 0 });
    fetchMock.mockResolvedValueOnce(err('scope_not_authorized', 401));
    expect(await tiktokAdapter.fetchMetrics!(c)).toEqual({});
  });
});
