/**
 * Search Console sync: pull search analytics into gsc_search_analytics, refresh the query/page -> topic maps,
 * and inspect a rotating slice of sitemap URLs. Used by scripts/seo/gsc-sync.ts (backfill or daily, local)
 * and /api/cron/gsc-sync (daily on Vercel).
 *
 * SERVER ONLY, service role.
 *
 * Daily mode re-fetches the last `days` complete days (default 5): Google revises recent days, and the upsert
 * on (date, query, page, country, device) makes the re-fetch idempotent. Backfill walks `months` back (max 16)
 * in 30-day windows.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTopicalMap } from '@/lib/brain/topical-map';
import type { TopicNode } from '@/lib/brain/topical-map-types';
import {
  addDays,
  backfillStart,
  dateWindows,
  fetchGrain,
  inspectUrls,
  lastCompleteDay,
  normalizePage,
  parseSitemapXml,
  pickUrlsToInspect,
  type GscApi,
  type GscGrain,
  type GscRow,
} from './gsc';
import { buildPageTopicIndex, buildQueryTopicIndex, SITE_ORIGIN, type QueryEdge } from './gsc-topics';

export interface GscSyncOptions {
  client: SupabaseClient;
  api: GscApi;
  siteUrl: string;
  mode: 'daily' | 'backfill';
  /** daily: how many complete days to (re)fetch, default 5 */
  days?: number;
  /** backfill: months back, default and max 16 */
  months?: number;
  /** URL inspections this run (0 to skip). Default 100. Daily quota is 2,000 per property. */
  inspectBudget?: number;
  extraDimensions?: ('country' | 'device')[];
  /** resubmit SITE_ORIGIN/sitemap.xml first (default true; skipped on dryRun or when the api cannot) */
  submitSitemap?: boolean;
  /** fetch and count, write nothing */
  dryRun?: boolean;
  now?: Date;
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
}

export interface GscSyncResult {
  startDate: string;
  endDate: string;
  rows: Record<GscGrain, number>;
  upserted: number;
  topics: { queries: number; pages: number };
  inspection: { attempted: number; saved: number; indexed: number; errors: number; stoppedOnQuota: boolean };
  sitemapSubmitted: boolean;
}

const CHUNK = 1000;

async function upsertRows(sb: SupabaseClient, rows: GscRow[]): Promise<number> {
  let n = 0;
  const fetchedAt = new Date().toISOString();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, fetched_at: fetchedAt }));
    const { error } = await sb.from('gsc_search_analytics').upsert(chunk, { onConflict: 'date,query,page,country,device' });
    if (error) throw new Error(`gsc_search_analytics upsert: ${error.message}`);
    n += chunk.length;
  }
  return n;
}

/** query:<slug> nodes linked to topics by asks_about edges, as phrasing -> topic pairs. */
async function queryEdges(sb: SupabaseClient): Promise<QueryEdge[]> {
  const edges: { src: string; dst: string }[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await sb.from('kg_edges').select('src,dst').eq('type', 'asks_about').order('id', { ascending: true }).range(from, from + CHUNK - 1);
    if (error) throw new Error(`kg_edges: ${error.message}`);
    edges.push(...((data ?? []) as { src: string; dst: string }[]));
    if ((data ?? []).length < CHUNK) break;
  }
  const qIds = [...new Set(edges.filter((e) => e.src.startsWith('query:') && e.dst.startsWith('topic:')).map((e) => e.src))];
  const text = new Map<string, string>();
  for (let i = 0; i < qIds.length; i += 200) {
    const { data, error } = await sb.from('kg_nodes').select('id,label,props').in('id', qIds.slice(i, i + 200));
    if (error) throw new Error(`kg_nodes: ${error.message}`);
    for (const r of (data ?? []) as { id: string; label: string; props: Record<string, unknown> | null }[]) {
      text.set(r.id, typeof r.props?.text === 'string' ? (r.props.text as string) : r.label);
    }
  }
  return edges.filter((e) => text.has(e.src) && e.dst.startsWith('topic:')).map((e) => ({ text: text.get(e.src)!, topicId: e.dst }));
}

/** Rewrite gsc_query_topics and gsc_page_topics from the current topical map. */
export async function refreshTopicMaps(sb: SupabaseClient, nodes?: TopicNode[], edges?: QueryEdge[]): Promise<{ queries: number; pages: number }> {
  const topicNodes = nodes ?? (await getTopicalMap({ client: sb })).nodes;
  const qEdges = edges ?? (await queryEdges(sb));
  const q = buildQueryTopicIndex(topicNodes, qEdges);
  const p = buildPageTopicIndex(topicNodes);
  const stamp = new Date().toISOString();
  const qRows = [...q].map(([query_key, m]) => ({ query_key, topic_id: m.topicId, match: m.match, updated_at: stamp }));
  const pRows = [...p].map(([page, m]) => ({ page, topic_id: m.topicId, match: m.match, updated_at: stamp }));
  for (let i = 0; i < qRows.length; i += CHUNK) {
    const { error } = await sb.from('gsc_query_topics').upsert(qRows.slice(i, i + CHUNK), { onConflict: 'query_key' });
    if (error) throw new Error(`gsc_query_topics: ${error.message}`);
  }
  for (let i = 0; i < pRows.length; i += CHUNK) {
    const { error } = await sb.from('gsc_page_topics').upsert(pRows.slice(i, i + CHUNK), { onConflict: 'page' });
    if (error) throw new Error(`gsc_page_topics: ${error.message}`);
  }
  // phrasings that left the map
  if (qRows.length) await sb.from('gsc_query_topics').delete().lt('updated_at', stamp);
  if (pRows.length) await sb.from('gsc_page_topics').delete().lt('updated_at', stamp);
  return { queries: qRows.length, pages: pRows.length };
}

export async function sitemapUrls(fetchImpl: typeof fetch = fetch, origin = SITE_ORIGIN): Promise<{ url: string; lastModified: string | null }[]> {
  const res = await fetchImpl(`${origin}/sitemap.xml`, { headers: { 'User-Agent': 'qs-gsc-sync' } });
  if (!res.ok) throw new Error(`sitemap.xml: HTTP ${res.status}`);
  return parseSitemapXml(await res.text());
}

async function lastInspections(sb: SupabaseClient): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await sb.from('gsc_url_inspection_latest').select('url,inspected_at').order('url', { ascending: true }).range(from, from + CHUNK - 1);
    if (error) throw new Error(`gsc_url_inspection_latest: ${error.message}`);
    for (const r of (data ?? []) as { url: string; inspected_at: string }[]) out.set(r.url, r.inspected_at);
    if ((data ?? []).length < CHUNK) break;
  }
  return out;
}

export async function runGscSync(o: GscSyncOptions): Promise<GscSyncResult> {
  const log = o.log ?? (() => {});
  const sb = o.client;
  const endDate = lastCompleteDay(o.now);
  const startDate = o.mode === 'backfill' ? backfillStart(endDate, o.months) : addDays(endDate, -(Math.max(1, o.days ?? 5) - 1));
  const result: GscSyncResult = {
    startDate,
    endDate,
    rows: { site: 0, page: 0, query: 0 },
    upserted: 0,
    topics: { queries: 0, pages: 0 },
    inspection: { attempted: 0, saved: 0, indexed: 0, errors: 0, stoppedOnQuota: false },
    sitemapSubmitted: false,
  };

  // A failed submit is logged, not thrown: it must not block the analytics and inspection below.
  if ((o.submitSitemap ?? true) && !o.dryRun && o.api.submitSitemap) {
    try {
      await o.api.submitSitemap(o.siteUrl, `${SITE_ORIGIN}/sitemap.xml`);
      result.sitemapSubmitted = true;
      log('sitemap submitted');
    } catch (err) {
      log(`sitemap submit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const w of dateWindows(startDate, endDate, 30)) {
    for (const grain of ['site', 'page', 'query'] as GscGrain[]) {
      const rows = await fetchGrain(o.api, o.siteUrl, grain, { ...w, extraDimensions: o.extraDimensions });
      result.rows[grain] += rows.length;
      if (!o.dryRun && rows.length) result.upserted += await upsertRows(sb, rows);
      log(`${w.startDate}..${w.endDate} ${grain}: ${rows.length} rows`);
    }
  }

  if (!o.dryRun) {
    result.topics = await refreshTopicMaps(sb);
    log(`topic map: ${result.topics.queries} phrasings, ${result.topics.pages} pages`);
  }

  const budget = o.inspectBudget ?? 100;
  if (budget > 0) {
    const urls = (await sitemapUrls(o.fetchImpl)).map((u) => normalizePage(u.url));
    const last = await lastInspections(sb);
    const pick = pickUrlsToInspect(urls, last, budget, { now: o.now });
    result.inspection.attempted = pick.length;
    if (pick.length) {
      const ins = await inspectUrls(o.api, o.siteUrl, pick);
      result.inspection.errors = ins.errors.length;
      result.inspection.stoppedOnQuota = ins.stoppedOnQuota;
      result.inspection.indexed = ins.rows.filter((r) => r.verdict === 'PASS').length;
      if (ins.errors.length) log(`inspection errors: ${ins.errors.slice(0, 3).map((e) => `${e.url}: ${e.message}`).join('; ')}`);
      if (!o.dryRun && ins.rows.length) {
        const { error } = await sb.from('gsc_url_inspection').insert(ins.rows);
        if (error) throw new Error(`gsc_url_inspection insert: ${error.message}`);
        result.inspection.saved = ins.rows.length;
      }
    }
    log(`inspected ${result.inspection.saved || result.inspection.attempted} of ${urls.length} sitemap URLs`);
  }
  return result;
}
