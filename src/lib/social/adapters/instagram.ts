/**
 * Instagram adapter: "Instagram API with Instagram Login" (graph.instagram.com). No Facebook Page needed.
 * Requires a Business or Creator account. Plain fetch, no SDK.
 *
 * Docs verified 2026-11-01:
 *   Publishing:  https://developers.facebook.com/docs/instagram-platform/content-publishing/
 *   Container:   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
 *   Insights:    https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
 *
 * TRIAL REELS (verified against the ig-user/media reference above):
 *   POST /{ig-user-id}/media  media_type=REELS  video_url=...  trial_params={"graduation_strategy":"MANUAL"|"SS_PERFORMANCE"}
 *   - trial_params is only valid with media_type=REELS; graduation_strategy is required.
 *   - MANUAL: Austin graduates it to followers by hand in the Instagram app.
 *     SS_PERFORMANCE: Instagram graduates it automatically if it performs well with non-followers.
 *   - Trial reels are shown to non-followers only, so share_to_feed is not sent (it would be meaningless).
 *   - Reels (trial or not) cannot be carousel items. We also never send collaborators on a trial reel:
 *     in-app trials cannot be collabs, and the API doc is silent, so we play safe.
 *   - Eligibility: Meta gates trial reels per account (professional accounts; rollout was gradual). An
 *     ineligible account gets a Graph error on container creation, which we surface verbatim as non-retryable.
 *
 * Other limits used by validate(): caption 2200 chars / 30 hashtags / 20 @mentions; carousel up to 20 items
 * (the current doc says 20, older docs said 10) and at least 2; reels 3s-15min, 300 MB; story video 3-60s,
 * 100 MB; images JPEG only, 8 MB. Containers expire after 24h; 100 API-published posts per rolling 24h.
 *
 * Metrics: `impressions` is deprecated for media created after 2024-07-02 and `plays` / `ig_reels_aggregated_all_plays_count`
 * / `clips_replays_count` were removed in 2025 in favour of `views`. We only request current names.
 *
 * State persisted between cron ticks (target.state):
 *   { step: 'children' | 'container' | 'published', childIds?: string[], containerId?: string, mediaId?: string }
 */
import type {
  AccountWithTokens,
  AuthUrlArgs,
  ConnectedAccountInput,
  ExchangeArgs,
  Format,
  PlatformAdapter,
  PublishContext,
  PublishResult,
  SocialMedia,
  SocialPost,
  SocialPostTarget,
  TokenUpdate,
} from '../types';

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || 'v26.0';
const GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;
const GRAPH_UNVERSIONED = 'https://graph.instagram.com';
const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';

export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
  'instagram_business_manage_comments',
];

const CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;
const MENTION_MAX = 20;
const CAROUSEL_MIN = 2;
const CAROUSEL_MAX = 20;
const REEL_MIN_SEC = 3;
const REEL_MAX_SEC = 15 * 60;
const STORY_VIDEO_MIN_SEC = 3;
const STORY_VIDEO_MAX_SEC = 60;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const REEL_MAX_BYTES = 300 * 1024 * 1024;
const STORY_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/** Seconds to wait before polling a video container again. Meta suggests once a minute. */
const VIDEO_POLL_SEC = 60;
const IMAGE_POLL_SEC = 15;

// ---------------------------------------------------------------------------
// Typed fetch helper
// ---------------------------------------------------------------------------

interface GraphErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  is_transient?: boolean;
  error_user_msg?: string;
  error_user_title?: string;
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
    public readonly subcode?: number,
    public readonly transient?: boolean,
  ) {
    super(message);
    this.name = 'InstagramApiError';
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function toSearch(params: Params): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  return sp;
}

async function igFetch<T>(
  method: 'GET' | 'POST',
  url: string,
  params: Params = {},
): Promise<T> {
  let res: Response;
  try {
    if (method === 'GET') {
      const qs = toSearch(params).toString();
      res = await fetch(qs ? `${url}?${qs}` : url, { method: 'GET' });
    } else {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: toSearch(params).toString(),
      });
    }
  } catch (err) {
    throw new InstagramApiError(`Network error calling Instagram: ${(err as Error).message}`, 0, undefined, undefined, true);
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  const errObj = (body as { error?: GraphErrorBody | string } | null)?.error;
  if (!res.ok || errObj) {
    // Graph errors are { error: { message, code, ... } }; the token endpoint uses { error_type, code, error_message }.
    const flat = body as { error_message?: string; code?: number } | null;
    const e: GraphErrorBody = typeof errObj === 'object' && errObj ? errObj : {};
    const msg = e.error_user_msg || e.message || flat?.error_message || (typeof errObj === 'string' ? errObj : '') || `HTTP ${res.status}`;
    throw new InstagramApiError(msg, res.status, e.code ?? flat?.code, e.error_subcode, e.is_transient);
  }
  return body as T;
}

const gGet = <T>(path: string, token: string, params: Params = {}) =>
  igFetch<T>('GET', `${GRAPH}/${path}`, { ...params, access_token: token });
const gPost = <T>(path: string, token: string, params: Params = {}) =>
  igFetch<T>('POST', `${GRAPH}/${path}`, { ...params, access_token: token });

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002]);
const TRANSIENT_CODES = new Set([1, 2]);
const AUTH_CODES = new Set([190, 102]);
const PERMISSION_CODES = new Set([10, 200]);
/** error_subcode for "the account has reached its publishing limit". */
const SUBCODE_PUBLISH_LIMIT = 2207042;

export function mapError(err: unknown): Extract<PublishResult, { kind: 'failed' }> {
  if (!(err instanceof InstagramApiError)) {
    return { kind: 'failed', error: `Instagram: ${(err as Error)?.message ?? String(err)}`, retryable: true, retryAfterSec: 300 };
  }
  const { code, subcode, status, transient } = err;
  if ((code !== undefined && AUTH_CODES.has(code)) || status === 401) {
    return { kind: 'failed', error: `Reconnect Instagram: the access token is invalid or expired (${err.message})`, retryable: false };
  }
  if (subcode === SUBCODE_PUBLISH_LIMIT) {
    return { kind: 'failed', error: `Instagram daily publishing limit reached: ${err.message}`, retryable: true, retryAfterSec: 3600 };
  }
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) {
    return { kind: 'failed', error: `Instagram rate limit: ${err.message}`, retryable: true, retryAfterSec: 900 };
  }
  if (code !== undefined && PERMISSION_CODES.has(code)) {
    return { kind: 'failed', error: `Instagram permission missing, reconnect Instagram and grant all permissions (${err.message})`, retryable: false };
  }
  if (transient || (code !== undefined && TRANSIENT_CODES.has(code)) || status === 0 || status >= 500) {
    return { kind: 'failed', error: `Instagram temporary error: ${err.message}`, retryable: true, retryAfterSec: 120 };
  }
  return { kind: 'failed', error: `Instagram: ${err.message}`, retryable: false };
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

interface ShortTokenResponse {
  access_token?: string;
  user_id?: string | number;
  permissions?: string[] | string;
  data?: Array<{ access_token: string; user_id: string | number; permissions?: string[] | string }>;
}
interface LongTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}
interface MeResponse {
  id?: string;
  user_id?: string | number;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  account_type?: string;
}

function parsePermissions(p: string[] | string | undefined): string[] {
  if (!p) return [];
  return Array.isArray(p) ? p : p.split(',').map((s) => s.trim()).filter(Boolean);
}

function expiryFrom(expiresIn?: number): Date | null {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
}

async function exchangeCode({ code, redirectUri }: ExchangeArgs): Promise<ConnectedAccountInput[]> {
  // Instagram appends "#_" to the code in the redirect; strip it defensively.
  const cleanCode = code.replace(/#_$/, '');
  const short = await igFetch<ShortTokenResponse>('POST', TOKEN_URL, {
    client_id: env('INSTAGRAM_APP_ID'),
    client_secret: env('INSTAGRAM_APP_SECRET'),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: cleanCode,
  });
  const entry = short.data?.[0] ?? short;
  const shortToken = entry.access_token;
  if (!shortToken) throw new Error('Instagram did not return an access token');

  const long = await igFetch<LongTokenResponse>('GET', `${GRAPH_UNVERSIONED}/access_token`, {
    grant_type: 'ig_exchange_token',
    client_secret: env('INSTAGRAM_APP_SECRET'),
    access_token: shortToken,
  });

  const me = await gGet<MeResponse>('me', long.access_token, {
    fields: 'user_id,username,name,profile_picture_url,account_type',
  });
  const igUserId = String(me.user_id ?? entry.user_id ?? me.id ?? '');
  if (!igUserId) throw new Error('Instagram did not return a user id');

  const scopes = parsePermissions(entry.permissions);
  return [
    {
      platform: 'instagram',
      external_id: igUserId,
      handle: me.username ?? null,
      display_name: me.name ?? me.username ?? null,
      avatar_url: me.profile_picture_url ?? null,
      accessToken: long.access_token,
      refreshToken: null, // IG Login has no refresh token; the long-lived token refreshes itself.
      expiresAt: expiryFrom(long.expires_in),
      scopes: scopes.length ? scopes : INSTAGRAM_SCOPES,
      meta: { account_type: me.account_type ?? null, app_scoped_id: me.id ?? null },
    },
  ];
}

async function refreshToken(account: AccountWithTokens): Promise<TokenUpdate> {
  if (!account.accessToken) throw new Error('Reconnect Instagram: no access token stored');
  // Long-lived tokens can be refreshed once they are at least 24h old and not yet expired (60-day lifetime).
  const res = await igFetch<LongTokenResponse>('GET', `${GRAPH_UNVERSIONED}/refresh_access_token`, {
    grant_type: 'ig_refresh_token',
    access_token: account.accessToken,
  });
  return { accessToken: res.access_token, expiresAt: expiryFrom(res.expires_in) };
}

function getAuthUrl({ state, redirectUri }: AuthUrlArgs): string {
  const sp = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: INSTAGRAM_SCOPES.join(','),
    state,
    enable_fb_login: '0',
  });
  return `${AUTHORIZE_URL}?${sp.toString()}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isPublicHttps(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    return !(h === 'localhost' || h.endsWith('.local') || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h));
  } catch {
    return false;
  }
}

function isJpeg(m: SocialMedia): boolean | null {
  if (m.mime) return /^image\/jpe?g$/i.test(m.mime);
  const path = (m.path || m.url).split('?')[0].toLowerCase();
  if (/\.(jpe?g)$/.test(path)) return true;
  if (/\.(png|webp|gif|heic|avif)$/.test(path)) return false;
  return null; // unknown, let Instagram decide
}

function validate(post: SocialPost, target: SocialPostTarget): string[] {
  const errs: string[] = [];
  const caption = target.caption_override ?? post.caption ?? '';
  const media = post.media ?? [];
  const format = target.format;

  if (!FORMATS.includes(format)) errs.push(`Instagram does not support the "${format}" format`);

  if (caption.length > CAPTION_MAX) errs.push(`Caption is ${caption.length} characters; Instagram allows ${CAPTION_MAX}`);
  const hashtags = caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (hashtags > HASHTAG_MAX) errs.push(`Caption has ${hashtags} hashtags; Instagram allows ${HASHTAG_MAX}`);
  const mentions = caption.match(/(^|\s)@[\w.]+/g)?.length ?? 0;
  if (mentions > MENTION_MAX) errs.push(`Caption has ${mentions} @mentions; Instagram allows ${MENTION_MAX}`);

  if (media.length === 0) {
    errs.push('Instagram needs at least one image or video');
    return errs;
  }
  media.forEach((m, i) => {
    if (!isPublicHttps(m.url)) errs.push(`Media ${i + 1} must be a public https URL (Instagram downloads it)`);
    if (m.type === 'image') {
      if (isJpeg(m) === false) errs.push(`Media ${i + 1}: Instagram only accepts JPEG images`);
      if (m.sizeBytes && m.sizeBytes > IMAGE_MAX_BYTES) errs.push(`Media ${i + 1}: images must be 8 MB or less`);
    }
  });

  const videos = media.filter((m) => m.type === 'video');
  const images = media.filter((m) => m.type === 'image');

  switch (format) {
    case 'image':
      if (media.length !== 1 || images.length !== 1) errs.push('An image post needs exactly one image (use Carousel for more)');
      break;
    case 'carousel':
      if (media.length < CAROUSEL_MIN || media.length > CAROUSEL_MAX)
        errs.push(`A carousel needs ${CAROUSEL_MIN} to ${CAROUSEL_MAX} items (has ${media.length})`);
      break;
    case 'reel':
    case 'trial_reel': {
      if (media.length !== 1 || videos.length !== 1) errs.push('A reel needs exactly one video and nothing else');
      const v = videos[0];
      if (v?.durationSec !== undefined && (v.durationSec < REEL_MIN_SEC || v.durationSec > REEL_MAX_SEC))
        errs.push(`Reels must be 3 seconds to 15 minutes (this one is ${Math.round(v.durationSec)}s)`);
      if (v?.sizeBytes && v.sizeBytes > REEL_MAX_BYTES) errs.push('Reel video must be 300 MB or less');
      const cover = target.options?.coverUrl;
      if (cover && !isPublicHttps(cover)) errs.push('Reel cover must be a public https URL to a JPEG');
      if (format === 'trial_reel') {
        const g = target.options?.trialGraduation;
        if (g && g !== 'MANUAL' && g !== 'SS_PERFORMANCE') errs.push('Trial graduation must be MANUAL or SS_PERFORMANCE');
      }
      break;
    }
    case 'story': {
      if (media.length !== 1) errs.push('A story needs exactly one image or video');
      const v = videos[0];
      if (v?.durationSec !== undefined && (v.durationSec < STORY_VIDEO_MIN_SEC || v.durationSec > STORY_VIDEO_MAX_SEC))
        errs.push(`Story videos must be 3 to 60 seconds (this one is ${Math.round(v.durationSec)}s)`);
      if (v?.sizeBytes && v.sizeBytes > STORY_VIDEO_MAX_BYTES) errs.push('Story video must be 100 MB or less');
      break;
    }
    default:
      break;
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Publishing state machine
// ---------------------------------------------------------------------------

type Step = 'children' | 'container' | 'published';
interface IgState {
  step: Step;
  childIds?: string[];
  containerId?: string;
  mediaId?: string;
  hasVideo?: boolean;
  commentId?: string | null;
  commentError?: string | null;
}

interface IdResponse { id: string }
interface StatusResponse { id?: string; status_code?: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'; status?: string }

function readState(raw: Record<string, unknown> | undefined): IgState | null {
  if (!raw || typeof raw !== 'object' || !raw.step) return null;
  return raw as unknown as IgState;
}

function requireAuth(ctx: PublishContext): { token: string; igId: string } | Extract<PublishResult, { kind: 'failed' }> {
  const token = ctx.account.accessToken;
  if (!token) return { kind: 'failed', error: 'Reconnect Instagram: no access token stored', retryable: false };
  return { token, igId: ctx.account.external_id };
}

/** Create the container(s) for a post. Returns the first state. */
async function createContainers(ctx: PublishContext, token: string, igId: string): Promise<IgState> {
  const { post, target, caption } = ctx;
  const media = post.media;
  const opts = target.options ?? {};
  const format = target.format as Format;

  if (format === 'carousel') {
    const childIds: string[] = [];
    for (const m of media) {
      const params: Params =
        m.type === 'video'
          ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: true }
          : { image_url: m.url, is_carousel_item: true };
      const res = await gPost<IdResponse>(`${igId}/media`, token, params);
      childIds.push(res.id);
    }
    return { step: 'children', childIds, hasVideo: media.some((m) => m.type === 'video') };
  }

  const m = media[0];
  let params: Params;
  if (format === 'reel' || format === 'trial_reel') {
    params = {
      media_type: 'REELS',
      video_url: m.url,
      caption,
      cover_url: opts.coverUrl ?? m.thumbnailUrl ?? undefined,
      thumb_offset: opts.coverUrl || m.thumbnailUrl ? undefined : opts.thumbOffsetMs,
    };
    if (format === 'trial_reel') {
      params.trial_params = JSON.stringify({ graduation_strategy: opts.trialGraduation ?? 'MANUAL' });
    } else if (opts.shareToFeed !== undefined) {
      params.share_to_feed = opts.shareToFeed;
    }
  } else if (format === 'story') {
    params = m.type === 'video' ? { media_type: 'STORIES', video_url: m.url } : { media_type: 'STORIES', image_url: m.url };
  } else {
    params = { image_url: m.url, caption };
  }
  const res = await gPost<IdResponse>(`${igId}/media`, token, params);
  return { step: 'container', containerId: res.id, hasVideo: m.type === 'video' };
}

async function containerStatus(id: string, token: string): Promise<StatusResponse> {
  return gGet<StatusResponse>(id, token, { fields: 'status_code,status' });
}

function containerFailed(s: StatusResponse, label: string): Extract<PublishResult, { kind: 'failed' }> | null {
  if (s.status_code === 'ERROR')
    return { kind: 'failed', error: `Instagram could not process the ${label}: ${s.status || 'unknown error'}`, retryable: false };
  if (s.status_code === 'EXPIRED')
    return { kind: 'failed', error: `Instagram ${label} container expired (not published within 24 hours)`, retryable: false };
  if (s.status_code === 'PUBLISHED')
    return { kind: 'failed', error: `Instagram says the ${label} is already published but the post id was lost; check the account before retrying`, retryable: false };
  return null;
}

async function checkQuota(igId: string, token: string): Promise<Extract<PublishResult, { kind: 'failed' }> | null> {
  try {
    const q = await gGet<{ data?: Array<{ quota_usage?: number; config?: { quota_total?: number } }> }>(
      `${igId}/content_publishing_limit`,
      token,
      { fields: 'quota_usage,config' },
    );
    const row = q.data?.[0];
    const total = row?.config?.quota_total;
    if (row && total !== undefined && (row.quota_usage ?? 0) >= total) {
      return { kind: 'failed', error: `Instagram daily publishing limit reached (${row.quota_usage}/${total})`, retryable: true, retryAfterSec: 3600 };
    }
  } catch {
    // The quota check is advisory; media_publish reports the real limit.
  }
  return null;
}

async function finishPublish(ctx: PublishContext, token: string, igId: string, state: IgState): Promise<PublishResult> {
  const quota = await checkQuota(igId, token);
  if (quota) return quota;

  const pub = await gPost<IdResponse>(`${igId}/media_publish`, token, { creation_id: state.containerId });
  const mediaId = pub.id;
  const next: IgState = { ...state, step: 'published', mediaId };

  let url: string | null = null;
  try {
    const info = await gGet<{ permalink?: string }>(mediaId, token, { fields: 'permalink' });
    url = info.permalink ?? null;
  } catch {
    url = null;
  }

  // First comment: best effort, never fails the publish. Stories cannot take comments.
  const firstComment = ctx.post.first_comment?.trim();
  if (firstComment && ctx.target.format !== 'story') {
    try {
      const c = await gPost<IdResponse>(`${mediaId}/comments`, token, { message: firstComment });
      next.commentId = c.id;
    } catch (err) {
      next.commentError = (err as Error).message;
    }
  }

  return { kind: 'published', externalId: mediaId, url, state: next as unknown as Record<string, unknown> };
}

/** Move the state machine forward as far as it can go right now. */
async function advance(ctx: PublishContext, token: string, igId: string, state: IgState): Promise<PublishResult> {
  if (state.step === 'published' && state.mediaId) {
    return { kind: 'published', externalId: state.mediaId, url: ctx.target.external_url, state: state as unknown as Record<string, unknown> };
  }

  const pollSec = state.hasVideo ? VIDEO_POLL_SEC : IMAGE_POLL_SEC;

  if (state.step === 'children') {
    const ids = state.childIds ?? [];
    for (let i = 0; i < ids.length; i++) {
      const s = await containerStatus(ids[i], token);
      const failed = containerFailed(s, `carousel item ${i + 1}`);
      if (failed) return failed;
      if (s.status_code !== 'FINISHED') {
        return { kind: 'processing', state: state as unknown as Record<string, unknown>, retryAfterSec: pollSec };
      }
    }
    const parent = await gPost<IdResponse>(`${igId}/media`, token, {
      media_type: 'CAROUSEL',
      children: ids.join(','),
      caption: ctx.caption,
    });
    state = { ...state, step: 'container', containerId: parent.id };
  }

  if (state.step === 'container' && state.containerId) {
    const s = await containerStatus(state.containerId, token);
    const failed = containerFailed(s, ctx.target.format === 'carousel' ? 'carousel' : 'media');
    if (failed) return failed;
    if (s.status_code === 'FINISHED') return finishPublish(ctx, token, igId, state);
    return { kind: 'processing', state: state as unknown as Record<string, unknown>, retryAfterSec: pollSec };
  }

  return { kind: 'failed', error: 'Instagram publish state is corrupt; recreate the post', retryable: false };
}

async function publish(ctx: PublishContext): Promise<PublishResult> {
  const auth = requireAuth(ctx);
  if ('kind' in auth) return auth;
  try {
    // Resume rather than recreate if a previous attempt already made containers.
    const existing = readState(ctx.target.state);
    const state = existing ?? (await createContainers(ctx, auth.token, auth.igId));
    return await advance(ctx, auth.token, auth.igId, state);
  } catch (err) {
    return mapError(err);
  }
}

async function checkStatus(ctx: PublishContext): Promise<PublishResult> {
  const auth = requireAuth(ctx);
  if ('kind' in auth) return auth;
  const state = readState(ctx.target.state);
  if (!state) return publish(ctx);
  try {
    return await advance(ctx, auth.token, auth.igId, state);
  } catch (err) {
    return mapError(err);
  }
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const METRICS_BY_FORMAT: Partial<Record<Format, string[]>> = {
  image: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'],
  carousel: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'],
  reel: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
  trial_reel: ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
  story: ['views', 'reach', 'replies', 'shares', 'total_interactions'],
};

/** Normalised keys so the UI can compare across platforms. */
const METRIC_ALIASES: Record<string, string> = { saved: 'saves' };

async function fetchMetrics(ctx: PublishContext): Promise<Record<string, number>> {
  const token = ctx.account.accessToken;
  const mediaId = ctx.target.external_id;
  if (!token || !mediaId) return {};
  const metrics = METRICS_BY_FORMAT[ctx.target.format] ?? METRICS_BY_FORMAT.image!;
  const res = await gGet<{ data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
    `${mediaId}/insights`,
    token,
    { metric: metrics.join(',') },
  );
  const out: Record<string, number> = {};
  for (const row of res.data ?? []) {
    const v = row.values?.[0]?.value ?? row.total_value?.value;
    if (typeof v === 'number') out[METRIC_ALIASES[row.name] ?? row.name] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------

const FORMATS: Format[] = ['image', 'carousel', 'reel', 'trial_reel', 'story'];

export const instagramAdapter: PlatformAdapter = {
  platform: 'instagram',
  label: 'Instagram',
  formats: FORMATS,
  usesPkce: false,
  requiredEnv: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'],
  getAuthUrl,
  exchangeCode,
  refreshToken,
  validate,
  publish,
  checkStatus,
  fetchMetrics,
};
