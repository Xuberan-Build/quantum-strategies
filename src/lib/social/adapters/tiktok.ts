/**
 * TikTok adapter (Content Posting API v2). Plain fetch, no SDK.
 *
 * Docs checked 2026-11-01:
 * - Web login (authorize URL, comma-separated scopes): https://developers.tiktok.com/doc/login-kit-web
 * - Token + refresh (POST /v2/oauth/token/, form-encoded, refresh token may rotate):
 *   https://developers.tiktok.com/doc/oauth-user-access-token-management
 * - PKCE: TikTok wants code_challenge = HEX(SHA256(verifier)), not RFC 7636 base64url:
 *   https://developers.tiktok.com/docs/en/login-kit-desktop . For web apps code_verifier is documented as optional
 *   ("required for mobile and desktop app only"). We get the standard base64url challenge from the shared pkcePair(),
 *   which is the same 32 SHA-256 bytes, so getAuthUrl re-encodes it as hex. That keeps both cases working.
 * - Creator info (must be queried before every post): https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
 * - Direct post video init + FILE_UPLOAD PUT: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 * - Draft (inbox) upload: https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
 * - Chunk rules (5-64 MB chunks, last chunk up to 128 MB, count = floor(size / chunk), < 5 MB whole, 1-1000 chunks):
 *   https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
 * - Photo post (PULL_FROM_URL only, needs the media domain verified in the TikTok developer portal):
 *   https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 * - Status: https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status
 *   (field really is spelled `publicaly_available_post_id`)
 * - Metrics: https://developers.tiktok.com/doc/tiktok-api-v2-video-query (scope video.list)
 */
import type {
  AccountWithTokens,
  ConnectedAccountInput,
  PlatformAdapter,
  PublishContext,
  PublishResult,
  SocialPost,
  SocialPostTarget,
  TargetOptions,
  TokenUpdate,
} from '../types';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const API = 'https://open.tiktokapis.com';
const TOKEN_URL = `${API}/v2/oauth/token/`;

// user.info.profile is needed for `username` (the @handle used in post URLs); video.list for metrics.
export const TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'video.publish', 'video.upload', 'video.list'];

const MB = 1024 * 1024;
export const TIKTOK_CHUNK_SIZE = 10 * MB;
const MIN_CHUNK = 5 * MB;
const MAX_CHUNK = 64 * MB;
const MAX_LAST_CHUNK = 128 * MB;
const MAX_CHUNKS = 1000;

export const CAPTION_MAX = 2200;
export const PHOTO_TITLE_MAX = 90;
export const PHOTO_DESCRIPTION_MAX = 4000;
export const PHOTO_MAX = 35;

const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

/** UTF-16 length, which is how TikTok counts "runes". */
function u16len(s: string): number {
  return s.length;
}

/** base64url challenge (standard S256) -> hex (TikTok's encoding of the same SHA-256 bytes). */
export function tiktokChallenge(base64urlChallenge: string): string {
  if (/^[0-9a-f]{64}$/.test(base64urlChallenge)) return base64urlChallenge; // already hex
  return Buffer.from(base64urlChallenge, 'base64url').toString('hex');
}

export interface ChunkPlan {
  chunkSize: number;
  totalChunkCount: number;
  /** inclusive byte ranges in upload order */
  ranges: Array<{ start: number; end: number }>;
}

/**
 * TikTok chunking: files under one preferred chunk upload whole; otherwise count = floor(size / chunk) and the last
 * chunk absorbs the remainder (so it is between chunk and 2*chunk, inside the 128 MB cap).
 */
export function planChunks(videoSize: number, preferred = TIKTOK_CHUNK_SIZE): ChunkPlan {
  if (videoSize <= 0) throw new Error('Video is empty');
  let chunk = Math.min(Math.max(preferred, MIN_CHUNK), MAX_CHUNK);
  if (videoSize <= chunk) {
    return { chunkSize: videoSize, totalChunkCount: 1, ranges: [{ start: 0, end: videoSize - 1 }] };
  }
  // very large files: grow the chunk so we stay under 1000 chunks
  while (Math.floor(videoSize / chunk) > MAX_CHUNKS && chunk < MAX_CHUNK) chunk = Math.min(chunk * 2, MAX_CHUNK);
  const count = Math.floor(videoSize / chunk);
  if (count > MAX_CHUNKS) throw new Error('Video is too large for TikTok upload');
  const ranges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < count; i++) {
    const start = i * chunk;
    const end = i === count - 1 ? videoSize - 1 : start + chunk - 1;
    ranges.push({ start, end });
  }
  const last = ranges[ranges.length - 1];
  if (last.end - last.start + 1 > MAX_LAST_CHUNK) throw new Error('Last TikTok chunk would exceed 128 MB');
  return { chunkSize: chunk, totalChunkCount: count, ranges };
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

interface TikTokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string; logid?: string };
}

class TikTokError extends Error {
  constructor(message: string, public code: string, public httpStatus: number) {
    super(message);
  }
}

async function ttFetch<T>(path: string, token: string, init: { method?: string; body?: unknown; query?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}${init.query ?? ''}`, {
    method: init.method ?? 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let json: TikTokEnvelope<T> = {};
  try {
    // TikTok returns post ids as bare int64 numbers, which JSON.parse would round. Quote long integers first.
    const text = await res.text();
    json = JSON.parse(text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"')) as TikTokEnvelope<T>;
  } catch {
    /* non-JSON body */
  }
  const code = json.error?.code ?? (res.ok ? 'ok' : `http_${res.status}`);
  if (!res.ok || code !== 'ok') {
    throw new TikTokError(json.error?.message || code, code, res.status);
  }
  return (json.data ?? {}) as T;
}

/** Map a thrown error to a PublishResult. Never throws. */
export function tiktokFailure(err: unknown): PublishResult {
  if (err instanceof TikTokError) {
    switch (err.code) {
      case 'unaudited_client_can_only_post_to_private_accounts':
        return { kind: 'failed', error: 'TikTok app not audited yet: post as SELF_ONLY or use draft mode', retryable: false };
      case 'privacy_level_option_mismatch':
        return { kind: 'failed', error: `TikTok rejected the privacy level: ${err.message}`, retryable: false };
      case 'url_ownership_unverified':
        return {
          kind: 'failed',
          error: 'TikTok has not verified the media domain. Verify the social-media bucket domain in the TikTok developer portal (needed for photo posts).',
          retryable: false,
        };
      case 'spam_risk_too_many_posts':
        return { kind: 'failed', error: 'TikTok daily post cap reached for this account', retryable: true, retryAfterSec: 6 * 3600 };
      case 'spam_risk_user_banned_from_posting':
        return { kind: 'failed', error: 'TikTok says this account is banned from posting', retryable: false };
      case 'reached_active_user_cap':
        return { kind: 'failed', error: 'TikTok app reached its daily active publishing user quota', retryable: true, retryAfterSec: 6 * 3600 };
      case 'access_token_invalid':
        return { kind: 'failed', error: 'TikTok token is invalid or expired. Reconnect the account.', retryable: false };
      case 'scope_not_authorized':
        return { kind: 'failed', error: `TikTok scope not granted (${err.message}). Reconnect the account.`, retryable: false };
      case 'rate_limit_exceeded':
        return { kind: 'failed', error: 'TikTok rate limit hit', retryable: true, retryAfterSec: 60 };
    }
    if (err.httpStatus === 429) return { kind: 'failed', error: 'TikTok rate limit hit', retryable: true, retryAfterSec: 60 };
    if (err.httpStatus >= 500) return { kind: 'failed', error: `TikTok server error: ${err.message}`, retryable: true };
    return { kind: 'failed', error: `TikTok: ${err.message} (${err.code})`, retryable: false };
  }
  return { kind: 'failed', error: `TikTok: ${err instanceof Error ? err.message : String(err)}`, retryable: true };
}

interface CreatorInfo {
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`TikTok token request failed: ${json.error_description || json.error || res.status}`);
  }
  return json;
}

function postUrl(handle: string | null | undefined, id: string, photo: boolean): string | null {
  if (!handle) return null;
  return `https://www.tiktok.com/@${handle.replace(/^@/, '')}/${photo ? 'photo' : 'video'}/${id}`;
}

function resolvePrivacy(opts: TargetOptions, info: CreatorInfo): { privacy?: string; error?: string } {
  const allowed = info.privacy_level_options ?? [];
  const wanted = opts.ttPrivacy ?? 'SELF_ONLY';
  if (allowed.length > 0 && !allowed.includes(wanted)) {
    return {
      error: `TikTok privacy "${wanted}" is not allowed for this account right now. Allowed: ${allowed.join(', ')}`,
    };
  }
  return { privacy: wanted };
}

async function publishVideo(ctx: PublishContext, token: string): Promise<PublishResult> {
  const { post, target } = ctx;
  const opts = target.options ?? {};
  const draft = opts.ttMode === 'draft';
  const media = post.media[0];

  const info = await ttFetch<CreatorInfo>('/v2/post/publish/creator_info/query/', token);
  const max = info.max_video_post_duration_sec;
  if (max && media.durationSec && media.durationSec > max) {
    return { kind: 'failed', error: `Video is ${Math.round(media.durationSec)}s; this TikTok account allows at most ${max}s`, retryable: false };
  }

  let postInfo: Record<string, unknown> | undefined;
  if (!draft) {
    const p = resolvePrivacy(opts, info);
    if (p.error) return { kind: 'failed', error: p.error, retryable: false };
    postInfo = {
      title: ctx.caption,
      privacy_level: p.privacy,
      disable_comment: !!(opts.ttDisableComment || info.comment_disabled),
      disable_duet: !!(opts.ttDisableDuet || info.duet_disabled),
      disable_stitch: !!(opts.ttDisableStitch || info.stitch_disabled),
      brand_content_toggle: !!opts.ttBrandedContent,
      ...(opts.thumbOffsetMs != null ? { video_cover_timestamp_ms: opts.thumbOffsetMs } : {}),
    };
  }

  // Download the video from our public bucket, then push it to TikTok (FILE_UPLOAD avoids domain verification).
  const dl = await fetch(media.url);
  if (!dl.ok) return { kind: 'failed', error: `Could not download video (${dl.status})`, retryable: true };
  const bytes = new Uint8Array(await dl.arrayBuffer());
  const headerMime = dl.headers.get('content-type')?.split(';')[0].trim();
  const mime = [media.mime, headerMime].find((m) => m && VIDEO_MIMES.includes(m)) ?? 'video/mp4';
  const plan = planChunks(bytes.byteLength);

  const sourceInfo = {
    source: 'FILE_UPLOAD',
    video_size: bytes.byteLength,
    chunk_size: plan.chunkSize,
    total_chunk_count: plan.totalChunkCount,
  };
  const initPath = draft ? '/v2/post/publish/inbox/video/init/' : '/v2/post/publish/video/init/';
  const init = await ttFetch<{ publish_id?: string; upload_url?: string }>(initPath, token, {
    body: draft ? { source_info: sourceInfo } : { post_info: postInfo, source_info: sourceInfo },
  });
  if (!init.publish_id || !init.upload_url) return { kind: 'failed', error: 'TikTok init returned no upload URL', retryable: true };

  for (const r of plan.ranges) {
    const chunk = bytes.subarray(r.start, r.end + 1);
    const put = await fetch(init.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': mime,
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${r.start}-${r.end}/${bytes.byteLength}`,
      },
      body: chunk,
    });
    if (!put.ok && put.status !== 206 && put.status !== 201) {
      return { kind: 'failed', error: `TikTok chunk upload failed (${put.status}) at bytes ${r.start}-${r.end}`, retryable: true };
    }
  }

  return { kind: 'processing', state: { publishId: init.publish_id, mode: draft ? 'draft' : 'direct', kind: 'video' }, retryAfterSec: 30 };
}

async function publishPhotos(ctx: PublishContext, token: string): Promise<PublishResult> {
  const { post, target } = ctx;
  const opts = target.options ?? {};
  const draft = opts.ttMode === 'draft';
  const info = await ttFetch<CreatorInfo>('/v2/post/publish/creator_info/query/', token);

  const postInfo: Record<string, unknown> = {
    title: (post.title ?? '').slice(0, PHOTO_TITLE_MAX),
    description: ctx.caption,
  };
  if (!draft) {
    const p = resolvePrivacy(opts, info);
    if (p.error) return { kind: 'failed', error: p.error, retryable: false };
    Object.assign(postInfo, {
      privacy_level: p.privacy,
      disable_comment: !!(opts.ttDisableComment || info.comment_disabled),
      brand_content_toggle: !!opts.ttBrandedContent,
      auto_add_music: true,
    });
  }

  // Photos only support PULL_FROM_URL: the media domain must be verified in the TikTok developer portal.
  const init = await ttFetch<{ publish_id?: string }>('/v2/post/publish/content/init/', token, {
    body: {
      media_type: 'PHOTO',
      post_mode: draft ? 'MEDIA_UPLOAD' : 'DIRECT_POST',
      post_info: postInfo,
      source_info: { source: 'PULL_FROM_URL', photo_images: post.media.map((m) => m.url), photo_cover_index: 0 },
    },
  });
  if (!init.publish_id) return { kind: 'failed', error: 'TikTok photo init returned no publish id', retryable: true };
  return { kind: 'processing', state: { publishId: init.publish_id, mode: draft ? 'draft' : 'direct', kind: 'photo' }, retryAfterSec: 30 };
}

export const tiktokAdapter: PlatformAdapter = {
  platform: 'tiktok',
  label: 'TikTok',
  formats: ['tiktok_video', 'tiktok_photo'],
  usesPkce: true,
  requiredEnv: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],

  getAuthUrl({ state, redirectUri, codeChallenge }) {
    const p = new URLSearchParams({
      client_key: env('TIKTOK_CLIENT_KEY'),
      response_type: 'code',
      scope: TIKTOK_SCOPES.join(','),
      redirect_uri: redirectUri,
      state,
    });
    if (codeChallenge) {
      p.set('code_challenge', tiktokChallenge(codeChallenge));
      p.set('code_challenge_method', 'S256');
    }
    return `${AUTH_URL}?${p.toString()}`;
  },

  async exchangeCode({ code, redirectUri, codeVerifier }): Promise<ConnectedAccountInput[]> {
    const tok = await tokenRequest({
      client_key: env('TIKTOK_CLIENT_KEY'),
      client_secret: env('TIKTOK_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const accessToken = tok.access_token!;

    type U = { user?: { open_id?: string; display_name?: string; avatar_url?: string; username?: string } };
    let user: U['user'] = {};
    try {
      user = (await ttFetch<U>('/v2/user/info/', accessToken, { method: 'GET', query: '?fields=open_id,avatar_url,display_name,username' })).user ?? {};
    } catch {
      // username needs user.info.profile; fall back to the basic fields
      try {
        user = (await ttFetch<U>('/v2/user/info/', accessToken, { method: 'GET', query: '?fields=open_id,avatar_url,display_name' })).user ?? {};
      } catch {
        user = {};
      }
    }

    return [
      {
        platform: 'tiktok',
        external_id: user?.open_id || tok.open_id || '',
        handle: user?.username ?? null,
        display_name: user?.display_name ?? null,
        avatar_url: user?.avatar_url ?? null,
        accessToken,
        refreshToken: tok.refresh_token ?? null,
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
        scopes: (tok.scope ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        meta: {},
      },
    ];
  },

  async refreshToken(account: AccountWithTokens): Promise<TokenUpdate> {
    if (!account.refreshToken) throw new Error('TikTok account has no refresh token');
    const tok = await tokenRequest({
      client_key: env('TIKTOK_CLIENT_KEY'),
      client_secret: env('TIKTOK_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    });
    return {
      accessToken: tok.access_token!,
      refreshToken: tok.refresh_token ?? undefined, // may rotate
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
    };
  },

  validate(post: SocialPost, target: SocialPostTarget): string[] {
    const problems: string[] = [];
    const caption = target.caption_override ?? post.caption ?? '';
    const media = post.media ?? [];
    if (target.format === 'tiktok_video') {
      const videos = media.filter((m) => m.type === 'video');
      if (videos.length !== 1 || media.length !== 1) problems.push('TikTok video needs exactly one video');
      if (u16len(caption) > CAPTION_MAX) problems.push(`TikTok caption is ${u16len(caption)} characters; max ${CAPTION_MAX}`);
      const mime = videos[0]?.mime;
      if (mime && !VIDEO_MIMES.includes(mime)) problems.push(`TikTok accepts MP4, MOV or WebM, not ${mime}`);
    } else if (target.format === 'tiktok_photo') {
      if (media.length < 1 || media.length > PHOTO_MAX) problems.push(`TikTok photo post needs 1-${PHOTO_MAX} images`);
      if (media.some((m) => m.type !== 'image')) problems.push('TikTok photo post can only contain images');
      if (post.title && u16len(post.title) > PHOTO_TITLE_MAX) problems.push(`TikTok photo title is ${u16len(post.title)} characters; max ${PHOTO_TITLE_MAX}`);
      if (u16len(caption) > Math.min(CAPTION_MAX, PHOTO_DESCRIPTION_MAX)) problems.push(`TikTok caption is ${u16len(caption)} characters; max ${CAPTION_MAX}`);
    } else {
      problems.push(`TikTok does not support format ${target.format}`);
    }
    const priv = target.options?.ttPrivacy;
    if (priv && !['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].includes(priv)) {
      problems.push(`Unknown TikTok privacy level ${priv}`);
    }
    return problems;
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    try {
      const token = ctx.account.accessToken;
      if (!token) return { kind: 'failed', error: 'TikTok account has no access token. Reconnect it.', retryable: false };
      // A publish id already exists: do not init a second upload, just keep polling.
      if (typeof ctx.target.state?.publishId === 'string') return await tiktokAdapter.checkStatus!(ctx);
      return ctx.target.format === 'tiktok_photo' ? await publishPhotos(ctx, token) : await publishVideo(ctx, token);
    } catch (err) {
      return tiktokFailure(err);
    }
  },

  async checkStatus(ctx: PublishContext): Promise<PublishResult> {
    try {
      const token = ctx.account.accessToken;
      if (!token) return { kind: 'failed', error: 'TikTok account has no access token. Reconnect it.', retryable: false };
      const publishId = ctx.target.state?.publishId;
      if (typeof publishId !== 'string') {
        return {
          kind: 'failed',
          error: 'TikTok publish was interrupted before an id came back. Check the TikTok app before retrying.',
          retryable: false,
        };
      }
      const s = await ttFetch<{ status?: string; fail_reason?: string; publicaly_available_post_id?: Array<string | number> }>(
        '/v2/post/publish/status/fetch/',
        token,
        { body: { publish_id: publishId } },
      );
      const photo = ctx.target.format === 'tiktok_photo';
      switch (s.status) {
        case 'PUBLISH_COMPLETE': {
          const pub = s.publicaly_available_post_id?.[0];
          const id = pub != null ? String(pub) : publishId;
          return {
            kind: 'published',
            externalId: id,
            url: pub != null ? postUrl(ctx.account.handle, id, photo) : null,
            state: { publishId, ...(pub != null ? { postId: id } : {}) },
          };
        }
        case 'SEND_TO_USER_INBOX':
          return { kind: 'needs_action', message: 'Open TikTok inbox to finish posting', state: { publishId } };
        case 'FAILED':
          return { kind: 'failed', error: `TikTok publish failed: ${s.fail_reason || 'unknown reason'}`, retryable: false };
        default:
          return { kind: 'processing', state: { publishId, lastStatus: s.status ?? null }, retryAfterSec: 30 };
      }
    } catch (err) {
      return tiktokFailure(err);
    }
  },

  async fetchMetrics(ctx: PublishContext): Promise<Record<string, number>> {
    try {
      const token = ctx.account.accessToken;
      const id = (ctx.target.state?.postId as string | undefined) ?? ctx.target.external_id;
      if (!token || !id || id === ctx.target.state?.publishId) return {};
      const data = await ttFetch<{ videos?: Array<Record<string, number | string>> }>('/v2/video/query/', token, {
        query: '?fields=id,view_count,like_count,comment_count,share_count',
        body: { filters: { video_ids: [id] } },
      });
      const v = data.videos?.[0];
      if (!v) return {};
      const out: Record<string, number> = {};
      const map: Record<string, string> = { view_count: 'views', like_count: 'likes', comment_count: 'comments', share_count: 'shares' };
      for (const [k, name] of Object.entries(map)) if (typeof v[k] === 'number') out[name] = v[k] as number;
      return out;
    } catch {
      return {};
    }
  },
};
