/**
 * Free demand data: Google and YouTube autocomplete (suggestqueries.google.com, client=firefox).
 *
 * - Every raw response is cached under scripts/research/.cache/topical-map/<date>/<source>/<hash>.json
 *   (gitignored). A cached answer from the last `maxAgeDays` is reused and costs no request.
 * - Requests are paced 1-3 s with jitter, capped at `maxRequests` (counted and printed), and the harvest
 *   stops at the first 429, 403, or non-JSON answer (a block or a captcha page). The build then carries on
 *   with whatever is cached plus the audience and vidIQ data.
 * - No scraping of result pages, no paid APIs.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeQuery } from './queries';

export type AcSource = 'google_ac' | 'youtube_ac';

export const AC_URL: Record<AcSource, (q: string) => string> = {
  google_ac: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=${encodeURIComponent(q)}`,
  youtube_ac: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&gl=us&q=${encodeURIComponent(q)}`,
};

export interface AcRequest {
  source: AcSource;
  q: string;
  /** who asked: a topic id, problem id or probe tag */
  owner: string;
  /** the seed phrase this request expands (same as q for plain seeds) */
  seed: string;
  phase: 'seed' | 'seed2' | 'expand';
}

export interface AcResult {
  request: AcRequest;
  suggestions: string[];
  fromCache: boolean;
}

export interface HarvestStats {
  requests: number;
  cacheHits: number;
  missing: number;
  blocked: { source: AcSource; status: number | string; q: string } | null;
  errors: number;
}

export interface Fetcher {
  (url: string): Promise<{ status: number; text: string }>;
}

export const defaultFetcher: Fetcher = async (url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0', Accept: 'application/json,text/javascript,*/*' } });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
};

export const cacheKey = (source: AcSource, q: string) => createHash('sha1').update(`${source}\u0000${normalizeQuery(q)}`).digest('hex').slice(0, 20);

/** Parse a firefox-client suggest answer: ["q", ["s1", "s2", ...], ...]. Null when it isn't one (a block page). */
export function parseSuggest(text: string): string[] | null {
  const t = text.trim();
  if (!t.startsWith('[')) return null;
  try {
    const j = JSON.parse(t) as unknown;
    if (!Array.isArray(j) || !Array.isArray(j[1])) return null;
    return (j[1] as unknown[]).filter((s): s is string => typeof s === 'string');
  } catch {
    return null;
  }
}

export class AcCache {
  constructor(
    readonly root: string,
    readonly today: string,
    readonly maxAgeDays = 30,
  ) {}

  private days(): string[] {
    if (!existsSync(this.root)) return [];
    return readdirSync(this.root)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();
  }

  get(source: AcSource, q: string, anyAge = false): string[] | null {
    const key = cacheKey(source, q);
    const cutoff = new Date(Date.parse(this.today) - this.maxAgeDays * 86400_000).toISOString().slice(0, 10);
    for (const d of this.days()) {
      if (!anyAge && d < cutoff) break;
      const p = path.join(this.root, d, source, `${key}.json`);
      if (existsSync(p)) {
        const j = JSON.parse(readFileSync(p, 'utf8')) as { suggestions?: string[] };
        return j.suggestions ?? [];
      }
    }
    return null;
  }

  put(source: AcSource, q: string, status: number, raw: string, suggestions: string[]): void {
    const dir = path.join(this.root, this.today, source);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${cacheKey(source, q)}.json`), JSON.stringify({ q, source, status, fetchedAt: new Date().toISOString(), suggestions, raw: raw.slice(0, 4000) }, null, 1));
  }
}

export interface HarvestOptions {
  /** false = cache only (no network) */
  network: boolean;
  maxRequests: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  log?: (m: string) => void;
}

export class Harvester {
  stats: HarvestStats = { requests: 0, cacheHits: 0, missing: 0, blocked: null, errors: 0 };
  results: AcResult[] = [];
  private seen = new Set<string>();

  constructor(
    readonly cache: AcCache,
    readonly opts: HarvestOptions,
  ) {}

  get budgetLeft(): number {
    return this.opts.network && !this.stats.blocked ? Math.max(0, this.opts.maxRequests - this.stats.requests) : 0;
  }

  /** Run requests in order. Cached answers are free; network requests stop at the cap or the first block. */
  async run(reqs: AcRequest[]): Promise<void> {
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const fetcher = this.opts.fetcher ?? defaultFetcher;
    for (const r of reqs) {
      const k = `${r.source}\u0000${normalizeQuery(r.q)}`;
      if (this.seen.has(k)) {
        // same query asked for another owner: reuse the answer
        const prev = this.results.find((x) => x.request.source === r.source && normalizeQuery(x.request.q) === normalizeQuery(r.q));
        if (prev) this.results.push({ request: r, suggestions: prev.suggestions, fromCache: true });
        continue;
      }
      const cached = this.cache.get(r.source, r.q, !this.opts.network);
      if (cached) {
        this.seen.add(k);
        this.stats.cacheHits++;
        this.results.push({ request: r, suggestions: cached, fromCache: true });
        continue;
      }
      if (!this.budgetLeft) {
        this.stats.missing++;
        continue;
      }
      if (this.stats.requests > 0) {
        const lo = this.opts.minDelayMs ?? 1000;
        const hi = this.opts.maxDelayMs ?? 3000;
        await sleep(lo + Math.random() * (hi - lo));
      }
      this.stats.requests++;
      let status: number | string;
      let text = '';
      try {
        const res = await fetcher(AC_URL[r.source](r.q));
        status = res.status;
        text = res.text;
      } catch (e) {
        this.stats.errors++;
        this.opts.log?.(`  ${r.source} "${r.q}": ${e instanceof Error ? e.message : e}`);
        if (this.stats.errors >= 5) {
          this.stats.blocked = { source: r.source, status: 'network errors', q: r.q };
          this.opts.log?.('  harvest stopped after 5 network errors');
        }
        continue;
      }
      const suggestions = status === 200 ? parseSuggest(text) : null;
      if (status === 429 || status === 403 || suggestions === null) {
        this.stats.blocked = { source: r.source, status, q: r.q };
        this.opts.log?.(`  BLOCKED by ${r.source} (HTTP ${status}) on "${r.q}"; stopping the harvest, continuing with cache + audience data`);
        continue;
      }
      this.cache.put(r.source, r.q, status as number, text, suggestions);
      this.seen.add(k);
      this.results.push({ request: r, suggestions, fromCache: false });
      if (this.stats.requests % 50 === 0) this.opts.log?.(`  ${this.stats.requests} requests so far`);
    }
  }
}

/** a-z suffixes and question prefixes for one seed phrase (the expansion for top topics). */
export function expansions(seed: string): string[] {
  const s = normalizeQuery(seed);
  const out = [...'abcdefghijklmnopqrstuvwxyz'].map((c) => `${s} ${c}`);
  for (const p of ['how to', 'why', 'what is']) if (!s.startsWith(p)) out.push(`${p} ${s}`);
  return out;
}
