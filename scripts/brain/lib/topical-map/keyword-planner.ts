/**
 * Google Ads Keyword Planner exports -> search volume per topic. Pure apart from loadKeywordPlanner (file read).
 *
 * Input: the "Saved keywords stats" / "Keyword stats" export (Keyword Planner > Download > .csv). Google writes it
 * as UTF-16 LE with a BOM, tab separated, with two title lines (report name, date range) before the header row.
 * The normalised JSON this module writes (brain/research/keywords/*.json, { source, rows }) is accepted too.
 *
 * Matching: a KP keyword matches a map query when kpKey() of both is equal. kpKey lowercases, strips accents and
 * turns every run of non [a-z0-9] characters into one space. The upload lowercased the map's queries and replaced
 * non [a-z0-9' &-] characters with spaces; Keyword Planner then splits apostrophes itself ("didn't" -> "didn t"),
 * so the key drops apostrophes, ampersands and hyphens as well.
 *
 * Near-identical phrasings: Keyword Planner reports close variants ("psycho cybernetics", "psycho cybernetics
 * book") with the same grouped volume. Summing them would count one search pool several times, so rows with the
 * exact same statistics signature (average, 12 monthly values, bids, competition index) that share a content word
 * are counted once (the largest group member stands for the group).
 *
 * Spikes: a row whose YoY change is 1000% or more and whose average is over 3 times the median of its first six
 * months is counted at that pre-spike median (spikeVolume). The 18 Oct 2026 export has three unrelated generic terms
 * ("goal setting", "personal development", "networking tips") jumping to the same 450,000 peak in May and Sep 2026,
 * which reads as automated traffic or a Keyword Planner artefact, not people.
 */
import { readFileSync } from 'node:fs';
import { contentWords } from './queries';

export interface KpMonth {
  /** YYYY-MM */
  month: string;
  searches: number | null;
}

export interface KpRow {
  keyword: string;
  avgMonthlySearches: number | null;
  /** percent, e.g. -18 for "-18%"; null when blank or "∞" (from zero) */
  threeMonthChange: number | null;
  yoyChange: number | null;
  /** Low | Medium | High (paid search competition) */
  competition: string | null;
  /** 0-100 */
  competitionIndex: number | null;
  /** top of page bid, account currency */
  bidLow: number | null;
  bidHigh: number | null;
  monthly: KpMonth[];
}

export interface KpFile {
  source: { file: string; title: string | null; dateRange: string | null; currency: string | null; location: string | null };
  rows: KpRow[];
}

const MONTHS: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** Decode a KP export: UTF-16 LE/BE (BOM or NUL-pattern sniffed) or UTF-8 (BOM stripped). */
export function decodeKpBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const sw = Buffer.from(buf.subarray(2));
    sw.swap16();
    return sw.toString('utf16le');
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  // no BOM: UTF-16 LE text has a NUL in every odd byte for ASCII
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0 && buf[0] !== 0) return buf.toString('utf16le');
  return buf.toString('utf8');
}

/** "201000.0" -> 201000, "1.70" -> 1.7, "1,234" -> 1234, "" / "--" -> null. */
export function parseKpNumber(s: string | undefined | null): number | null {
  const t = (s ?? '').trim().replace(/^"|"$/g, '').replace(/,/g, '').replace(/[$€£\s]/g, '');
  if (!t || t === '--' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "-18%" -> -18, "0%" -> 0, "∞" / "" -> null. */
export function parseKpPercent(s: string | undefined | null): number | null {
  const t = (s ?? '').trim().replace(/^"|"$/g, '');
  if (!t || t === '∞' || /inf/i.test(t)) return null;
  return parseKpNumber(t.replace(/%$/, ''));
}

/** "Searches: Oct 2025" -> "2025-10" */
export function monthOf(header: string): string | null {
  const m = header.match(/searches:\s*([a-z]{3})[a-z]*\s+(\d{4})/i);
  if (!m) return null;
  const mm = MONTHS[m[1].toLowerCase()];
  return mm ? `${m[2]}-${mm}` : null;
}

const splitLine = (line: string) => line.split('\t').map((c) => c.replace(/^"(.*)"$/, '$1'));

/** Parse the decoded text of a KP export. Title lines before the header are kept as source metadata. */
export function parseKpTsv(text: string, file = ''): KpFile {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const h = lines.findIndex((l) => /^"?keyword"?\t/i.test(l));
  if (h < 0) throw new Error(`keyword planner: no header row starting with "Keyword" in ${file || 'input'}`);
  const pre = lines.slice(0, h).map((l) => l.replace(/^"|"$/g, '').trim()).filter(Boolean);
  const header = splitLine(lines[h]).map((c) => c.trim());
  const col = (re: RegExp) => header.findIndex((c) => re.test(c));
  const c = {
    keyword: col(/^keyword$/i),
    currency: col(/^currency$/i),
    segmentation: col(/^segmentation$/i),
    avg: col(/^avg\.? monthly searches$/i),
    three: col(/^three month change$/i),
    yoy: col(/^yoy change$/i),
    comp: col(/^competition$/i),
    compIdx: col(/^competition \(indexed value\)$/i),
    bidLow: col(/^top of page bid \(low range\)$/i),
    bidHigh: col(/^top of page bid \(high range\)$/i),
  };
  if (c.avg < 0) throw new Error('keyword planner: no "Avg. monthly searches" column');
  const months = header.map((name, i) => ({ i, month: monthOf(name) })).filter((x): x is { i: number; month: string } => !!x.month);
  const rows: KpRow[] = [];
  let currency: string | null = null;
  let location: string | null = null;
  for (const line of lines.slice(h + 1)) {
    if (!line.trim()) continue;
    const f = splitLine(line);
    const keyword = (f[c.keyword] ?? '').trim();
    if (!keyword) {
      // totals rows ("All", "United States") carry the location in the segmentation column
      const seg = c.segmentation >= 0 ? (f[c.segmentation] ?? '').trim() : '';
      if (seg && seg !== 'All') location = seg;
      continue;
    }
    if (c.currency >= 0 && f[c.currency]) currency = f[c.currency].trim();
    rows.push({
      keyword,
      avgMonthlySearches: parseKpNumber(f[c.avg]),
      threeMonthChange: c.three >= 0 ? parseKpPercent(f[c.three]) : null,
      yoyChange: c.yoy >= 0 ? parseKpPercent(f[c.yoy]) : null,
      competition: c.comp >= 0 ? (f[c.comp] ?? '').trim() || null : null,
      competitionIndex: c.compIdx >= 0 ? parseKpNumber(f[c.compIdx]) : null,
      bidLow: c.bidLow >= 0 ? parseKpNumber(f[c.bidLow]) : null,
      bidHigh: c.bidHigh >= 0 ? parseKpNumber(f[c.bidHigh]) : null,
      monthly: months.map((m) => ({ month: m.month, searches: parseKpNumber(f[m.i]) })),
    });
  }
  return { source: { file, title: pre[0] ?? null, dateRange: pre[1] ?? null, currency, location }, rows };
}

/** Read a KP export (raw UTF-16/UTF-8 TSV or CSV export) or the normalised JSON ({ source, rows }). */
export function loadKeywordPlanner(file: string): KpFile {
  const buf = readFileSync(file);
  const text = decodeKpBuffer(buf);
  if (/^\s*[{[]/.test(text)) return fromNormalisedJson(JSON.parse(text) as NormalisedKp, file);
  return parseKpTsv(text, file);
}

/** Match key shared by map queries and KP keywords (see the header). */
export function kpKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Index several KP files by match key. A later file overrides an earlier one for the same keyword. */
export function kpIndex(files: KpFile[]): Map<string, KpRow> {
  const idx = new Map<string, KpRow>();
  for (const f of files) for (const r of f.rows) idx.set(kpKey(r.keyword), r);
  return idx;
}

export const SPIKE_YOY = 1000;
/** searchTrend ignores rows averaging under this many searches and caps each row's change at ±TREND_CAP percent */
export const TREND_MIN_BASE = 50;
export const TREND_CAP = 300;

/** The volume a row counts at: its average, or its pre-spike median when it looks like a spike (see header). */
export function spikeVolume(r: KpRow): { volume: number; spike: boolean } {
  const avg = r.avgMonthlySearches ?? 0;
  if ((r.yoyChange ?? 0) < SPIKE_YOY) return { volume: avg, spike: false };
  const early = r.monthly.slice(0, 6).map((m) => m.searches).filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!early.length) return { volume: avg, spike: false };
  const med = early.length % 2 ? early[(early.length - 1) / 2] : (early[early.length / 2 - 1] + early[early.length / 2]) / 2;
  return avg > 3 * med ? { volume: Math.round(med), spike: true } : { volume: avg, spike: false };
}

const signature = (r: KpRow) => [r.avgMonthlySearches, r.bidLow, r.bidHigh, r.competitionIndex, ...r.monthly.map((m) => m.searches)].join('|');

/**
 * Rows counted once each: near-identical phrasings (same statistics signature and a shared content word) collapse
 * to one representative. Rows without volume are dropped.
 */
export function dedupeKpRows(rows: KpRow[]): { counted: KpRow[]; merged: Map<string, string[]> } {
  const sorted = [...new Map(rows.map((r) => [kpKey(r.keyword), r])).values()].filter((r) => (r.avgMonthlySearches ?? 0) > 0).sort((a, b) => (b.avgMonthlySearches ?? 0) - (a.avgMonthlySearches ?? 0) || a.keyword.length - b.keyword.length);
  const counted: KpRow[] = [];
  const merged = new Map<string, string[]>();
  const words = new Map<KpRow, Set<string>>();
  const w = (r: KpRow) => words.get(r) ?? (words.set(r, new Set(contentWords(r.keyword))), words.get(r)!);
  for (const r of sorted) {
    const sig = signature(r);
    const rep = counted.find((c) => signature(c) === sig && [...w(r)].some((x) => w(c).has(x)));
    if (rep) merged.set(rep.keyword, [...(merged.get(rep.keyword) ?? []), r.keyword]);
    else counted.push(r);
  }
  return { counted, merged };
}

export interface SearchDemand {
  /** sum of avg monthly searches over the counted (de-duplicated) keywords */
  volume: number;
  /** map queries with a KP row / with volume > 0 / counted after de-duplication */
  matched: number;
  withVolume: number;
  counted: number;
  /** volume-weighted mean YoY and 3-month change, percent (rows with "∞" or blank skipped) */
  yoy: number | null;
  threeMonth: number | null;
  /** sum of the 12 monthly series of the counted rows (oldest first) */
  monthly: KpMonth[];
  /** volume-weighted top of page bids and competition index; value = Σ volume × high bid (a monthly paid-click proxy) */
  bidLow: number | null;
  bidHigh: number | null;
  competitionIndex: number | null;
  value: number;
  /** strongest counted keywords, highest counted volume first */
  top: { keyword: string; volume: number; yoy: number | null; threeMonth: number | null; bidHigh: number | null }[];
  /** keywords counted at their pre-spike level (spikeVolume) */
  spikes: { keyword: string; reported: number; counted: number }[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

function wmean(rows: KpRow[], pick: (r: KpRow) => number | null): number | null {
  let s = 0;
  let w = 0;
  for (const r of rows) {
    const v = pick(r);
    const vol = spikeVolume(r).volume;
    if (v === null || !Number.isFinite(v) || vol <= 0) continue;
    s += v * vol;
    w += vol;
  }
  return w > 0 ? s / w : null;
}

/** Search demand for a set of map query texts. */
export function searchDemandFor(queryTexts: string[], idx: Map<string, KpRow>, topN = 8): SearchDemand {
  const rows: KpRow[] = [];
  const seen = new Set<string>();
  for (const t of queryTexts) {
    const k = kpKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    const r = idx.get(k);
    if (r) rows.push(r);
  }
  const { counted: dd } = dedupeKpRows(rows);
  const counted = dd.sort((a, b) => spikeVolume(b).volume - spikeVolume(a).volume || a.keyword.length - b.keyword.length);
  const volume = counted.reduce((s, r) => s + spikeVolume(r).volume, 0);
  const months = counted[0]?.monthly.map((m) => m.month) ?? [];
  const monthly = months.map((month, i) => ({ month, searches: counted.reduce((s, r) => s + (r.monthly[i]?.searches ?? 0), 0) }));
  // trends from tiny bases are noise: rows under TREND_MIN_BASE searches are skipped and each change is capped at ±TREND_CAP%
  const trendRows = counted.filter((r) => spikeVolume(r).volume >= TREND_MIN_BASE);
  const capT = (v: number | null) => (v === null ? null : Math.max(-TREND_CAP, Math.min(TREND_CAP, v)));
  const yoy = wmean(trendRows, (r) => capT(r.yoyChange));
  const three = wmean(trendRows, (r) => capT(r.threeMonthChange));
  const bl = wmean(counted, (r) => r.bidLow);
  const bh = wmean(counted, (r) => r.bidHigh);
  const ci = wmean(counted, (r) => r.competitionIndex);
  return {
    volume,
    matched: rows.length,
    withVolume: rows.filter((r) => (r.avgMonthlySearches ?? 0) > 0).length,
    counted: counted.length,
    yoy: yoy === null ? null : r1(yoy),
    threeMonth: three === null ? null : r1(three),
    monthly,
    bidLow: bl === null ? null : r2(bl),
    bidHigh: bh === null ? null : r2(bh),
    competitionIndex: ci === null ? null : Math.round(ci),
    value: Math.round(counted.reduce((s, r) => s + spikeVolume(r).volume * (r.bidHigh ?? 0), 0)),
    top: counted.slice(0, topN).map((r) => ({ keyword: r.keyword, volume: spikeVolume(r).volume, yoy: r.yoyChange, threeMonth: r.threeMonthChange, bidHigh: r.bidHigh })),
    spikes: counted.filter((r) => spikeVolume(r).spike).map((r) => ({ keyword: r.keyword, reported: r.avgMonthlySearches ?? 0, counted: spikeVolume(r).volume })),
  };
}

/**
 * The normalised file kept in the brain (research/keywords/*.json): `source` (with `months`, the YYYY-MM of each
 * monthly value) and one compact row per line, `monthly` as a plain array of searches in `months` order.
 */
export interface NormalisedKp {
  source: KpFile['source'] & { months?: string[]; [k: string]: unknown };
  rows: (Omit<KpRow, 'monthly'> & { monthly: (number | null)[] | KpMonth[] })[];
}

export function normalisedKpJson(f: KpFile, extra: Record<string, unknown> = {}): string {
  const months = f.rows[0]?.monthly.map((m) => m.month) ?? [];
  const head = JSON.stringify({ ...f.source, ...extra, months }, null, 1);
  const rows = f.rows.map((r) => JSON.stringify({ ...r, monthly: r.monthly.map((m) => m.searches) }));
  return `{\n"source": ${head},\n"rows": [\n${rows.join(',\n')}\n]\n}\n`;
}

export function fromNormalisedJson(j: NormalisedKp | KpRow[], file = ''): KpFile {
  if (Array.isArray(j)) return { source: { file, title: null, dateRange: null, currency: null, location: null }, rows: j };
  const months = j.source.months ?? [];
  const rows: KpRow[] = (j.rows ?? []).map((r) => ({
    ...r,
    monthly: (r.monthly as unknown[]).map((m, i) => (typeof m === 'object' && m !== null ? (m as KpMonth) : { month: months[i] ?? String(i), searches: typeof m === 'number' ? m : null })),
  }));
  return { source: { file, title: j.source.title ?? null, dateRange: j.source.dateRange ?? null, currency: j.source.currency ?? null, location: j.source.location ?? null }, rows };
}
