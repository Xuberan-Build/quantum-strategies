/**
 * Browser client for the insights and asset-graph API (/api/admin/content/insights/**, /links, /assets/**).
 */
import type { AssetLink, AssetRef, Insight, InsightSourceKind } from '@/lib/content/any-to-any/types';
import type { AssetGraph, ResolvedAsset } from '@/lib/content/any-to-any/graph';
import type { InsightAssets, InsightInput, InsightPatch } from '@/lib/content/any-to-any/insights';
import type { InsightCandidate } from '@/lib/content/any-to-any/extract';

export type { AssetGraph, ResolvedAsset, InsightAssets, InsightInput, InsightPatch, InsightCandidate };

export const SOURCE_KIND_LABELS: Record<InsightSourceKind, string> = {
  article: 'Article',
  vcap: 'VCAP workshop',
  reddit: 'Reddit',
  x: 'X',
  recording: 'Recording',
  video: 'Video',
  interview: 'Interview',
  other: 'Other',
};

/** content/architecture.md pillars; X = cross-pillar. */
export const PILLARS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'X'];
/** gtm/problem-solution-map.md clusters. */
export const CLUSTERS = Array.from({ length: 12 }, (_, i) => String(i + 1));

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export function listInsights(params: { q?: string; pillar?: string; sourceKind?: string; status?: string; postId?: string; limit?: number } = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  return call<{ insights: Insight[] }>(`/api/admin/content/insights?${sp}`).then((r) => r.insights);
}

export function getInsight(id: string) {
  return call<{ insight: Insight; assets: InsightAssets }>(`/api/admin/content/insights/${id}`);
}

export function createInsight(input: InsightInput) {
  return call<{ insight: Insight }>('/api/admin/content/insights', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.insight);
}

export function updateInsight(id: string, patch: InsightPatch) {
  return call<{ insight: Insight }>(`/api/admin/content/insights/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => r.insight);
}

export function archiveInsight(id: string) {
  return call<{ insight: Insight }>(`/api/admin/content/insights/${id}`, { method: 'DELETE' }).then((r) => r.insight);
}

export function extractFromArticle(postId: string) {
  return call<{ post: { id: string; slug: string; title: string }; candidates: InsightCandidate[] }>(
    '/api/admin/content/insights/extract', { method: 'POST', body: JSON.stringify({ postId }) },
  );
}

export function saveInsightsBulk(postId: string | null, insights: InsightInput[]) {
  return call<{ insights: Insight[] }>('/api/admin/content/insights/bulk', { method: 'POST', body: JSON.stringify({ postId, insights }) }).then((r) => r.insights);
}

export function linkAssets(input: { from: AssetRef; to: AssetRef; direction?: string; insightId?: string | null; note?: string | null }) {
  return call<{ link: AssetLink }>('/api/admin/content/links', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.link);
}

export function unlinkAssets(linkId: string) {
  return call<{ ok: true }>(`/api/admin/content/links/${linkId}`, { method: 'DELETE' });
}

export function getAssetGraph(ref: AssetRef) {
  return call<AssetGraph>(`/api/admin/content/assets/graph?kind=${encodeURIComponent(ref.kind)}&id=${encodeURIComponent(ref.id)}`);
}

export function setAssetInsight(asset: AssetRef, insightId: string | null) {
  return call<{ ok: true; insightId: string | null }>('/api/admin/content/assets/insight', { method: 'PATCH', body: JSON.stringify({ asset, insightId }) });
}

export interface ArticleOption { id: string; slug: string; title: string; published_at: string | null }

/** Published articles (content_posts) for the extract picker. */
export function listPublishedArticles() {
  return call<{ posts?: ArticleOption[] } | ArticleOption[]>('/api/admin/content?published=true').then((r) => (Array.isArray(r) ? r : r.posts ?? []));
}
