/**
 * The insight table (content_insights): one idea Austin said or wrote, with its source.
 * Every piece and post can carry one (insight_id); content_asset_links edges can name one too.
 * Client-injected: pass supabaseAdmin from routes, a fake in tests.
 */
import type { AssetLink, AssetRef, Insight, InsightSourceKind } from './types';
import { isUuid, resolveAssets, type Db, type ResolvedAsset } from './graph';

export const INSIGHT_SOURCE_KINDS: readonly InsightSourceKind[] = ['article', 'vcap', 'reddit', 'x', 'recording', 'video', 'interview', 'other'];
export const INSIGHT_SELECT = 'id, line, source_kind, source_ref, source_post_id, claim, evidence_tier, pillar, cluster, tags, notes, status, created_by, created_at, updated_at';

export interface InsightInput {
  line: string;
  source_kind?: InsightSourceKind;
  source_ref?: string | null;
  source_post_id?: string | null;
  claim?: string | null;
  evidence_tier?: string | null;
  pillar?: string | null;
  cluster?: string | null;
  tags?: string[];
  notes?: string | null;
}

export type InsightPatch = Partial<InsightInput> & { status?: Insight['status'] };

export interface ListInsightsOptions {
  q?: string | null;
  pillar?: string | null;
  sourceKind?: InsightSourceKind | string | null;
  /** 'active' (default), 'archived' or 'all'. */
  status?: Insight['status'] | 'all' | null;
  /** Only insights lifted from this article. */
  postId?: string | null;
  limit?: number;
}

const LIMITS: Record<string, number> = { line: 600, source_ref: 500, claim: 1500, evidence_tier: 40, pillar: 20, cluster: 20, notes: 4000 };

/** Validate a create (partial = false) or patch (partial = true) body. Unknown fields are ignored. */
export function parseInsightInput(raw: Record<string, unknown>, opts: { partial?: boolean } = {}): { value: InsightPatch | null; errors: string[] } {
  const errors: string[] = [];
  const value: InsightPatch = {};
  const text = (key: keyof typeof LIMITS, required = false) => {
    if (!(key in raw)) {
      if (required) errors.push(`${key} is required`);
      return;
    }
    const v = raw[key];
    if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) {
      if (required || key === 'line') errors.push(`${key} is required`);
      else (value as Record<string, unknown>)[key] = null;
      return;
    }
    if (typeof v !== 'string') return void errors.push(`${key} must be a string`);
    if (v.trim().length > LIMITS[key]) return void errors.push(`${key} must be at most ${LIMITS[key]} characters`);
    (value as Record<string, unknown>)[key] = v.trim();
  };

  text('line', !opts.partial);
  for (const key of ['source_ref', 'claim', 'evidence_tier', 'pillar', 'cluster', 'notes'] as const) text(key);

  if ('source_kind' in raw && raw.source_kind != null) {
    if (!INSIGHT_SOURCE_KINDS.includes(raw.source_kind as InsightSourceKind)) errors.push(`source_kind must be one of ${INSIGHT_SOURCE_KINDS.join(', ')}`);
    else value.source_kind = raw.source_kind as InsightSourceKind;
  }
  if ('source_post_id' in raw) {
    const v = raw.source_post_id;
    if (v === null || v === '') value.source_post_id = null;
    else if (!isUuid(v)) errors.push('source_post_id must be a uuid');
    else value.source_post_id = v;
  }
  if ('tags' in raw && raw.tags != null) {
    const tags = raw.tags;
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) errors.push('tags must be an array of strings');
    else value.tags = [...new Set(tags.map((t) => (t as string).trim()).filter(Boolean))].slice(0, 30);
  }
  if ('status' in raw && raw.status != null) {
    if (raw.status !== 'active' && raw.status !== 'archived') errors.push('status must be active or archived');
    else value.status = raw.status;
  }
  if (opts.partial && !errors.length && Object.keys(value).length === 0) errors.push('Nothing to update');
  return errors.length ? { value: null, errors } : { value, errors };
}

/** Strip characters that break PostgREST or() / ilike filters. */
function searchTerm(q: string): string {
  return q.replace(/[%_,()*\\:"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export async function listInsights(client: Db, opts: ListInsightsOptions = {}): Promise<Insight[]> {
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? 100)), 500);
  let query = client.from('content_insights').select(INSIGHT_SELECT).order('created_at', { ascending: false }).limit(limit);
  const status = opts.status ?? 'active';
  if (status !== 'all') query = query.eq('status', status);
  if (opts.pillar) query = query.eq('pillar', opts.pillar);
  if (opts.sourceKind) query = query.eq('source_kind', opts.sourceKind);
  if (opts.postId && isUuid(opts.postId)) query = query.eq('source_post_id', opts.postId);
  const q = opts.q ? searchTerm(opts.q) : '';
  if (q) query = query.or(`line.ilike.%${q}%,claim.ilike.%${q}%,notes.ilike.%${q}%,source_ref.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Insight[];
}

export async function getInsight(client: Db, id: string): Promise<Insight | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client.from('content_insights').select(INSIGHT_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Insight | null) ?? null;
}

export async function createInsight(client: Db, input: InsightInput, createdBy?: string | null): Promise<Insight> {
  const row = {
    line: input.line.trim(),
    source_kind: input.source_kind ?? (input.source_post_id ? 'article' : 'other'),
    source_ref: input.source_ref ?? null,
    source_post_id: input.source_post_id ?? null,
    claim: input.claim ?? null,
    evidence_tier: input.evidence_tier ?? null,
    pillar: input.pillar ?? null,
    cluster: input.cluster ?? null,
    tags: input.tags ?? [],
    notes: input.notes ?? null,
    created_by: createdBy && isUuid(createdBy) ? createdBy : null,
  };
  const { data, error } = await client.from('content_insights').insert(row).select(INSIGHT_SELECT).single();
  if (error) throw new Error(error.message);
  return data as Insight;
}

export async function updateInsight(client: Db, id: string, patch: InsightPatch): Promise<Insight | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await client
    .from('content_insights')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(INSIGHT_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Insight | null) ?? null;
}

/** Soft delete: status = 'archived'. Assets keep their insight_id. */
export async function archiveInsight(client: Db, id: string): Promise<Insight | null> {
  return updateInsight(client, id, { status: 'archived' });
}

export interface InsightLinkEdge {
  link: AssetLink;
  from: ResolvedAsset;
  to: ResolvedAsset;
}

export interface InsightAssets {
  /** content_pieces with insight_id = this insight. */
  pieces: ResolvedAsset[];
  /** social_posts with insight_id = this insight (platform from their targets). */
  socialPosts: ResolvedAsset[];
  /** content_asset_links edges tagged with this insight, both ends resolved. */
  links: InsightLinkEdge[];
  /** Source article (source_post_id), if any. */
  source: ResolvedAsset | null;
}

/** Every piece, social post and link edge carrying the insight, with titles, status and platform resolved. */
export async function assetsForInsight(client: Db, insightId: string): Promise<InsightAssets> {
  if (!isUuid(insightId)) return { pieces: [], socialPosts: [], links: [], source: null };
  const [pieceRows, postRows, linkRows, insightRows] = await Promise.all([
    client.from('content_pieces').select('id').eq('insight_id', insightId).limit(500),
    client.from('social_posts').select('id').eq('insight_id', insightId).limit(500),
    client.from('content_asset_links').select('id, from_kind, from_id, to_kind, to_id, direction, insight_id, note, created_at').eq('insight_id', insightId).limit(500),
    client.from('content_insights').select('source_post_id').eq('id', insightId).limit(1),
  ]);
  for (const r of [pieceRows, postRows, linkRows, insightRows]) if (r.error) throw new Error(r.error.message);

  const pieces = ((pieceRows.data ?? []) as { id: string }[]).map((p): AssetRef => ({ kind: 'piece', id: p.id }));
  const posts = ((postRows.data ?? []) as { id: string }[]).map((p): AssetRef => ({ kind: 'social_post', id: p.id }));
  const links = (linkRows.data ?? []) as AssetLink[];
  const sourcePostId = ((insightRows.data ?? []) as { source_post_id: string | null }[])[0]?.source_post_id ?? null;
  const sourceRef: AssetRef[] = sourcePostId ? [{ kind: 'article', id: sourcePostId }] : [];

  const linkRefs = links.flatMap((l): AssetRef[] => [{ kind: l.from_kind, id: l.from_id }, { kind: l.to_kind, id: l.to_id }]);
  const resolved = await resolveAssets(client, [...pieces, ...posts, ...sourceRef, ...linkRefs]);
  const byKey = new Map(resolved.map((a) => [`${a.kind}:${a.id}`, a]));
  const get = (r: AssetRef) => byKey.get(`${r.kind}:${r.id}`)!;

  return {
    pieces: pieces.map(get),
    socialPosts: posts.map(get),
    links: links.map((l) => ({ link: l, from: get({ kind: l.from_kind, id: l.from_id }), to: get({ kind: l.to_kind, id: l.to_id }) })),
    source: sourceRef.length ? get(sourceRef[0]) : null,
  };
}

/** Set (or clear) insight_id on a piece or social post. Returns false when the row doesn't exist. */
export async function setAssetInsight(client: Db, asset: AssetRef, insightId: string | null): Promise<boolean> {
  const table = asset.kind === 'piece' ? 'content_pieces' : asset.kind === 'social_post' ? 'social_posts' : null;
  if (!table) throw new Error('Only pieces and social posts carry an insight_id');
  if (!isUuid(asset.id)) return false;
  if (insightId !== null && !isUuid(insightId)) throw new Error('insightId must be a uuid');
  const { data, error } = await client.from(table).update({ insight_id: insightId }).eq('id', asset.id).select('id');
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length > 0;
}
