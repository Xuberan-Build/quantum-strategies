/**
 * Ingest a staged JSONL corpus file into knowledge_chunks, with epistemic tiers.
 *
 * SAFE BY DEFAULT: runs as --dry-run unless --execute is passed. A dry run makes
 * only SELECT requests (to diff against what's already ingested) and calls no
 * paid API. It prints counts, the embedding cost estimate, the per-source plan
 * and sample rows.
 *
 * Usage (from the app repo root):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx \
 *     scripts/brain/ingest-staged-corpus.ts <file.jsonl> [options]
 *
 * Options:
 *   --dry-run                 (default) plan only
 *   --execute                 embed and write. Requires today's backup (see below)
 *   --replace-source <path>   only touch rows whose metadata.source_path = <path>:
 *                             delete ALL of them and re-insert that source's records
 *                             from the file. If the file has no records for <path>,
 *                             this deletes the source (e.g. a note that was removed)
 *   --batch <n>               embedding batch size (default 100)
 *   --samples <n>             sample rows to print (default 3)
 *
 * Record format (one JSON object per line):
 *   { content, tradition, content_type, text_name, author?, date_composed?, source_url?,
 *     priority?, themes?: string[], chapter?, section?, translator?,
 *     metadata: { tier, citation, verify: boolean, copyright, source_path, content_hash?, ... } }
 *   tier: evidence | model | contested | lineage | market_signal | internal | enemy
 *
 * Upsert-by-source convention:
 *   metadata.source_path is the stable key of the thing a chunk came from (a note's
 *   path, a source card id, a public-domain text + chapter). metadata.content_hash is
 *   sha256(content), recomputed here. On --execute, for each source_path in the file:
 *     - chunks whose hash already exists for that source are kept (no re-embedding);
 *     - new hashes are embedded and inserted;
 *     - existing rows for that source whose hash is no longer in the file are deleted
 *       AFTER the inserts succeed (a failure leaves extras, never gaps).
 *   So re-syncing a changed note replaces its old chunks instead of duplicating them.
 *
 * Guards:
 *   - Refuses to run at all unless backups/<today>* exists with a _manifest.json that
 *     reports zero failed tables (`npm run backup`). Today = local or UTC date.
 *     Note: the standard backup does not export knowledge_chunks, so before deleting
 *     any rows this script writes them (without embeddings) to that backup folder.
 *   - Refuses --execute if the tier column doesn't exist yet (apply the migration first).
 *   - Assumes the corpus lock is applied (knowledge_chunks readable by admins and the
 *     service role only), since tiers market_signal and internal hold non-public notes.
 *   - Warns when deletions would cascade to content_corpus_links.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ── config ────────────────────────────────────────────────────────────────
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIMENSIONS = 1536;
const PRICE_PER_MILLION_TOKENS = 0.02; // USD, text-embedding-3-small list price; check before relying on it
const INSERT_BATCH = 50;
const DELETE_BATCH = 100;
const MAX_WORDS = 400;
const MAX_QUOTE_WORDS = 25;
const TIERS = ['evidence', 'model', 'contested', 'lineage', 'market_signal', 'internal', 'enemy'] as const;
const COLUMNS = [
  'tradition', 'text_name', 'author', 'translator', 'date_composed', 'book', 'chapter', 'verse', 'lines',
  'section', 'content', 'priority', 'content_type', 'source_url', 'language', 'themes', 'cross_tradition_tags',
  'metadata', 'tier',
] as const;

type Tier = (typeof TIERS)[number];
type StagedRecord = {
  content: string;
  tradition: string;
  content_type: string;
  text_name: string;
  author?: string | null;
  translator?: string | null;
  date_composed?: string | null;
  source_url?: string | null;
  priority?: number;
  themes?: string[];
  chapter?: string | null;
  section?: string | null;
  metadata: Record<string, unknown> & { tier: Tier; source_path: string; content_hash?: string };
  [k: string]: unknown;
};
type ExistingRow = { id: string; hash: string | null };

// ── args ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const val = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FILE = argv.find((a, i) => !a.startsWith('--') && !['--replace-source', '--batch', '--samples'].includes(argv[i - 1] ?? ''));
const EXECUTE = flag('--execute');
const REPLACE_SOURCE = val('--replace-source');
const EMBED_BATCH = Number(val('--batch') ?? 100);
const SAMPLES = Number(val('--samples') ?? 3);

const die = (msg: string): never => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

// ── helpers ───────────────────────────────────────────────────────────────
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const estTokens = (s: string) => Math.ceil(s.length / 4);
const ymd = (d: Date, utc: boolean) =>
  utc
    ? d.toISOString().slice(0, 10)
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const chunked = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function findTodaysBackup(): string {
  const root = resolve('backups');
  if (!existsSync(root)) die('No backups/ folder. Run `npm run backup` first.');
  const now = new Date();
  const days = new Set([ymd(now, false), ymd(now, true)]);
  const candidates = readdirSync(root)
    .filter((d) => [...days].some((day) => d.startsWith(day)))
    .sort()
    .reverse();
  for (const d of candidates) {
    const manifest = join(root, d, '_manifest.json');
    if (!existsSync(manifest)) continue;
    try {
      const m = JSON.parse(readFileSync(manifest, 'utf8')) as { failed_tables?: number };
      if ((m.failed_tables ?? 1) === 0) return join(root, d);
    } catch {
      /* unreadable manifest: keep looking */
    }
  }
  return die(`No successful backup from today (${[...days].join(' / ')}) in backups/. Run \`npm run backup\` first.`);
}

// ── REST clients ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const sbHeaders = () => ({ apikey: SERVICE_KEY!, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' });

async function sbGetAll<T>(pathAndQuery: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: { ...sbHeaders(), Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`GET ${pathAndQuery.slice(0, 80)}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function tierColumnExists(): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?select=tier&limit=1`, { headers: sbHeaders() });
  return res.ok;
}

async function existingForSource(sourcePath: string): Promise<ExistingRow[]> {
  const q = `knowledge_chunks?select=id,hash:metadata->>content_hash&metadata->>source_path=eq.${encodeURIComponent(sourcePath)}`;
  return sbGetAll<ExistingRow>(q);
}

async function embed(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIMENSIONS }),
    });
    if (res.ok) {
      const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
    }
    if (attempt >= 4 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`Embedding failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
  }
}

async function insertRows(rows: Record<string, unknown>[]): Promise<string[]> {
  const ids: string[] = [];
  for (const batch of chunked(rows, INSERT_BATCH)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?select=id`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Insert failed after ${ids.length} rows: ${res.status} ${(await res.text()).slice(0, 300)}`);
    ids.push(...((await res.json()) as { id: string }[]).map((r) => r.id));
  }
  return ids;
}

async function exportRows(ids: string[], backupDir: string, label: string) {
  const rows: unknown[] = [];
  for (const batch of chunked(ids, DELETE_BATCH)) {
    const cols = ['id', ...COLUMNS.filter((c) => c !== 'tier'), 'created_at'].join(',');
    rows.push(...(await sbGetAll(`knowledge_chunks?select=${cols},tier&id=in.(${batch.join(',')})`)));
  }
  const file = join(backupDir, `knowledge_chunks-${label}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(rows, null, 1));
  return file;
}

async function deleteRows(ids: string[]) {
  for (const batch of chunked(ids, DELETE_BATCH)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?id=in.(${batch.join(',')})`, {
      method: 'DELETE',
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

async function countLinks(ids: string[]): Promise<number> {
  let n = 0;
  for (const batch of chunked(ids, DELETE_BATCH)) {
    n += (await sbGetAll(`content_corpus_links?select=id&chunk_id=in.(${batch.join(',')})`)).length;
  }
  return n;
}

// ── validation ────────────────────────────────────────────────────────────
function loadAndValidate(path: string): { records: StagedRecord[]; problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  const records: StagedRecord[] = [];
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim());
  lines.forEach((line, i) => {
    const at = `line ${i + 1}`;
    let r: StagedRecord;
    try {
      r = JSON.parse(line);
    } catch {
      problems.push(`${at}: not valid JSON`);
      return;
    }
    for (const k of ['content', 'tradition', 'content_type', 'text_name'] as const) {
      if (typeof r[k] !== 'string' || !(r[k] as string).trim()) problems.push(`${at}: missing ${k}`);
    }
    const m = r.metadata;
    if (!m || typeof m !== 'object') {
      problems.push(`${at}: missing metadata`);
      return;
    }
    if (!TIERS.includes(m.tier)) problems.push(`${at}: metadata.tier must be one of ${TIERS.join(', ')}`);
    if (typeof m.source_path !== 'string' || !m.source_path) problems.push(`${at}: metadata.source_path is required (upsert key)`);
    if (typeof m.citation !== 'string' || !m.citation) problems.push(`${at}: metadata.citation is required`);
    if (typeof m.verify !== 'boolean') problems.push(`${at}: metadata.verify must be boolean`);
    if (!['public_domain', 'cc_by', 'summary_fair_use', 'internal'].includes(String(m.copyright))) {
      problems.push(`${at}: metadata.copyright must be public_domain | cc_by | summary_fair_use | internal`);
    }
    if (typeof r.content === 'string') {
      const hash = sha256(r.content);
      if (m.content_hash && m.content_hash !== hash) warnings.push(`${at}: content_hash didn't match content; recomputed`);
      m.content_hash = hash;
      if (words(r.content) > MAX_WORDS) warnings.push(`${at}: ${words(r.content)} words (> ${MAX_WORDS})`);
    }
    const quotes = Array.isArray(m.quotes) ? (m.quotes as unknown[]) : [];
    for (const q of quotes) {
      const text = typeof q === 'string' ? q : (q as { text?: string })?.text ?? '';
      if (words(text) > MAX_QUOTE_WORDS) problems.push(`${at}: quote over ${MAX_QUOTE_WORDS} words`);
    }
    if (m.copyright === 'summary_fair_use' && m.written_by === 'original_author') {
      problems.push(`${at}: in-copyright text marked as the author's own words; only summaries may be staged`);
    }
    records.push(r);
  });
  return { records, problems, warnings };
}

function toRow(r: StagedRecord, embedding?: number[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const c of COLUMNS) {
    if (c === 'tier') row.tier = r.metadata.tier;
    else if (r[c] !== undefined && r[c] !== null) row[c] = r[c];
  }
  row.priority = r.priority ?? 2;
  row.themes = r.themes ?? [];
  row.metadata = { ...r.metadata, ingested_by: 'scripts/brain/ingest-staged-corpus.ts', ingested_at: new Date().toISOString() };
  if (embedding) row.embedding = `[${embedding.join(',')}]`;
  return row;
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!FILE) die('Usage: ingest-staged-corpus.ts <file.jsonl> [--dry-run | --execute] [--replace-source <path>]');
  if (!existsSync(FILE!)) die(`File not found: ${FILE}`);
  if (!SUPABASE_URL || !SERVICE_KEY) die('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  if (EXECUTE && !OPENAI_KEY) die('Missing OPENAI_API_KEY');

  const backupDir = findTodaysBackup();
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (writes to production)' : 'dry run (no writes, no paid calls)'}`);
  console.log(`Backup found: ${backupDir}`);

  const { records: all, problems, warnings } = loadAndValidate(FILE!);
  warnings.forEach((w) => console.warn(`  ! ${w}`));
  if (problems.length) {
    problems.slice(0, 50).forEach((p) => console.error(`  ✖ ${p}`));
    die(`${problems.length} validation problem(s). Fix the file first.`);
  }

  const records = REPLACE_SOURCE ? all.filter((r) => r.metadata.source_path === REPLACE_SOURCE) : all;
  const hasTier = await tierColumnExists();

  // Group by source and diff against what's already in the table.
  const bySource = new Map<string, StagedRecord[]>();
  for (const r of records) bySource.set(r.metadata.source_path, [...(bySource.get(r.metadata.source_path) ?? []), r]);
  if (REPLACE_SOURCE && !bySource.has(REPLACE_SOURCE)) bySource.set(REPLACE_SOURCE, []);

  type Plan = { source: string; insert: StagedRecord[]; deleteIds: string[]; keep: number };
  const plans: Plan[] = [];
  for (const [source, recs] of bySource) {
    const existing = await existingForSource(source);
    if (REPLACE_SOURCE) {
      plans.push({ source, insert: recs, deleteIds: existing.map((e) => e.id), keep: 0 });
      continue;
    }
    const existingHashes = new Set(existing.map((e) => e.hash));
    const fileHashes = new Set(recs.map((r) => r.metadata.content_hash));
    const seen = new Set<string>();
    const insert = recs.filter((r) => {
      const h = r.metadata.content_hash!;
      if (existingHashes.has(h) || seen.has(h)) return false; // already ingested, or a duplicate within the file
      seen.add(h);
      return true;
    });
    // Delete rows whose hash is gone from the file, plus duplicate copies of a kept hash.
    const keptOnce = new Set<string>();
    const deleteIds = existing
      .filter((e) => {
        if (!e.hash || !fileHashes.has(e.hash)) return true;
        if (keptOnce.has(e.hash)) return true;
        keptOnce.add(e.hash);
        return false;
      })
      .map((e) => e.id);
    plans.push({ source, insert, deleteIds, keep: existing.length - deleteIds.length });
  }

  const toInsert = plans.flatMap((p) => p.insert);
  const toDelete = plans.flatMap((p) => p.deleteIds);
  const tokens = toInsert.reduce((s, r) => s + estTokens(r.content), 0);
  const tally = (f: (r: StagedRecord) => string) =>
    toInsert.reduce<Record<string, number>>((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});

  console.log(`\nFile: ${FILE}  (${all.length} records${REPLACE_SOURCE ? `, ${records.length} for ${REPLACE_SOURCE}` : ''})`);
  console.log(`Sources: ${plans.length}  ·  unchanged chunks kept: ${plans.reduce((s, p) => s + p.keep, 0)}`);
  console.log(`To insert: ${toInsert.length}  ·  to delete: ${toDelete.length}`);
  console.log('By tier:', tally((r) => r.metadata.tier));
  console.log('By tradition/content_type:', tally((r) => `${r.tradition}/${r.content_type}`));
  console.log(`Needs verification (metadata.verify=true): ${toInsert.filter((r) => r.metadata.verify).length}`);
  console.log(
    `Embedding estimate: ~${tokens.toLocaleString()} tokens ≈ $${((tokens / 1e6) * PRICE_PER_MILLION_TOKENS).toFixed(4)} (${EMBED_MODEL}, ${EMBED_DIMENSIONS} dims)`,
  );
  const changed = plans.filter((p) => p.insert.length || p.deleteIds.length);
  if (changed.length) {
    console.log('\nPer-source plan (changed sources only):');
    changed.slice(0, 40).forEach((p) => console.log(`  ${p.source}: +${p.insert.length} −${p.deleteIds.length} (keep ${p.keep})`));
    if (changed.length > 40) console.log(`  … ${changed.length - 40} more`);
  }
  if (toDelete.length) {
    const links = await countLinks(toDelete);
    if (links) console.warn(`  ! ${links} content_corpus_links row(s) reference rows that would be deleted (ON DELETE CASCADE).`);
  }
  if (!hasTier) console.warn('  ! knowledge_chunks has no tier column yet: apply the corpus_evidence_tiers migration before --execute.');

  console.log(`\nSample rows (${Math.min(SAMPLES, toInsert.length)}):`);
  toInsert.slice(0, SAMPLES).forEach((r) => {
    const row = toRow(r);
    console.log(
      JSON.stringify(
        { ...row, content: `${String(row.content).slice(0, 220)}…`, metadata: { ...(row.metadata as object), quotes: undefined } },
        null,
        1,
      ),
    );
  });

  if (!EXECUTE) {
    console.log('\nDry run complete. Nothing was written. Re-run with --execute to embed and insert.');
    return;
  }

  // ── execute ─────────────────────────────────────────────────────────────
  if (!hasTier) die('Refusing to write: tier column missing. Apply the migration first.');

  let inserted = 0;
  for (const batch of chunked(toInsert, EMBED_BATCH)) {
    const vectors = await embed(batch.map((r) => r.content));
    const ids = await insertRows(batch.map((r, i) => toRow(r, vectors[i])));
    inserted += ids.length;
    console.log(`  inserted ${inserted}/${toInsert.length}`);
  }

  if (toDelete.length) {
    const file = await exportRows(toDelete, backupDir, REPLACE_SOURCE ? 'replaced' : 'superseded');
    console.log(`  exported ${toDelete.length} row(s) about to be deleted → ${file}`);
    await deleteRows(toDelete);
    console.log(`  deleted ${toDelete.length}`);
  }
  console.log(`\nDone. Inserted ${inserted}, deleted ${toDelete.length}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
