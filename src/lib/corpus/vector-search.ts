// Shared vector search helper — used by deep-research and agent routes.
// Supabase JS client mis-serializes vector arrays in the Next.js App Router context
// (returns 200 with []) — use direct REST calls for the vector RPC.
import type { CorpusTier } from './evidence';

export interface VectorHit {
  id: string;
  similarity?: number;
  rank?: number;
  tradition?: string;
  text_name?: string;
  author?: string;
  section?: string;
  chapter?: string;
  content?: string;
  themes?: string[];
  source_url?: string;
  priority?: string;
  tier?: string;
  [key: string]: unknown;
}

const restHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
});

/**
 * Vector search via match_knowledge. `tiers` (optional) restricts results to those
 * epistemic tiers (filter_tiers). Omitted or empty = all tiers, the original behaviour
 * and the original request body.
 */
export async function vectorSearch(
  embedding: number[],
  threshold: number,
  count: number,
  tradition: string | null,
  tiers?: readonly CorpusTier[] | null
): Promise<VectorHit[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/match_knowledge`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: count,
      filter_tradition: tradition,
      filter_priority: null,
      filter_themes: null,
      ...(tiers?.length ? { filter_tiers: tiers } : {}),
    }),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  const hits: VectorHit[] = Array.isArray(data) ? data : [];
  // Belt and braces: the RPC already filtered, but never let a wrong tier through.
  return tiers?.length ? hits.filter((h) => typeof h.tier !== 'string' || tiers.includes(h.tier as CorpusTier)) : hits;
}

/**
 * Restrict hits from sources that can't filter by tier themselves (the keyword RPC,
 * theme lookups) to the given tiers. Looks up the tier of any hit that doesn't carry one.
 * No tiers = hits returned unchanged. Fails closed: if the lookup fails, hits whose tier
 * is unknown are dropped rather than risk passing a non-evidence tier off as a source.
 */
export async function filterHitsByTier<T extends { id: string; tier?: unknown }>(
  hits: T[],
  tiers?: readonly CorpusTier[] | null
): Promise<T[]> {
  if (!tiers?.length || hits.length === 0) return hits;
  const tierById = new Map<string, string>();
  for (const h of hits) if (typeof h.tier === 'string') tierById.set(h.id, h.tier);
  const unknown = [...new Set(hits.filter((h) => !tierById.has(h.id)).map((h) => h.id))];
  if (unknown.length > 0) {
    try {
      const ids = unknown.map((id) => encodeURIComponent(id)).join(',');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/knowledge_chunks?select=id,tier&id=in.(${ids})`,
        { headers: restHeaders(), cache: 'no-store' }
      );
      if (!res.ok) throw new Error(`tier lookup ${res.status}`);
      for (const row of (await res.json()) as { id: string; tier: string }[]) tierById.set(row.id, row.tier);
    } catch (err) {
      console.warn('[filterHitsByTier] tier lookup failed; dropping hits with unknown tier', err);
    }
  }
  return hits
    .filter((h) => tiers.includes(tierById.get(h.id) as CorpusTier))
    .map((h) => ({ ...h, tier: tierById.get(h.id) }));
}
