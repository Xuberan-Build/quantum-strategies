/**
 * Any-to-any asset graph (brain/content/social-master-plan.md §1, §2, §5).
 * "Made from" edges live in content_asset_links; implicit edges come from content_pieces.source_post_id
 * and social_posts.piece_id. Client-injected and free of server imports, so the pure helpers
 * (directionFor, formRelation, sourceFormForInsight) are safe to import in the browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { FORM_RANK, type AssetKind, type AssetLink, type AssetRef, type Direction, type Insight, type InsightSourceKind, type PieceType } from './types';

export type Db = SupabaseClient;
export type FormKey = PieceType | 'article';

export const ASSET_KINDS: readonly AssetKind[] = ['article', 'piece', 'social_post', 'insight', 'external'];
export const DIRECTIONS: readonly Direction[] = ['down', 'up', 'across', 'same'];
const INTERNAL_KINDS = new Set<AssetKind>(['article', 'piece', 'social_post', 'insight']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Thrown for bad input (routes map it to 400). */
export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphValidationError';
  }
}

// ── Forms, platforms and direction ──────────────────────────────────────────

/** Where each form lives. Two forms of equal rank on the same platform are 'same'; otherwise 'across'. */
export const FORM_PLATFORM: Record<FormKey, string> = {
  article: 'site',
  blog: 'site',
  youtube_long: 'youtube',
  short: 'vertical',
  social_tiktok: 'tiktok',
  reddit: 'reddit',
  reddit_post: 'reddit',
  x_article: 'x',
  social_twitter: 'x',
  ig_carousel: 'instagram',
  ig_lettering: 'instagram',
  social_ig: 'instagram',
  email: 'email',
  email_sequence: 'email',
};

export function isFormKey(value: unknown): value is FormKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FORM_RANK, value);
}

/**
 * Direction of an edge from a source form to a target form (master plan §2).
 * Longer target = 'up', shorter = 'down', equal rank on the same platform = 'same', equal rank elsewhere = 'across'.
 * `samePlatform` defaults to comparing FORM_PLATFORM. Unknown forms (old rows) give 'across'.
 */
export function directionFor(sourceForm: FormKey | string, targetForm: FormKey | string, samePlatform?: boolean): Direction {
  if (!isFormKey(sourceForm) || !isFormKey(targetForm)) return 'across';
  const a = FORM_RANK[sourceForm];
  const b = FORM_RANK[targetForm];
  if (b > a) return 'up';
  if (b < a) return 'down';
  const same = samePlatform ?? FORM_PLATFORM[sourceForm] === FORM_PLATFORM[targetForm];
  return same ? 'same' : 'across';
}

/** Longer / same / shorter relative to a source form (for grouping in the UI). null when either form is unknown. */
export function formRelation(sourceForm: FormKey | string | null | undefined, form: FormKey | string | null | undefined): 'longer' | 'same' | 'shorter' | null {
  if (!isFormKey(sourceForm) || !isFormKey(form)) return null;
  const a = FORM_RANK[sourceForm];
  const b = FORM_RANK[form];
  return b > a ? 'longer' : b < a ? 'shorter' : 'same';
}

/** The form an insight was first said or written in, when the source kind implies one. */
export function sourceFormForInsight(insight: Pick<Insight, 'source_kind'> | { source_kind: InsightSourceKind | string }): FormKey | null {
  switch (insight.source_kind) {
    case 'article': return 'article';
    case 'vcap':
    case 'video': return 'youtube_long';
    case 'reddit': return 'reddit_post';
    case 'x': return 'social_twitter';
    default: return null; // recording, interview, other: raw material, no published form
  }
}

/** Best-guess form of a publisher post with no calendar piece, from its first target. */
export function formForSocialTarget(platform: string | null | undefined, format: string | null | undefined): FormKey | null {
  switch (format) {
    case 'short':
    case 'reel':
    case 'trial_reel':
    case 'tiktok_video': return 'short';
    case 'video': return platform === 'youtube' ? 'youtube_long' : 'short';
    case 'carousel':
    case 'tiktok_photo': return 'ig_carousel';
    case 'story': return 'social_ig';
    case 'image': return platform === 'instagram' ? 'social_ig' : 'social_twitter';
    case 'tweet':
    case 'thread': return 'social_twitter';
    default: return null;
  }
}

// ── Resolving assets ────────────────────────────────────────────────────────

export interface ResolvedAsset {
  kind: AssetKind;
  id: string;
  title: string;
  /** piece_type for pieces; 'article' | 'social_post' | 'insight' | 'external' otherwise. */
  type: string;
  /** Length form used for direction and grouping, when known. */
  form: FormKey | null;
  status: string | null;
  platforms: string[];
  /** Admin link (or the url itself for external). */
  href: string | null;
  insightId: string | null;
  /** The row no longer exists (link left dangling). */
  missing?: boolean;
}

export interface GraphEdge {
  /** content_asset_links.id; null for implicit edges (source_post_id, piece_id). */
  linkId: string | null;
  direction: Direction | null;
  note: string | null;
  insightId: string | null;
  implicit: boolean;
  asset: ResolvedAsset;
}

export interface AssetGraph {
  asset: ResolvedAsset;
  /** Made from. */
  parents: GraphEdge[];
  /** Made into. */
  children: GraphEdge[];
  insight: Insight | null;
}

const refKey = (r: AssetRef) => `${r.kind}:${r.id}`;

function clip(text: string | null | undefined, n = 80): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

function externalTitle(url: string): string {
  try {
    const u = new URL(url);
    return clip(`${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`, 80);
  } catch {
    return clip(url, 80);
  }
}

function missingAsset(ref: AssetRef): ResolvedAsset {
  return { kind: ref.kind, id: ref.id, title: '(deleted)', type: ref.kind, form: null, status: null, platforms: [], href: null, insightId: null, missing: true };
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/** Resolve titles, status, platform and links for a batch of refs (one query per kind). Order is kept. */
export async function resolveAssets(client: Db, refs: AssetRef[]): Promise<ResolvedAsset[]> {
  const ids = (kind: AssetKind) => [...new Set(refs.filter((r) => r.kind === kind && isUuid(r.id)).map((r) => r.id))];
  const out = new Map<string, ResolvedAsset>();

  const articleIds = ids('article');
  if (articleIds.length) {
    const data = await rows<{ id: string; slug: string; title: string; is_published: boolean | null }>(
      client.from('content_posts').select('id, slug, title, is_published').in('id', articleIds),
    );
    for (const a of data) {
      out.set(`article:${a.id}`, {
        kind: 'article', id: a.id, title: a.title || a.slug, type: 'article', form: 'article',
        status: a.is_published ? 'published' : 'draft', platforms: ['site'], href: `/admin/content/${a.slug}`, insightId: null,
      });
    }
  }

  const pieceIds = ids('piece');
  if (pieceIds.length) {
    const data = await rows<{ id: string; title: string | null; piece_type: string; status: string; insight_id: string | null }>(
      client.from('content_pieces').select('id, title, piece_type, status, insight_id').in('id', pieceIds),
    );
    for (const p of data) {
      const form = isFormKey(p.piece_type) ? p.piece_type : null;
      out.set(`piece:${p.id}`, {
        kind: 'piece', id: p.id, title: p.title || '(untitled piece)', type: p.piece_type, form,
        status: p.status, platforms: form ? [FORM_PLATFORM[form]] : [], href: `/admin/studio/social-calendar/${p.id}`, insightId: p.insight_id ?? null,
      });
    }
  }

  const postIds = ids('social_post');
  if (postIds.length) {
    const posts = await rows<{ id: string; title: string | null; caption: string | null; status: string; insight_id: string | null; piece_id: string | null }>(
      client.from('social_posts').select('id, title, caption, status, insight_id, piece_id').in('id', postIds),
    );
    const targets = posts.length
      ? await rows<{ post_id: string; platform: string; format: string }>(
        client.from('social_post_targets').select('post_id, platform, format').in('post_id', posts.map((p) => p.id)),
      )
      : [];
    const piecesById = new Map<string, string>();
    const linkedPieces = [...new Set(posts.map((p) => p.piece_id).filter(isUuid))];
    if (linkedPieces.length) {
      const data = await rows<{ id: string; piece_type: string }>(client.from('content_pieces').select('id, piece_type').in('id', linkedPieces));
      for (const p of data) piecesById.set(p.id, p.piece_type);
    }
    for (const p of posts) {
      const ts = targets.filter((t) => t.post_id === p.id);
      const pieceType = p.piece_id ? piecesById.get(p.piece_id) : undefined;
      const form = isFormKey(pieceType) ? pieceType : ts.length ? formForSocialTarget(ts[0].platform, ts[0].format) : null;
      out.set(`social_post:${p.id}`, {
        kind: 'social_post', id: p.id, title: p.title || clip(p.caption) || '(no caption)', type: 'social_post', form,
        status: p.status, platforms: [...new Set(ts.map((t) => t.platform))], href: `/admin/social/compose?post=${p.id}`, insightId: p.insight_id ?? null,
      });
    }
  }

  const insightIds = ids('insight');
  if (insightIds.length) {
    const data = await rows<{ id: string; line: string; status: string; source_kind: string }>(
      client.from('content_insights').select('id, line, status, source_kind').in('id', insightIds),
    );
    for (const i of data) {
      out.set(`insight:${i.id}`, {
        kind: 'insight', id: i.id, title: clip(i.line, 140), type: 'insight', form: sourceFormForInsight(i),
        status: i.status, platforms: [], href: `/admin/studio/insights/${i.id}`, insightId: i.id,
      });
    }
  }

  return refs.map((r) => {
    if (r.kind === 'external') {
      return { kind: 'external', id: r.id, title: externalTitle(r.id), type: 'external', form: null, status: null, platforms: [], href: r.id, insightId: null };
    }
    return out.get(refKey(r)) ?? missingAsset(r);
  });
}

/** The length form of one asset (null when unknown). */
export async function assetForm(client: Db, ref: AssetRef): Promise<FormKey | null> {
  if (ref.kind === 'external') return null;
  const [asset] = await resolveAssets(client, [ref]);
  return asset.form;
}

/** Direction for an edge between two stored assets, computed from their forms. 'across' when a form is unknown. */
export async function inferDirection(client: Db, from: AssetRef, to: AssetRef): Promise<Direction> {
  const [a, b] = await resolveAssets(client, [from, to]);
  if (!a.form || !b.form) return 'across';
  return directionFor(a.form, b.form);
}

// ── Links ───────────────────────────────────────────────────────────────────

/** Validate a raw { kind, id } into an AssetRef, or throw GraphValidationError. */
export function parseAssetRef(raw: unknown, label = 'asset'): AssetRef {
  if (!raw || typeof raw !== 'object') throw new GraphValidationError(`${label} must be { kind, id }`);
  const { kind, id } = raw as Record<string, unknown>;
  if (typeof kind !== 'string' || !ASSET_KINDS.includes(kind as AssetKind)) {
    throw new GraphValidationError(`${label}.kind must be one of ${ASSET_KINDS.join(', ')}`);
  }
  if (typeof id !== 'string' || !id.trim()) throw new GraphValidationError(`${label}.id is required`);
  const value = id.trim();
  if (INTERNAL_KINDS.has(kind as AssetKind) && !isUuid(value)) throw new GraphValidationError(`${label}.id must be a uuid for kind ${kind}`);
  if (kind === 'external') {
    let ok = false;
    try {
      const u = new URL(value);
      ok = u.protocol === 'https:' || u.protocol === 'http:';
    } catch { /* not a url */ }
    if (!ok) throw new GraphValidationError(`${label}.id must be an http(s) url for kind external`);
    if (value.length > 2000) throw new GraphValidationError(`${label}.id is too long`);
  }
  return { kind: kind as AssetKind, id: value };
}

export interface LinkInput {
  from: AssetRef;
  to: AssetRef;
  direction: Direction;
  insightId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

/** Create or update the edge from → to (unique on from_kind, from_id, to_kind, to_id). */
export async function linkAssets(client: Db, input: LinkInput): Promise<AssetLink> {
  const from = parseAssetRef(input.from, 'from');
  const to = parseAssetRef(input.to, 'to');
  if (from.kind === to.kind && from.id === to.id) throw new GraphValidationError('An asset cannot be made from itself');
  if (!DIRECTIONS.includes(input.direction)) throw new GraphValidationError(`direction must be one of ${DIRECTIONS.join(', ')}`);
  if (input.insightId != null && !isUuid(input.insightId)) throw new GraphValidationError('insightId must be a uuid');
  if (input.createdBy != null && !isUuid(input.createdBy)) throw new GraphValidationError('createdBy must be a uuid');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 1000) || null : null;

  const row: Record<string, unknown> = {
    from_kind: from.kind, from_id: from.id, to_kind: to.kind, to_id: to.id, direction: input.direction, note,
  };
  // Leave an existing insight_id / created_by alone on re-link unless a value is given.
  if (input.insightId !== undefined) row.insight_id = input.insightId;
  if (input.createdBy) row.created_by = input.createdBy;

  const { data, error } = await client
    .from('content_asset_links')
    .upsert(row, { onConflict: 'from_kind,from_id,to_kind,to_id' })
    .select('id, from_kind, from_id, to_kind, to_id, direction, insight_id, note, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as AssetLink;
}

export async function unlinkAssets(client: Db, linkId: string): Promise<boolean> {
  if (!isUuid(linkId)) throw new GraphValidationError('link id must be a uuid');
  const { data, error } = await client.from('content_asset_links').delete().eq('id', linkId).select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.length > 0 : !!data;
}

const LINK_SELECT = 'id, from_kind, from_id, to_kind, to_id, direction, insight_id, note, created_at';

/** Everything this asset was made from and made into, with titles resolved. */
export async function assetGraph(client: Db, input: AssetRef): Promise<AssetGraph> {
  const ref = parseAssetRef(input);
  const [outgoing, incoming] = await Promise.all([
    rows<AssetLink>(client.from('content_asset_links').select(LINK_SELECT).eq('from_kind', ref.kind).eq('from_id', ref.id)),
    rows<AssetLink>(client.from('content_asset_links').select(LINK_SELECT).eq('to_kind', ref.kind).eq('to_id', ref.id)),
  ]);

  type Pending = Omit<GraphEdge, 'asset'> & { ref: AssetRef };
  const parents: Pending[] = incoming.map((l) => ({
    linkId: l.id, direction: l.direction, note: l.note, insightId: l.insight_id, implicit: false, ref: { kind: l.from_kind, id: l.from_id },
  }));
  const children: Pending[] = outgoing.map((l) => ({
    linkId: l.id, direction: l.direction, note: l.note, insightId: l.insight_id, implicit: false, ref: { kind: l.to_kind, id: l.to_id },
  }));
  const implicit = (list: Pending[], r: AssetRef) => {
    if (!list.some((e) => refKey(e.ref) === refKey(r))) list.push({ linkId: null, direction: null, note: null, insightId: null, implicit: true, ref: r });
  };

  // Implicit edges the calendar and publisher already record.
  if (ref.kind === 'piece') {
    const [piece] = await rows<{ source_post_id: string | null }>(client.from('content_pieces').select('source_post_id').eq('id', ref.id).limit(1));
    if (piece?.source_post_id) implicit(parents, { kind: 'article', id: piece.source_post_id });
    const posts = await rows<{ id: string }>(client.from('social_posts').select('id').eq('piece_id', ref.id).limit(100));
    for (const p of posts) implicit(children, { kind: 'social_post', id: p.id });
  } else if (ref.kind === 'social_post') {
    const [post] = await rows<{ piece_id: string | null }>(client.from('social_posts').select('piece_id').eq('id', ref.id).limit(1));
    if (post?.piece_id) implicit(parents, { kind: 'piece', id: post.piece_id });
  } else if (ref.kind === 'article') {
    const pieces = await rows<{ id: string }>(client.from('content_pieces').select('id').eq('source_post_id', ref.id).limit(200));
    for (const p of pieces) implicit(children, { kind: 'piece', id: p.id });
  }

  const all = [ref, ...parents.map((e) => e.ref), ...children.map((e) => e.ref)];
  const resolved = await resolveAssets(client, all);
  const byKey = new Map(resolved.map((a) => [refKey(a), a]));
  const finish = (list: Pending[]): GraphEdge[] => list.map(({ ref: r, ...edge }) => ({ ...edge, asset: byKey.get(refKey(r)) ?? missingAsset(r) }));
  const asset = resolved[0];

  let insight: Insight | null = null;
  const insightId = ref.kind === 'insight' ? ref.id : asset.insightId;
  if (insightId) {
    const [row] = await rows<Insight>(client.from('content_insights').select('*').eq('id', insightId).limit(1));
    insight = row ?? null;
  }

  return { asset, parents: finish(parents), children: finish(children), insight };
}
