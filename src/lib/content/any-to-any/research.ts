/**
 * Research pack for "make from this" (the in-app half of "call in the research and topical agents").
 *
 * Server only. Pulls the same kinds of material the Claude Code agents use
 * (.claude/agents/content-brief.md, content-experience.md), from the database only:
 *   - topic:     the topical-map topic(s) the source belongs to (kg_nodes via topical-map.ts)
 *   - audience:  the topic's search queries and the audience's own words (problem quotes)
 *   - evidence:  the topic's claims and their evidence chunks, then full-text search of knowledge_chunks
 *                (fts_content, websearch syntax). Vector search is not used: stored embeddings are the old
 *                1536-dim set until the Voyage migration, so nothing is embedded here.
 *   - firstHand: Austin's own material, verbatim from rows (content_insights, interview quotes pushed into
 *                piece notes by scripts/content/apply-interview-insights.ts, his extra context). Never synthesized.
 *   - links:     published articles from the topic's assets, and LIVE product routes
 *   - gaps:      what is missing, in plain words
 *
 * Every query is defensive: a missing table, an empty map or a failed search becomes a gap, never a throw.
 * The full pipeline (brief, first-hand, QA agents) runs in Claude Code: /content-run piece:<id>.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TopicNode } from '@/lib/brain/topical-map-types';
import type { TopicScorecard } from '@/lib/brain/topical-map';
import { EVIDENCE_TIERS, type CorpusTier } from '@/lib/corpus/evidence';
import { filterHitsByTier } from '@/lib/corpus/vector-search';
import { PRODUCTS } from '@/lib/constants/products';
import type { PieceType } from './types';

const SITE = 'https://quantumstrategies.online';
export const RESEARCH_VERSION = 1;
export const DEFAULT_MAX_EVIDENCE = 8;
const EXCERPT_CHARS = 500;
const MAX_QUESTIONS = 6;
const MAX_QUOTES = 6;
const MAX_FIRST_HAND = 10;
const PER_TEXT_CAP = 2;
/** Strongest first: evidence and model before lineage (lineage is resonance, never proof). */
const TIER_ORDER: Record<string, number> = { evidence: 0, model: 1, lineage: 2 };

// ── Types ───────────────────────────────────────────────────────────────────

export interface ResearchSourceInput {
  form: string;
  title: string | null;
  text: string;
  sourcePostId?: string | null;
  insightId?: string | null;
  articleUrl?: string | null;
  /** The source asset when it is a piece (its own notes can carry interview quotes). */
  pieceId?: string | null;
}

export interface ResearchTopic {
  id: string;
  title: string;
  level: string;
  pillar: string;
  cluster: string | null;
  /** 'asset' (the source article is one of the topic's assets) or 'keywords' */
  matchedBy: 'asset' | 'keywords' | 'parent';
  matchReason: string;
  score: number;
}

export interface ResearchAudienceItem {
  text: string;
  /** query = how people search; quote = their own words */
  kind: 'query' | 'quote' | 'phrasing';
  source: string | null;
  url?: string | null;
  likes?: number | null;
  topicId: string;
}

export interface ResearchSource {
  /** S1..Sn */
  id: string;
  chunkId: string;
  textName: string | null;
  author: string | null;
  section: string | null;
  tier: string;
  url: string | null;
  excerpt: string;
  /** 'claim' (the topic's mapped evidence) or 'search' (full-text hit) */
  via: 'claim' | 'search';
  claimId?: string | null;
  claim?: string | null;
  phrase?: string | null;
}

export interface ResearchClaim {
  id: string;
  label: string;
  tier: string | null;
  sources: string[];
}

export interface ResearchFirstHand {
  /** A1..An */
  id: string;
  /** Verbatim from the row. */
  text: string;
  kind: 'insight' | 'interview_quote' | 'extra_context';
  /** Where it came from, in plain words. */
  where: string;
  sourceRef: string | null;
  refId: string | null;
}

export interface ResearchLink {
  url: string;
  label: string;
  kind: 'article' | 'product';
  status: string;
}

export interface ResearchPack {
  version: number;
  builtAt: string;
  target: PieceType;
  topics: ResearchTopic[];
  questions: ResearchAudienceItem[];
  words: ResearchAudienceItem[];
  claims: ResearchClaim[];
  sources: ResearchSource[];
  firstHand: ResearchFirstHand[];
  links: ResearchLink[];
  phrases: string[];
  gaps: string[];
  counts: { sources: number; firstHand: number; questions: number; words: number; links: number; topics: number };
}

export interface ResearchDeps {
  /** All topical-map nodes (defaults to getTopicalMap). */
  topics?: () => Promise<TopicNode[]>;
  /** One topic scorecard (defaults to getTopic). */
  topic?: (id: string) => Promise<TopicScorecard | null>;
}

export interface BuildResearchArgs {
  source: ResearchSourceInput;
  target: PieceType;
  maxEvidence?: number;
  /** Austin's extra context from the make box (his own words, carried as an A# item). */
  extraContext?: string | null;
  /** True when extraContext is the source itself (an external post), so it is not first-hand. */
  extraIsSource?: boolean;
}

// ── Keywords ────────────────────────────────────────────────────────────────

const STOP = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both but by can
  cannot could did do does doing down during each even ever every few for from further get gets got had has have having he her here
  hers him his how i if in into is it its itself just like make makes made me more most much must my myself no nor not now of off on
  once one only or other our ours out over own really same say says she should so some still such than that the their theirs them
  then there these they thing things this those through to too under until up us very want was way we were what when where which
  while who whom why will with without would you your yours yourself yourselves isn dont don doesn didn youre ive im its it's
  something someone anything everything nothing new old get getting go going know see seen look week day days time times
  people person lot lots way ways back first last next keep keeps kept everywhere always never actually maybe feel feels two three four five six seven eight nine ten`
    .split(/\s+/)
    .filter(Boolean),
);

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Lowercase content words (stopwords out, light plural stem). Hyphens split ("self-image" → self, image). */
export function tokens(text: string): string[] {
  return (text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) ?? [])
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

function rawWords(text: string): string[] {
  return text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) ?? [];
}

/** The part of the source that says what it is about: title, insight line, first lines. */
function headText(source: ResearchSourceInput, insightLine?: string | null): string {
  const body = source.text.replace(/^[A-Z ]+:\s*/gm, ' ');
  return [source.title ?? '', insightLine ?? '', body.slice(0, 400)].join(' \n ');
}

/**
 * 2 or 3 search phrases from the source, no model needed: adjacent content-word pairs from the head
 * (title, insight, first lines) ranked by how often they recur in the whole text, then the strongest single words.
 */
export function extractKeyPhrases(source: ResearchSourceInput, insightLine?: string | null, max = 3): string[] {
  const head = headText(source, insightLine);
  const all = `${head}\n${source.text}`;
  const freq = new Map<string, number>();
  for (const t of tokens(all)) freq.set(t, (freq.get(t) ?? 0) + 1);
  const headTokens = new Set(tokens(head));

  const pairs = new Map<string, number>();
  // pairs only within a line / sentence, from raw words so stopwords break adjacency
  for (const segment of head.split(/[\n.!?:;,()"]+/)) {
    const w = rawWords(segment);
    for (let i = 0; i < w.length - 1; i++) {
      const a = w[i];
      const b = w[i + 1];
      if (a.length < 3 || b.length < 3 || STOP.has(a) || STOP.has(b) || /^\d+$/.test(a) || /^\d+$/.test(b)) continue;
      const key = `${a} ${b}`;
      const score = (freq.get(stem(a)) ?? 1) + (freq.get(stem(b)) ?? 1);
      pairs.set(key, Math.max(pairs.get(key) ?? 0, score) + 0.5);
    }
  }
  const out: string[] = [];
  const used = new Set<string>();
  for (const [p] of [...pairs.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
    if (out.length >= max - 1) break;
    const ws = p.split(' ').map(stem);
    if (ws.every((w) => used.has(w))) continue;
    out.push(p);
    ws.forEach((w) => used.add(w));
  }
  const singles = [...headTokens]
    .filter((t) => !used.has(t) && t.length > 3)
    .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b));
  for (const s of singles) {
    if (out.length >= max) break;
    out.push(s);
  }
  return out.slice(0, max);
}

// ── Topic matching ──────────────────────────────────────────────────────────

/** content_post:<slug> refs that point at the source article. */
function sourceSlug(source: ResearchSourceInput): string | null {
  const m = source.articleUrl?.match(/\/articles\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const LEVEL_WEIGHT: Record<string, number> = { subtopic: 1, topic: 1.1, section: 0.7, pillar: 0.4 };

export interface TopicMatch {
  node: TopicNode;
  matchedBy: 'asset' | 'keywords';
  score: number;
  reason: string;
}

/**
 * Match the source to topics. (a) a topic whose assets include the source article (content_post:<slug>);
 * (b) else keyword overlap between the source head (title, insight line, first lines) and topic titles plus their
 * queries. Returns the best 1 or 2.
 */
export function matchTopics(nodes: TopicNode[], source: ResearchSourceInput, insightLine?: string | null): TopicMatch[] {
  const slug = sourceSlug(source);
  if (slug) {
    const byAsset = nodes
      .filter((n) => n.assets.some((a) => a.ref === `content_post:${slug}`))
      .sort((a, b) => (LEVEL_WEIGHT[b.level] ?? 1) - (LEVEL_WEIGHT[a.level] ?? 1) || b.scores.priority - a.scores.priority);
    if (byAsset.length) {
      return byAsset.slice(0, 2).map((node) => ({
        node,
        matchedBy: 'asset' as const,
        score: 100,
        reason: `the source article (${slug}) is one of this topic's assets`,
      }));
    }
  }

  const src = new Set(tokens(headText(source, insightLine)));
  if (!src.size) return [];
  const scored: TopicMatch[] = [];
  for (const node of nodes) {
    const label = new Set(tokens(node.label));
    const queries = new Set(node.queries.flatMap((q) => tokens(q.text)));
    const labelHits = [...label].filter((t) => src.has(t));
    const queryHits = [...queries].filter((t) => src.has(t) && !label.has(t));
    const distinct = new Set([...labelHits, ...queryHits]);
    if (distinct.size < 2) continue;
    const raw = labelHits.length * 2 + queryHits.length;
    // favour a tight label (a 3-word label matching 2 words beats a 12-word label matching 2)
    const score = (raw / Math.sqrt(Math.max(3, label.size))) * (LEVEL_WEIGHT[node.level] ?? 1);
    scored.push({
      node,
      matchedBy: 'keywords',
      score: Math.round(score * 100) / 100,
      reason: `shared words: ${[...distinct].slice(0, 6).join(', ')}`,
    });
  }
  scored.sort((a, b) => b.score - a.score || b.node.scores.priority - a.node.scores.priority || a.node.id.localeCompare(b.node.id));
  const best = scored[0];
  if (!best) return [];
  const second = scored.find((s, i) => i > 0 && s.score >= best.score * 0.75 && s.node.parent !== best.node.id && best.node.parent !== s.node.id);
  return second ? [best, second] : [best];
}

// ── Evidence ────────────────────────────────────────────────────────────────

interface ChunkRow {
  id: string;
  text_name: string | null;
  author: string | null;
  section: string | null;
  chapter?: string | null;
  content: string | null;
  tier: string | null;
  source_url: string | null;
}

const CHUNK_COLUMNS = 'id, text_name, author, section, chapter, content, tier, source_url';

/** ≤ 500 chars around the first place the words appear (whole words, trimmed with ellipses). */
export function excerptAround(content: string, words: string[], max = EXCERPT_CHARS): string {
  const text = content.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const lower = text.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w.toLowerCase());
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  let start = Math.max(0, at - 150);
  if (start > 0) {
    const sp = text.indexOf(' ', start);
    start = sp >= 0 && sp < at ? sp + 1 : start;
  }
  const room = max - (start > 0 ? 1 : 0) - 1;
  let slice = text.slice(start, start + room);
  if (start + room < text.length) slice = slice.replace(/\s+\S*$/, '');
  return `${start > 0 ? '…' : ''}${slice}${start + slice.length < text.length ? '…' : ''}`;
}

/** Page furniture that got chunked (PMC headers, nav), not a passage anyone can cite. */
function isBoilerplate(content: string): boolean {
  if (/Search in PMC|View in NLM Catalog|Add to search/i.test(content) || (content.match(/[a-z]/gi)?.length ?? 0) < 40) return true;
  // Reference lists that got chunked: "[ DOI ] [ PubMed ] [ Google Scholar ]" runs, not citable prose.
  const refMarks = content.match(/\[\s*(DOI|PubMed|Google Scholar|PMC free article)\s*\]/gi)?.length ?? 0;
  return refMarks >= 3 && refMarks / Math.max(1, content.length / 1000) > 2;
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160);
}

async function fullTextSearch(client: SupabaseClient, query: string, tiers: readonly string[], limit: number): Promise<ChunkRow[]> {
  for (const column of ['fts_content', 'content']) {
    try {
      const { data, error } = await client
        .from('knowledge_chunks')
        .select(CHUNK_COLUMNS)
        .textSearch(column, query, { type: 'websearch', config: 'english' })
        .in('tier', [...tiers])
        .limit(limit);
      if (!error) return (data ?? []) as ChunkRow[];
    } catch {
      /* try the next column */
    }
  }
  return [];
}

/** Rows whose own tier column is null are dropped (fail closed), then filterHitsByTier semantics. */
async function tierFiltered<T extends ChunkRow>(rows: T[], tiers: readonly CorpusTier[]): Promise<T[]> {
  const known = rows.filter((r) => typeof r.tier === 'string');
  return filterHitsByTier(known as (T & { tier: string })[], tiers);
}

interface Candidate {
  row: ChunkRow;
  via: 'claim' | 'search';
  claimId?: string | null;
  claim?: string | null;
  phrase?: string | null;
  hits: number;
  overlap: number;
  /** found by a multi-word phrase (single words are weaker matches) */
  multi?: boolean;
}

// ── First-hand ──────────────────────────────────────────────────────────────

/**
 * `From interview <date> [<id>] (read back) (lived): "<quote>" -> <fills>` lines (scripts/content/apply-interview-insights.ts).
 * Parentheticals are optional and in any order: "read back" marks a confirmed line; lived / view / worked-out says what it is
 * (worked-out = an understanding reached in a mentor session after Claude introduced research, never a lived story).
 */
const INTERVIEW_LINE = /From interview ([0-9-]+) \[([^\]]+)\]((?:\s*\([^)]*\))*):\s*"([^"]+)"/g;

export type InterviewKind = 'lived' | 'view' | 'worked-out' | null;

export function interviewQuotes(notes: string | null | undefined): { date: string; id: string; quote: string; confirmed: boolean; kind: InterviewKind }[] {
  if (!notes) return [];
  const out: { date: string; id: string; quote: string; confirmed: boolean; kind: InterviewKind }[] = [];
  for (const m of notes.matchAll(INTERVIEW_LINE)) {
    const parens = m[3] ?? '';
    const kind = (/\((lived|view|worked-out)\)/.exec(parens)?.[1] ?? null) as InterviewKind;
    out.push({ date: m[1], id: m[2], quote: m[4].trim(), confirmed: /\(read back\)/.test(parens), kind });
  }
  return out;
}

interface InsightRow {
  id: string;
  line: string | null;
  source_kind: string | null;
  source_ref: string | null;
  source_post_id: string | null;
  pillar: string | null;
  cluster: string | null;
  status?: string | null;
}

type QueryThunk = () => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

/** Run a query built inside the thunk, so a builder that throws (missing method, bad table) is a gap too. */
async function safeRows<T>(q: QueryThunk): Promise<{ rows: T[]; error: string | null }> {
  try {
    const { data, error } = await q();
    if (error) return { rows: [], error: error.message ?? 'query failed' };
    return { rows: (Array.isArray(data) ? data : data ? [data] : []) as T[], error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Links ───────────────────────────────────────────────────────────────────

function productRoute(label: string, id: string): string | null {
  const slug = id.replace(/^product:/, '');
  const byName = Object.values(PRODUCTS).find((p) => p.name.toLowerCase() === label.toLowerCase());
  const bySlug = PRODUCTS[slug];
  const hit = byName ?? bySlug;
  return hit ? `${SITE}/products/${hit.slug}/` : null;
}

// ── Build ───────────────────────────────────────────────────────────────────

async function defaultTopics(client: SupabaseClient): Promise<TopicNode[]> {
  const { getTopicalMap } = await import('@/lib/brain/topical-map');
  return (await getTopicalMap({ client })).nodes;
}

async function defaultTopic(client: SupabaseClient, id: string): Promise<TopicScorecard | null> {
  const { getTopic } = await import('@/lib/brain/topical-map');
  return getTopic(id, { client, quotesPerProblem: 3, chunksPerClaim: 2 });
}

export async function buildResearchPack(client: SupabaseClient, args: BuildResearchArgs, deps: ResearchDeps = {}): Promise<ResearchPack> {
  const { source, target } = args;
  const maxEvidence = Math.max(1, Math.min(20, args.maxEvidence ?? DEFAULT_MAX_EVIDENCE));
  const gaps: string[] = [];
  const tiers = EVIDENCE_TIERS;

  // The insight the source carries (its line feeds topic matching and is an A# item).
  let insight: InsightRow | null = null;
  if (source.insightId) {
    const { rows } = await safeRows<InsightRow>(() =>
      client.from('content_insights').select('id, line, source_kind, source_ref, source_post_id, pillar, cluster, status').eq('id', source.insightId).maybeSingle(),
    );
    insight = rows[0] ?? null;
  }

  // 1. Topic
  let nodes: TopicNode[] = [];
  try {
    nodes = await (deps.topics ? deps.topics() : defaultTopics(client));
  } catch (e) {
    gaps.push(`Topical map could not be read (${e instanceof Error ? e.message : String(e)}).`);
  }
  const matches = nodes.length ? matchTopics(nodes, source, insight?.line) : [];
  const loadCard = async (id: string): Promise<TopicScorecard | null> => {
    try {
      return await (deps.topic ? deps.topic(id) : defaultTopic(client, id));
    } catch {
      return null; // keep the match without its scorecard
    }
  };
  const cards: TopicScorecard[] = [];
  for (const m of matches) {
    const card = await loadCard(m.node.id);
    if (card) cards.push(card);
  }
  const topics: ResearchTopic[] = matches.map((m) => ({
    id: m.node.id,
    title: m.node.label,
    level: m.node.level,
    pillar: m.node.pillarCode,
    cluster: m.node.mapsTo?.cluster ?? null,
    matchedBy: m.matchedBy,
    matchReason: m.reason,
    score: m.score,
  }));
  if (!topics.length) gaps.push('No topical-map topic matched this source: no search queries, audience words or mapped claims to work from.');
  // A query-level subtopic often carries no claims or quotes of its own: borrow its parent's.
  for (const card of [...cards]) {
    const parentId = card.topic.parent;
    if (!parentId || cards.some((c) => c.topic.id === parentId)) continue;
    const hasQuotes = card.problems.some((p) => p.quotes.length > 0);
    if (card.claims.length && hasQuotes) continue;
    const parent = await loadCard(parentId);
    if (!parent) continue;
    cards.push(parent);
    topics.push({
      id: parent.topic.id,
      title: parent.topic.label,
      level: parent.topic.level,
      pillar: parent.topic.pillarCode,
      cluster: parent.topic.mapsTo?.cluster ?? null,
      matchedBy: 'parent',
      matchReason: `parent of ${card.topic.id}, which has ${card.claims.length ? 'no audience quotes' : 'no mapped claims'}`,
      score: 0,
    });
  }

  // 2. Audience
  const questions: ResearchAudienceItem[] = [];
  const words: ResearchAudienceItem[] = [];
  const seenQ = new Set<string>();
  for (const card of cards) {
    for (const q of card.queries) {
      const k = normKey(q.text);
      if (!k || seenQ.has(k) || questions.length >= MAX_QUESTIONS) continue;
      seenQ.add(k);
      questions.push({ text: q.text, kind: 'query', source: q.sources?.length ? q.sources.join(', ') : 'topical map', topicId: card.topic.id });
    }
  }
  const seenW = new Set<string>();
  for (const card of cards) {
    for (const p of card.problems) {
      for (const q of p.quotes) {
        const k = normKey(q.text);
        if (!k || seenW.has(k) || words.length >= MAX_QUOTES) continue;
        seenW.add(k);
        words.push({ text: q.text, kind: 'quote', source: [q.source, p.label].filter(Boolean).join(' · ') || null, url: q.url, likes: q.likes, topicId: card.topic.id });
      }
    }
  }
  if (!words.length) {
    for (const card of cards) {
      for (const w of card.topic.audienceWords ?? []) {
        const k = normKey(w);
        if (!k || seenW.has(k) || words.length >= MAX_QUOTES) continue;
        seenW.add(k);
        words.push({ text: w, kind: 'phrasing', source: 'topical map audience phrasing (coded, check before quoting)', topicId: card.topic.id });
      }
    }
  }
  if (topics.length && !questions.length) gaps.push('The matched topic has no search queries.');
  if (topics.length && !words.length) gaps.push("No audience quotes for the matched topic: don't pass the topic label off as their words.");

  // 3. Evidence: the topic's claims first, then full-text search
  const phrases = extractKeyPhrases(source, insight?.line, 3);
  const candidates: Candidate[] = [];
  const claimLinks: { id: string; label: string; tier: string | null; chunkIds: string[] }[] = [];
  const claimChunkIds = new Set<string>();
  for (const card of cards) {
    for (const c of card.claims) {
      const ids = c.evidence.map((e) => e.chunkId).filter(Boolean);
      claimLinks.push({ id: c.id, label: c.label, tier: c.tier, chunkIds: ids });
      ids.forEach((id) => claimChunkIds.add(id));
    }
  }
  if (claimChunkIds.size) {
    const { rows } = await safeRows<ChunkRow>(() => client.from('knowledge_chunks').select(CHUNK_COLUMNS).in('id', [...claimChunkIds]));
    const byId = new Map((await tierFiltered(rows, tiers)).map((r) => [r.id, r]));
    for (const cl of claimLinks) {
      for (const id of cl.chunkIds) {
        const row = byId.get(id);
        if (row) candidates.push({ row, via: 'claim', claimId: cl.id, claim: cl.label, hits: 99, overlap: 0 });
      }
    }
  }

  const searchQueries: string[] = [...phrases];
  const headQuery = cards[0]?.queries[0]?.text;
  if (headQuery && !searchQueries.some((p) => normKey(p) === normKey(headQuery))) searchQueries.push(headQuery);
  const searchHits = new Map<string, Candidate>();
  const sourceTokens = new Set(tokens(headText(source, insight?.line)));
  let searchFailed = 0;
  for (const phrase of searchQueries.slice(0, 4)) {
    const ws = tokens(phrase);
    if (!ws.length) continue;
    // a single word is a weak query: only use it when the phrases came up short
    if (ws.length === 1 && searchHits.size >= maxEvidence) continue;
    const forms = ws.length > 1 ? [`"${ws.join(' ')}"`, ws.join(' ')] : [ws[0]];
    // per phrase: the exact phrase, then all its words; evidence/model tiers first, lineage only to fill
    let found: ChunkRow[] = [];
    const enough = Math.min(3, maxEvidence);
    for (const tierSet of [tiers.filter((t) => t !== 'lineage'), ['lineage']]) {
      if (found.length >= enough) break;
      // lineage (resonance) only on the exact phrase: an all-words match there is mostly noise
      for (const q of tierSet.includes('lineage') && forms.length > 1 ? forms.slice(0, 1) : forms) {
        if (found.length >= enough) break;
        const rows = await fullTextSearch(client, q, tierSet, maxEvidence);
        found = [...found, ...rows.filter((r) => !found.some((f) => f.id === r.id))];
      }
    }
    if (!found.length) searchFailed++;
    for (const row of await tierFiltered(found, tiers)) {
      const content = (row.content ?? '').toLowerCase();
      const overlap = ws.filter((w) => content.includes(w)).length;
      // a one-word hit must share at least one more word with the source, or it is noise
      if (ws.length === 1) {
        const chunkTokens = new Set(tokens(content));
        if ([...sourceTokens].filter((t) => chunkTokens.has(t)).length < 2) continue;
      }
      const prev = searchHits.get(row.id);
      if (prev) {
        prev.hits++;
        prev.multi = prev.multi || ws.length > 1;
      } else searchHits.set(row.id, { row, via: 'search', phrase, hits: 1, overlap, multi: ws.length > 1 });
    }
  }
  candidates.push(
    ...[...searchHits.values()].sort(
      (a, b) =>
        Number(!!b.multi) - Number(!!a.multi) ||
        b.hits - a.hits ||
        (TIER_ORDER[a.row.tier ?? ''] ?? 9) - (TIER_ORDER[b.row.tier ?? ''] ?? 9) ||
        b.overlap - a.overlap ||
        a.row.id.localeCompare(b.row.id),
    ),
  );

  // dedupe (same chunk id, or same text), at most 2 passages per text, number S1..Sn
  const sources: ResearchSource[] = [];
  const seenChunk = new Set<string>();
  const seenText = new Set<string>();
  const perText = new Map<string, number>();
  const excerptWords = phrases.flatMap((p) => p.split(' '));
  for (const c of candidates) {
    if (sources.length >= maxEvidence) break;
    const content = c.row.content ?? '';
    const tk = normKey(content);
    if (!content.trim() || seenChunk.has(c.row.id) || seenText.has(tk) || isBoilerplate(content)) continue;
    const textKey = c.row.text_name ?? c.row.source_url ?? c.row.id;
    if ((perText.get(textKey) ?? 0) >= PER_TEXT_CAP) continue;
    seenChunk.add(c.row.id);
    seenText.add(tk);
    perText.set(textKey, (perText.get(textKey) ?? 0) + 1);
    sources.push({
      id: `S${sources.length + 1}`,
      chunkId: c.row.id,
      textName: c.row.text_name,
      author: c.row.author,
      section: c.row.section ?? c.row.chapter ?? null,
      tier: c.row.tier as string,
      url: c.row.source_url,
      excerpt: excerptAround(content, c.via === 'search' && c.phrase ? c.phrase.split(' ') : excerptWords),
      via: c.via,
      claimId: c.claimId ?? null,
      claim: c.claim ?? null,
      phrase: c.phrase ?? null,
    });
  }
  const claims: ResearchClaim[] = [];
  const seenClaim = new Set<string>();
  for (const cl of claimLinks) {
    if (seenClaim.has(cl.id)) continue;
    seenClaim.add(cl.id);
    claims.push({ id: cl.id, label: cl.label, tier: cl.tier, sources: sources.filter((s) => s.claimId === cl.id).map((s) => s.id) });
  }
  if (sources.length < 3) {
    gaps.push(
      `Only ${sources.length} evidence passage${sources.length === 1 ? '' : 's'} found (full-text search; vector search is down until the Voyage migration). Expect [NEEDS SOURCE] marks.`,
    );
  }
  if (searchFailed && searchFailed === Math.min(4, searchQueries.length) && !claimChunkIds.size) {
    gaps.push(`Full-text search found nothing for: ${searchQueries.slice(0, 4).join('; ')}.`);
  }
  if (sources.length && sources.every((s) => s.tier === 'lineage')) {
    gaps.push('Every passage is lineage tier (where the idea comes from): resonance only, nothing here proves a mechanism.');
  }

  // 4. First-hand (verbatim rows only)
  const firstHand: ResearchFirstHand[] = [];
  const seenFirst = new Set<string>();
  const addFirst = (item: Omit<ResearchFirstHand, 'id'>) => {
    const k = normKey(item.text);
    if (!k || seenFirst.has(k) || firstHand.length >= MAX_FIRST_HAND) return;
    seenFirst.add(k);
    firstHand.push({ id: `A${firstHand.length + 1}`, ...item });
  };
  let insightsMissing = false;
  if (insight?.line) {
    addFirst({ text: insight.line, kind: 'insight', where: 'the insight this source carries', sourceRef: [insight.source_kind, insight.source_ref].filter(Boolean).join(' · ') || null, refId: insight.id });
  }
  const insightQueries: { where: string; run: QueryThunk }[] = [];
  const INSIGHT_COLS = 'id, line, source_kind, source_ref, source_post_id, pillar, cluster, status';
  if (source.sourcePostId) {
    insightQueries.push({ where: 'insight lifted from the same article', run: () => client.from('content_insights').select(INSIGHT_COLS).eq('source_post_id', source.sourcePostId!).limit(6) });
  }
  const topicClusters = new Set(topics.map((t) => t.cluster).filter((c): c is string => !!c));
  const topicPillars = [...new Set(topics.map((t) => t.pillar).filter((p) => p && p !== 'SPINE'))];
  for (const pillar of topicPillars) {
    insightQueries.push({ where: `insight in the topic's pillar (${pillar})`, run: () => client.from('content_insights').select(INSIGHT_COLS).eq('pillar', pillar).limit(12) });
  }
  for (const q of insightQueries) {
    const { rows, error } = await safeRows<InsightRow>(q.run);
    if (error && /content_insights|schema cache|does not exist/i.test(error)) {
      insightsMissing = true;
      break;
    }
    const active = rows.filter((r) => r.line && (r.status ?? 'active') === 'active');
    // cluster matches first within a pillar
    active.sort((a, b) => Number(clusterMatch(b.cluster, topicClusters)) - Number(clusterMatch(a.cluster, topicClusters)));
    for (const r of active.slice(0, q.where.startsWith('insight in the topic') ? 4 : 6)) {
      addFirst({
        text: r.line!,
        kind: 'insight',
        where: clusterMatch(r.cluster, topicClusters) ? `${q.where}, same cluster` : q.where,
        sourceRef: [r.source_kind, r.source_ref].filter(Boolean).join(' · ') || null,
        refId: r.id,
      });
    }
  }

  // interview quotes in notes of related pieces (and the source piece itself)
  const pieceRows: { id: string; title: string | null; notes: string | null }[] = [];
  const pieceQueries: QueryThunk[] = [];
  if (source.pieceId) pieceQueries.push(() => client.from('content_pieces').select('id, title, notes').eq('id', source.pieceId).limit(1));
  if (source.sourcePostId) pieceQueries.push(() => client.from('content_pieces').select('id, title, notes').eq('source_post_id', source.sourcePostId).limit(80));
  if (source.insightId) pieceQueries.push(() => client.from('content_pieces').select('id, title, notes').eq('insight_id', source.insightId).limit(40));
  for (const q of pieceQueries) {
    const { rows } = await safeRows<{ id: string; title: string | null; notes: string | null }>(q);
    for (const r of rows) if (!pieceRows.some((p) => p.id === r.id)) pieceRows.push(r);
  }
  for (const p of pieceRows) {
    for (const q of interviewQuotes(p.notes)) {
      addFirst({
        text: q.quote,
        kind: 'interview_quote',
        where: `interview ${q.date} [${q.id}]${q.confirmed ? ', read back' : ''}${q.kind ? `, ${q.kind === 'worked-out' ? 'worked out in a mentor session (not a lived story)' : q.kind}` : ''}, in the notes of piece "${p.title ?? p.id}"`,
        sourceRef: `interview ${q.date} [${q.id}]`,
        refId: p.id,
      });
    }
  }
  if (args.extraContext?.trim() && !args.extraIsSource) {
    addFirst({ text: args.extraContext.trim().slice(0, 1500), kind: 'extra_context', where: 'typed by Austin into Make from this', sourceRef: null, refId: null });
  }
  if (insightsMissing) gaps.push('content_insights is not available yet (the any-to-any migration is not applied), so linked insights were not read.');
  if (!firstHand.length) gaps.push("No first-hand material from Austin (insights, interview quotes): every story stays an [AUSTIN: …] question.");

  // 5. Links
  const links: ResearchLink[] = [];
  const ownSlug = sourceSlug(source);
  const articleAssets = new Map<string, string>();
  for (const card of cards) {
    for (const a of card.assets) {
      if (a.kind !== 'content_post' && !a.ref.startsWith('content_post:')) continue;
      if (a.status !== 'LIVE') continue;
      const slug = a.ref.replace(/^content_post:/, '');
      if (slug && slug !== ownSlug && !articleAssets.has(slug)) articleAssets.set(slug, a.label ?? slug);
    }
  }
  if (articleAssets.size) {
    const { rows, error } = await safeRows<{ slug: string; title: string | null; is_published: boolean | null }>(() =>
      client.from('content_posts').select('slug, title, is_published').in('slug', [...articleAssets.keys()]),
    );
    const published = new Map(rows.filter((r) => r.is_published).map((r) => [r.slug, r]));
    for (const [slug, label] of articleAssets) {
      // published articles only; if the check itself failed, trust the map's LIVE status
      if (!error && !published.has(slug)) continue;
      links.push({ url: `${SITE}/articles/${slug}/`, label: published.get(slug)?.title ?? label, kind: 'article', status: 'LIVE' });
    }
  }
  const seenProduct = new Set<string>();
  for (const card of cards) {
    for (const p of card.products) {
      if (seenProduct.has(p.id) || (p.status ?? '').toUpperCase() !== 'LIVE') continue;
      seenProduct.add(p.id);
      const url = productRoute(p.label, p.id);
      if (url) links.push({ url, label: p.label, kind: 'product', status: 'LIVE' });
    }
  }
  if (topics.length && !links.length) gaps.push('No published internal links or LIVE product routes on the matched topic.');

  return {
    version: RESEARCH_VERSION,
    builtAt: new Date().toISOString(),
    target,
    topics,
    questions,
    words,
    claims,
    sources,
    firstHand,
    links,
    phrases: searchQueries.slice(0, 4),
    gaps,
    counts: { sources: sources.length, firstHand: firstHand.length, questions: questions.length, words: words.length, links: links.length, topics: topics.length },
  };
}

function clusterMatch(cluster: string | null, topicClusters: Set<string>): boolean {
  if (!cluster) return false;
  const c = cluster.toLowerCase();
  for (const t of topicClusters) if (t.toLowerCase() === c || t.toLowerCase().endsWith(c) || t.toLowerCase() === `cluster:${c}`) return true;
  return false;
}

// ── Prompt block ────────────────────────────────────────────────────────────

/** Rules added to the prompt whenever a research pack is present. */
export const RESEARCH_RULES = [
  'Every factual claim (a study, a number, a mechanism, a named finding) cites its source right after it as [S#], using only the numbered SOURCES in the research pack. A claim no S# supports gets [NEEDS SOURCE] instead.',
  'Lineage-tier sources show where an idea comes from. Use them as "as <author> put it", never as "research shows". Never cite a source for more than its excerpt says.',
  "First-person stories, examples and opinions of Austin's come only from the AUSTIN'S MATERIAL items, cited [A#]. If none fits, write [AUSTIN: <a specific question for him>] instead. Never invent a story, a client, a conversation, a quote or a number.",
  'Answer at least 2 of the AUDIENCE QUESTIONS (pick the ones that fit) and use the audience\'s own words where they read naturally.',
  'Never invent a source, an author, a title or a URL. Link only to URLs listed under INTERNAL LINKS, and only where the format allows links.',
  'Leave the [S#], [A#], [NEEDS SOURCE] and [AUSTIN: …] markers in the draft: Austin checks them and removes them before publishing.',
];

/** The numbered sources, one entry per passage (also the video-script brief's SOURCES). */
export function sourcesBlock(pack: ResearchPack): string {
  if (!pack.sources.length) return 'none found. Every factual claim beyond the source gets [NEEDS SOURCE].';
  return pack.sources
    .map((s) => {
      const who = [s.author, s.textName, s.section].filter(Boolean).join(', ');
      return `[${s.id}] ${who || 'untitled'} · tier: ${s.tier}${s.claim ? ` · backs claim: ${s.claim}` : ''}${s.url ? ` · ${s.url}` : ''}\n     "${s.excerpt}"`;
    })
    .join('\n');
}

/** The RESEARCH PACK block for the prompt. `omitSources` when the sources travel separately (video brief). */
export function researchBlock(pack: ResearchPack, opts: { omitSources?: boolean } = {}): string {
  const lines: string[] = ['RESEARCH PACK (from the topical map and the knowledge corpus; nothing here is invented)'];
  if (pack.topics.length) {
    lines.push(`TOPIC: ${pack.topics.map((t) => `${t.title} (${t.id}, ${t.pillar})`).join('; ')}`);
  } else {
    lines.push('TOPIC: no topical-map match.');
  }
  if (opts.omitSources) lines.push('', 'SOURCES: see SOURCES below (cite as [S#]).');
  else lines.push('', 'SOURCES (cite as [S#]):', sourcesBlock(pack));
  if (pack.claims.length) {
    lines.push('', 'MAPPED CLAIMS FOR THIS TOPIC:');
    for (const c of pack.claims) lines.push(`- ${c.label}${c.tier ? ` (tier ${c.tier})` : ''}: ${c.sources.length ? c.sources.map((s) => `[${s}]`).join(' ') : 'no passage loaded, [NEEDS SOURCE] if used'}`);
  }
  lines.push('', 'AUDIENCE QUESTIONS AND WORDS:');
  if (pack.questions.length || pack.words.length) {
    for (const q of pack.questions) lines.push(`- Q (search): ${q.text}`);
    for (const w of pack.words) lines.push(`- Their words${w.kind === 'phrasing' ? ' (coded phrasing)' : ''}: ${w.text}${w.source ? ` (${w.source})` : ''}`);
  } else {
    lines.push('none on file.');
  }
  lines.push('', "AUSTIN'S MATERIAL (his own words, cite as [A#]):");
  if (pack.firstHand.length) {
    for (const a of pack.firstHand) lines.push(`[${a.id}] "${a.text}" (${a.where}${a.sourceRef ? `; ${a.sourceRef}` : ''})`);
  } else {
    lines.push('none on file. Every story of his is an [AUSTIN: <question>] placeholder.');
  }
  lines.push('', 'INTERNAL LINKS:');
  if (pack.links.length) for (const l of pack.links) lines.push(`- ${l.label} (${l.kind}): ${l.url}`);
  else lines.push('none beyond the article URL above.');
  return lines.join('\n');
}

/** What gets stored on content_pieces.platform_meta.research (no full chunk text beyond the excerpt). */
export function researchMeta(pack: ResearchPack): Record<string, unknown> {
  return {
    version: pack.version,
    built_at: pack.builtAt,
    topics: pack.topics,
    topic_id: pack.topics[0]?.id ?? null,
    phrases: pack.phrases,
    sources: pack.sources.map((s) => ({
      id: s.id,
      chunk_id: s.chunkId,
      text_name: s.textName,
      author: s.author,
      section: s.section,
      tier: s.tier,
      url: s.url,
      via: s.via,
      claim: s.claim ?? null,
      excerpt: s.excerpt,
    })),
    claims: pack.claims,
    questions: pack.questions.map((q) => q.text),
    words: pack.words.map((w) => ({ text: w.text, source: w.source, url: w.url ?? null })),
    first_hand: pack.firstHand,
    links: pack.links,
    gaps: pack.gaps,
    counts: pack.counts,
  };
}

/** Targets long enough that a pack is worth building even going across or down. */
export const RESEARCH_LONG_TARGETS: readonly PieceType[] = ['blog', 'youtube_long', 'x_article', 'reddit_post'];

export function wantsResearch(direction: string, target: PieceType): boolean {
  return direction === 'up' || RESEARCH_LONG_TARGETS.includes(target);
}
