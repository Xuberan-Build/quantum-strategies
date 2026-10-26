/**
 * The /admin/brain/search report: Search Console numbers joined to the topical map.
 *
 * Pure builders (tested) plus loadSearchReport(), which reads the gsc_* tables and the map with the service
 * role. Periods are the last `days` days that have data, compared with the same-length window before them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PillarCode, TopicLevel, TopicNode } from '@/lib/brain/topical-map-types';
import { keywordKey } from './keyword-key';
import { buildPageTopicIndex, buildQueryTopicIndex, trackedHeadTerms } from './gsc-topics';

export interface QueryTotal {
  query: string;
  query_key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  top_page: string | null;
}

export interface PageTotal {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export interface InspectionLatest {
  url: string;
  inspected_at: string;
  verdict: string | null;
  coverage_state: string | null;
  indexing_state: string | null;
  last_crawl_time: string | null;
  google_canonical: string | null;
  user_canonical: string | null;
}

export interface SiteDay {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface Period {
  startDate: string;
  endDate: string;
}

export interface TopicRef {
  id: string;
  label: string;
  pillarCode: PillarCode;
  level: TopicLevel;
}

export interface KeywordRow {
  query: string;
  topic: TopicRef | null;
  /** how the topic was found: head_term | search_term | query (phrasing) or content_post (page) */
  match: string | null;
  /** Keyword Planner average monthly searches (US) for this exact phrasing, when the map has it */
  volume: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  /** previous period; null when the query had no impressions then */
  prevPosition: number | null;
  prevClicks: number;
  prevImpressions: number;
  page: string | null;
}

export interface HeadTermRow {
  topic: TopicRef;
  headTerm: string;
  volume: number;
  position: number | null;
  clicks: number;
  impressions: number;
  prevPosition: number | null;
}

export interface PageRow {
  page: string;
  topic: TopicRef | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  prevClicks: number;
  inspection: InspectionLatest | null;
}

export interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export interface SearchReport {
  configured: { siteUrl: string | null; credentials: boolean; indexNow: boolean };
  hasData: boolean;
  period: Period | null;
  previous: Period | null;
  totals: Totals;
  prevTotals: Totals;
  daily: SiteDay[];
  index: { inspected: number; indexed: number; notIndexed: number; lastInspected: string | null; states: { state: string; count: number }[] };
  keywords: KeywordRow[];
  headTerms: HeadTermRow[];
  pages: PageRow[];
  pillars: PillarCode[];
  lastFetched: string | null;
}

const ref = (n: TopicNode): TopicRef => ({ id: n.id, label: n.label, pillarCode: n.pillarCode, level: n.level });

export function totalsOf(days: SiteDay[]): Totals {
  const clicks = days.reduce((s, d) => s + d.clicks, 0);
  const impressions = days.reduce((s, d) => s + d.impressions, 0);
  const posW = days.reduce((s, d) => s + d.position * d.impressions, 0);
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? posW / impressions : null };
}

/** Keyword Planner volume per phrasing key, from the map's queries and search terms. */
export function volumeIndex(nodes: TopicNode[]): Map<string, number> {
  const out = new Map<string, number>();
  const put = (text: string | undefined, v: number | null | undefined) => {
    if (!text || typeof v !== 'number') return;
    const k = keywordKey(text);
    out.set(k, Math.max(out.get(k) ?? 0, v));
  };
  for (const n of nodes) {
    for (const q of n.queries ?? []) put(q.text, q.volume);
    for (const t of n.searchTerms ?? []) put(t.keyword, t.volume);
    if (n.headTerm) put(n.headTerm.text, n.headTerm.volume);
  }
  return out;
}

export function buildKeywordRows(current: QueryTotal[], previous: QueryTotal[], nodes: TopicNode[]): KeywordRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const qIdx = buildQueryTopicIndex(nodes);
  const pIdx = buildPageTopicIndex(nodes);
  const vol = volumeIndex(nodes);
  const prev = new Map(previous.map((p) => [p.query, p]));
  return current.map((c) => {
    const qm = qIdx.get(c.query_key);
    const pm = !qm && c.top_page ? pIdx.get(c.top_page) : undefined;
    const t = qm ? byId.get(qm.topicId) : pm ? byId.get(pm.topicId) : undefined;
    const p = prev.get(c.query);
    return {
      query: c.query,
      topic: t ? ref(t) : null,
      match: qm?.match ?? pm?.match ?? null,
      volume: vol.get(c.query_key) ?? null,
      clicks: c.clicks,
      impressions: c.impressions,
      ctr: c.ctr,
      position: c.position,
      prevPosition: p && p.impressions > 0 ? p.position : null,
      prevClicks: p?.clicks ?? 0,
      prevImpressions: p?.impressions ?? 0,
      page: c.top_page,
    };
  });
}

/** Every topic's head term with where it ranks now, or null position when it is not ranking yet. */
export function buildHeadTermRows(nodes: TopicNode[], current: QueryTotal[], previous: QueryTotal[]): HeadTermRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const agg = (rows: QueryTotal[]) => {
    const m = new Map<string, { clicks: number; impressions: number; posW: number }>();
    for (const r of rows) {
      const a = m.get(r.query_key) ?? { clicks: 0, impressions: 0, posW: 0 };
      a.clicks += r.clicks;
      a.impressions += r.impressions;
      a.posW += (r.position ?? 0) * r.impressions;
      m.set(r.query_key, a);
    }
    return m;
  };
  const cur = agg(current);
  const prev = agg(previous);
  return trackedHeadTerms(nodes).map((h) => {
    const c = cur.get(h.key);
    const p = prev.get(h.key);
    return {
      topic: ref(byId.get(h.topicId)!),
      headTerm: h.headTerm,
      volume: h.volume,
      position: c && c.impressions > 0 ? c.posW / c.impressions : null,
      clicks: c?.clicks ?? 0,
      impressions: c?.impressions ?? 0,
      prevPosition: p && p.impressions > 0 ? p.posW / p.impressions : null,
    };
  });
}

export function buildPageRows(current: PageTotal[], previous: PageTotal[], inspections: InspectionLatest[], nodes: TopicNode[], sitemap: string[] = []): PageRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pIdx = buildPageTopicIndex(nodes);
  const prev = new Map(previous.map((p) => [p.page, p]));
  const ins = new Map(inspections.map((i) => [i.url, i]));
  const rows: PageRow[] = current.map((c) => {
    const t = pIdx.get(c.page);
    const node = t ? byId.get(t.topicId) : undefined;
    return { page: c.page, topic: node ? ref(node) : null, clicks: c.clicks, impressions: c.impressions, ctr: c.ctr, position: c.position, prevClicks: prev.get(c.page)?.clicks ?? 0, inspection: ins.get(c.page) ?? null };
  });
  // pages Google inspected, or the sitemap lists, that earned no impressions this period still belong in the table
  const seen = new Set(rows.map((r) => r.page));
  for (const url of [...inspections.map((i) => i.url), ...sitemap]) {
    if (seen.has(url)) continue;
    seen.add(url);
    const t = pIdx.get(url);
    const node = t ? byId.get(t.topicId) : undefined;
    rows.push({ page: url, topic: node ? ref(node) : null, clicks: 0, impressions: 0, ctr: 0, position: null, prevClicks: prev.get(url)?.clicks ?? 0, inspection: ins.get(url) ?? null });
  }
  return rows;
}

export function indexSummary(inspections: InspectionLatest[]): SearchReport['index'] {
  const states = new Map<string, number>();
  let last: string | null = null;
  for (const i of inspections) {
    const s = i.coverage_state ?? i.verdict ?? 'Unknown';
    states.set(s, (states.get(s) ?? 0) + 1);
    if (!last || i.inspected_at > last) last = i.inspected_at;
  }
  const indexed = inspections.filter((i) => i.verdict === 'PASS').length;
  return {
    inspected: inspections.length,
    indexed,
    notIndexed: inspections.length - indexed,
    lastInspected: last,
    states: [...states].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Loader (service role)
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const shift = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : 0);
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : num(v));

async function rpcRows<T>(sb: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (data ?? []) as T[];
}

function toQueryTotals(rows: Record<string, unknown>[]): QueryTotal[] {
  return rows.map((r) => ({ query: String(r.query), query_key: String(r.query_key ?? ''), clicks: num(r.clicks), impressions: num(r.impressions), ctr: num(r.ctr), position: numOrNull(r.avg_position), top_page: (r.top_page as string) ?? null }));
}
function toPageTotals(rows: Record<string, unknown>[]): PageTotal[] {
  return rows.map((r) => ({ page: String(r.page), clicks: num(r.clicks), impressions: num(r.impressions), ctr: num(r.ctr), position: numOrNull(r.avg_position) }));
}

export async function loadSearchReport(opts: { client?: SupabaseClient; days?: number; env?: Record<string, string | undefined> } = {}): Promise<SearchReport> {
  const env = opts.env ?? process.env;
  const sb = opts.client ?? (await import('@/lib/supabase/server')).supabaseAdmin;
  const days = opts.days ?? 28;
  const { gscConfigFromEnv } = await import('./gsc');
  const { indexNowKey } = await import('./indexnow');
  const cfg = gscConfigFromEnv(env);
  const configured = { siteUrl: cfg.siteUrl, credentials: !!cfg.credentials, indexNow: !!indexNowKey(env) };

  const { getTopicalMap } = await import('@/lib/brain/topical-map');
  const nodes = await getTopicalMap({ client: sb })
    .then((m) => m.nodes)
    .catch(() => [] as TopicNode[]);
  const pillars = [...new Set(nodes.map((n) => n.pillarCode))].sort();

  const empty: SearchReport = {
    configured,
    hasData: false,
    period: null,
    previous: null,
    totals: { clicks: 0, impressions: 0, ctr: 0, position: null },
    prevTotals: { clicks: 0, impressions: 0, ctr: 0, position: null },
    daily: [],
    index: indexSummary([]),
    keywords: [],
    headTerms: buildHeadTermRows(nodes, [], []),
    pages: [],
    pillars,
    lastFetched: null,
  };

  const latest = await sb.from('gsc_search_analytics').select('date,fetched_at').eq('grain', 'site').order('date', { ascending: false }).limit(1);
  if (latest.error) throw new Error(`gsc_search_analytics: ${latest.error.message}`);
  const top = (latest.data ?? [])[0] as { date: string; fetched_at: string } | undefined;

  const insRes = await sb.from('gsc_url_inspection_latest').select('url,inspected_at,verdict,coverage_state,indexing_state,last_crawl_time,google_canonical,user_canonical').limit(5000);
  if (insRes.error) throw new Error(`gsc_url_inspection_latest: ${insRes.error.message}`);
  const inspections = (insRes.data ?? []) as InspectionLatest[];

  if (!top) return { ...empty, index: indexSummary(inspections), pages: buildPageRows([], [], inspections, nodes) };

  const period = { startDate: shift(top.date, -(days - 1)), endDate: top.date };
  const previous = { startDate: shift(period.startDate, -days), endDate: shift(period.startDate, -1) };

  const siteRes = await sb.from('gsc_search_analytics').select('date,clicks,impressions,position').eq('grain', 'site').gte('date', previous.startDate).lte('date', period.endDate).order('date', { ascending: true });
  if (siteRes.error) throw new Error(`gsc_search_analytics: ${siteRes.error.message}`);
  const site = ((siteRes.data ?? []) as Record<string, unknown>[]).map((r) => ({ date: String(r.date), clicks: num(r.clicks), impressions: num(r.impressions), position: num(r.position) }));
  const daily = site.filter((d) => d.date >= period.startDate);
  const prevDays = site.filter((d) => d.date < period.startDate);

  const [qCur, qPrev, pCur, pPrev] = await Promise.all([
    rpcRows<Record<string, unknown>>(sb, 'gsc_query_totals', { p_start: period.startDate, p_end: period.endDate, p_limit: 5000 }).then(toQueryTotals),
    rpcRows<Record<string, unknown>>(sb, 'gsc_query_totals', { p_start: previous.startDate, p_end: previous.endDate, p_limit: 5000 }).then(toQueryTotals),
    rpcRows<Record<string, unknown>>(sb, 'gsc_page_totals', { p_start: period.startDate, p_end: period.endDate }).then(toPageTotals),
    rpcRows<Record<string, unknown>>(sb, 'gsc_page_totals', { p_start: previous.startDate, p_end: previous.endDate }).then(toPageTotals),
  ]);

  return {
    ...empty,
    hasData: true,
    period,
    previous,
    totals: totalsOf(daily),
    prevTotals: totalsOf(prevDays),
    daily,
    index: indexSummary(inspections),
    keywords: buildKeywordRows(qCur, qPrev, nodes),
    headTerms: buildHeadTermRows(nodes, qCur, qPrev),
    pages: buildPageRows(pCur, pPrev, inspections, nodes),
    lastFetched: top.fetched_at,
  };
}

/** Search performance for one topic (the topical map panel). */
export interface TopicSearchPerformance {
  period: Period | null;
  headTerm: { text: string; volume: number; position: number | null; clicks: number; impressions: number } | null;
  clicks: number;
  impressions: number;
  position: number | null;
  topQueries: { query: string; clicks: number; impressions: number; position: number | null }[];
}

export async function loadTopicSearchPerformance(topicId: string, opts: { client?: SupabaseClient; days?: number } = {}): Promise<TopicSearchPerformance> {
  const sb = opts.client ?? (await import('@/lib/supabase/server')).supabaseAdmin;
  const days = opts.days ?? 28;
  const { getTopicalMap } = await import('@/lib/brain/topical-map');
  const nodes = (await getTopicalMap({ client: sb })).nodes;
  const node = nodes.find((n) => n.id === topicId);
  const head = node?.headTerm?.text ? { text: node.headTerm.text, volume: node.headTerm.volume ?? 0 } : null;
  const none: TopicSearchPerformance = { period: null, headTerm: head ? { ...head, position: null, clicks: 0, impressions: 0 } : null, clicks: 0, impressions: 0, position: null, topQueries: [] };

  const latest = await sb.from('gsc_search_analytics').select('date').eq('grain', 'site').order('date', { ascending: false }).limit(1);
  if (latest.error) throw new Error(`gsc_search_analytics: ${latest.error.message}`);
  const top = (latest.data ?? [])[0] as { date: string } | undefined;
  if (!top) return none;
  const period = { startDate: shift(top.date, -(days - 1)), endDate: top.date };

  const [totals, queries] = await Promise.all([
    rpcRows<Record<string, unknown>>(sb, 'gsc_topic_totals', { p_start: period.startDate, p_end: period.endDate }),
    rpcRows<Record<string, unknown>>(sb, 'gsc_query_totals', { p_start: period.startDate, p_end: period.endDate, p_limit: 5000 }).then(toQueryTotals),
  ]);
  const t = totals.find((r) => r.topic_id === topicId);
  const rows = buildKeywordRows(queries, [], nodes).filter((r) => r.topic?.id === topicId);
  const headKey = head ? keywordKey(head.text) : null;
  const hq = headKey ? queries.filter((q) => q.query_key === headKey) : [];
  const hImp = hq.reduce((s, q) => s + q.impressions, 0);
  return {
    period,
    headTerm: head ? { ...head, clicks: hq.reduce((s, q) => s + q.clicks, 0), impressions: hImp, position: hImp ? hq.reduce((s, q) => s + (q.position ?? 0) * q.impressions, 0) / hImp : null } : null,
    clicks: num(t?.clicks),
    impressions: num(t?.impressions),
    position: t ? numOrNull(t.avg_position) : null,
    topQueries: rows.sort((a, b) => b.impressions - a.impressions).slice(0, 5).map((r) => ({ query: r.query, clicks: r.clicks, impressions: r.impressions, position: r.position })),
  };
}
