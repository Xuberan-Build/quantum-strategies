/**
 * Google Search Console client: search analytics (clicks, impressions, position) and URL Inspection.
 *
 * SERVER ONLY. Auth is a service account (JWT, scope webmasters). The service account's client_email
 * must be added as a user on the Search Console property (Settings > Users and permissions) with Full permission:
 * Restricted can read reports and inspect URLs but cannot submit sitemaps.
 *
 * Env:
 *   GSC_SITE_URL       the property, exactly as Search Console names it:
 *                        Domain property      "sc-domain:quantumstrategies.online"
 *                        URL-prefix property  "https://quantumstrategies.online/"
 *   GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY   service account (falls back to GOOGLE_CRM_CLIENT_EMAIL / _PRIVATE_KEY,
 *                        the quantum-aigent project, which has the Search Console API enabled)
 *   GSC_SERVICE_ACCOUNT_FILE             local alternative: path to the key JSON
 *
 * The API pieces sit behind GscApi so the pagination, date and parsing logic is tested with a fake.
 *
 * Data facts this module encodes:
 *  - Search analytics lags 2 to 3 days and dates are Pacific time. lastCompleteDay() is "today in PT minus 3".
 *  - Google keeps 16 months. backfillStart() clamps to that.
 *  - One request returns at most 25,000 rows; page with startRow until a short page comes back.
 *  - Queries Google anonymises are left out of query-level rows, so site and page totals come from separate
 *    fetches without the query dimension (grain 'site' and 'page').
 *  - URL Inspection is 2,000 calls a day and 600 a minute per property. inspectUrls() stops at the first quota
 *    error rather than burning retries.
 */
import { keywordKey } from './keyword-key';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/seo/gsc.ts is server-only');
}

export type GscDimension = 'date' | 'query' | 'page' | 'country' | 'device';
export type GscGrain = 'site' | 'page' | 'query';

export interface GscQueryRequest {
  startDate: string;
  endDate: string;
  dimensions: GscDimension[];
  rowLimit?: number;
  startRow?: number;
  type?: 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';
  dataState?: 'final' | 'all';
  aggregationType?: 'auto' | 'byPage' | 'byProperty';
}

export interface GscApiRow {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
}

export interface GscInspectionResponse {
  inspectionResult?: {
    inspectionResultLink?: string | null;
    indexStatusResult?: {
      verdict?: string | null;
      coverageState?: string | null;
      indexingState?: string | null;
      pageFetchState?: string | null;
      robotsTxtState?: string | null;
      lastCrawlTime?: string | null;
      googleCanonical?: string | null;
      userCanonical?: string | null;
      [k: string]: unknown;
    } | null;
    [k: string]: unknown;
  } | null;
}

/** The Search Console calls this module needs. createGscApi() wraps googleapis; tests pass a fake. */
export interface GscApi {
  query(siteUrl: string, body: GscQueryRequest): Promise<{ rows?: GscApiRow[] | null }>;
  inspect(siteUrl: string, inspectionUrl: string): Promise<GscInspectionResponse>;
  /** (Re)submit a sitemap. Needs Full permission on the property, not Restricted. */
  submitSitemap?(siteUrl: string, feedpath: string): Promise<void>;
}

export interface GscCredentials {
  clientEmail: string;
  privateKey: string;
}

export interface GscEnvConfig {
  siteUrl: string | null;
  credentials: GscCredentials | null;
  /** which env vars the credentials came from (names only, never values) */
  credentialSource: string | null;
}

/** Full scope (not .readonly) because the daily sync resubmits the sitemap. */
export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters';
export const MAX_ROW_LIMIT = 25000;
export const MAX_MONTHS = 16;
/** Days between a date and its data being final in Search Console. */
export const DEFAULT_LAG_DAYS = 3;
export const INSPECTION_DAILY_QUOTA = 2000;

/** "sc-domain:example.com" or an http(s) URL-prefix ending in "/". */
export function isValidSiteUrl(v: string | null | undefined): v is string {
  if (!v) return false;
  if (/^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return true;
  return /^https?:\/\/[^/\s]+\/(\S*\/)?$/i.test(v);
}

export function gscConfigFromEnv(env: Record<string, string | undefined> = process.env, readFile?: (p: string) => string): GscEnvConfig {
  const siteUrl = isValidSiteUrl(env.GSC_SITE_URL?.trim()) ? env.GSC_SITE_URL!.trim() : null;
  const fix = (k: string) => (k.includes('\\n') ? k.replace(/\\n/g, '\n') : k);
  let credentials: GscCredentials | null = null;
  let credentialSource: string | null = null;
  if (env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY) {
    credentials = { clientEmail: env.GSC_CLIENT_EMAIL, privateKey: fix(env.GSC_PRIVATE_KEY) };
    credentialSource = 'GSC_CLIENT_EMAIL/GSC_PRIVATE_KEY';
  } else if (env.GSC_SERVICE_ACCOUNT_FILE && readFile) {
    const json = JSON.parse(readFile(env.GSC_SERVICE_ACCOUNT_FILE)) as { client_email?: string; private_key?: string };
    if (json.client_email && json.private_key) {
      credentials = { clientEmail: json.client_email, privateKey: json.private_key };
      credentialSource = 'GSC_SERVICE_ACCOUNT_FILE';
    }
  } else if (env.GOOGLE_CRM_CLIENT_EMAIL && env.GOOGLE_CRM_PRIVATE_KEY) {
    credentials = { clientEmail: env.GOOGLE_CRM_CLIENT_EMAIL, privateKey: fix(env.GOOGLE_CRM_PRIVATE_KEY) };
    credentialSource = 'GOOGLE_CRM_CLIENT_EMAIL/GOOGLE_CRM_PRIVATE_KEY';
  }
  return { siteUrl, credentials, credentialSource };
}

/** googleapis-backed GscApi. Imported lazily so tests and the client bundle never load googleapis. */
export async function createGscApi(credentials: GscCredentials): Promise<GscApi> {
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({ email: credentials.clientEmail, key: credentials.privateKey, scopes: [GSC_SCOPE] });
  const sc = google.searchconsole({ version: 'v1', auth });
  return {
    async query(siteUrl, body) {
      const res = await sc.searchanalytics.query({ siteUrl, requestBody: body });
      return { rows: (res.data.rows ?? []) as GscApiRow[] };
    },
    async inspect(siteUrl, inspectionUrl) {
      const res = await sc.urlInspection.index.inspect({ requestBody: { siteUrl, inspectionUrl } });
      return res.data as GscInspectionResponse;
    },
    async submitSitemap(siteUrl, feedpath) {
      await sc.sitemaps.submit({ siteUrl, feedpath });
    },
  };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);

export function addDays(day: string, n: number): string {
  return iso(new Date(parseDay(day).getTime() + n * DAY));
}

/** Calendar date in America/Los_Angeles (Search Console's day boundary). */
export function pacificDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The newest day whose data is final: today in PT minus lagDays. */
export function lastCompleteDay(now: Date = new Date(), lagDays = DEFAULT_LAG_DAYS): string {
  return addDays(pacificDate(now), -Math.max(0, lagDays));
}

/** First day of a backfill ending at endDate: `months` back (capped at 16, Google's retention), plus one day. */
export function backfillStart(endDate: string, months = MAX_MONTHS): string {
  const m = Math.max(1, Math.min(MAX_MONTHS, Math.floor(months)));
  const d = parseDay(endDate);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - m, d.getUTCDate()));
  return addDays(iso(start), 1);
}

/** Split [start, end] into windows of at most `days` days (oldest first), so a backfill is many small requests. */
export function dateWindows(startDate: string, endDate: string, days = 30): { startDate: string; endDate: string }[] {
  const out: { startDate: string; endDate: string }[] = [];
  if (startDate > endDate) return out;
  for (let s = startDate; s <= endDate; s = addDays(s, days)) {
    const e = addDays(s, days - 1);
    out.push({ startDate: s, endDate: e < endDate ? e : endDate });
  }
  return out;
}

/** The same-length window immediately before [start, end]. */
export function previousPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const len = Math.round((parseDay(endDate).getTime() - parseDay(startDate).getTime()) / DAY) + 1;
  return { startDate: addDays(startDate, -len), endDate: addDays(startDate, -1) };
}

// ---------------------------------------------------------------------------
// Search analytics
// ---------------------------------------------------------------------------

/** Every row for a request, paging with startRow until a short page. maxPages guards a runaway loop. */
export async function fetchAllRows(api: GscApi, siteUrl: string, req: GscQueryRequest, opts: { maxPages?: number } = {}): Promise<GscApiRow[]> {
  const rowLimit = Math.min(MAX_ROW_LIMIT, Math.max(1, req.rowLimit ?? MAX_ROW_LIMIT));
  const maxPages = opts.maxPages ?? 40;
  const out: GscApiRow[] = [];
  for (let page = 0, startRow = req.startRow ?? 0; page < maxPages; page++, startRow += rowLimit) {
    const res = await api.query(siteUrl, { type: 'web', dataState: 'final', ...req, rowLimit, startRow });
    const rows = res.rows ?? [];
    out.push(...rows);
    if (rows.length < rowLimit) break;
  }
  return out;
}

/** gsc_search_analytics row shape. Dimensions not requested are ''. */
export interface GscRow {
  date: string;
  grain: GscGrain;
  query: string;
  query_key: string;
  page: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Normalise a page URL so the same page under http/https, www/non-www or with a query string lands on one key:
 * https, lowercase host without "www.", no query or fragment, trailing slash on paths without a file extension
 * (the site runs trailingSlash: true).
 */
export function normalizePage(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let path = u.pathname || '/';
    const last = path.slice(path.lastIndexOf('/') + 1);
    if (!path.endsWith('/') && !last.includes('.')) path = `${path}/`;
    return `https://${host}${path}`;
  } catch {
    return url;
  }
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** API rows -> table rows. Merges rows that collapse onto the same key after page normalisation. */
export function toGscRows(rows: GscApiRow[], dimensions: GscDimension[], grain: GscGrain): GscRow[] {
  const idx = (d: GscDimension) => dimensions.indexOf(d);
  const pick = (r: GscApiRow, d: GscDimension) => (idx(d) >= 0 ? (r.keys?.[idx(d)] ?? '') : '');
  const merged = new Map<string, GscRow & { posW: number }>();
  for (const r of rows) {
    const date = pick(r, 'date');
    if (!date) continue;
    const query = pick(r, 'query');
    const page = normalizePage(pick(r, 'page'));
    const country = pick(r, 'country').toLowerCase();
    const device = pick(r, 'device').toUpperCase();
    const key = [date, query, page, country, device].join('\u0001');
    const imp = n(r.impressions);
    const prev = merged.get(key);
    if (prev) {
      prev.clicks += n(r.clicks);
      prev.impressions += imp;
      prev.posW += n(r.position) * imp;
    } else {
      merged.set(key, { date, grain, query, query_key: query ? keywordKey(query) : '', page, country, device, clicks: n(r.clicks), impressions: imp, ctr: 0, position: n(r.position), posW: n(r.position) * imp });
    }
  }
  return [...merged.values()].map(({ posW, ...row }) => ({
    ...row,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    position: row.impressions > 0 ? posW / row.impressions : row.position,
  }));
}

export interface FetchGrainsOptions {
  startDate: string;
  endDate: string;
  /** add these dimensions to the query grain (each multiplies the row count) */
  extraDimensions?: ('country' | 'device')[];
  maxPages?: number;
}

export const GRAIN_DIMENSIONS: Record<GscGrain, GscDimension[]> = {
  site: ['date'],
  page: ['date', 'page'],
  query: ['date', 'query', 'page'],
};

/** Fetch one grain for a window, as table rows. */
export async function fetchGrain(api: GscApi, siteUrl: string, grain: GscGrain, opts: FetchGrainsOptions): Promise<GscRow[]> {
  const dimensions: GscDimension[] = grain === 'query' ? [...GRAIN_DIMENSIONS.query, ...(opts.extraDimensions ?? [])] : GRAIN_DIMENSIONS[grain];
  const apiRows = await fetchAllRows(api, siteUrl, { startDate: opts.startDate, endDate: opts.endDate, dimensions }, { maxPages: opts.maxPages });
  return toGscRows(apiRows, dimensions, grain);
}

// ---------------------------------------------------------------------------
// URL inspection
// ---------------------------------------------------------------------------

/** gsc_url_inspection row shape (inspected_at defaults in the DB). */
export interface GscInspectionRow {
  url: string;
  verdict: string | null;
  coverage_state: string | null;
  indexing_state: string | null;
  page_fetch_state: string | null;
  robots_txt_state: string | null;
  last_crawl_time: string | null;
  google_canonical: string | null;
  user_canonical: string | null;
  raw: Record<string, unknown>;
}

export function parseInspection(url: string, res: GscInspectionResponse): GscInspectionRow {
  const s = res.inspectionResult?.indexStatusResult ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const crawl = str(s.lastCrawlTime);
  return {
    url,
    verdict: str(s.verdict),
    coverage_state: str(s.coverageState),
    indexing_state: str(s.indexingState),
    page_fetch_state: str(s.pageFetchState),
    robots_txt_state: str(s.robotsTxtState),
    // the API reports "1970-01-01T00:00:00Z" for never crawled
    last_crawl_time: crawl && !crawl.startsWith('1970-') ? crawl : null,
    google_canonical: str(s.googleCanonical),
    user_canonical: str(s.userCanonical),
    raw: (res.inspectionResult ?? {}) as Record<string, unknown>,
  };
}

/** Indexed in Google's terms: verdict PASS ("URL is on Google"). */
export const isIndexed = (r: { verdict: string | null }) => r.verdict === 'PASS';

/**
 * Which sitemap URLs to inspect this run: never-inspected first (sitemap order), then the stalest inspections
 * older than minAgeDays. At most `budget`.
 */
export function pickUrlsToInspect(sitemapUrls: string[], lastInspected: Map<string, string | Date>, budget: number, opts: { now?: Date; minAgeDays?: number } = {}): string[] {
  const now = (opts.now ?? new Date()).getTime();
  const minAge = (opts.minAgeDays ?? 7) * DAY;
  const uniq = [...new Set(sitemapUrls)];
  const never = uniq.filter((u) => !lastInspected.has(u));
  const stale = uniq
    .filter((u) => lastInspected.has(u))
    .map((u) => ({ u, t: new Date(lastInspected.get(u)!).getTime() }))
    .filter((x) => now - x.t >= minAge)
    .sort((a, b) => a.t - b.t)
    .map((x) => x.u);
  return [...never, ...stale].slice(0, Math.max(0, Math.min(budget, INSPECTION_DAILY_QUOTA)));
}

const isQuotaError = (err: unknown) => {
  const e = err as { code?: number; status?: number; message?: string };
  return e?.code === 429 || e?.status === 429 || /quota|rate limit/i.test(String(e?.message ?? ''));
};

export interface InspectResult {
  rows: GscInspectionRow[];
  errors: { url: string; message: string }[];
  stoppedOnQuota: boolean;
}

/** Inspect URLs one at a time (pausing delayMs between calls). Stops at the first quota error. */
export async function inspectUrls(api: GscApi, siteUrl: string, urls: string[], opts: { delayMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<InspectResult> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = opts.delayMs ?? 150; // 600/min ceiling is 100ms; stay under it
  const out: InspectResult = { rows: [], errors: [], stoppedOnQuota: false };
  for (let i = 0; i < urls.length; i++) {
    try {
      out.rows.push(parseInspection(urls[i], await api.inspect(siteUrl, urls[i])));
    } catch (err) {
      if (isQuotaError(err)) {
        out.stoppedOnQuota = true;
        break;
      }
      out.errors.push({ url: urls[i], message: err instanceof Error ? err.message : String(err) });
    }
    if (delay > 0 && i < urls.length - 1) await sleep(delay);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

/** <loc> and <lastmod> pairs from a sitemap.xml body. */
export function parseSitemapXml(xml: string): { url: string; lastModified: string | null }[] {
  const out: { url: string; lastModified: string | null }[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1] ?? null;
    out.push({ url: loc.replace(/&amp;/g, '&'), lastModified: lastmod });
  }
  return out;
}
