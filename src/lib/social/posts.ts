/**
 * Shared post helpers for the admin API: select string, loaders, body parsing and target validation.
 */
import type { Db } from './accounts';
import { getAdapter } from './registry';
import type { Format, SocialMedia, SocialPost, SocialPostTarget, TargetOptions, Platform } from './types';

export const POST_SELECT =
  '*, targets:social_post_targets(*, account:social_accounts(id, platform, handle, display_name, avatar_url))';

export type PostWithTargets = SocialPost & {
  targets: (SocialPostTarget & {
    account: { id: string; platform: Platform; handle: string | null; display_name: string | null; avatar_url: string | null } | null;
  })[];
};

export async function loadPost(client: Db, id: string): Promise<PostWithTargets | null> {
  const { data } = await client.from('social_posts').select(POST_SELECT).eq('id', id).maybeSingle();
  return (data as PostWithTargets | null) ?? null;
}

export interface PostFilters {
  from?: string | null;
  to?: string | null;
  status?: string | null; // comma separated
  platform?: string | null;
}

const POST_STATUSES = ['draft', 'scheduled', 'publishing', 'published', 'partial', 'failed', 'cancelled'];

function isoOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function listPosts(client: Db, f: PostFilters): Promise<PostWithTargets[]> {
  let q = client.from('social_posts').select(POST_SELECT);

  const statuses = (f.status ?? '').split(',').map((s) => s.trim()).filter((s) => POST_STATUSES.includes(s));
  if (statuses.length) q = q.in('status', statuses);

  const from = isoOrNull(f.from);
  const to = isoOrNull(f.to);
  if (from || to) {
    const range = [from ? `scheduled_at.gte.${from}` : null, to ? `scheduled_at.lte.${to}` : null].filter(Boolean);
    const rangeExpr = range.length > 1 ? `and(${range.join(',')})` : range[0]!;
    q = statuses.includes('draft') ? q.or(`${rangeExpr},scheduled_at.is.null`) : q.or(rangeExpr);
  }

  if (f.platform) {
    const { data: ids } = await client.from('social_post_targets').select('post_id').eq('platform', f.platform);
    const postIds = Array.from(new Set(((ids ?? []) as { post_id: string }[]).map((r) => r.post_id)));
    if (postIds.length === 0) return [];
    q = q.in('id', postIds);
  }

  const { data, error } = await q
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as PostWithTargets[];
}

// ---------------------------------------------------------------- body parsing

export interface TargetInput {
  account_id: string;
  format: Format;
  caption_override?: string | null;
  options?: TargetOptions;
}

export interface PostInput {
  title?: string | null;
  caption?: string;
  media?: SocialMedia[];
  link?: string | null;
  first_comment?: string | null;
  tags?: string[];
  piece_id?: string | null;
  scheduled_at?: string | null;
  status?: 'draft' | 'scheduled' | 'cancelled';
  targets?: TargetInput[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isStr = (v: unknown): v is string => typeof v === 'string';
const optStr = (v: unknown, max: number): string | null | undefined => (v === undefined ? undefined : v === null ? null : isStr(v) && v.length <= max ? v : undefined);

/** Hand validation (zod is not a direct dependency). Returns the cleaned input or a list of problems. */
export function parsePostBody(raw: Record<string, any>, opts: { partial: boolean }): { value?: PostInput; errors: string[] } {
  const errors: string[] = [];
  const out: PostInput = {};
  const has = (k: string) => raw[k] !== undefined;

  if (has('title')) {
    if (raw.title !== null && (!isStr(raw.title) || raw.title.length > 300)) errors.push('title must be a string up to 300 characters');
    else out.title = raw.title;
  }
  if (has('caption') || !opts.partial) {
    if (!isStr(raw.caption)) errors.push('caption is required and must be a string');
    else if (raw.caption.length > 20000) errors.push('caption is too long');
    else out.caption = raw.caption;
  }
  if (has('media')) {
    if (!Array.isArray(raw.media) || raw.media.length > 35) errors.push('media must be an array of up to 35 items');
    else if (!raw.media.every((m: any) => m && isStr(m.url) && /^https?:\/\//.test(m.url) && (m.type === 'image' || m.type === 'video'))) {
      errors.push('each media item needs an http(s) url and type image|video');
    } else out.media = raw.media;
  } else if (!opts.partial) out.media = [];
  for (const key of ['link', 'first_comment'] as const) {
    if (has(key)) {
      const v = optStr(raw[key], key === 'link' ? 2000 : 5000);
      if (v === undefined) errors.push(`${key} must be a string or null`);
      else out[key] = v === '' ? null : v;
    }
  }
  if (has('tags')) {
    if (!Array.isArray(raw.tags) || !raw.tags.every(isStr) || raw.tags.length > 50) errors.push('tags must be an array of strings');
    else out.tags = raw.tags;
  }
  if (has('piece_id')) {
    if (raw.piece_id !== null && !(isStr(raw.piece_id) && UUID.test(raw.piece_id))) errors.push('piece_id must be a uuid or null');
    else out.piece_id = raw.piece_id;
  }
  if (has('scheduled_at')) {
    if (raw.scheduled_at === null) out.scheduled_at = null;
    else if (!isStr(raw.scheduled_at) || Number.isNaN(new Date(raw.scheduled_at).getTime())) errors.push('scheduled_at must be an ISO date or null');
    else out.scheduled_at = new Date(raw.scheduled_at).toISOString();
  }
  if (has('status')) {
    const allowed = opts.partial ? ['draft', 'scheduled', 'cancelled'] : ['draft', 'scheduled'];
    if (!allowed.includes(raw.status)) errors.push(`status must be one of ${allowed.join(', ')}`);
    else out.status = raw.status;
  } else if (!opts.partial) errors.push('status is required (draft or scheduled)');

  if (has('targets')) {
    if (!Array.isArray(raw.targets) || raw.targets.length > 20) errors.push('targets must be an array of up to 20 items');
    else {
      const seen = new Set<string>();
      const targets: TargetInput[] = [];
      for (const t of raw.targets) {
        if (!t || !isStr(t.account_id) || !UUID.test(t.account_id) || !isStr(t.format)) {
          errors.push('each target needs account_id (uuid) and format');
          continue;
        }
        if (seen.has(t.account_id)) { errors.push('an account can only be targeted once per post'); continue; }
        seen.add(t.account_id);
        if (t.caption_override != null && (!isStr(t.caption_override) || t.caption_override.length > 20000)) { errors.push('caption_override must be a string'); continue; }
        if (t.options != null && (typeof t.options !== 'object' || Array.isArray(t.options))) { errors.push('options must be an object'); continue; }
        targets.push({ account_id: t.account_id, format: t.format, caption_override: t.caption_override ?? null, options: t.options ?? {} });
      }
      out.targets = targets;
    }
  } else if (!opts.partial) out.targets = [];

  return errors.length ? { errors } : { value: out, errors };
}

/**
 * Check accounts are connected, formats belong to the adapter, and adapter.validate passes.
 * Returns { [account_id]: problems[] } (empty object = all good).
 */
export async function validateTargets(
  client: Db,
  post: Pick<SocialPost, 'caption' | 'media' | 'link' | 'first_comment' | 'tags' | 'title'> & { id?: string },
  targets: TargetInput[],
): Promise<Record<string, string[]>> {
  const errors: Record<string, string[]> = {};
  if (targets.length === 0) return errors;
  const { data } = await client
    .from('social_accounts')
    .select('id, platform, status')
    .in('id', targets.map((t) => t.account_id));
  const accounts = new Map(((data ?? []) as { id: string; platform: Platform; status: string }[]).map((a) => [a.id, a]));

  for (const t of targets) {
    const problems: string[] = [];
    const account = accounts.get(t.account_id);
    if (!account) problems.push('Account not found');
    else if (account.status !== 'connected') problems.push(`Account is ${account.status}; reconnect it first`);
    else {
      let adapter;
      try { adapter = getAdapter(account.platform); } catch { problems.push(`No adapter for ${account.platform}`); }
      if (adapter) {
        if (!adapter.formats.includes(t.format)) problems.push(`Format "${t.format}" is not supported on ${adapter.label}`);
        else {
          const now = new Date().toISOString();
          const fakePost: SocialPost = {
            id: post.id ?? 'preview', piece_id: null, title: post.title ?? null, caption: post.caption, media: post.media,
            link: post.link ?? null, first_comment: post.first_comment ?? null, tags: post.tags, status: 'draft',
            scheduled_at: null, created_by: null, created_at: now, updated_at: now,
          };
          const fakeTarget: SocialPostTarget = {
            id: 'preview', post_id: fakePost.id, account_id: account.id, platform: account.platform, format: t.format,
            caption_override: t.caption_override ?? null, options: t.options ?? {}, status: 'pending', external_id: null,
            external_url: null, state: {}, error: null, attempts: 0, next_attempt_at: null, published_at: null, metrics: {},
            metrics_synced_at: null,
          };
          problems.push(...adapter.validate(fakePost, fakeTarget));
        }
      }
    }
    if (problems.length) errors[t.account_id] = problems;
  }
  return errors;
}

/** Resolve account platforms so we can store the denormalised platform column. */
export async function platformsFor(client: Db, accountIds: string[]): Promise<Map<string, Platform>> {
  if (accountIds.length === 0) return new Map();
  const { data } = await client.from('social_accounts').select('id, platform').in('id', accountIds);
  return new Map(((data ?? []) as { id: string; platform: Platform }[]).map((a) => [a.id, a.platform]));
}

export async function insertTargets(client: Db, postId: string, targets: TargetInput[]) {
  if (targets.length === 0) return;
  const platforms = await platformsFor(client, targets.map((t) => t.account_id));
  const rows = targets.map((t) => ({
    post_id: postId,
    account_id: t.account_id,
    platform: platforms.get(t.account_id),
    format: t.format,
    caption_override: t.caption_override ?? null,
    options: t.options ?? {},
    status: 'pending',
  }));
  const { error } = await client.from('social_post_targets').insert(rows);
  if (error) throw new Error(error.message);
}

/** Drafts only need the accounts to exist and the format to belong to the platform; scheduling runs full validation. */
export async function validateTargetsLoose(client: Db, targets: TargetInput[]): Promise<Record<string, string[]>> {
  const errors: Record<string, string[]> = {};
  const platforms = await platformsFor(client, targets.map((t) => t.account_id));
  for (const t of targets) {
    const platform = platforms.get(t.account_id);
    if (!platform) { errors[t.account_id] = ['Account not found']; continue; }
    try {
      if (!getAdapter(platform).formats.includes(t.format)) errors[t.account_id] = [`Format "${t.format}" is not supported on ${platform}`];
    } catch {
      errors[t.account_id] = [`No adapter for ${platform}`];
    }
  }
  return errors;
}
