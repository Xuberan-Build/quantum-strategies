/**
 * Weekly winners (brain/content/social-master-plan.md §2 promotion rule, §3 numbers that matter, §4 Friday loop).
 *
 * A published target that beats its channel median (platform + format, last 90 days) by PROMOTION_MULTIPLE on the
 * number that matters there is a winner. A winner becomes a content_promotions row proposing a longer form; Austin
 * reviews it in /admin/social/winners and accepting it makes the longer piece via makeAsset.
 *
 * Promotions never write into kg_nodes: the topical-map queue is rebuilt from brain/content/topical-map.json.
 * Every function takes the Supabase client so tests can inject an in-memory fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeAsset } from './make';
import { CHANNEL_METRIC, FORM_RANK, PROMOTION_MULTIPLE, type PieceType, type Promotion, type PromotionStatus } from './types';

export type Db = SupabaseClient;

/** Groups with fewer published posts than this in the baseline window get no median. */
export const MIN_BASELINE_POSTS = 5;

const DAY_MS = 86_400_000;
const PROMOTION_STATUSES: PromotionStatus[] = ['proposed', 'accepted', 'dismissed', 'done'];

// ---------------------------------------------------------------- types

interface TargetRow {
  id: string;
  post_id: string;
  account_id: string;
  platform: string;
  format: string;
  status: string;
  external_url: string | null;
  published_at: string | null;
  metrics: Record<string, unknown> | null;
}

export interface ChannelMedian {
  platform: string;
  format: string;
  metric: string | null;
  /** Published targets with metrics in the baseline window. */
  count: number;
  /** null when the group is thin (count < MIN_BASELINE_POSTS) or has no usable metric. */
  median: number | null;
}

export interface ThinGroup {
  platform: string;
  format: string;
  metric: string | null;
  count: number;
  reason: 'not_enough_history' | 'no_metric' | 'median_zero';
}

export interface WinnerPromotionRef {
  id: string;
  proposed_format: PieceType;
  status: PromotionStatus;
  piece_id: string | null;
}

export interface Winner {
  target_id: string;
  post_id: string;
  platform: string;
  format: string;
  published_at: string | null;
  external_url: string | null;
  title: string | null;
  caption: string;
  insight_id: string | null;
  account: { id: string; handle: string | null; display_name: string | null } | null;
  metric: string;
  value: number;
  median: number;
  /** value / median, rounded to 1 decimal. */
  multiple: number;
  suggestions: PieceType[];
  /** Promotions already stored for this target (any status). */
  promotions: WinnerPromotionRef[];
  promotionExists: boolean;
}

export interface WinnersResult {
  winners: Winner[];
  thinGroups: ThinGroup[];
  medians: ChannelMedian[];
  sinceDays: number;
  baselineDays: number;
  multiple: number;
}

// ---------------------------------------------------------------- helpers

const groupKey = (platform: string, format: string) => `${platform}::${format}`;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The channel metric for a group: the first CHANNEL_METRIC key present in any target's metrics. */
function pickMetric(platform: string, rows: TargetRow[]): string | null {
  const keys = CHANNEL_METRIC[platform];
  if (!keys) return null;
  for (const k of keys) {
    if (rows.some((r) => r.metrics && num(r.metrics[k]) !== null)) return k;
  }
  return null;
}

/** Targets that have been synced at least once (non-empty metrics). Missing metric key counts as 0. */
function metricValue(row: TargetRow, metric: string): number | null {
  if (!row.metrics || Object.keys(row.metrics).length === 0) return null;
  return num(row.metrics[metric]) ?? 0;
}

async function loadPublishedTargets(client: Db, sinceIso: string): Promise<TargetRow[]> {
  const { data, error } = await client
    .from('social_post_targets')
    .select('id, post_id, account_id, platform, format, status, external_url, published_at, metrics')
    .eq('status', 'published')
    .gte('published_at', sinceIso)
    .order('published_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TargetRow[];
}

function computeMedians(rows: TargetRow[]): { medians: ChannelMedian[]; byKey: Map<string, ChannelMedian> } {
  const groups = new Map<string, TargetRow[]>();
  for (const r of rows) {
    const k = groupKey(r.platform, r.format);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const medians: ChannelMedian[] = [];
  const byKey = new Map<string, ChannelMedian>();
  for (const [k, list] of groups) {
    const { platform, format } = list[0];
    const metric = pickMetric(platform, list);
    const values = metric ? list.map((r) => metricValue(r, metric)).filter((v): v is number => v !== null) : [];
    const m: ChannelMedian = {
      platform,
      format,
      metric,
      count: values.length,
      median: metric && values.length >= MIN_BASELINE_POSTS ? median(values) : null,
    };
    medians.push(m);
    byKey.set(k, m);
  }
  medians.sort((a, b) => a.platform.localeCompare(b.platform) || a.format.localeCompare(b.format));
  return { medians, byKey };
}

// ---------------------------------------------------------------- medians + winners

export async function channelMedians(client: Db, opts: { sinceDays?: number; now?: Date } = {}): Promise<ChannelMedian[]> {
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.sinceDays ?? 90) * DAY_MS).toISOString();
  return computeMedians(await loadPublishedTargets(client, since)).medians;
}

export async function findWinners(
  client: Db,
  opts: { sinceDays?: number; multiple?: number; baselineDays?: number; now?: Date } = {},
): Promise<WinnersResult> {
  const sinceDays = opts.sinceDays ?? 7;
  const multiple = opts.multiple ?? PROMOTION_MULTIPLE;
  const baselineDays = Math.max(opts.baselineDays ?? 90, sinceDays);
  const now = opts.now ?? new Date();
  const windowStart = new Date(now.getTime() - sinceDays * DAY_MS).toISOString();
  const baselineStart = new Date(now.getTime() - baselineDays * DAY_MS).toISOString();

  const rows = await loadPublishedTargets(client, baselineStart);
  const { medians, byKey } = computeMedians(rows);
  const inWindow = rows.filter((r) => r.published_at && r.published_at >= windowStart);

  const thinGroups: ThinGroup[] = [];
  const thinSeen = new Set<string>();
  const candidates: { row: TargetRow; metric: string; value: number; median: number }[] = [];

  for (const row of inWindow) {
    const k = groupKey(row.platform, row.format);
    const g = byKey.get(k)!;
    let reason: ThinGroup['reason'] | null = null;
    if (!g.metric) reason = 'no_metric';
    else if (g.median === null) reason = 'not_enough_history';
    else if (g.median <= 0) reason = 'median_zero';
    if (reason) {
      if (!thinSeen.has(k)) {
        thinSeen.add(k);
        thinGroups.push({ platform: g.platform, format: g.format, metric: g.metric, count: g.count, reason });
      }
      continue;
    }
    const value = metricValue(row, g.metric!);
    if (value === null) continue;
    if (value >= multiple * g.median!) candidates.push({ row, metric: g.metric!, value, median: g.median! });
  }

  // Thin groups that have history but nothing this week are still worth reporting.
  for (const g of medians) {
    const k = groupKey(g.platform, g.format);
    if (thinSeen.has(k)) continue;
    if (!g.metric || g.median === null) {
      thinSeen.add(k);
      thinGroups.push({ platform: g.platform, format: g.format, metric: g.metric, count: g.count, reason: g.metric ? 'not_enough_history' : 'no_metric' });
    }
  }

  if (candidates.length === 0) return { winners: [], thinGroups, medians, sinceDays, baselineDays, multiple };

  const postIds = Array.from(new Set(candidates.map((c) => c.row.post_id)));
  const accountIds = Array.from(new Set(candidates.map((c) => c.row.account_id)));
  const targetIds = candidates.map((c) => c.row.id);

  const [postsRes, accountsRes, promosRes] = await Promise.all([
    client.from('social_posts').select('id, title, caption, insight_id').in('id', postIds),
    client.from('social_accounts').select('id, handle, display_name').in('id', accountIds),
    client.from('content_promotions').select('id, source_id, proposed_format, status, piece_id').eq('source_kind', 'social_target').in('source_id', targetIds),
  ]);
  if (postsRes.error) throw new Error(postsRes.error.message);
  const posts = new Map(((postsRes.data ?? []) as { id: string; title: string | null; caption: string | null; insight_id: string | null }[]).map((p) => [p.id, p]));
  const accounts = new Map(((accountsRes.data ?? []) as { id: string; handle: string | null; display_name: string | null }[]).map((a) => [a.id, a]));
  const promos = (promosRes.data ?? []) as (WinnerPromotionRef & { source_id: string })[];

  const winners: Winner[] = candidates.map(({ row, metric, value, median: med }) => {
    const post = posts.get(row.post_id);
    const mine = promos.filter((p) => p.source_id === row.id).map(({ id, proposed_format, status, piece_id }) => ({ id, proposed_format, status, piece_id }));
    return {
      target_id: row.id,
      post_id: row.post_id,
      platform: row.platform,
      format: row.format,
      published_at: row.published_at,
      external_url: row.external_url,
      title: post?.title ?? null,
      caption: post?.caption ?? '',
      insight_id: post?.insight_id ?? null,
      account: accounts.get(row.account_id) ?? null,
      metric,
      value,
      median: med,
      multiple: round1(value / med),
      suggestions: suggestFormats(row.platform, row.format),
      promotions: mine,
      promotionExists: mine.length > 0,
    };
  });
  winners.sort((a, b) => b.multiple - a.multiple);
  return { winners, thinGroups, medians, sinceDays, baselineDays, multiple };
}

// ---------------------------------------------------------------- format suggestions

/** The form a source sits at, for the FORM_RANK comparison. */
function sourceForm(platform: string, format: string): PieceType | null {
  const p = platform.toLowerCase();
  const f = format.toLowerCase();
  if (p === 'x' || p === 'threads') return f === 'article' || f === 'x_article' ? 'x_article' : 'social_twitter';
  if (p === 'instagram') {
    if (f === 'carousel') return 'ig_carousel';
    if (f === 'reel' || f === 'trial_reel' || f === 'short') return 'short';
    return 'social_ig';
  }
  if (p === 'youtube') return f === 'short' ? 'short' : 'youtube_long';
  if (p === 'tiktok') return f === 'tiktok_photo' ? 'ig_carousel' : 'short';
  if (p === 'reddit') return f === 'answer' || f === 'comment' || f === 'reddit' ? 'reddit' : 'reddit_post';
  return null;
}

/** Preferred longer forms per source (master plan §2 conversion map), before the FORM_RANK filter. */
function preferredLonger(platform: string, format: string): PieceType[] {
  const p = platform.toLowerCase();
  const f = format.toLowerCase();
  if (p === 'x' || p === 'threads') return ['reddit_post', 'blog', 'x_article', 'youtube_long'];
  if (p === 'instagram') return f === 'carousel' ? ['blog', 'youtube_long'] : ['youtube_long', 'blog'];
  if (p === 'youtube') return f === 'short' ? ['youtube_long', 'blog'] : [];
  if (p === 'tiktok') return f === 'tiktok_photo' ? ['blog', 'youtube_long'] : ['youtube_long', 'blog'];
  if (p === 'reddit') return ['blog', 'youtube_long', 'x_article'];
  return ['blog', 'youtube_long'];
}

/**
 * Ordered PieceType suggestions for going longer from a winner on this platform + format. Only forms with a higher
 * FORM_RANK than the source (so a Reddit post gets blog + long video; X Article is the same length and is left out).
 */
export function suggestFormats(platform: string, format: string): PieceType[] {
  const from = sourceForm(platform, format);
  const rank = from ? FORM_RANK[from] : 0;
  return preferredLonger(platform, format).filter((t) => FORM_RANK[t] > rank);
}

// ---------------------------------------------------------------- promotions

export interface ProposeInput {
  sourceKind: Promotion['source_kind'];
  sourceId: string;
  proposedFormat: PieceType;
  insightId?: string | null;
  platform?: string | null;
  metric?: string | null;
  value?: number | null;
  channelMedian?: number | null;
  multiple?: number | null;
  proposedTitle?: string | null;
  notes?: string | null;
}

function multipleOf(value: number | null | undefined, med: number | null | undefined): number | null {
  if (value == null || med == null || med <= 0) return null;
  return round1(value / med);
}

/**
 * Upsert on (source_kind, source_id, proposed_format). An existing row keeps its status and piece_id: re-proposing
 * a winner that was already accepted or dismissed never resets it. Its numbers refresh while it is still proposed.
 */
export async function proposePromotion(client: Db, input: ProposeInput): Promise<{ promotion: Promotion; created: boolean }> {
  if (!(input.proposedFormat in FORM_RANK) || input.proposedFormat === ('article' as PieceType)) {
    throw new Error(`Unknown format: ${input.proposedFormat}`);
  }
  const fields = {
    insight_id: input.insightId ?? null,
    platform: input.platform ?? null,
    metric: input.metric ?? null,
    value: input.value ?? null,
    channel_median: input.channelMedian ?? null,
    multiple: input.multiple ?? multipleOf(input.value, input.channelMedian),
    proposed_title: input.proposedTitle ?? null,
    notes: input.notes ?? null,
  };

  const { data: existing, error: findErr } = await client
    .from('content_promotions')
    .select('*')
    .eq('source_kind', input.sourceKind)
    .eq('source_id', input.sourceId)
    .eq('proposed_format', input.proposedFormat)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (existing) {
    const row = existing as Promotion;
    if (row.status !== 'proposed') return { promotion: row, created: false };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(fields)) if (v !== null) patch[k] = v;
    const { data, error } = await client.from('content_promotions').update(patch).eq('id', row.id).select('*').single();
    if (error) throw new Error(error.message);
    return { promotion: (data as Promotion) ?? { ...row, ...patch }, created: false };
  }

  const { data, error } = await client
    .from('content_promotions')
    .insert({ source_kind: input.sourceKind, source_id: input.sourceId, proposed_format: input.proposedFormat, status: 'proposed', ...fields })
    .select('*')
    .single();
  if (error) {
    // Lost a race with a concurrent propose: return the row that won.
    if ((error as { code?: string }).code === '23505') {
      const again = await client.from('content_promotions').select('*')
        .eq('source_kind', input.sourceKind).eq('source_id', input.sourceId).eq('proposed_format', input.proposedFormat).maybeSingle();
      if (again.data) return { promotion: again.data as Promotion, created: false };
    }
    throw new Error(error.message);
  }
  return { promotion: data as Promotion, created: true };
}

/** Propose a promotion straight from a published target, filling the numbers from findWinners' logic. */
export async function proposeFromTarget(
  client: Db,
  input: { targetId: string; proposedFormat: PieceType; baselineDays?: number; now?: Date },
): Promise<{ promotion: Promotion; created: boolean }> {
  const { data: t, error } = await client
    .from('social_post_targets')
    .select('id, post_id, account_id, platform, format, status, external_url, published_at, metrics')
    .eq('id', input.targetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) throw new Error('Target not found');
  const target = t as TargetRow;

  const medians = await channelMedians(client, { sinceDays: input.baselineDays ?? 90, now: input.now });
  const g = medians.find((m) => m.platform === target.platform && m.format === target.format);
  const metric = g?.metric ?? CHANNEL_METRIC[target.platform]?.[0] ?? null;
  const value = metric ? metricValue(target, metric) : null;

  const { data: post } = await client.from('social_posts').select('id, title, caption, insight_id').eq('id', target.post_id).maybeSingle();
  const p = post as { title: string | null; caption: string | null; insight_id: string | null } | null;

  return proposePromotion(client, {
    sourceKind: 'social_target',
    sourceId: target.id,
    proposedFormat: input.proposedFormat,
    insightId: p?.insight_id ?? null,
    platform: target.platform,
    metric,
    value,
    channelMedian: g?.median ?? null,
    proposedTitle: p?.title || firstLine(p?.caption ?? '') || null,
  });
}

function firstLine(text: string, max = 120): string {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export interface ExternalWinnerInput {
  url: string;
  platform: 'reddit' | 'x' | string;
  metric: string;
  value: number;
  channelMedian?: number | null;
  title?: string | null;
  text?: string | null;
  insightId?: string | null;
  /** Defaults to the first longer form for the platform (Reddit post → blog). */
  format?: PieceType;
  /** Source format for suggestions ('post' or 'answer' on Reddit). */
  sourceFormat?: string;
}

/**
 * A winner the publisher can't read (Reddit is blocked to our tools; X posts made by hand). Austin logs it with its
 * numbers; the pasted text is kept in notes so acceptPromotion can pass it to the generator as context.
 */
export async function addExternalWinner(client: Db, input: ExternalWinnerInput): Promise<{ promotion: Promotion; created: boolean }> {
  const url = input.url.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('A full https:// link to the post is required');
  if (!Number.isFinite(input.value) || input.value < 0) throw new Error('value must be a number');
  const platform = (input.platform || 'other').toLowerCase();
  const format = input.format ?? suggestFormats(platform, input.sourceFormat ?? 'post')[0] ?? 'blog';
  return proposePromotion(client, {
    sourceKind: 'external',
    sourceId: url,
    proposedFormat: format,
    insightId: input.insightId ?? null,
    platform,
    metric: input.metric || null,
    value: input.value,
    channelMedian: input.channelMedian ?? null,
    proposedTitle: input.title?.trim() || null,
    notes: input.text?.trim() || null,
  });
}

export async function getPromotion(client: Db, id: string): Promise<Promotion | null> {
  const { data, error } = await client.from('content_promotions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Promotion | null) ?? null;
}

export interface PromotionWithPiece extends Promotion {
  piece: { id: string; title: string | null; piece_type: string; status: string } | null;
}

export async function listPromotions(client: Db, opts: { status?: PromotionStatus | null; limit?: number } = {}): Promise<PromotionWithPiece[]> {
  let q = client.from('content_promotions').select('*');
  if (opts.status && PROMOTION_STATUSES.includes(opts.status)) q = q.eq('status', opts.status);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(opts.limit ?? 200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Promotion[];
  const pieceIds = Array.from(new Set(rows.map((r) => r.piece_id).filter((v): v is string => !!v)));
  let pieces = new Map<string, PromotionWithPiece['piece']>();
  if (pieceIds.length) {
    const { data: ps } = await client.from('content_pieces').select('id, title, piece_type, status').in('id', pieceIds);
    pieces = new Map(((ps ?? []) as NonNullable<PromotionWithPiece['piece']>[]).map((p) => [p.id, p]));
  }
  return rows.map((r) => ({ ...r, piece: r.piece_id ? pieces.get(r.piece_id) ?? null : null }));
}

export interface AcceptResult {
  promotion: Promotion;
  piece: { id: string; title: string | null; piece_type: string };
  warnings: string[];
}

/**
 * Make the longer piece and mark the promotion accepted with its piece_id.
 * Social targets make from their post ({kind:'social_post'}); external winners from the url, with the pasted text
 * passed as extraContext.
 */
export async function acceptPromotion(client: Db, id: string, opts: { createdBy?: string | null; scheduledFor?: string | null } = {}): Promise<AcceptResult> {
  const promo = await getPromotion(client, id);
  if (!promo) throw new Error('Promotion not found');
  if (promo.status !== 'proposed') throw new Error(`Promotion is already ${promo.status}`);

  let source: { kind: 'social_post' | 'external' | 'piece' | 'insight'; id: string };
  let extraContext: string | undefined;
  const numbers = promo.metric && promo.value != null
    ? `It won: ${promo.value} ${promo.metric}${promo.channel_median != null ? ` against a channel median of ${promo.channel_median}` : ''}${promo.multiple != null ? ` (x${promo.multiple})` : ''}.`
    : '';

  switch (promo.source_kind) {
    case 'social_target': {
      const { data: t, error } = await client.from('social_post_targets').select('id, post_id').eq('id', promo.source_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error('The winning post no longer exists');
      source = { kind: 'social_post', id: (t as { post_id: string }).post_id };
      extraContext = numbers || undefined;
      break;
    }
    case 'social_post':
      source = { kind: 'social_post', id: promo.source_id };
      extraContext = numbers || undefined;
      break;
    case 'external':
      source = { kind: 'external', id: promo.source_id };
      extraContext = [
        promo.proposed_title ? `Title: ${promo.proposed_title}` : '',
        numbers,
        promo.notes ? `The post, as written:\n${promo.notes}` : '',
      ].filter(Boolean).join('\n\n') || undefined;
      break;
    case 'piece':
      source = { kind: 'piece', id: promo.source_id };
      break;
    case 'insight':
      source = { kind: 'insight', id: promo.source_id };
      break;
    default:
      throw new Error(`Unsupported source kind: ${String(promo.source_kind)}`);
  }

  const made = await makeAsset(client, {
    source,
    target: promo.proposed_format,
    insightId: promo.insight_id ?? null,
    createdBy: opts.createdBy ?? null,
    extraContext,
    scheduledFor: opts.scheduledFor ?? null,
  });

  const now = new Date().toISOString();
  const { data, error } = await client
    .from('content_promotions')
    .update({ status: 'accepted', piece_id: made.piece.id, updated_at: now })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`Piece ${made.piece.id} was made but the promotion did not update: ${error.message}`);
  const promotion = (data as Promotion | null) ?? { ...promo, status: 'accepted' as const, piece_id: made.piece.id, updated_at: now };
  return { promotion, piece: made.piece, warnings: made.warnings ?? [] };
}

async function setStatus(client: Db, id: string, patch: Record<string, unknown>): Promise<Promotion> {
  const { data, error } = await client
    .from('content_promotions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Promotion not found');
  return data as Promotion;
}

export async function dismissPromotion(client: Db, id: string, notes?: string | null): Promise<Promotion> {
  const promo = await getPromotion(client, id);
  if (!promo) throw new Error('Promotion not found');
  const patch: Record<string, unknown> = { status: 'dismissed' };
  // Keep the pasted text of external winners: append the reason instead of replacing notes.
  if (notes?.trim()) patch.notes = promo.notes ? `${promo.notes}\n\nDismissed: ${notes.trim()}` : `Dismissed: ${notes.trim()}`;
  return setStatus(client, id, patch);
}

/** Mark an accepted promotion done (its longer piece went out). */
export async function markDone(client: Db, id: string): Promise<Promotion> {
  const promo = await getPromotion(client, id);
  if (!promo) throw new Error('Promotion not found');
  if (promo.status !== 'accepted') throw new Error(`Only accepted promotions can be marked done (this one is ${promo.status})`);
  return setStatus(client, id, { status: 'done' });
}

/** Move accepted promotions whose piece is published to done. Returns how many moved. */
export async function syncDonePromotions(client: Db): Promise<number> {
  const { data, error } = await client.from('content_promotions').select('id, piece_id').eq('status', 'accepted');
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as { id: string; piece_id: string | null }[]).filter((r) => r.piece_id);
  if (!rows.length) return 0;
  const { data: ps } = await client.from('content_pieces').select('id, status').in('id', rows.map((r) => r.piece_id!));
  const published = new Set(((ps ?? []) as { id: string; status: string }[]).filter((p) => p.status === 'published').map((p) => p.id));
  const done = rows.filter((r) => published.has(r.piece_id!));
  if (!done.length) return 0;
  const { error: upErr } = await client
    .from('content_promotions')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .in('id', done.map((r) => r.id));
  if (upErr) throw new Error(upErr.message);
  return done.length;
}
