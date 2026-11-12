/**
 * Pure helpers for scripts/brain/corpus-pull.ts: query terms, ranking, excerpts, references,
 * a translation-rights hint and the printed format. No I/O here, so it is unit-tested
 * (scripts/brain/lib/corpus-pull/__tests__/format.test.ts).
 */

export interface CorpusRow {
  id: string;
  tradition: string | null;
  text_name: string | null;
  author: string | null;
  translator: string | null;
  date_composed: string | null;
  book: string | null;
  chapter: string | null;
  verse: string | null;
  lines?: string | null;
  section: string | null;
  content: string | null;
  source_url: string | null;
  tier: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RankedHit {
  row: CorpusRow;
  score: number;
  matched: string[];
  excerpt: string;
  reference: string;
  rights: RightsHint;
}

export interface PullOptions {
  query: string;
  traditions: string[];
  texts: string[];
  limit: number;
  perText: number;
  json: boolean;
  tiers: string[] | null; // null = all tiers
}

/** Tiers searched by default: the teachings and the research. Creator research (market_signal) and brain notes (internal) are opt-in. */
export const DEFAULT_TIERS = ['lineage', 'evidence', 'model', 'contested', 'enemy'];

const STOP = new Set(
  `a about after again all also am an and any are as at be because been being but by can could did do does doing
  for from get got had has have he her him his how i if in into is it its just me more most my no nor not of on or
  our out over own she should so some such than that the their them then there these they this those to too up us
  very was we were what when where which while who why will with would you your yours im ive dont cant wont isnt`.split(/\s+/),
);

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Content words of a query, lowercased and lightly stemmed, websearch operators and quotes dropped, de-duplicated. */
export function queryTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/(^|\s)-\S+/g, ' ') // websearch negation: -word
    .match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length > 2 && w !== 'or' && !STOP.has(w)).map(stem))];
}

/** The quoted phrase in a query ("dark night"), if any, else the whole query when it has 2 to 4 content words. */
export function queryPhrase(query: string): string | null {
  const quoted = query.match(/"([^"]+)"/);
  if (quoted) return quoted[1].toLowerCase().trim();
  const terms = queryTerms(query);
  return terms.length >= 2 && terms.length <= 4 ? query.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() : null;
}

/** websearch_to_tsquery text that matches ANY term (the broadening pass). */
export function orQuery(terms: string[]): string {
  return terms.join(' or ');
}

function termRegex(term: string): RegExp {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*`, 'gi');
}

/** Page furniture and scan noise that got chunked (library stamps, ad pages, Devanagari OCR), not a passage anyone can cite. */
export function isNoise(content: string): boolean {
  const letters = content.match(/[a-z]/gi)?.length ?? 0;
  if (letters < 60) return true;
  if (/Digitized by Google.{0,40}(Crown|net\.|6s\.)|Search in PMC|View in NLM Catalog/i.test(content)) return true;
  const refMarks = content.match(/\[\s*(DOI|PubMed|Google Scholar|PMC free article)\s*\]/gi)?.length ?? 0;
  return refMarks >= 3;
}

/**
 * Score a passage for the query: distinct terms matched dominate (10 each), the phrase adds 15,
 * repeated hits add a little (capped), and short dense passages beat long ones with one stray hit.
 */
export function scorePassage(content: string, terms: string[], phrase: string | null): { score: number; matched: string[] } {
  const text = content.toLowerCase();
  const matched: string[] = [];
  let hits = 0;
  for (const t of terms) {
    const n = text.match(termRegex(t))?.length ?? 0;
    if (n > 0) matched.push(t);
    hits += Math.min(n, 4);
  }
  if (matched.length === 0) return { score: 0, matched };
  const coverage = matched.length / Math.max(1, terms.length);
  const phraseBonus = phrase && text.replace(/\s+/g, ' ').includes(phrase) ? 15 : 0;
  const density = Math.min(5, (hits * 1000) / Math.max(400, text.length));
  const score = matched.length * 10 + coverage * 10 + phraseBonus + hits + density - (isNoise(content) ? 40 : 0);
  return { score: Math.round(score * 10) / 10, matched };
}

/** The chunk's own heading ("Dark Night of the Soul — Book 1, Chapter I St. John of the Cross …, E. Allison Peers translation") is metadata, not text. */
export function stripHeading(content: string): string {
  const text = content.replace(/\s+/g, ' ').trim();
  const m = text.match(/^.{0,220}?(translation(?: \([^)]*\))?|edition \(\d{4}\)|\(\d{4}\)|\(~?\d{3,4} CE\))\s+/i);
  return m && m[0].length < text.length - 40 ? text.slice(m[0].length) : text;
}

/** ~max chars around the window holding the most distinct query terms, trimmed to whole words with ellipses. */
export function bestExcerpt(content: string, terms: string[], max = 300): string {
  const text = stripHeading(content);
  if (text.length <= max) return text;
  const positions: { at: number; term: string }[] = [];
  for (const t of terms) for (const m of text.matchAll(termRegex(t))) positions.push({ at: m.index ?? 0, term: t });
  let center = 0;
  if (positions.length) {
    let best = -1;
    for (const p of positions) {
      const inWindow = new Set(positions.filter((q) => q.at >= p.at - 40 && q.at <= p.at + max - 80).map((q) => q.term));
      if (inWindow.size > best) {
        best = inWindow.size;
        center = p.at;
      }
    }
  }
  let start = Math.max(0, center - 60);
  if (start > 0) {
    const sp = text.indexOf(' ', start);
    start = sp >= 0 && sp < center ? sp + 1 : start;
  }
  let slice = text.slice(start, start + max);
  if (start + max < text.length) slice = slice.replace(/\s+\S*$/, '');
  return `${start > 0 ? '…' : ''}${slice}${start + slice.length < text.length ? '…' : ''}`;
}

const md = (row: CorpusRow, key: string): string | null => {
  const v = row.metadata?.[key];
  return typeof v === 'string' || typeof v === 'number' ? String(v) : null;
};

/** A human reference from the structural columns, e.g. "Bk 1 · ch. I" or "Mansion 4, Chapter 3" or "Dharana 42". */
export function reference(row: CorpusRow): string {
  const label = md(row, 'section_label') ?? md(row, 'title') ?? md(row, 'section_title') ?? md(row, 'hexagram_name') ?? md(row, 'chapter_title');
  const parts: string[] = [];
  if (row.book && row.book !== '1') parts.push(/^\d+$/.test(row.book) ? `Bk ${row.book}` : row.book);
  if (row.chapter) parts.push(`ch. ${row.chapter}`);
  if (row.verse) parts.push(`v. ${row.verse}`);
  if (row.lines) parts.push(`ll. ${row.lines}`);
  const struct = parts.join(' · ');
  const extra = label ?? (row.section && !/^[a-z0-9_]+$/.test(row.section) ? row.section : null);
  return [struct, extra].filter(Boolean).join(' · ') || row.section || '(no reference)';
}

export interface RightsHint {
  status: 'public-domain' | 'paraphrase' | 'check' | 'paper';
  note: string;
}

/** Translations in the corpus that are in copyright or of unclear status: never quote, paraphrase and mark PARAPHRASE. */
const IN_COPYRIGHT = [
  /ergin/i, // Rumi Divan, Nevit Oguz Ergin (1990s)
  /afira/i, // Ibn Arabi Fusus, modern
  /jaideva singh/i, // Vijnana Bhairava, 1979
  /wallis/i, // VBT commentary, 2010s
  /thich nhat hanh/i, // Heart Sutra
  /ram kumar rai/i, // Kularnava, 1983
  /pritzker|sefaria community/i, // Zohar (Soncino/Pritzker English), Sefaria community translations
  /\bai translation\b/i, // Neiye
  /peers/i, // Dark Night, E. Allison Peers (1935)
  /wieger/i, // Liezi English via Wieger: provenance unclear
];

/** Is the corpus translation safe to quote under the bank's rule (US public domain: published 1930 or earlier)? */
export function rightsHint(row: CorpusRow): RightsHint {
  const who = `${row.translator ?? ''} ${row.content?.slice(0, 260) ?? ''}`;
  if (row.tier === 'evidence' || row.tier === 'contested' || row.tradition === 'science') {
    return { status: 'paper', note: 'research paper: cite it, quote a few words at most, paraphrase the finding' };
  }
  if (row.tier === 'internal') return { status: 'check', note: 'QS internal note, never a public source' };
  for (const re of IN_COPYRIGHT) if (re.test(who)) return { status: 'paraphrase', note: `translation in copyright or unclear (${row.translator ?? 'see heading'}): paraphrase, mark PARAPHRASE` };
  // Translation year: the chunk metadata, else a year next to "translation"/"edition" in the translator field or the chunk heading.
  // The composition date never counts (Brother Lawrence is 1666, his English is not), except for works written in English
  // (no translator) after 1800, where the composition date is the publication date.
  const metaYear = Number(md(row, 'translation_year') ?? NaN);
  const near = [
    ...who.matchAll(/(?:translation|edition|translated|tr\.)[^\n]{0,60}?\b(1[6-9]\d\d)\b/gi),
    ...who.matchAll(/\b(1[6-9]\d\d)\)?,?\s*(?:translation|edition)/gi),
    ...(row.translator ?? '').matchAll(/\b(1[6-9]\d\d)\b/g),
  ].map((m) => Number(m[1]));
  const composed = Number(row.date_composed?.match(/\b(1[89]\d\d)\b/)?.[1] ?? NaN);
  const year = Number.isFinite(metaYear) ? metaYear : near.length ? Math.max(...near) : !row.translator && Number.isFinite(composed) ? composed : null;
  if (year !== null && year <= 1930) return { status: 'public-domain', note: `translation ${year}: quotable with credit` };
  if (year !== null) return { status: 'paraphrase', note: `translation ${year}: paraphrase, mark PARAPHRASE` };
  return { status: 'check', note: `translator/date not recorded (${row.translator || 'unknown'}): check the edition before quoting` };
}

/** Rank rows, drop zero scores and noise, keep at most `perText` per text so one long book can't fill the list. */
export function rankRows(rows: CorpusRow[], query: string, limit: number, perText: number): RankedHit[] {
  const terms = queryTerms(query);
  const phrase = queryPhrase(query);
  const seen = new Set<string>();
  const scored: RankedHit[] = [];
  for (const row of rows) {
    if (!row.content || seen.has(row.id)) continue;
    seen.add(row.id);
    const { score, matched } = scorePassage(row.content, terms, phrase);
    if (score <= 0) continue;
    scored.push({ row, score, matched, excerpt: bestExcerpt(row.content, matched.length ? matched : terms), reference: reference(row), rights: rightsHint(row) });
  }
  scored.sort((a, b) => b.score - a.score || (a.row.content?.length ?? 0) - (b.row.content?.length ?? 0));
  const perTextCount = new Map<string, number>();
  const out: RankedHit[] = [];
  for (const h of scored) {
    const key = h.row.text_name ?? '?';
    const n = perTextCount.get(key) ?? 0;
    if (n >= perText) continue;
    perTextCount.set(key, n + 1);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

/** One hit as plain text for the terminal. */
export function formatHit(h: RankedHit, i: number): string {
  const r = h.row;
  const who = [r.author, r.translator ? `tr. ${r.translator}` : null, r.date_composed].filter(Boolean).join(' · ');
  return [
    `${i + 1}. [${r.tradition}] ${r.text_name} · ${h.reference}`,
    `   ${who}`,
    `   chunk ${r.id} · tier ${r.tier ?? '?'} · score ${h.score} · matched: ${h.matched.join(', ') || '-'}`,
    `   rights: ${h.rights.status} (${h.rights.note})`,
    r.source_url ? `   ${r.source_url}` : null,
    `   "${h.excerpt}"`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The JSON shape for --json (stable keys, no embedding). */
export function hitJson(h: RankedHit) {
  const r = h.row;
  return {
    id: r.id,
    tradition: r.tradition,
    text_name: r.text_name,
    author: r.author,
    translator: r.translator,
    date_composed: r.date_composed,
    book: r.book,
    chapter: r.chapter,
    verse: r.verse,
    section: r.section,
    reference: h.reference,
    tier: r.tier,
    source_url: r.source_url,
    score: h.score,
    matched: h.matched,
    rights: h.rights,
    excerpt: h.excerpt,
  };
}

const USAGE = 'usage: corpus-pull.ts "<query>" [--tradition a,b] [--text text_name,…] [--limit 8] [--per-text 3] [--tiers lineage,evidence|all] [--json]';

/** Parse argv (after the script path). Throws with the usage line on a bad call. */
export function parseArgs(argv: string[]): PullOptions {
  const opts: PullOptions = { query: '', traditions: [], texts: [], limit: 8, perText: 3, json: false, tiers: DEFAULT_TIERS };
  const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value\n${USAGE}`);
      return v;
    };
    if (a === '--json') opts.json = true;
    else if (a === '--tradition' || a === '--traditions') opts.traditions = list(next());
    else if (a === '--text') opts.texts = list(next());
    else if (a === '--limit') opts.limit = Math.max(1, Math.min(50, Number(next()) || 8));
    else if (a === '--per-text') opts.perText = Math.max(1, Number(next()) || 3);
    else if (a === '--tiers') {
      const v = next();
      opts.tiers = v === 'all' ? null : list(v);
    } else if (a === '-h' || a === '--help') throw new Error(USAGE);
    else if (a.startsWith('--')) throw new Error(`unknown flag ${a}\n${USAGE}`);
    else words.push(a);
  }
  opts.query = words.join(' ').trim();
  if (!opts.query) throw new Error(USAGE);
  if (queryTerms(opts.query).length === 0) throw new Error(`no searchable words in "${opts.query}"\n${USAGE}`);
  return opts;
}
