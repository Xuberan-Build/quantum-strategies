/**
 * Lens 40 data collector: corpus -> brain bridge.
 *
 * For every brain claim (thesis/evidence map) and every taxonomy topic, embed a query and run
 * the read-only `match_knowledge` RPC. Report the top supporting passages (similarity, citation,
 * short excerpt), coverage by pillar, gaps (no non-QS passage above the gap line) and corpus
 * chunk counts by evidence tier.
 *
 * READ-ONLY: PostgREST SELECT/HEAD plus the STABLE `match_knowledge` function, and OpenAI embeddings.
 * Excerpts are capped at ~200 chars; no row ids, no user data.
 *
 * Tier handling: if knowledge_chunks has a `tier` column AND match_knowledge accepts
 * `filter_tiers`, retrieval is restricted to the evidence tiers (default `evidence,lineage`).
 * Otherwise it runs unfiltered and says so in `tier_filter.note`. Passages from QS's own
 * material (tradition `qs*`, tier `internal`, metadata.origin `second_brain`) never count
 * toward coverage; they are reported as `self_hits`.
 *
 * Inputs (all from the PRIVATE brain; nothing brain-specific lives in this file):
 *   --brain <dir>     brain root. Default: $BRAIN_DIR (the tick exports its worktree), else ./brain
 *   --claims <file>   claims markdown. Default: first of <brain>/{strategy,research}/thesis-evidence-map.md
 *   --taxonomy <file> default <brain>/content/taxonomy.md
 *   --queries <file>  optional JSON [{kind?, label, query, pillar?}] added to the run.
 *                     Default: <brain>/research/corpus-bridge-queries.json if present.
 *   Fallback: if no claims file exists, <brain>/strategy/authority-probes.json is used as the claim list.
 *   --tiers a,b       tiers counted as support (default evidence,lineage; env CORPUS_BRIDGE_TIERS)
 *   --gap <n>         gap line (default 0.45)    --strong <n> strong line (default 0.55)
 *   --out <file>      write JSON there instead of stdout
 *
 * Usage (from the app repo root):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/lenses/40-corpus-bridge.data.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const BRAIN = resolve(argVal('--brain') ?? process.env.BRAIN_DIR ?? 'brain');
const firstExisting = (...ps: string[]) => ps.find((p) => existsSync(p));
const CLAIMS = argVal('--claims') ?? firstExisting(join(BRAIN, 'strategy/thesis-evidence-map.md'), join(BRAIN, 'research/thesis-evidence-map.md'), join(BRAIN, 'thesis-evidence-map.md'));
const PROBES_FALLBACK = join(BRAIN, 'strategy/authority-probes.json');
const TAXONOMY = argVal('--taxonomy') ?? join(BRAIN, 'content/taxonomy.md');
const QUERIES = argVal('--queries') ?? firstExisting(join(BRAIN, 'research/corpus-bridge-queries.json'));
const SUPPORT_TIERS = (argVal('--tiers') ?? process.env.CORPUS_BRIDGE_TIERS ?? 'evidence,lineage').split(',').map((s) => s.trim()).filter(Boolean);
const ALL_TIERS = ['evidence', 'lineage', 'market_signal', 'contested', 'internal'];
const GAP = Number(argVal('--gap') ?? 0.45);
const STRONG = Number(argVal('--strong') ?? 0.55);
const OUT = argVal('--out');
const MATCH_THRESHOLD = 0.2;
const MATCH_COUNT = 10;
const PASSAGES_PER_ITEM = 3;
const EXCERPT_CHARS = 200;

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` } as Record<string, string>;
const relBrain = (p?: string) => (p ? relative(BRAIN, p) || p : null);

// ---------------------------------------------------------------- markdown helpers
const clean = (s: string) =>
  s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>]/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const kebab = (s: string) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const isSep = (line: string) => /^\s*\|?\s*:?-{2,}/.test(line);

type Table = { header: string[]; rows: string[][]; heading: string };
function tables(md: string): Table[] {
  const out: Table[] = [];
  const lines = md.split('\n');
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (h) { heading = clean(h[1]); continue; }
    if (/^\s*\|/.test(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(lines[i]).map(clean);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) rows.push(cells(lines[j]));
      out.push({ header, rows, heading });
      i = j - 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------- items
type Item = { kind: 'claim' | 'topic' | 'query'; id?: string; label: string; query: string; pillar: string | null; rite?: string | null; domain?: string | null; proposed?: boolean };

/** Pillar names -> slug, from the taxonomy's pillar table (header has Pillar + Rite + Belief). */
function pillarIndex(md: string): Map<string, string> {
  const idx = new Map<string, string>();
  for (const t of tables(md)) {
    const pc = t.header.findIndex((h) => /^pillar$/i.test(h));
    if (pc < 0 || !t.header.some((h) => /belief/i.test(h))) continue;
    for (const r of t.rows) {
      const name = clean(r[pc] ?? '');
      if (name) idx.set(name.toLowerCase(), kebab(name));
    }
  }
  return idx;
}
function toPillar(text: string | undefined, idx: Map<string, string>): string | null {
  if (!text) return null;
  const t = clean(text).toLowerCase();
  if (!t) return null;
  for (const [name, slug] of idx) if (t.includes(name) || t.includes(slug)) return slug;
  return idx.size ? null : kebab(t) || null;
}

function parseTopics(md: string, idx: Map<string, string>): Item[] {
  const items: Item[] = [];
  const lines = md.split('\n');
  let currentPillar: string | null = null;
  let currentRite: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rite = line.match(/^#{2,4}\s+Rite\s+[IVX]+\s*[·:-]\s*(.+)$/i);
    if (rite) { currentRite = clean(rite[1]); currentPillar = null; continue; }
    if (/^#{1,3}\s/.test(line) && !rite) currentPillar = null;
    const bold = line.match(/^\*\*(.+?)\*\*\s*(\(\d+\))?\s*$/);
    if (bold && idx.has(clean(bold[1]).toLowerCase())) { currentPillar = idx.get(clean(bold[1]).toLowerCase())!; continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(line).map(clean);
      const tc = header.findIndex((h) => /^(new )?topic$/i.test(h));
      const proposed = /^new topic$/i.test(header[tc] ?? '');
      const dc = header.findIndex((h) => /^domain$/i.test(h));
      const pc = header.findIndex((h) => /^pillar$/i.test(h));
      const rc = header.findIndex((h) => /^rite$/i.test(h));
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
        if (tc < 0) continue;
        const r = cells(lines[j]);
        const title = clean(r[tc] ?? '');
        if (!title) continue;
        const pillar = pc >= 0 ? toPillar(r[pc], idx) : currentPillar;
        if (!pillar) continue; // a topic table outside a pillar context (e.g. video concepts) is not a topic list
        const domain = dc >= 0 ? clean(r[dc]).replace(/[⚠\s]+$/u, '') : null;
        items.push({ kind: 'topic', label: title, query: title, pillar, rite: rc >= 0 ? clean(r[rc]) : currentRite, domain, ...(proposed ? { proposed: true } : {}) });
      }
      i = j - 1;
    }
  }
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(t.label) ? false : (seen.add(t.label), true)));
}

function parseClaims(md: string, idx: Map<string, string>): Item[] {
  const items: Item[] = [];
  // 1) any table with a claim/thesis column
  for (const t of tables(md)) {
    const cc = t.header.findIndex((h) => /claim|thesis|assertion|statement/i.test(h));
    if (cc < 0) continue;
    const qc = t.header.findIndex((h) => /query|probe|search/i.test(h));
    const pc = t.header.findIndex((h) => /pillar/i.test(h));
    const rc = t.header.findIndex((h) => /^rite/i.test(h));
    const ic = t.header.findIndex((h) => /^(#|id|ref)$/i.test(h));
    for (const r of t.rows) {
      const label = clean(r[cc] ?? '');
      if (!label || /^-+$/.test(label)) continue;
      const query = clean(qc >= 0 && r[qc] ? r[qc] : label).slice(0, 400);
      const pillarText = [pc >= 0 ? r[pc] : '', t.heading].join(' ');
      items.push({ kind: 'claim', id: ic >= 0 ? clean(r[ic]) : undefined, label: label.slice(0, 240), query, pillar: toPillar(pillarText, idx), rite: rc >= 0 ? clean(r[rc]) : null });
    }
  }
  if (items.length) return items;
  // 2) headings or list items that look like claims ("C1 …", "Claim: …"), or items under a "claims" heading
  let underClaims = false;
  let heading = '';
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const t = clean(h[2]);
      const m = t.match(/^(?:claim\s*)?(C\d+[a-z]?)[.:)\s-]+(.+)$/i) ?? t.match(/^claim[:\s-]+(.+)$/i);
      if (m) { items.push({ kind: 'claim', id: m[2] ? m[1] : undefined, label: (m[2] ?? m[1]).slice(0, 240), query: (m[2] ?? m[1]).slice(0, 400), pillar: toPillar(heading, idx) }); continue; }
      underClaims = /claim|thes[ie]s/i.test(t);
      heading = t;
      continue;
    }
    const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
    if (!li) continue;
    const t = clean(li[1]);
    const m = t.match(/^(C\d+[a-z]?)[.:)\s-]+(.+)$/i);
    if (m) items.push({ kind: 'claim', id: m[1], label: m[2].slice(0, 240), query: m[2].slice(0, 400), pillar: toPillar(`${t} ${heading}`, idx) });
    else if (underClaims && t.split(' ').length >= 4) items.push({ kind: 'claim', label: t.slice(0, 240), query: t.slice(0, 400), pillar: toPillar(`${t} ${heading}`, idx) });
  }
  return items;
}

// ---------------------------------------------------------------- REST
async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.slice(i, i + 100) }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status} ${(await res.text()).slice(0, 160)}`);
    const j = (await res.json()) as { data: { embedding: number[] }[] };
    out.push(...j.data.map((d) => d.embedding));
  }
  return out;
}

async function count(filter = ''): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?select=id${filter}`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } });
  if (!res.ok) return null;
  return Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
}

async function tierColumn(): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?select=tier&limit=1`, { headers });
  return res.ok;
}

type Hit = { tradition: string; text_name: string; author: string | null; chapter: string | null; verse: string | null; lines: string | null; section: string | null; content: string; source_url: string | null; content_type: string | null; metadata: Record<string, unknown> | null; similarity: number; tier?: string | null };

async function match(embedding: number[], tiers: string[] | null): Promise<{ hits: Hit[]; error?: string }> {
  const body: Record<string, unknown> = { query_embedding: embedding, match_threshold: MATCH_THRESHOLD, match_count: MATCH_COUNT, filter_tradition: null, filter_priority: null, filter_themes: null };
  if (tiers) body.filter_tiers = tiers;
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_knowledge`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return { hits: (await res.json()) as Hit[] };
    last = `${res.status} ${(await res.text()).slice(0, 160)}`;
    if (res.status < 500) break; // a 4xx (e.g. unknown filter_tiers) won't fix itself
  }
  return { hits: [], error: last };
}

const isSelf = (h: Hit) => /^qs/i.test(h.tradition) || h.tier === 'internal' || (h.metadata as { origin?: string } | null)?.origin === 'second_brain';
const strength = (s: number | null) => (s === null ? 'none' : s >= STRONG ? 'strong' : s > GAP ? 'moderate' : 'weak');
function citation(h: Hit): string {
  const loc = [h.chapter && `ch. ${h.chapter}`, h.verse && `v. ${h.verse}`, h.lines && `ll. ${h.lines}`, h.section].filter(Boolean).join(', ');
  return `${h.author ? `${h.author}, ` : ''}${h.text_name.replace(/_/g, ' ')}${loc ? ` (${loc})` : ''} [${h.tradition}${h.content_type ? `/${h.content_type}` : ''}]`;
}

async function pool<T, R>(xs: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(xs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (next < xs.length) { const i = next++; out[i] = await f(xs[i], i); }
  }));
  return out;
}

// ---------------------------------------------------------------- main
async function main() {
  const taxonomyMd = existsSync(TAXONOMY) ? readFileSync(TAXONOMY, 'utf8') : '';
  const idx = pillarIndex(taxonomyMd);
  const topics = taxonomyMd ? parseTopics(taxonomyMd, idx) : [];

  let claimsSource: string | null = null;
  let claims: Item[] = [];
  const notes: string[] = [];
  if (CLAIMS && existsSync(CLAIMS)) {
    claimsSource = relBrain(CLAIMS);
    claims = parseClaims(readFileSync(CLAIMS, 'utf8'), idx);
    if (!claims.length) notes.push(`claims file ${claimsSource} parsed to 0 claims: add a table with a "Claim" column (optional "Query", "Pillar", "#" columns)`);
  } else if (existsSync(PROBES_FALLBACK)) {
    claimsSource = `${relBrain(PROBES_FALLBACK)} (fallback: no thesis-evidence-map.md yet)`;
    const raw = JSON.parse(readFileSync(PROBES_FALLBACK, 'utf8')) as (string | { label?: string; query: string })[];
    claims = raw.map((p) => (typeof p === 'string' ? { kind: 'claim' as const, label: p, query: p, pillar: null } : { kind: 'claim' as const, label: p.label ?? p.query, query: p.query, pillar: null }));
    notes.push('no thesis-evidence-map.md found; authority probes used as the claim list');
  } else notes.push('no claims source found');

  let extra: Item[] = [];
  if (QUERIES && existsSync(QUERIES)) {
    const raw = JSON.parse(readFileSync(QUERIES, 'utf8')) as { kind?: string; label: string; query?: string; pillar?: string }[];
    extra = raw.map((q) => ({ kind: (q.kind === 'claim' || q.kind === 'topic' ? q.kind : 'query') as Item['kind'], label: q.label, query: q.query ?? q.label, pillar: toPillar(q.pillar, idx) ?? q.pillar ?? null }));
  }

  const items = [...claims, ...topics, ...extra];
  if (!items.length) throw new Error(`nothing to query (brain=${BRAIN})`);

  // tier filter detection
  const hasTier = await tierColumn();
  const embs = await embed(items.map((i) => i.query));
  let mode: 'rpc_filter' | 'unfiltered' = 'unfiltered';
  let tierNote = 'knowledge_chunks has no `tier` column yet (evidence-tiers migration not applied): retrieval is UNFILTERED; QS-own passages are excluded from coverage by tradition/origin instead';
  if (hasTier) {
    const probe = await match(embs[0], SUPPORT_TIERS);
    if (!probe.error) { mode = 'rpc_filter'; tierNote = `restricted to tiers ${SUPPORT_TIERS.join(', ')} via match_knowledge(filter_tiers)`; }
    else tierNote = `tier column exists but match_knowledge rejected filter_tiers (${probe.error.slice(0, 80)}): UNFILTERED, tier checked client-side where returned`;
  }

  const errors: string[] = [];
  const results = await pool(items, 2, async (it, i) => {
    const { hits, error } = await match(embs[i], mode === 'rpc_filter' ? SUPPORT_TIERS : null);
    if (error) errors.push(`${it.label.slice(0, 40)}: ${error}`);
    const support = hits.filter((h) => !isSelf(h) && (!h.tier || SUPPORT_TIERS.includes(h.tier)));
    const self = hits.filter(isSelf);
    const best = support[0]?.similarity ?? null;
    return {
      kind: it.kind,
      ...(it.id ? { id: it.id } : {}),
      label: it.label,
      ...(it.query !== it.label ? { query: it.query } : {}),
      pillar: it.pillar,
      ...(it.domain ? { domain: it.domain } : {}),
      ...(it.proposed ? { proposed: true } : {}),
      ...(error ? { error: 'match_knowledge failed after retries' } : {}),
      best_similarity: best === null ? null : Number(best.toFixed(3)),
      strength: strength(best),
      covered: best !== null && best > GAP,
      hits_over_gap: support.filter((h) => h.similarity > GAP).length,
      self_hits: self.length,
      best_self_similarity: self[0] ? Number(self[0].similarity.toFixed(3)) : null,
      passages: support.slice(0, PASSAGES_PER_ITEM).map((h) => ({
        similarity: Number(h.similarity.toFixed(3)),
        citation: citation(h),
        tradition: h.tradition,
        text_name: h.text_name,
        content_type: h.content_type,
        ...(h.tier ? { tier: h.tier } : {}),
        ...(h.source_url ? { source_url: h.source_url } : {}),
        excerpt: h.content.replace(/\s+/g, ' ').trim().slice(0, EXCERPT_CHARS),
      })),
    };
  });

  // coverage
  const ok = results.filter((r) => !('error' in r));
  const cov = (all: typeof results) => { const xs = all.filter((r) => !('error' in r)); return { covered: xs.filter((r) => r.covered).length, total: xs.length, pct: xs.length ? Math.round((100 * xs.filter((r) => r.covered).length) / xs.length) : 0, ...(all.length > xs.length ? { errored: all.length - xs.length } : {}) }; };
  const pillars = [...new Set([...idx.values(), ...results.map((r) => r.pillar).filter((p): p is string => !!p)])];
  const byPillar = pillars.map((p) => {
    const xs = results.filter((r) => r.pillar === p);
    return { pillar: p, ...cov(xs), claims: cov(xs.filter((r) => r.kind === 'claim')), topics: cov(xs.filter((r) => r.kind === 'topic')), median_best: median(xs.map((r) => r.best_similarity)) };
  });
  const gaps = ok
    .filter((r) => !r.covered)
    .sort((a, b) => (a.kind === b.kind ? (a.best_similarity ?? 0) - (b.best_similarity ?? 0) : a.kind === 'claim' ? -1 : 1))
    .map((r) => ({ kind: r.kind, ...(r.id ? { id: r.id } : {}), label: r.label, pillar: r.pillar, best_similarity: r.best_similarity, best_self_similarity: r.best_self_similarity, nearest: r.passages[0]?.citation ?? null }));

  // chunk counts by tier
  let byTier: Record<string, number | null> | { tier_column: false; total: number | null };
  if (hasTier) {
    byTier = {};
    for (const t of ALL_TIERS) byTier[t] = await count(`&tier=eq.${t}`);
    byTier['(null)'] = await count('&tier=is.null');
  } else byTier = { tier_column: false, total: await count() };

  const result = {
    generated_at: new Date().toISOString(),
    note: 'Produced by scripts/brain/lenses/40-corpus-bridge.data.ts (read-only). Excerpts truncated; quote under 25 words.',
    brain: BRAIN,
    inputs: { claims: claimsSource, claims_parsed: claims.length, taxonomy: relBrain(TAXONOMY), topics_parsed: topics.length, extra_queries: QUERIES ? relBrain(QUERIES) : null, extra_parsed: extra.length },
    tier_filter: { column: hasTier, mode, support_tiers: SUPPORT_TIERS, note: tierNote },
    thresholds: { gap: GAP, strong: STRONG, match_threshold: MATCH_THRESHOLD, match_count: MATCH_COUNT },
    corpus_by_tier: byTier,
    coverage: { overall: cov(results), claims: cov(results.filter((r) => r.kind === 'claim')), topics: cov(results.filter((r) => r.kind === 'topic')), by_pillar: byPillar, unassigned_pillar: cov(results.filter((r) => !r.pillar)) },
    gaps,
    items: results,
    ...(notes.length ? { notes } : {}),
    ...(errors.length ? { rpc_errors: errors.slice(0, 10) } : {}),
  };
  if (errors.length * 2 > items.length) throw new Error(`${errors.length}/${items.length} match_knowledge calls failed (e.g. ${errors[0]}); refusing to report misleading coverage`);
  const json = JSON.stringify(result, null, 2);
  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, json);
    console.error(`wrote ${OUT}`);
  } else console.log(json);
}

function median(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
