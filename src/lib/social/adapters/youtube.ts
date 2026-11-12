/**
 * YouTube adapter (Data API v3, plain fetch, no googleapis package).
 *
 * Auth: a Google OAuth *web* client (GOOGLE_SOCIAL_CLIENT_ID / GOOGLE_SOCIAL_CLIENT_SECRET), separate from the
 * service accounts the app already uses. access_type=offline + prompt=consent so Google always returns a
 * refresh token. One login yields one channel (the one picked in Google's account chooser; Brand Accounts
 * show up there as separate choices).
 *
 * Publishing: resumable upload. The media is read from its public URL in HTTP Range chunks (32 MiB, a
 * multiple of 256 KiB as Google requires) and PUT with Content-Range. When the per-call time budget runs out
 * we persist { uploadUrl, offset, size } in target.state and return 'processing'; the next cron tick calls
 * checkStatus, which asks Google for the committed offset (empty PUT, 'Content-Range: bytes * /size' -> 308
 * + Range) and carries on. Range reads mean a resume never re-downloads what was already sent.
 *
 * Caveats worth knowing before relying on this in production:
 * - Quota: videos.insert costs ~1600 units of the default 10,000/day, so roughly 6 uploads per day per
 *   Google Cloud project. The quota resets at midnight Pacific time; quotaExceeded is mapped to a retryable
 *   failure with retryAfterSec until then.
 * - Audit: videos uploaded through an *unverified* API project are locked to private, whatever privacyStatus
 *   we send, until the project passes Google's API compliance audit. This is not a validation problem (it is
 *   not something the post can fix), so validate() does not report it.
 * - Custom thumbnails (options.coverUrl) need a channel verified for custom thumbnails; failures are ignored.
 * - Shorts: there is no API flag. A vertical (or square) video of 3 minutes or less becomes a Short; we also
 *   make sure "#Shorts" appears in the title or description.
 */
import type {
  AccountWithTokens,
  AuthUrlArgs,
  ConnectedAccountInput,
  ExchangeArgs,
  PlatformAdapter,
  PublishContext,
  PublishResult,
  SocialPost,
  SocialPostTarget,
  TokenUpdate,
} from '../types';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3';

export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

const KIB256 = 256 * 1024;
const DEFAULT_CHUNK = 32 * 1024 * 1024;
const DEFAULT_BUDGET_MS = 200_000;
const MAX_CHUNK_ERRORS = 5;
const SHORT_MAX_SEC = 180;

export interface YoutubeUploadState {
  uploadUrl?: string;
  offset?: number;
  size?: number;
  mimeType?: string;
  videoId?: string;
  chunkErrors?: number;
  [k: string]: unknown;
}

export interface YoutubeAdapterOptions {
  /** Bytes per PUT. Rounded down to a multiple of 256 KiB. */
  chunkSize?: number;
  /** Wall-clock budget per publish/checkStatus call. */
  timeBudgetMs?: number;
}

class YtError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string | null,
  ) {
    super(message);
  }
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function readGoogleError(res: Response, what: string): Promise<YtError> {
  let reason: string | null = null;
  let message = `${what} failed (${res.status})`;
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      const err = j?.error;
      if (typeof err === 'string') {
        reason = err;
        message = `${what} failed: ${j.error_description || err}`;
      } else if (err) {
        reason = err.errors?.[0]?.reason ?? err.status ?? null;
        if (err.message) message = `${what} failed: ${err.message}`;
      }
    } catch {
      if (text) message = `${what} failed (${res.status}): ${text.slice(0, 200)}`;
    }
  } catch {
    /* body unreadable */
  }
  return new YtError(message, res.status, reason);
}

/** Seconds until the next midnight in America/Los_Angeles (when YouTube quota resets), plus 5 minutes. */
export function secondsUntilPacificMidnight(now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const elapsed = get('hour') * 3600 + get('minute') * 60 + get('second');
    if (!Number.isFinite(elapsed)) return 6 * 3600;
    return Math.max(60, 86400 - elapsed) + 300;
  } catch {
    return 6 * 3600;
  }
}

const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'uploadLimitExceeded']);

/** Map an error to a PublishResult. Never throws. */
export function mapError(e: unknown): PublishResult {
  if (e instanceof YtError) {
    if (e.status === 401 || e.reason === 'invalid_grant' || e.reason === 'authError') {
      return { kind: 'failed', error: `Reconnect YouTube: ${e.message}`, retryable: false };
    }
    if (e.reason && QUOTA_REASONS.has(e.reason)) {
      const daily = e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded' || e.reason === 'uploadLimitExceeded';
      return {
        kind: 'failed',
        error: daily ? `YouTube quota exceeded, retrying after it resets (midnight Pacific): ${e.message}` : e.message,
        retryable: true,
        retryAfterSec: daily ? secondsUntilPacificMidnight() : 300,
      };
    }
    if (e.status === 429) return { kind: 'failed', error: e.message, retryable: true, retryAfterSec: 300 };
    if (e.status >= 500 || e.status === 0) return { kind: 'failed', error: e.message, retryable: true, retryAfterSec: 120 };
    return { kind: 'failed', error: e.message, retryable: false };
  }
  const msg = e instanceof Error ? e.message : String(e);
  // Network-level errors (DNS, reset) are worth another go.
  return { kind: 'failed', error: `YouTube: ${msg}`, retryable: true, retryAfterSec: 120 };
}

// ---------- metadata ----------

const stripAngles = (s: string) => s.replace(/[<>]/g, '');

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export function buildMetadata(post: SocialPost, target: SocialPostTarget, caption: string) {
  const o = target.options ?? {};
  const firstLine = (caption || '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  let title = stripAngles((o.ytTitle ?? post.title ?? firstLine ?? '').trim());
  if (!title) title = 'Untitled';
  title = truncate(title, 100);

  let description = stripAngles(o.ytDescription ?? caption ?? '');
  description = description.slice(0, 5000);

  if (target.format === 'short' && !/#shorts\b/i.test(`${title} ${description}`)) {
    const suffix = description ? '\n\n#Shorts' : '#Shorts';
    description = description.slice(0, 5000 - suffix.length) + suffix;
  }

  // Tags: no '#', total length (with separators) under 500 chars.
  const tags: string[] = [];
  let total = 0;
  for (const raw of o.ytTags ?? post.tags ?? []) {
    const t = stripAngles(String(raw)).replace(/^#+/, '').trim();
    if (!t || tags.includes(t)) continue;
    const cost = t.length + (t.includes(' ') ? 2 : 0) + (tags.length ? 1 : 0);
    if (total + cost > 500) break;
    tags.push(t);
    total += cost;
  }

  return {
    snippet: { title, description, tags, categoryId: o.ytCategoryId ?? '22' },
    status: {
      privacyStatus: o.ytPrivacy ?? 'public',
      selfDeclaredMadeForKids: o.ytMadeForKids ?? false,
    },
  };
}

function watchUrl(id: string, format: string) {
  return format === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

// ---------- adapter ----------

export function createYoutubeAdapter(opts: YoutubeAdapterOptions = {}): PlatformAdapter {
  const chunkSize = Math.max(KIB256, Math.floor((opts.chunkSize ?? DEFAULT_CHUNK) / KIB256) * KIB256);
  const budgetMs = opts.timeBudgetMs ?? DEFAULT_BUDGET_MS;

  async function sourceSize(url: string, known?: number): Promise<number> {
    if (known && known > 0) return known;
    const head = await fetch(url, { method: 'HEAD' });
    const len = Number(head.headers.get('content-length'));
    if (head.ok && len > 0) return len;
    const probe = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const total = Number(probe.headers.get('content-range')?.split('/')[1]);
    try { await probe.body?.cancel(); } catch { /* ignore */ }
    if (total > 0) return total;
    throw new YtError(`Could not read the video size from ${url} (status ${probe.status})`, probe.ok ? 400 : probe.status, null);
  }

  async function readRange(url: string, start: number, end: number): Promise<Uint8Array> {
    const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
    if (!res.ok) {
      throw new YtError(`Could not download the video (${res.status})`, res.status >= 500 ? res.status : 400, null);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    // Server ignored Range and sent the whole file: slice it.
    if (res.status === 200 && buf.length > end - start + 1) return buf.subarray(start, end + 1);
    return buf;
  }

  async function initiate(ctx: PublishContext, size: number, mimeType: string): Promise<string> {
    const meta = buildMetadata(ctx.post, ctx.target, ctx.caption);
    const res = await fetch(`${UPLOAD_API}/videos?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.account.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(size),
        'X-Upload-Content-Type': mimeType,
      },
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw await readGoogleError(res, 'YouTube upload start');
    const loc = res.headers.get('location');
    if (!loc) throw new YtError('YouTube did not return an upload URL', 502, null);
    return loc;
  }

  /** 308 -> next offset from the Range header ("bytes=0-N"); none means nothing committed yet. */
  function offsetFrom308(res: Response): number {
    const m = /bytes=\d+-(\d+)/.exec(res.headers.get('range') ?? '');
    return m ? Number(m[1]) + 1 : 0;
  }

  async function parseVideoId(res: Response): Promise<string> {
    const j = await res.json().catch(() => null);
    if (!j?.id) throw new YtError('YouTube finished the upload without a video id', 502, null);
    return j.id as string;
  }

  /** Ask Google how much it has. Returns the offset or, if already complete, the video id. */
  async function queryOffset(uploadUrl: string, size: number, token: string): Promise<{ offset: number } | { videoId: string } | null> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Length': '0', 'Content-Range': `bytes */${size}` },
    });
    if (res.status === 308) return { offset: offsetFrom308(res) };
    if (res.status === 200 || res.status === 201) return { videoId: await parseVideoId(res) };
    if (res.status === 404 || res.status === 410) return null; // session expired: start again
    throw await readGoogleError(res, 'YouTube upload status');
  }

  async function setThumbnail(videoId: string, coverUrl: string, token: string) {
    try {
      const img = await fetch(coverUrl);
      if (!img.ok) return;
      const body = await img.arrayBuffer();
      await fetch(`${UPLOAD_API}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': img.headers.get('content-type') || 'image/jpeg' },
        body,
      });
    } catch {
      /* thumbnails are best effort */
    }
  }

  async function finish(ctx: PublishContext, videoId: string, state: YoutubeUploadState): Promise<PublishResult> {
    const cover = ctx.target.options?.coverUrl ?? ctx.post.media[0]?.thumbnailUrl;
    if (cover && ctx.account.accessToken) await setThumbnail(videoId, cover, ctx.account.accessToken);
    return {
      kind: 'published',
      externalId: videoId,
      url: watchUrl(videoId, ctx.target.format),
      state: { videoId, size: state.size, uploadUrl: null, offset: state.size },
    };
  }

  async function runUpload(ctx: PublishContext): Promise<PublishResult> {
    const started = Date.now();
    const token = ctx.account.accessToken;
    if (!token) return { kind: 'failed', error: 'Reconnect YouTube: no access token', retryable: false };
    const media = ctx.post.media[0];
    if (!media || media.type !== 'video') return { kind: 'failed', error: 'YouTube needs exactly one video', retryable: false };

    const prev = (ctx.target.state ?? {}) as YoutubeUploadState;
    let state: YoutubeUploadState = { ...prev };

    try {
      if (state.videoId) return await finish(ctx, state.videoId, state);

      let size = typeof state.size === 'number' ? state.size : 0;
      let offset = 0;

      if (state.uploadUrl && size > 0) {
        const q = await queryOffset(state.uploadUrl, size, token);
        if (q && 'videoId' in q) return await finish(ctx, q.videoId, state);
        if (q) offset = q.offset;
        else state = {}; // expired session: start a new one
      } else {
        state = {};
      }

      if (!state.uploadUrl) {
        size = await sourceSize(media.url, media.sizeBytes);
        const mimeType = media.mime || 'video/*';
        const uploadUrl = await initiate(ctx, size, mimeType);
        state = { uploadUrl, offset: 0, size, mimeType, chunkErrors: 0 };
        offset = 0;
      }
      const uploadUrl = state.uploadUrl as string;

      let lastChunkMs = 0;
      while (offset < size) {
        const elapsed = Date.now() - started;
        if (elapsed + lastChunkMs > budgetMs) {
          return { kind: 'processing', state: { ...state, offset }, retryAfterSec: 5 };
        }
        const t0 = Date.now();
        const end = Math.min(offset + chunkSize, size) - 1;
        const bytes = await readRange(media.url, offset, end);
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Length': String(bytes.length),
            'Content-Range': `bytes ${offset}-${offset + bytes.length - 1}/${size}`,
            'Content-Type': state.mimeType || 'video/*',
          },
          body: bytes as unknown as BodyInit,
        });
        lastChunkMs = Date.now() - t0;

        if (res.status === 308) {
          offset = offsetFrom308(res);
          state = { ...state, offset, chunkErrors: 0 };
          continue;
        }
        if (res.status === 200 || res.status === 201) {
          const videoId = await parseVideoId(res);
          return await finish(ctx, videoId, { ...state, offset: size, videoId });
        }
        if (res.status >= 500 || res.status === 429) {
          // Transient: keep the session, resume on the next tick from whatever Google committed.
          const chunkErrors = (state.chunkErrors ?? 0) + 1;
          if (chunkErrors >= MAX_CHUNK_ERRORS) {
            return { kind: 'failed', error: `YouTube upload kept failing (${res.status})`, retryable: true, retryAfterSec: 600 };
          }
          return { kind: 'processing', state: { ...state, offset, chunkErrors }, retryAfterSec: 60 * chunkErrors };
        }
        throw await readGoogleError(res, 'YouTube upload');
      }
      // Every byte sent but no final response: ask Google.
      const q = await queryOffset(uploadUrl, size, token);
      if (q && 'videoId' in q) return await finish(ctx, q.videoId, state);
      return { kind: 'processing', state: { ...state, offset: q?.offset ?? 0 }, retryAfterSec: 30 };
    } catch (e) {
      return mapError(e);
    }
  }

  async function api(path: string, token: string, what: string) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw await readGoogleError(res, what);
    return res.json();
  }

  async function tokenRequest(params: Record<string, string>) {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw await readGoogleError(res, 'Google token request');
    return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
  }

  return {
    platform: 'youtube',
    label: 'YouTube',
    formats: ['video', 'short'],
    usesPkce: false,
    requiredEnv: ['GOOGLE_SOCIAL_CLIENT_ID', 'GOOGLE_SOCIAL_CLIENT_SECRET'],

    getAuthUrl({ state, redirectUri, codeChallenge }: AuthUrlArgs): string {
      const p = new URLSearchParams({
        client_id: env('GOOGLE_SOCIAL_CLIENT_ID'),
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: YOUTUBE_SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      if (codeChallenge) {
        p.set('code_challenge', codeChallenge);
        p.set('code_challenge_method', 'S256');
      }
      return `${AUTH_URL}?${p.toString()}`;
    },

    async exchangeCode({ code, redirectUri, codeVerifier }: ExchangeArgs): Promise<ConnectedAccountInput[]> {
      const params: Record<string, string> = {
        code,
        client_id: env('GOOGLE_SOCIAL_CLIENT_ID'),
        client_secret: env('GOOGLE_SOCIAL_CLIENT_SECRET'),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      if (codeVerifier) params.code_verifier = codeVerifier;
      const tok = await tokenRequest(params);
      const data = await api('/channels?part=snippet,statistics&mine=true', tok.access_token, 'YouTube channel lookup');
      const items: any[] = data?.items ?? [];
      if (!items.length) throw new Error('This Google account has no YouTube channel. Create one, then connect again.');
      const expiresAt = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null;
      const scopes = tok.scope ? tok.scope.split(' ') : YOUTUBE_SCOPES;
      return items.map((ch) => {
        const sn = ch.snippet ?? {};
        const st = ch.statistics ?? {};
        return {
          platform: 'youtube' as const,
          external_id: ch.id,
          handle: sn.customUrl ?? null,
          display_name: sn.title ?? null,
          avatar_url: sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token ?? null,
          expiresAt,
          scopes,
          meta: {
            subscriberCount: st.subscriberCount != null ? Number(st.subscriberCount) : null,
            videoCount: st.videoCount != null ? Number(st.videoCount) : null,
            viewCount: st.viewCount != null ? Number(st.viewCount) : null,
          },
        };
      });
    },

    async refreshToken(account: AccountWithTokens): Promise<TokenUpdate> {
      if (!account.refreshToken) throw new Error('Reconnect YouTube: no refresh token stored');
      const tok = await tokenRequest({
        client_id: env('GOOGLE_SOCIAL_CLIENT_ID'),
        client_secret: env('GOOGLE_SOCIAL_CLIENT_SECRET'),
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
      });
      return {
        accessToken: tok.access_token,
        refreshToken: tok.refresh_token ?? undefined, // Google usually omits it: keep the existing one
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
      };
    },

    validate(post: SocialPost, target: SocialPostTarget): string[] {
      const problems: string[] = [];
      if (target.format !== 'video' && target.format !== 'short') {
        problems.push(`YouTube does not support the "${target.format}" format`);
      }
      const media = post.media ?? [];
      if (media.length !== 1 || media[0].type !== 'video') {
        problems.push('YouTube needs exactly one video');
      }
      const v = media[0];
      if (target.format === 'short' && v && v.type === 'video') {
        if (v.durationSec != null && v.durationSec > SHORT_MAX_SEC) {
          problems.push(`A Short must be ${SHORT_MAX_SEC / 60} minutes or less (this video is ${Math.round(v.durationSec)}s)`);
        }
        if (v.width && v.height && v.width > v.height) {
          problems.push('A Short must be vertical or square (this video is landscape)');
        }
      }
      const explicitTitle = target.options?.ytTitle ?? post.title;
      if (explicitTitle && explicitTitle.trim().length > 100) {
        problems.push(`YouTube titles are 100 characters max (this one is ${explicitTitle.trim().length})`);
      }
      return problems;
    },

    publish: (ctx) => runUpload(ctx),

    async checkStatus(ctx: PublishContext): Promise<PublishResult> {
      const state = (ctx.target.state ?? {}) as YoutubeUploadState;
      if (state.uploadUrl && !state.videoId) return runUpload(ctx);
      const id = state.videoId ?? ctx.target.external_id;
      if (!id) return runUpload(ctx);
      try {
        const token = ctx.account.accessToken;
        if (!token) return { kind: 'failed', error: 'Reconnect YouTube: no access token', retryable: false };
        const data = await api(`/videos?part=status,processingDetails&id=${encodeURIComponent(id)}`, token, 'YouTube status');
        const v = data?.items?.[0];
        if (!v) return { kind: 'failed', error: 'YouTube video not found (deleted or removed)', retryable: false };
        const up = v.status?.uploadStatus;
        if (up === 'rejected') return { kind: 'failed', error: `YouTube rejected the video: ${v.status?.rejectionReason ?? 'unknown'}`, retryable: false };
        if (up === 'failed') return { kind: 'failed', error: `YouTube processing failed: ${v.status?.failureReason ?? 'unknown'}`, retryable: false };
        if (up === 'deleted') return { kind: 'failed', error: 'YouTube video was deleted', retryable: false };
        return {
          kind: 'published',
          externalId: id,
          url: watchUrl(id, ctx.target.format),
          state: {
            ...state,
            videoId: id,
            uploadStatus: up ?? null,
            privacyStatus: v.status?.privacyStatus ?? null,
            processingStatus: v.processingDetails?.processingStatus ?? null,
          },
        };
      } catch (e) {
        return mapError(e);
      }
    },

    async fetchMetrics(ctx: PublishContext): Promise<Record<string, number>> {
      const id = ctx.target.external_id ?? (ctx.target.state as YoutubeUploadState)?.videoId;
      if (!id || !ctx.account.accessToken) return {};
      const data = await api(`/videos?part=statistics&id=${encodeURIComponent(id)}`, ctx.account.accessToken, 'YouTube metrics');
      const s = data?.items?.[0]?.statistics;
      if (!s) return {};
      return {
        views: Number(s.viewCount ?? 0),
        likes: Number(s.likeCount ?? 0),
        comments: Number(s.commentCount ?? 0),
      };
    },
  };
}

export const youtubeAdapter: PlatformAdapter = createYoutubeAdapter();
