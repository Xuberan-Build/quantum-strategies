/**
 * Lens 20 data collector: knowledge-corpus statistics for the authority lens.
 *
 * READ-ONLY. Issues SELECTs via PostgREST plus (optionally) the read-only
 * `match_knowledge` RPC for retrieval probes. Emits aggregates only: no chunk
 * content, no row IDs, no user identifiers.
 *
 * Usage (from the app repo root):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx \
 *     scripts/brain/lenses/20-authority.data.ts [--out <file.json>] [--probes <probes.json>]
 *
 * --probes: optional JSON file, an array of strings or of {"label": string, "query": string}.
 *           Each probe is embedded (text-embedding-3-small) and run against the read-only
 *           `match_knowledge` SQL function (STABLE, SELECT only). Defaults to $AUTHORITY_PROBES,
 *           then brain/strategy/authority-probes.json if present. Keep probe lists in the private
 *           brain repo, not here. Without a probe file, probes are skipped.
 * Without --out the JSON is printed to stdout.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const args = process.argv.slice(2);
const argVal = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const OUT = argVal('--out');
// Probe list: --probes, else $AUTHORITY_PROBES, else the private brain's probe file if it is checked out here.
const DEFAULT_PROBES = 'brain/strategy/authority-probes.json';
const PROBES = argVal('--probes') ?? process.env.AUTHORITY_PROBES ?? (existsSync(DEFAULT_PROBES) ? DEFAULT_PROBES : undefined);

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` } as Record<string, string>;

async function selectAll<T>(table: string, select: string, pageSize = 1000): Promise<T[] | { error: string }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      headers: { ...headers, Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 160)}` };
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

const isErr = (x: unknown): x is { error: string } => !!x && typeof x === 'object' && 'error' in (x as object);
const tally = (vals: (string | null | undefined)[]) => {
  const m: Record<string, number> = {};
  for (const v of vals) m[v ?? '(null)'] = (m[v ?? '(null)'] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const topN = (obj: Record<string, number>, n: number) => Object.fromEntries(Object.entries(obj).slice(0, n));
const pct = (q: number[], p: number) => (q.length ? q[Math.min(q.length - 1, Math.floor(p * q.length))] : null);

type Chunk = {
  tradition: string; text_name: string; author: string | null; translator: string | null;
  date_composed: string | null; content_type: string | null; priority: number | null;
  source_url: string | null; themes: string[] | null; cross_tradition_tags: string[] | null;
  content: string; created_at: string;
};

async function corpusStats() {
  const rows = await selectAll<Chunk>(
    'knowledge_chunks',
    'tradition,text_name,author,translator,date_composed,content_type,priority,source_url,themes,cross_tradition_tags,content,created_at',
  );
  if (isErr(rows)) return rows;

  const byTradition = tally(rows.map((r) => r.tradition));
  const byContentType = tally(rows.map((r) => r.content_type));
  const byPriority = tally(rows.map((r) => String(r.priority)));
  const matrix: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const k = `${r.content_type ?? '(null)'} | p${r.priority ?? '?'}`;
    matrix[r.tradition] ??= {};
    matrix[r.tradition][k] = (matrix[r.tradition][k] ?? 0) + 1;
  }

  const texts: Record<string, { tradition: string; text_name: string; author: string | null; translator: string | null; date_composed: string | null; content_type: string | null; chunks: number; with_source_url: number; avg_chars: number }> = {};
  for (const r of rows) {
    const k = `${r.tradition}::${r.text_name}`;
    texts[k] ??= { tradition: r.tradition, text_name: r.text_name, author: r.author, translator: r.translator, date_composed: r.date_composed, content_type: r.content_type, chunks: 0, with_source_url: 0, avg_chars: 0 };
    const t = texts[k];
    t.avg_chars = (t.avg_chars * t.chunks + r.content.length) / (t.chunks + 1);
    t.chunks += 1;
    if (r.source_url) t.with_source_url += 1;
  }
  const textList = Object.values(texts).sort((a, b) => b.chunks - a.chunks).map((t) => ({ ...t, avg_chars: Math.round(t.avg_chars) }));

  const lens = rows.map((r) => r.content.length).sort((a, b) => a - b);
  const themes = tally(rows.flatMap((r) => r.themes ?? []));
  const xtags = tally(rows.flatMap((r) => r.cross_tradition_tags ?? []));

  // Cheap quality flags (counts only).
  const seen = new Set<string>();
  const dupByText: Record<string, number> = {};
  let dupChunks = 0;
  for (const r of rows) {
    const k = r.content.trim().slice(0, 200);
    if (seen.has(k)) { dupChunks += 1; dupByText[`${r.tradition}/${r.text_name}`] = (dupByText[`${r.tradition}/${r.text_name}`] ?? 0) + 1; }
    else seen.add(k);
  }

  return {
    total_chunks: rows.length,
    distinct_texts: textList.length,
    by_tradition: byTradition,
    by_content_type: byContentType,
    by_priority: byPriority,
    tradition_x_type_priority: matrix,
    texts_top60: textList.slice(0, 60),
    texts_all_names: textList.map((t) => `${t.tradition}/${t.text_name} (${t.chunks})`),
    source_url: {
      chunks_with: rows.filter((r) => r.source_url).length,
      chunks_without: rows.filter((r) => !r.source_url).length,
      texts_fully_without: textList.filter((t) => t.with_source_url === 0).map((t) => `${t.tradition}/${t.text_name}`),
    },
    metadata_gaps: {
      chunks_no_author: rows.filter((r) => !r.author).length,
      chunks_no_date: rows.filter((r) => !r.date_composed).length,
      chunks_no_themes: rows.filter((r) => !r.themes?.length).length,
      chunks_no_cross_tags: rows.filter((r) => !r.cross_tradition_tags?.length).length,
    },
    chunk_chars: { min: lens[0] ?? null, p10: pct(lens, 0.1), median: pct(lens, 0.5), p90: pct(lens, 0.9), max: lens[lens.length - 1] ?? null, under_200: lens.filter((l) => l < 200).length },
    near_duplicate_chunks: dupChunks,
    near_duplicates_by_text: Object.fromEntries(Object.entries(dupByText).sort((a, b) => b[1] - a[1])),
    themes_top40: topN(themes, 40),
    themes_distinct: Object.keys(themes).length,
    cross_tradition_tags_top30: topN(xtags, 30),
    ingested_by_month: tally(rows.map((r) => r.created_at.slice(0, 7))),
  };
}

async function sourcesStats() {
  const rows = await selectAll<{ tradition: string; text_name: string; display_name: string; status: string; chunk_count: number | null; source_url: string | null; format: string | null; priority: number | null }>(
    'knowledge_sources', 'tradition,text_name,display_name,status,chunk_count,source_url,format,priority',
  );
  if (isErr(rows)) return rows;
  return {
    total: rows.length,
    by_status: tally(rows.map((r) => r.status)),
    by_tradition: tally(rows.map((r) => r.tradition)),
    not_ingested: rows.filter((r) => r.status !== 'ingested').map((r) => `${r.tradition}/${r.text_name}: ${r.display_name} [${r.status}]`),
  };
}

async function queryLogStats() {
  const rows = await selectAll<{ query: string; tradition_filter: string | null; threshold: number | null; chunks_returned: number | null; top_sources: { tradition?: string; similarity?: number }[] | null; latency_ms: number | null; created_at: string }>(
    'knowledge_query_log', 'query,tradition_filter,threshold,chunks_returned,top_sources,latency_ms,created_at',
  );
  if (isErr(rows)) return rows;
  const since = Date.now() - 30 * 864e5;
  const topSims = rows.map((r) => r.top_sources?.[0]?.similarity).filter((s): s is number => typeof s === 'number').sort((a, b) => a - b);
  const q = tally(rows.map((r) => r.query.trim().toLowerCase().slice(0, 90)));
  return {
    total: rows.length,
    last_30d: rows.filter((r) => Date.parse(r.created_at) > since).length,
    first: rows.map((r) => r.created_at).sort()[0] ?? null,
    last: rows.map((r) => r.created_at).sort().at(-1) ?? null,
    zero_result: rows.filter((r) => !r.chunks_returned).length,
    tradition_filter: tally(rows.map((r) => r.tradition_filter)),
    top1_similarity: { n: topSims.length, p10: pct(topSims, 0.1), median: pct(topSims, 0.5), p90: pct(topSims, 0.9) },
    top_source_traditions: tally(rows.flatMap((r) => (r.top_sources ?? []).map((s) => s.tradition ?? '(null)'))),
    frequent_queries_top25: topN(q, 25),
  };
}

async function countOnly(table: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } });
  if (!res.ok) return { error: `${res.status}` };
  return { total: Number(res.headers.get('content-range')?.split('/')[1] ?? 0) };
}

async function userQueryStats() {
  const rows = await selectAll<{ filter_tradition: string | null; chunks_retrieved: number | null; product_slug: string | null; created_at: string }>(
    'knowledge_queries', 'filter_tradition,chunks_retrieved,product_slug,created_at',
  );
  if (isErr(rows)) return rows;
  return { total: rows.length, by_product: tally(rows.map((r) => r.product_slug)), zero_result: rows.filter((r) => !r.chunks_retrieved).length };
}

async function linkStats() {
  const rows = await selectAll<{ curated: boolean | null; similarity: number | null; angle_id: string; knowledge_chunks: { tradition: string; content_type: string | null } | null }>(
    'content_corpus_links', 'curated,similarity,angle_id,knowledge_chunks(tradition,content_type)',
  );
  if (isErr(rows)) return rows;
  return {
    total: rows.length,
    curated: rows.filter((r) => r.curated).length,
    distinct_angles: new Set(rows.map((r) => r.angle_id)).size,
    by_tradition: tally(rows.map((r) => r.knowledge_chunks?.tradition)),
    by_content_type: tally(rows.map((r) => r.knowledge_chunks?.content_type)),
  };
}

async function queueStats() {
  const rows = await selectAll<{ status: string; source_type: string; quality_score: number | null }>('corpus_ingestion_queue', 'status,source_type,quality_score');
  if (isErr(rows)) return rows;
  return { total: rows.length, by_status: tally(rows.map((r) => r.status)), by_source_type: tally(rows.map((r) => r.source_type)) };
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  const j = (await res.json()) as { data: { embedding: number[] }[] };
  return j.data.map((d) => d.embedding);
}

async function probeStats() {
  if (!PROBES) return { skipped: 'no --probes file given' };
  if (!OPENAI_KEY) return { error: 'OPENAI_API_KEY missing' };
  const raw = JSON.parse(readFileSync(PROBES, 'utf8')) as (string | { label?: string; query: string })[];
  const probes = raw.map((p) => (typeof p === 'string' ? { label: p, query: p } : { label: p.label ?? p.query, query: p.query }));
  const embs = await embed(probes.map((p) => p.query));
  const out = [];
  for (let i = 0; i < probes.length; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_knowledge`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_embedding: embs[i], match_threshold: 0.2, match_count: 8, filter_tradition: null, filter_priority: null, filter_themes: null }),
    });
    const hits = res.ok ? ((await res.json()) as { tradition: string; text_name: string; content_type: string; similarity: number }[]) : [];
    out.push({
      label: probes[i].label,
      top1_similarity: hits[0] ? Number(hits[0].similarity.toFixed(3)) : null,
      hits_over_0_45: hits.filter((h) => h.similarity > 0.45).length,
      hits_over_0_55: hits.filter((h) => h.similarity > 0.55).length,
      top_hits: hits.slice(0, 5).map((h) => `${h.similarity.toFixed(3)} ${h.tradition}/${h.text_name} [${h.content_type}]`),
    });
  }
  return out;
}

async function main() {
  const [corpus, sources, queryLog, userQueries, links, queue, probes] = await Promise.all([
    corpusStats(), sourcesStats(), queryLogStats(), userQueryStats(), linkStats(), queueStats(), probeStats(),
  ]);
  const result = {
    generated_at: new Date().toISOString(),
    note: 'Aggregates only. Produced by scripts/brain/lenses/20-authority.data.ts (read-only).',
    corpus, sources, query_log: queryLog, user_queries: userQueries,
    content_corpus_links: links, ingestion_queue: queue, retrieval_probes: probes,
    table_counts: { content_pillars: await countOnly('content_pillars'), content_angles: await countOnly('content_angles'), content_pieces: await countOnly('content_pieces') },
  };
  const json = JSON.stringify(result, null, 2);
  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, json);
    console.error(`wrote ${OUT}`);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
