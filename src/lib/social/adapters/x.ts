/**
 * X adapter (API v2, OAuth 2.0 Authorization Code + PKCE, confidential client). Plain fetch, no SDK.
 *
 * Docs checked 2026-11-01:
 * - OAuth 2.0 auth code + PKCE (authorize at x.com/i/oauth2/authorize, token at api.x.com/2/oauth2/token,
 *   confidential clients authenticate with Basic auth, offline.access gives a refresh token, media.write scope):
 *   https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
 * - Create post (text, media.media_ids 1-4, reply.in_reply_to_tweet_id): https://docs.x.com/x-api/posts/create-post
 * - One-shot media upload (POST /2/media/upload, multipart `media` + `media_category`): https://docs.x.com/x-api/media/upload-media
 * - Media status for GIFs (GET /2/media/upload?command=STATUS&media_id=).
 *
 * Images only (Austin, 2026-11-01: "I don't want video on X. Maybe some memes."). Up to 4 images, or 1 GIF on its own.
 * Video is rejected in validate(). If video is ever wanted, use the chunked upload:
 * https://docs.x.com/x-api/media/quickstart/media-upload-chunked
 * - Users me: https://docs.x.com/x-api/users/user-lookup-me ; post lookup with public_metrics:
 *   https://docs.x.com/x-api/posts/post-lookup-by-post-id
 *
 * Idempotency: every posted part id is kept in target.state.postedIds. A resume (checkStatus, or publish called again
 * with state) continues from the next unposted part, so a retry never double-posts. Because the engine does not persist
 * state on a `failed` result, any failure after the first part is live is returned as `processing` (retryable) or
 * `needs_action` (not retryable) so the posted ids are saved.
 */
import type {
  AccountWithTokens,
  ConnectedAccountInput,
  PlatformAdapter,
  PublishContext,
  PublishResult,
  SocialMedia,
  SocialPost,
  SocialPostTarget,
  TokenUpdate,
} from '../types';

const AUTH_URL = 'https://x.com/i/oauth2/authorize';
const API = 'https://api.x.com';
const TOKEN_URL = `${API}/2/oauth2/token`;
export const X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];

export const X_MAX_CHARS = 280;
export const X_URL_LENGTH = 23;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_GIF_BYTES = 15 * 1024 * 1024;
const MAX_RESUMES = 5;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// ---------- text ----------

const URL_RE = /https?:\/\/[^\s]+/gi;

/** twitter-text weighting: these ranges count 1, everything else (CJK, emoji) counts 2. */
function weight(cp: number): number {
  if ((cp >= 0 && cp <= 4351) || (cp >= 8192 && cp <= 8205) || (cp >= 8208 && cp <= 8223) || (cp >= 8242 && cp <= 8247)) return 1;
  return 2;
}

/** Weighted length as X counts it: every URL is 23, CJK/emoji count double. */
export function xWeightedLength(text: string): number {
  let n = 0;
  const withoutUrls = text.replace(URL_RE, () => {
    n += X_URL_LENGTH;
    return '';
  });
  for (const ch of withoutUrls.normalize('NFC')) n += weight(ch.codePointAt(0)!);
  return n;
}

/** Split a long caption into thread parts: one per paragraph, overlong paragraphs split on sentences, then words. */
export function splitThread(text: string, max = X_MAX_CHARS): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    if (xWeightedLength(para) <= max) {
      out.push(para);
      continue;
    }
    const pieces = para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para];
    let cur = '';
    const flush = () => {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    };
    for (const piece of pieces) {
      if (xWeightedLength(cur + piece) <= max) {
        cur += piece;
        continue;
      }
      flush();
      if (xWeightedLength(piece) <= max) {
        cur = piece;
        continue;
      }
      for (const word of piece.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (xWeightedLength(next) <= max) cur = next;
        else {
          flush();
          cur = word;
        }
      }
    }
    flush();
  }
  return out;
}

export interface XPlan {
  parts: string[];
  linkReply: string | null;
}

/** Work out the posts to send. Pure. */
export function planX(post: SocialPost, target: SocialPostTarget, caption: string): XPlan {
  const opts = target.options ?? {};
  let parts: string[];
  if (target.format === 'thread') {
    const given = (opts.threadParts ?? []).map((p) => p.trim()).filter(Boolean);
    parts = given.length > 0 ? given : splitThread(caption);
  } else {
    parts = [caption.trim()];
  }
  if (parts.length === 0) parts = [''];
  let linkReply: string | null = null;
  const link = post.link?.trim();
  if (link) {
    if (opts.linkInReply) {
      linkReply = link;
      // keep the main post link-free for reach. Not cheaper: the reply carries the URL and is billed $0.20 like any URL post
      parts[0] = parts[0].split(link).join('').replace(/[ \t]+\n/g, '\n').trim();
    } else if (!parts.some((p) => p.includes(link))) {
      parts[0] = parts[0] ? `${parts[0]}\n\n${link}` : link;
    }
  }
  return { parts, linkReply };
}

// ---------- http ----------

class XError extends Error {
  constructor(message: string, public status: number, public retryAfterSec?: number, public credits = false) {
    super(message);
  }
}

async function xFetch<T>(
  path: string,
  token: string,
  init: { method?: string; json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form;
  }
  const res = await fetch(`${API}${path}`, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body });
  const text = await res.text().catch(() => '');
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const detail =
      (json.detail as string) ||
      (json.title as string) ||
      (Array.isArray(json.errors) && (json.errors[0] as { message?: string })?.message) ||
      text.slice(0, 200) ||
      `HTTP ${res.status}`;
    const credits = res.status === 402 || /credit/i.test(`${json.type ?? ''} ${json.title ?? ''} ${detail}`);
    let retryAfter: number | undefined;
    if (res.status === 429) {
      const reset = Number(res.headers.get('x-rate-limit-reset'));
      retryAfter = Number.isFinite(reset) && reset > 0 ? Math.max(1, Math.ceil(reset - Date.now() / 1000)) : 60;
    }
    throw new XError(String(detail), res.status, retryAfter, credits);
  }
  return json as T;
}

/** Map an error to a failed result. Never throws. */
export function xFailure(err: unknown): Extract<PublishResult, { kind: 'failed' }> {
  if (err instanceof XError) {
    if (err.credits) return { kind: 'failed', error: 'X API credits exhausted', retryable: false };
    if (err.status === 429) return { kind: 'failed', error: 'X rate limit hit', retryable: true, retryAfterSec: err.retryAfterSec ?? 60 };
    if (err.status === 401) return { kind: 'failed', error: 'X token is invalid or expired. Reconnect the account.', retryable: false };
    if (err.status >= 500) return { kind: 'failed', error: `X server error: ${err.message}`, retryable: true };
    return { kind: 'failed', error: `X: ${err.message} (${err.status})`, retryable: false };
  }
  return { kind: 'failed', error: `X: ${err instanceof Error ? err.message : String(err)}`, retryable: true };
}

async function tokenRequest(params: Record<string, string>) {
  const clientId = env('X_CLIENT_ID');
  const basic = Buffer.from(`${clientId}:${env('X_CLIENT_SECRET')}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ ...params, client_id: clientId }).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) throw new Error(`X token request failed: ${json.error_description || json.error || res.status}`);
  return json;
}

// ---------- media ----------

interface ProcessingInfo {
  state?: 'pending' | 'in_progress' | 'succeeded' | 'failed';
  check_after_secs?: number;
  error?: { message?: string };
}
interface MediaData {
  data?: { id?: string; media_key?: string; processing_info?: ProcessingInfo };
}

async function download(m: SocialMedia): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`Could not download media (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const mime = m.mime || res.headers.get('content-type')?.split(';')[0].trim() || (m.type === 'video' ? 'video/mp4' : 'image/jpeg');
  return { bytes, mime };
}

/** Upload one media item. Returns its id and whether X is still processing it. */
async function uploadMedia(token: string, m: SocialMedia): Promise<{ id: string; pending: ProcessingInfo | null }> {
  if (m.type !== 'image') throw new Error('X posts are images only (no video)');
  const { bytes, mime } = await download(m);
  const form = new FormData();
  form.append('media', new Blob([bytes as BlobPart], { type: mime }), 'image');
  form.append('media_category', mime === 'image/gif' ? 'tweet_gif' : 'tweet_image');
  const r = await xFetch<MediaData>('/2/media/upload', token, { form });
  if (!r.data?.id) throw new Error('X media upload returned no id');
  const p = r.data.processing_info;
  return { id: r.data.id, pending: p && p.state !== 'succeeded' ? p : null };
}

async function mediaStatus(token: string, id: string): Promise<ProcessingInfo> {
  const r = await xFetch<MediaData>(`/2/media/upload?command=STATUS&media_id=${encodeURIComponent(id)}`, token);
  return r.data?.processing_info ?? { state: 'succeeded' };
}

// ---------- publish state machine ----------

interface XState {
  parts?: string[];
  linkReply?: string | null;
  mediaIds?: string[];
  mediaPending?: string[];
  postedIds?: string[];
  linkReplyId?: string | null;
  resumeAttempts?: number;
}

function statusUrl(handle: string | null | undefined, id: string): string {
  return handle ? `https://x.com/${handle.replace(/^@/, '')}/status/${id}` : `https://x.com/i/web/status/${id}`;
}

async function run(ctx: PublishContext): Promise<PublishResult> {
  const token = ctx.account.accessToken;
  if (!token) return { kind: 'failed', error: 'X account has no access token. Reconnect it.', retryable: false };
  const prev = (ctx.target.state ?? {}) as XState;
  const st: XState = { ...prev };
  if (!st.parts) {
    const plan = planX(ctx.post, ctx.target, ctx.caption);
    st.parts = plan.parts;
    st.linkReply = plan.linkReply;
  }
  st.postedIds = [...(st.postedIds ?? [])];

  const anyPosted = () => (st.postedIds?.length ?? 0) > 0;
  const snapshot = (): Record<string, unknown> => ({ ...st });

  /** Failure after something is live: keep the state so a retry resumes instead of reposting. */
  const failAfterPartial = (err: unknown): PublishResult => {
    const f = xFailure(err);
    if (!anyPosted()) return f;
    const attempts = (st.resumeAttempts ?? 0) + 1;
    st.resumeAttempts = attempts;
    const where = `${st.postedIds!.length}/${st.parts!.length} posts live`;
    if (f.retryable && attempts <= MAX_RESUMES) {
      return { kind: 'processing', state: snapshot(), retryAfterSec: f.retryAfterSec ?? 60 * attempts };
    }
    return { kind: 'needs_action', message: `Thread partly posted (${where}): ${f.error}. Retry resumes from the next post.`, state: snapshot() };
  };

  // 1. media (only before the first post goes out)
  if (!anyPosted()) {
    try {
      if (!st.mediaIds) {
        const media = ctx.post.media ?? [];
        const ids: string[] = [];
        const pending: string[] = [];
        let wait = 5;
        for (const m of media) {
          const up = await uploadMedia(token, m);
          ids.push(up.id);
          if (up.pending) {
            pending.push(up.id);
            wait = Math.max(wait, up.pending.check_after_secs ?? 5);
          }
        }
        st.mediaIds = ids;
        st.mediaPending = pending;
        if (pending.length > 0) return { kind: 'processing', state: snapshot(), retryAfterSec: wait };
      }
      if (st.mediaPending && st.mediaPending.length > 0) {
        const still: string[] = [];
        let wait = 5;
        for (const id of st.mediaPending) {
          const p = await mediaStatus(token, id);
          if (p.state === 'failed') {
            return { kind: 'failed', error: `X could not process the media: ${p.error?.message ?? 'unknown error'}`, retryable: false };
          }
          if (p.state !== 'succeeded') {
            still.push(id);
            wait = Math.max(wait, p.check_after_secs ?? 5);
          }
        }
        st.mediaPending = still;
        if (still.length > 0) return { kind: 'processing', state: snapshot(), retryAfterSec: wait };
      }
    } catch (err) {
      const f = xFailure(err);
      // media ids expire, so a retry starts the upload over
      return f;
    }
  }

  // 2. the posts, chained as replies
  for (let i = st.postedIds.length; i < st.parts.length; i++) {
    const body: Record<string, unknown> = { text: st.parts[i] };
    if (i === 0 && st.mediaIds && st.mediaIds.length > 0) body.media = { media_ids: st.mediaIds };
    if (i > 0) body.reply = { in_reply_to_tweet_id: st.postedIds[i - 1] };
    try {
      const r = await xFetch<{ data?: { id?: string } }>('/2/tweets', token, { json: body });
      if (!r.data?.id) throw new Error('X returned no post id');
      st.postedIds.push(r.data.id);
    } catch (err) {
      return failAfterPartial(err);
    }
  }

  // 3. link in the first reply
  if (st.linkReply && !st.linkReplyId) {
    try {
      const r = await xFetch<{ data?: { id?: string } }>('/2/tweets', token, {
        json: { text: st.linkReply, reply: { in_reply_to_tweet_id: st.postedIds[0] } },
      });
      if (!r.data?.id) throw new Error('X returned no post id for the link reply');
      st.linkReplyId = r.data.id;
    } catch (err) {
      return failAfterPartial(err);
    }
  }

  const first = st.postedIds[0];
  return { kind: 'published', externalId: first, url: statusUrl(ctx.account.handle, first), state: snapshot() };
}

export const xAdapter: PlatformAdapter = {
  platform: 'x',
  label: 'X',
  formats: ['tweet', 'thread'],
  usesPkce: true,
  requiredEnv: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],

  getAuthUrl({ state, redirectUri, codeChallenge }) {
    const p = new URLSearchParams({
      response_type: 'code',
      client_id: env('X_CLIENT_ID'),
      redirect_uri: redirectUri,
      scope: X_SCOPES.join(' '),
      state,
    });
    if (codeChallenge) {
      p.set('code_challenge', codeChallenge);
      p.set('code_challenge_method', 'S256');
    }
    return `${AUTH_URL}?${p.toString()}`;
  },

  async exchangeCode({ code, redirectUri, codeVerifier }): Promise<ConnectedAccountInput[]> {
    if (!codeVerifier) throw new Error('X login needs the PKCE code verifier');
    const tok = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: codeVerifier });
    const me = await xFetch<{ data?: { id: string; username?: string; name?: string; profile_image_url?: string } }>(
      '/2/users/me?user.fields=profile_image_url,username,name',
      tok.access_token!,
    );
    if (!me.data?.id) throw new Error('X did not return the account');
    return [
      {
        platform: 'x',
        external_id: me.data.id,
        handle: me.data.username ?? null,
        display_name: me.data.name ?? null,
        avatar_url: me.data.profile_image_url ?? null,
        accessToken: tok.access_token!,
        refreshToken: tok.refresh_token ?? null,
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
        scopes: (tok.scope ?? '').split(' ').filter(Boolean),
        meta: {},
      },
    ];
  },

  async refreshToken(account: AccountWithTokens): Promise<TokenUpdate> {
    if (!account.refreshToken) throw new Error('X account has no refresh token');
    const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: account.refreshToken });
    // X rotates refresh tokens: the old one stops working, so always store the new one.
    return {
      accessToken: tok.access_token!,
      refreshToken: tok.refresh_token ?? null,
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
    };
  },

  validate(post: SocialPost, target: SocialPostTarget): string[] {
    const problems: string[] = [];
    if (target.format !== 'tweet' && target.format !== 'thread') return [`X does not support format ${target.format}`];
    const media = post.media ?? [];
    const isGif = (m: SocialMedia) => m.mime === 'image/gif' || /\.gif(\?|$)/i.test(m.url);
    const images = media.filter((m) => m.type === 'image');
    const gifs = images.filter(isGif);
    if (media.some((m) => m.type === 'video')) problems.push('X is images only (memes, GIFs). Remove the video or untick X');
    if (images.length > MAX_IMAGES) problems.push(`X allows at most ${MAX_IMAGES} images per post`);
    if (gifs.length > 0 && images.length > 1) problems.push('X allows one GIF per post, with no other images');
    for (const m of images) {
      const max = isGif(m) ? MAX_GIF_BYTES : MAX_IMAGE_BYTES;
      if (m.sizeBytes && m.sizeBytes > max) problems.push(`${isGif(m) ? 'GIF' : 'Image'} is over X's ${max / 1024 / 1024} MB limit`);
    }
    const plan = planX(post, target, target.caption_override ?? post.caption ?? '');
    plan.parts.forEach((p, i) => {
      const n = xWeightedLength(p);
      const label = plan.parts.length > 1 ? `Post ${i + 1}` : 'Post';
      if (n > X_MAX_CHARS) problems.push(`${label} is ${n} characters; X allows ${X_MAX_CHARS} (links count as ${X_URL_LENGTH})`);
    });
    if (!plan.parts[0] && media.length === 0) problems.push('X post needs text or media');
    if (target.format === 'tweet' && plan.parts.length > 1) problems.push('Use the thread format for more than one post');
    return problems;
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    try {
      return await run(ctx);
    } catch (err) {
      return xFailure(err);
    }
  },

  async checkStatus(ctx: PublishContext): Promise<PublishResult> {
    try {
      const st = (ctx.target.state ?? {}) as XState;
      if (!st.parts) {
        return {
          kind: 'failed',
          error: 'X publish was interrupted before any progress was saved. Check X before retrying.',
          retryable: false,
        };
      }
      return await run(ctx);
    } catch (err) {
      return xFailure(err);
    }
  },

  async fetchMetrics(ctx: PublishContext): Promise<Record<string, number>> {
    try {
      const token = ctx.account.accessToken;
      const id = ctx.target.external_id;
      if (!token || !id) return {};
      const r = await xFetch<{ data?: { public_metrics?: Record<string, number> } }>(
        `/2/tweets/${encodeURIComponent(id)}?tweet.fields=public_metrics`,
        token,
      );
      const m = r.data?.public_metrics ?? {};
      const out: Record<string, number> = {};
      const map: Record<string, string> = {
        impression_count: 'impressions',
        like_count: 'likes',
        retweet_count: 'reposts',
        reply_count: 'replies',
        quote_count: 'quotes',
        bookmark_count: 'bookmarks',
      };
      for (const [k, name] of Object.entries(map)) if (typeof m[k] === 'number') out[name] = m[k];
      return out;
    } catch {
      return {};
    }
  },
};
