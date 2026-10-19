/**
 * IndexNow: tell Bing, Yandex, Seznam, Naver and the other IndexNow engines a URL changed, so they recrawl it
 * now instead of on their own schedule. Google does not take IndexNow (and its Indexing API is only for job
 * postings and livestreams), so Google still finds changes through the sitemap.
 *
 * Setup: INDEXNOW_KEY (8 to 128 of [a-zA-Z0-9-]; generate with `openssl rand -hex 16`). next.config.ts rewrites
 * /<key>.txt to /api/indexnow-key, which answers with the key, so the engines can verify we own the host.
 *
 * One POST to api.indexnow.org reaches every participating engine (they share submissions).
 *
 * No spam: submit only URLs that changed. selectChanged() drops URLs submitted in the last minIntervalMs and,
 * when a lastModified is known, URLs not modified since their last accepted submission.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_HOST = 'quantumstrategies.online';
export const MAX_URLS_PER_POST = 10_000;
/** A URL is not re-submitted inside this window, whatever the trigger. */
export const DEFAULT_MIN_INTERVAL_MS = 10 * 60 * 1000;

const KEY_RE = /^[a-zA-Z0-9-]{8,128}$/;

export function indexNowKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = env.INDEXNOW_KEY?.trim();
  return k && KEY_RE.test(k) ? k : null;
}

export const keyLocation = (key: string, host = INDEXNOW_HOST) => `https://${host}/${key}.txt`;

/** Absolute https URLs on `host` only, de-duplicated, fragments dropped. */
export function sameHostUrls(urls: string[], host = INDEXNOW_HOST): string[] {
  const out = new Set<string>();
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== host) continue;
      u.hash = '';
      out.add(u.toString());
    } catch {
      /* not a URL */
    }
  }
  return [...out];
}

export interface ChangedCandidate {
  url: string;
  lastModified?: string | Date | null;
}

/**
 * Keep URLs worth submitting: never submitted, or modified after their last accepted submission. Anything
 * submitted inside minIntervalMs is dropped regardless. `force` skips the lastModified check, never the interval.
 */
export function selectChanged(candidates: ChangedCandidate[], lastSubmitted: Map<string, string | Date>, opts: { now?: Date; minIntervalMs?: number; force?: boolean } = {}): string[] {
  const now = (opts.now ?? new Date()).getTime();
  const minInterval = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    const prev = lastSubmitted.get(c.url);
    if (!prev) {
      out.push(c.url);
      continue;
    }
    const prevT = new Date(prev).getTime();
    if (now - prevT < minInterval) continue;
    if (opts.force) {
      out.push(c.url);
      continue;
    }
    const mod = c.lastModified ? new Date(c.lastModified).getTime() : NaN;
    if (Number.isFinite(mod) && mod > prevT) out.push(c.url);
  }
  return out;
}

export interface SubmitResult {
  submitted: number;
  batches: { size: number; status: number | null; ok: boolean; response: string }[];
  skipped: string | null;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

export interface SubmitOptions {
  key?: string | null;
  host?: string;
  endpoint?: string;
  fetchImpl?: FetchLike;
  /** service-role client: log each URL to indexnow_submissions (best effort) */
  client?: SupabaseClient | null;
  /** publish | script | cron, stored with each logged row */
  trigger?: string;
}

/**
 * POST urls to IndexNow in batches of up to 10,000. 200 and 202 are accepted. Logs one row per URL.
 * Never throws for HTTP errors (the result says what happened); throws only for a missing key.
 */
export async function submitToIndexNow(urls: string[], opts: SubmitOptions = {}): Promise<SubmitResult> {
  const key = opts.key === undefined ? indexNowKey() : opts.key;
  const host = opts.host ?? INDEXNOW_HOST;
  const endpoint = opts.endpoint ?? INDEXNOW_ENDPOINT;
  const list = sameHostUrls(urls, host);
  const result: SubmitResult = { submitted: 0, batches: [], skipped: null };
  if (!key) {
    result.skipped = 'INDEXNOW_KEY is not set';
    return result;
  }
  if (!list.length) {
    result.skipped = 'no URLs on this host';
    return result;
  }
  const doFetch: FetchLike = opts.fetchImpl ?? ((u, init) => fetch(u, init));
  for (let i = 0; i < list.length; i += MAX_URLS_PER_POST) {
    const batch = list.slice(i, i + MAX_URLS_PER_POST);
    let status: number | null = null;
    let text = '';
    try {
      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key, keyLocation: keyLocation(key, host), urlList: batch }),
      });
      status = res.status;
      text = (await res.text().catch(() => '')).slice(0, 500);
    } catch (err) {
      text = `fetch failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
    }
    const ok = status === 200 || status === 202;
    if (ok) result.submitted += batch.length;
    result.batches.push({ size: batch.length, status, ok, response: text });
    if (opts.client) {
      const rows = batch.map((url) => ({ url, engine: 'indexnow', endpoint, status_code: status, response: text || null, trigger: opts.trigger ?? null }));
      try {
        for (let j = 0; j < rows.length; j += 1000) {
          const { error } = await opts.client.from('indexnow_submissions').insert(rows.slice(j, j + 1000));
          if (error) console.warn('[indexnow] log insert failed:', error.message);
        }
      } catch (err) {
        console.warn('[indexnow] log insert failed:', err instanceof Error ? err.message : String(err));
      }
    }
  }
  return result;
}

/** Latest accepted (200/202) submission per URL, from indexnow_submissions. */
export async function lastAcceptedSubmissions(client: SupabaseClient, urls: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < urls.length; i += 200) {
    const { data, error } = await client
      .from('indexnow_submissions')
      .select('url, submitted_at')
      .in('url', urls.slice(i, i + 200))
      .in('status_code', [200, 202])
      .order('submitted_at', { ascending: false });
    if (error) throw new Error(`indexnow_submissions: ${error.message}`);
    for (const r of (data ?? []) as { url: string; submitted_at: string }[]) if (!out.has(r.url)) out.set(r.url, r.submitted_at);
  }
  return out;
}

/**
 * Best-effort ping for content that just changed (publish hooks). Skips URLs pinged in the last 10 minutes.
 * Never throws: publishing must not depend on IndexNow.
 */
export async function notifyIndexNow(urls: string[], opts: { client?: SupabaseClient | null; trigger?: string; fetchImpl?: FetchLike } = {}): Promise<SubmitResult | null> {
  try {
    const key = indexNowKey();
    if (!key) return null;
    let client = opts.client;
    if (client === undefined) {
      const { supabaseAdmin } = await import('@/lib/supabase/server');
      client = supabaseAdmin;
    }
    const list = sameHostUrls(urls);
    const last = client ? await lastAcceptedSubmissions(client, list).catch(() => new Map<string, string>()) : new Map<string, string>();
    const fresh = selectChanged(list.map((url) => ({ url, lastModified: new Date() })), last);
    if (!fresh.length) return { submitted: 0, batches: [], skipped: 'submitted recently' };
    const res = await submitToIndexNow(fresh, { key, client, trigger: opts.trigger ?? 'publish', fetchImpl: opts.fetchImpl });
    if (res.batches.some((b) => !b.ok)) console.warn('[indexnow] submission not accepted:', res.batches.map((b) => b.status));
    return res;
  } catch (err) {
    console.warn('[indexnow] notify failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** The URLs an article publish/update/unpublish changes: the article and the /articles/ listing. */
export function articleChangeUrls(slug: string): string[] {
  const s = slug.replace(/^\/+|\/+$/g, '');
  return [`https://${INDEXNOW_HOST}/articles/${s}/`, `https://${INDEXNOW_HOST}/articles/`];
}
