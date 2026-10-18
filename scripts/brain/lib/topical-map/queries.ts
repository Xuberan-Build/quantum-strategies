/**
 * Query normalisation, de-duplication, signal and intent. Pure.
 *
 * Signal is relative demand, never a volume:
 *   google_ac / youtube_ac  autocomplete returned it at rank r (0-based): 1 - r/20 (1.0 .. 0.55), the best rank per
 *                           source, plus 0.1 for every further seed that surfaced it (cap +0.5): a phrase several
 *                           seeds lead to is searched more.
 *   audience                a coded audience phrase: log2(1 + quotes) + log10(1 + likes) / 2
 *   vidiq                   vidIQ monthly YouTube searches (audience-vocabulary.md): max(0.5, log10(monthly) - 2)
 *   keyword_planner         a Keyword Planner "Discover new keywords" idea the map had not harvested (--kp-add-new),
 *                           same scale on its Google monthly searches; left out of audience demand
 *   query signal            sum over sources, so a phrase seen in several places outranks one seen once.
 */
import type { QuerySource, TopicIntent, TopicQuery } from '../../../../src/lib/brain/topical-map-types';

/** Lowercase, strip accents and punctuation, collapse whitespace, unify apostrophes. */
export function normalizeQuery(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dedupe key: normalised, apostrophes dropped, plural-insensitive on the last word, filler words dropped. */
export function queryKey(text: string): string {
  const words = normalizeQuery(text)
    .replace(/'/g, '')
    .split(' ')
    .filter((w) => w && !FILLER.has(w));
  if (words.length) words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(' ');
}

const FILLER = new Set(['a', 'an', 'the']);
const singular = (w: string) => (w.length > 4 && /[^s]s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w);

/** Junk filter: too short, too long, non-latin, URLs, or pure numbers. */
export function isUsableQuery(text: string): boolean {
  const n = normalizeQuery(text);
  if (n.length < 3 || n.length > 90) return false;
  if (/^\d+$/.test(n)) return false;
  if (/\b(www|http|com)\b/.test(n)) return false;
  if (n.split(' ').length > 12) return false;
  return /[a-z]/.test(n);
}

export interface RawQuery {
  text: string;
  source: QuerySource;
  /** autocomplete rank (0 = first suggestion) */
  rank?: number;
  /** the seed phrase that produced it (autocomplete) */
  seed?: string;
  /** audience: number of coded items / likes behind the phrase */
  quotes?: number;
  likes?: number;
  /** vidiq: monthly searches */
  monthly?: number;
}

export interface HarvestedQuery extends TopicQuery {
  key: string;
  /** seeds whose autocomplete returned it, and the topic ids those seeds belong to */
  seeds: string[];
  seedTopics: string[];
  perSource: Partial<Record<QuerySource, number>>;
  monthly?: number;
}

export const acSignal = (rank: number) => Math.max(0.55, 1 - Math.max(0, rank) / 20);
export const audienceSignal = (quotes: number, likes: number) => Math.log2(1 + Math.max(0, quotes)) + Math.log10(1 + Math.max(0, likes)) / 2;
export const vidiqSignal = (monthly: number) => Math.max(0.5, Math.log10(Math.max(1, monthly)) - 2);

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Merge raw sightings into one query per dedupe key. The display text is the most common normalised spelling
 * (ties: the shortest). `seedTopic` maps a seed phrase to the topic ids it was harvested for.
 */
export function mergeQueries(raw: RawQuery[], seedTopic: (seed: string) => string[] = () => []): HarvestedQuery[] {
  const groups = new Map<string, { spellings: Map<string, number>; sightings: RawQuery[] }>();
  for (const r of raw) {
    if (!isUsableQuery(r.text)) continue;
    const key = queryKey(r.text);
    if (!key) continue;
    const g = groups.get(key) ?? { spellings: new Map<string, number>(), sightings: [] as RawQuery[] };
    const n = normalizeQuery(r.text);
    g.spellings.set(n, (g.spellings.get(n) ?? 0) + 1);
    g.sightings.push(r);
    groups.set(key, g);
  }
  const out: HarvestedQuery[] = [];
  for (const [key, g] of groups) {
    const text = [...g.spellings].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    const perSource: Partial<Record<QuerySource, number>> = {};
    const seeds = new Set<string>();
    let monthly: number | undefined;
    for (const src of ['google_ac', 'youtube_ac'] as const) {
      const s = g.sightings.filter((x) => x.source === src);
      if (!s.length) continue;
      const best = Math.max(...s.map((x) => acSignal(x.rank ?? 0)));
      const distinctSeeds = new Set(s.map((x) => x.seed ?? '')).size;
      perSource[src] = round2(best + Math.min(0.5, 0.1 * (distinctSeeds - 1)));
    }
    const aud = g.sightings.filter((x) => x.source === 'audience');
    if (aud.length) perSource.audience = round2(audienceSignal(aud.reduce((s, x) => s + (x.quotes ?? 1), 0), aud.reduce((s, x) => s + (x.likes ?? 0), 0)));
    const vq = g.sightings.filter((x) => x.source === 'vidiq' && x.monthly);
    if (vq.length) {
      monthly = Math.max(...vq.map((x) => x.monthly!));
      perSource.vidiq = round2(vidiqSignal(monthly));
    }
    const kpq = g.sightings.filter((x) => x.source === 'keyword_planner' && x.monthly);
    if (kpq.length) perSource.keyword_planner = round2(vidiqSignal(Math.max(...kpq.map((x) => x.monthly!))));
    for (const x of g.sightings) if (x.seed) seeds.add(x.seed);
    const seedTopics = [...new Set([...seeds].flatMap((s) => seedTopic(s)))];
    out.push({
      key,
      text,
      sources: (Object.keys(perSource) as QuerySource[]).sort(),
      signal: round2(Object.values(perSource).reduce((s, v) => s + (v ?? 0), 0)),
      seeds: [...seeds].sort(),
      seedTopics,
      perSource,
      monthly,
    });
  }
  return out.sort((a, b) => b.signal - a.signal || a.text.localeCompare(b.text));
}

const COMPARISON = /\b(vs|versus|or|compared to|difference between|better than|alternative|alternatives)\b/;
const COMMERCIAL = /\b(best|course|courses|book|books|app|apps|program|coach|coaching|price|pricing|buy|review|reviews|test|quiz|template|tool|tools|agency|software|service|services|consultant|free)\b/;
const PROBLEM = /\b(i can't|i cant|can't|cant|why do i|why am i|i feel|i keep|how to stop|how to overcome|how to get over|struggle|struggling|fear of|never|stuck|lost|behind|not working|doesn't work|doesnt work|failed|failing|sabotage|burnout|burned out|numb|lonely|anxiety|overwhelm|overwhelmed|too late|no motivation|lazy)\b/;
const INFORMATIONAL = /\b(what is|what are|meaning|definition|define|how does|how do|why|explained|science|psychology|examples?|theory|does .+ work|is .+ real)\b/;

/** Search intent of one query (rules, first match wins: navigational, comparison, problem, commercial, informational). */
export function queryIntent(text: string, navigationalNames: string[] = []): TopicIntent {
  const t = normalizeQuery(text);
  if (navigationalNames.some((n) => n.length > 3 && new RegExp(`\\b${escapeRe(normalizeQuery(n))}\\b`).test(t))) return 'navigational';
  if (/\b(login|website|official|youtube channel|podcast)\b/.test(t)) return 'navigational';
  if (COMPARISON.test(t)) return 'comparison';
  if (PROBLEM.test(t)) return 'problem';
  if (COMMERCIAL.test(t)) return 'commercial';
  if (INFORMATIONAL.test(t)) return 'informational';
  return 'informational';
}

/** Topic intent: the intent carrying the most query signal; `fallback` when there are no queries. */
export function dominantIntent(queries: { text: string; signal: number }[], fallback: TopicIntent, names: string[] = []): TopicIntent {
  if (!queries.length) return fallback;
  const w = new Map<TopicIntent, number>();
  for (const q of queries) {
    const i = queryIntent(q.text, names);
    w.set(i, (w.get(i) ?? 0) + q.signal);
  }
  return [...w].sort((a, b) => b[1] - a[1])[0][0];
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Content words (for lexical similarity when embeddings are off). */
const STOP = new Set('a an the to of in on for and or is are be my your you i me it its how what why when do does with without from by at as that this can not no vs about get'.split(' '));
export function contentWords(text: string): string[] {
  return normalizeQuery(text)
    .replace(/'/g, '')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => singular(w.replace(/ing$/, '').replace(/ed$/, '')));
}

/** Overlap coefficient on content words (0..1). Used when embeddings are unavailable. */
export function lexicalSim(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}
