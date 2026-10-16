/**
 * Brain -> corpus bridge: stage second-brain notes as INTERNAL-tier corpus chunks.
 *
 * Walks the private brain (markdown), selects the notes worth retrieving, strips denylisted
 * sections (revenue, pricing targets, financials), chunks heading-aware (<= 400 words), hashes
 * every chunk and writes staging JSONL with tier `internal`. It compares the hashes with what
 * the corpus already holds for each note (read-only SELECT on metadata), so only changed notes
 * are re-embedded. The write itself is delegated to the shared staged-corpus ingest script in
 * replace-by-source mode. This script never writes to the database directly.
 *
 * Brain chunks are context, never evidence: tier `internal`, `metadata.not_evidence = true`.
 *
 * DEFAULT IS A DRY RUN: counts, changed notes and an embedding-cost estimate. Nothing is written
 * except the staging JSONL, which goes to the brain's gitignored `.snapshots/corpus-sync/`
 * (never into this public repo).
 *
 * Usage (from the app repo root):
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/sync-brain-to-corpus.ts \
 *     [--brain <dir>] [--out <dir>] [--offline] [--json] [--verbose] [--execute]
 *
 *   --brain     brain root. Default: $BRAIN_DIR, else ./brain, else $BRAIN_WORKTREE / ~/.quantum-brain-auto
 *   --out       staging dir. Default: <brain>/.snapshots/corpus-sync
 *   --offline   don't read corpus state; treat every selected note as changed
 *   --json      print the dry-run report as JSON (for the tick log)
 *   --verbose   list every selected / skipped file
 *   --execute   run the ingest for changed notes. Refused unless ALL hold:
 *                 - today's backup exists: backups/<YYYY-MM-DD>T*\/_manifest.json with no failed tables
 *                 - knowledge_chunks has the `tier` column (evidence-tiers migration applied)
 *                 - scripts/brain/ingest-staged-corpus.ts exists
 *
 * Selection policy (structural only; content lives in the brain):
 *   include: 00-north-star.md, decisions/, strategy/, content/, research/social-listening.md,
 *            research/creators/, research/transcripts/ (summaries), journey/learnings.md, journey/decisions.md
 *   exclude: READMEs, journey/log/ (raw), research/conversation/ (customer and commenter voice),
 *            briefings/, corpus-staging/, research/corpus-links.md (derived FROM the corpus), dotfiles,
 *            filenames matching the financial denylist, and any note flagged private:
 *            frontmatter `private: true` | `corpus: false` | `visibility: private`, or a
 *            `<!-- private -->` / `<!-- corpus:skip -->` marker in the first 20 lines.
 *   section-level: `<!-- corpus:skip -->` ... `<!-- /corpus:skip -->` blocks are dropped; headings
 *            matching the financial denylist drop their whole section; lines with financial terms are dropped.
 *   override: an optional `<brain>/.corpus-sync.json` {"include": [...], "exclude": [...]} (path prefixes)
 *            is applied on top (exclude wins).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const argVal = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const EXECUTE = has('--execute');
const OFFLINE = has('--offline');
const AS_JSON = has('--json');
const VERBOSE = has('--verbose');
const APP_ROOT = process.cwd();

function defaultBrain(): string {
  const candidates = [
    process.env.BRAIN_DIR,
    join(APP_ROOT, 'brain'),
    process.env.BRAIN_WORKTREE,
    join(homedir(), '.quantum-brain-auto'),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => existsSync(join(p, 'README.md'))) ?? join(APP_ROOT, 'brain');
}
const BRAIN = resolve(argVal('--brain') ?? defaultBrain());
const OUT_DIR = resolve(argVal('--out') ?? join(BRAIN, '.snapshots', 'corpus-sync'));
if (!existsSync(BRAIN)) {
  console.error(`brain not found: ${BRAIN}`);
  process.exit(1);
}

// ---------------------------------------------------------------- constants
const TIER = 'internal';
const ORIGIN = 'second_brain';
const TRADITION = 'qs_internal';
const CONTENT_TYPE = 'internal_note';
const PRIORITY = 3;
const MAX_WORDS = 400;
const MIN_WORDS = 25; // smaller sections merge forward
const EMBED_USD_PER_MTOK = 0.02; // text-embedding-3-small
const INGEST_SCRIPT = join(APP_ROOT, 'scripts/brain/ingest-staged-corpus.ts');

const INCLUDE_PREFIXES = [
  '00-north-star.md',
  'decisions/',
  'strategy/',
  'content/',
  'research/social-listening.md',
  'research/creators/',
  'research/transcripts/',
  'journey/learnings.md',
  'journey/decisions.md',
];
const EXCLUDE_PREFIXES = [
  'journey/log/',
  'research/conversation/',
  'briefings/',
  'corpus-staging/',
  'research/corpus-links.md',
];
// Revenue targets and financials never enter the corpus.
const FINANCIAL_HEADING = /\b(revenue|pricing|price (?:point|test|target)s?|financ\w*|forecast\w*|(?<!token[ -]?)budget\w*|runway|burn rate|profit\w*|margin\w*|cash ?flow|valuation|fundrais\w*|unit economics|ltv|cac|mrr|arr|targets?\b.*\b(?:sales|income|\$))/i;
const FINANCIAL_LINE = /\b(revenue|mrr|arr|run-?rate|runway|burn rate|profit\w*|ebitda|valuation|forecast\w*|fundrais\w*|income target|sales target)\b|\$\s?\d[\d,.]*\s?(?:k|m|mm|bn)\b|\$\s?\d[\d,.]*\s?\/\s?(?:mo|month|yr|year)\b/i;
const FINANCIAL_FILE = /financ|revenue|pricing|budget|forecast|valuation/i;
const PRIVATE_MARKER = /<!--\s*(private|corpus:skip)\s*-->/i;

// ---------------------------------------------------------------- types
type Chunk = {
  tradition: string;
  text_name: string;
  author: string;
  content_type: string;
  priority: number;
  tier: string;
  section: string;
  content: string;
  source_url: null;
  themes: string[];
  metadata: {
    origin: string;
    source_path: string;
    content_hash: string;
    file_hash: string;
    chunk_index: number;
    chunk_count: number;
    heading_path: string[];
    words: number;
    tags: Record<string, string>;
    not_evidence: true;
    brain_commit: string | null;
    staged_at: string;
  };
};
type FileReport = { path: string; chunks: number; words: number; status: 'new' | 'changed' | 'unchanged'; skippedSections: number; skippedLines: number };

// ---------------------------------------------------------------- selection
function loadOverride(): { include: string[]; exclude: string[] } {
  const p = join(BRAIN, '.corpus-sync.json');
  if (!existsSync(p)) return { include: [], exclude: [] };
  try {
    const j = JSON.parse(readFileSync(p, 'utf8')) as { include?: string[]; exclude?: string[] };
    return { include: j.include ?? [], exclude: j.exclude ?? [] };
  } catch {
    console.error(`ignoring unreadable ${p}`);
    return { include: [], exclude: [] };
  }
}
const OVERRIDE = loadOverride();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

function selectReason(rel: string): string | null {
  const base = rel.split('/').pop() ?? rel;
  const inc = [...INCLUDE_PREFIXES, ...OVERRIDE.include].some((p) => rel === p || rel.startsWith(p));
  const exc = [...EXCLUDE_PREFIXES, ...OVERRIDE.exclude].find((p) => rel === p || rel.startsWith(p));
  if (exc) return `excluded (${exc})`;
  if (!inc) return 'not in include list';
  if (/^readme\.md$/i.test(base)) return 'index file';
  if (FINANCIAL_FILE.test(base)) return 'financial filename';
  return null;
}

function parseFrontmatter(text: string): { fm: Record<string, string>; body: string } {
  if (!text.startsWith('---\n')) return { fm: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { fm: {}, body: text };
  const fm: Record<string, string> = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) fm[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return { fm, body: text.slice(end + 4).replace(/^\n/, '') };
}

function isPrivate(fm: Record<string, string>, body: string): boolean {
  if (/^(true|yes)$/i.test(fm.private ?? '')) return true;
  if (/^(false|no)$/i.test(fm.corpus ?? '')) return true;
  if (/^private$/i.test(fm.visibility ?? '')) return true;
  return PRIVATE_MARKER.test(body.split('\n').slice(0, 20).join('\n'));
}

// ---------------------------------------------------------------- chunking
const words = (s: string) => (s.match(/\S+/g) ?? []).length;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

type Section = { headingPath: string[]; text: string };

function sanitize(body: string): { sections: Section[]; skippedSections: number; skippedLines: number } {
  const lines = body.split('\n');
  const sections: Section[] = [];
  const stack: { level: number; title: string }[] = [];
  let buf: string[] = [];
  let skipLevel = 0; // >0 while inside a denylisted section
  let inSkipBlock = false;
  let inFence = false;
  let skippedSections = 0;
  let skippedLines = 0;
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) sections.push({ headingPath: stack.map((s) => s.title), text });
    buf = [];
  };
  for (const line of lines) {
    if (/<!--\s*corpus:skip\s*-->/i.test(line)) { inSkipBlock = true; skippedSections++; continue; }
    if (/<!--\s*\/corpus:skip\s*-->/i.test(line)) { inSkipBlock = false; continue; }
    if (inSkipBlock) continue;
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const h = !inFence ? line.match(/^(#{1,6})\s+(.*)$/) : null;
    if (h) {
      const level = h[1].length;
      const title = h[2].replace(/[*_`]/g, '').trim();
      if (skipLevel && level > skipLevel) continue; // still inside the skipped section
      skipLevel = 0;
      flush();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      if (FINANCIAL_HEADING.test(title)) { skipLevel = level; skippedSections++; continue; }
      stack.push({ level, title });
      continue;
    }
    if (skipLevel) continue;
    if (/^\s*<!--.*-->\s*$/.test(line)) continue; // HTML comments are authoring notes
    if (FINANCIAL_LINE.test(line)) { skippedLines++; continue; }
    buf.push(line);
  }
  flush();
  return { sections, skippedSections, skippedLines };
}

function splitLong(par: string): string[] {
  if (words(par) <= MAX_WORDS) return [par];
  const sentences = par.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(*])/);
  const out: string[] = [];
  let cur: string[] = [];
  let n = 0;
  for (const s of sentences) {
    const w = words(s);
    if (w > MAX_WORDS) {
      // a single run-on "sentence" (e.g. a giant table row): hard-split on words
      if (cur.length) { out.push(cur.join(' ')); cur = []; n = 0; }
      const toks = s.split(/\s+/);
      for (let i = 0; i < toks.length; i += MAX_WORDS) out.push(toks.slice(i, i + MAX_WORDS).join(' '));
      continue;
    }
    if (n + w > MAX_WORDS && cur.length) { out.push(cur.join(' ')); cur = []; n = 0; }
    cur.push(s);
    n += w;
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

function chunkSections(sections: Section[]): { headingPath: string[]; text: string }[] {
  // 1) merge tiny sections forward (a heading with one line rarely retrieves well on its own)
  const merged: Section[] = [];
  for (const s of sections) {
    const prev = merged[merged.length - 1];
    if (prev && words(prev.text) < MIN_WORDS && words(prev.text) + words(s.text) <= MAX_WORDS) {
      prev.text = `${prev.text}\n\n${s.headingPath.length ? `${s.headingPath[s.headingPath.length - 1]}\n` : ''}${s.text}`;
      continue;
    }
    merged.push({ ...s });
  }
  // 2) pack paragraphs into <= MAX_WORDS chunks within each section
  const out: { headingPath: string[]; text: string }[] = [];
  for (const s of merged) {
    const pars = s.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).flatMap(splitLong);
    let cur: string[] = [];
    let n = 0;
    for (const p of pars) {
      const w = words(p);
      if (n + w > MAX_WORDS && cur.length) { out.push({ headingPath: s.headingPath, text: cur.join('\n\n') }); cur = []; n = 0; }
      cur.push(p);
      n += w;
    }
    if (cur.length) out.push({ headingPath: s.headingPath, text: cur.join('\n\n') });
  }
  return out.filter((c) => words(c.text) >= 8);
}

function tagsFrom(fm: Record<string, string>, body: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const k of ['rite', 'pillar', 'domain', 'type']) if (fm[k]) tags[k] = fm[k];
  // fallback: a "Tags: Domain = X · type = Y" line near the top
  const line = body.split('\n').slice(0, 15).find((l) => /^tags:/i.test(l.trim()));
  if (line) {
    for (const part of line.replace(/^tags:/i, '').split(/[·|;]/)) {
      const m = part.match(/^\s*([A-Za-z]+)\s*[=:]\s*(.+?)\s*$/);
      if (m && !tags[m[1].toLowerCase()]) tags[m[1].toLowerCase()] = m[2].replace(/[*_`]/g, '');
    }
  }
  return tags;
}

function brainCommit(): string | null {
  const r = spawnSync('git', ['-C', BRAIN, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// ---------------------------------------------------------------- corpus state (read-only)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = KEY ? ({ apikey: KEY, Authorization: `Bearer ${KEY}` } as Record<string, string>) : {};

async function tierColumnExists(): Promise<boolean | null> {
  if (!SUPABASE_URL || !KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_chunks?select=tier&limit=1`, { headers });
  if (res.ok) return true;
  const body = await res.text();
  return /42703|column .*tier.* does not exist|Could not find/i.test(body) ? false : null;
}

/** source_path -> sorted chunk hashes currently in the corpus. */
async function corpusState(): Promise<{ map: Map<string, string[]>; error?: string }> {
  const map = new Map<string, string[]>();
  if (OFFLINE) return { map, error: 'offline: corpus state not read' };
  if (!SUPABASE_URL || !KEY) return { map, error: 'no Supabase env: corpus state not read' };
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const url = `${SUPABASE_URL}/rest/v1/knowledge_chunks?select=metadata&metadata->>origin=eq.${ORIGIN}`;
    const res = await fetch(url, { headers: { ...headers, Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' } });
    if (!res.ok) return { map, error: `corpus state read failed: ${res.status} ${(await res.text()).slice(0, 120)}` };
    const page = (await res.json()) as { metadata: { source_path?: string; content_hash?: string } | null }[];
    for (const r of page) {
      const p = r.metadata?.source_path;
      const h = r.metadata?.content_hash;
      if (!p || !h) continue;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(h);
    }
    if (page.length < pageSize) break;
  }
  for (const v of map.values()) v.sort();
  return { map };
}

// ---------------------------------------------------------------- backup guard
function todaysBackup(): string | null {
  const dir = join(APP_ROOT, 'backups');
  if (!existsSync(dir)) return null;
  const now = new Date();
  const utc = now.toISOString().slice(0, 10);
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hits = readdirSync(dir)
    .filter((n) => n.startsWith(`${utc}T`) || n.startsWith(`${local}T`))
    .sort()
    .reverse();
  for (const n of hits) {
    const manifest = join(dir, n, '_manifest.json');
    if (!existsSync(manifest)) continue;
    try {
      const m = JSON.parse(readFileSync(manifest, 'utf8')) as { failed_tables?: number };
      if ((m.failed_tables ?? 0) === 0) return join(dir, n);
    } catch { /* unreadable manifest: not a valid backup */ }
  }
  return null;
}

// ---------------------------------------------------------------- main
async function main() {
  const stagedAt = new Date().toISOString();
  const commit = brainCommit();
  const all = walk(BRAIN).map((f) => relative(BRAIN, f).split(sep).join('/')).sort();
  const skipped: { path: string; reason: string }[] = [];
  const chunks: Chunk[] = [];
  const perFile = new Map<string, { chunks: Chunk[]; skippedSections: number; skippedLines: number }>();

  for (const rel of all) {
    const reason = selectReason(rel);
    if (reason) { skipped.push({ path: rel, reason }); continue; }
    const raw = readFileSync(join(BRAIN, rel), 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    if (isPrivate(fm, body)) { skipped.push({ path: rel, reason: 'flagged private' }); continue; }
    const { sections, skippedSections, skippedLines } = sanitize(body);
    const title = sections[0]?.headingPath[0] ?? rel;
    const tags = tagsFrom(fm, body);
    const pieces = chunkSections(sections);
    if (!pieces.length) { skipped.push({ path: rel, reason: 'no retrievable text' }); continue; }
    const hashes = pieces.map((p) => sha(`${rel}\n${p.headingPath.join(' > ')}\n${p.text}`).slice(0, 32));
    const fileHash = sha([...hashes].sort().join('\n')).slice(0, 32);
    const fileChunks: Chunk[] = pieces.map((p, i) => {
      const crumb = p.headingPath.length ? p.headingPath.join(' › ') : title;
      return {
        tradition: TRADITION,
        text_name: `brain/${rel.replace(/\.md$/, '')}`,
        author: 'Quantum Strategies (internal)',
        content_type: CONTENT_TYPE,
        priority: PRIORITY,
        tier: TIER,
        section: crumb.slice(0, 300),
        // breadcrumb first so the embedding carries the note's context
        content: `[${rel} › ${crumb}]\n\n${p.text}`,
        source_url: null,
        themes: Object.values(tags).map((v) => v.toLowerCase()).slice(0, 6),
        metadata: {
          origin: ORIGIN,
          source_path: rel,
          content_hash: hashes[i],
          file_hash: fileHash,
          chunk_index: i,
          chunk_count: pieces.length,
          heading_path: p.headingPath,
          words: words(p.text),
          tags,
          not_evidence: true,
          brain_commit: commit,
          staged_at: stagedAt,
        },
      };
    });
    perFile.set(rel, { chunks: fileChunks, skippedSections, skippedLines });
    chunks.push(...fileChunks);
  }

  // diff against corpus
  const state = await corpusState();
  const reports: FileReport[] = [];
  for (const [rel, f] of perFile) {
    const have = state.map.get(rel);
    const want = f.chunks.map((c) => c.metadata.content_hash).sort();
    const status: FileReport['status'] = !have ? 'new' : have.join() === want.join() ? 'unchanged' : 'changed';
    reports.push({ path: rel, chunks: f.chunks.length, words: f.chunks.reduce((a, c) => a + c.metadata.words, 0), status, skippedSections: f.skippedSections, skippedLines: f.skippedLines });
  }
  const removed = [...state.map.keys()].filter((p) => !perFile.has(p)).sort();
  const toSync = reports.filter((r) => r.status !== 'unchanged');
  const syncChunks = toSync.flatMap((r) => perFile.get(r.path)!.chunks);
  const tokens = Math.ceil(syncChunks.reduce((a, c) => a + c.content.length, 0) / 4);
  const allTokens = Math.ceil(chunks.reduce((a, c) => a + c.content.length, 0) / 4);
  const tierCol = OFFLINE ? null : await tierColumnExists();

  // stage (always: the JSONL is the reviewable artifact; it lives in the brain's gitignored dir)
  mkdirSync(OUT_DIR, { recursive: true });
  const allPath = join(OUT_DIR, 'brain-internal.all.jsonl');
  const changedPath = join(OUT_DIR, 'brain-internal.changed.jsonl');
  const removedPath = join(OUT_DIR, 'brain-internal.removed.txt');
  writeFileSync(allPath, chunks.map((c) => JSON.stringify(c)).join('\n') + (chunks.length ? '\n' : ''));
  writeFileSync(changedPath, syncChunks.map((c) => JSON.stringify(c)).join('\n') + (syncChunks.length ? '\n' : ''));
  writeFileSync(removedPath, removed.join('\n') + (removed.length ? '\n' : ''));

  const report = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    brain: BRAIN,
    brain_commit: commit,
    staging: { all: allPath, changed: changedPath, removed: removedPath },
    corpus_state: state.error ?? `read ${[...state.map.values()].reduce((a, v) => a + v.length, 0)} existing internal chunks across ${state.map.size} notes`,
    tier_column: tierCol,
    files: {
      scanned: all.length,
      selected: perFile.size,
      skipped: skipped.length,
      new: reports.filter((r) => r.status === 'new').length,
      changed: reports.filter((r) => r.status === 'changed').length,
      unchanged: reports.filter((r) => r.status === 'unchanged').length,
      removed: removed.length,
    },
    chunks: { total: chunks.length, to_embed: syncChunks.length, max_words: Math.max(0, ...chunks.map((c) => c.metadata.words)) },
    denylist: {
      sections_dropped: reports.reduce((a, r) => a + r.skippedSections, 0),
      lines_dropped: reports.reduce((a, r) => a + r.skippedLines, 0),
    },
    embedding_estimate: {
      model: 'text-embedding-3-small',
      tokens_changed: tokens,
      usd_changed: Number(((tokens / 1e6) * EMBED_USD_PER_MTOK).toFixed(4)),
      tokens_full_resync: allTokens,
      usd_full_resync: Number(((allTokens / 1e6) * EMBED_USD_PER_MTOK).toFixed(4)),
    },
    changed_files: toSync.map((r) => `${r.status.padEnd(7)} ${r.path} (${r.chunks} chunks)`),
    removed_files: removed,
    ...(VERBOSE ? { selected: reports.map((r) => `${r.path} (${r.chunks} chunks, ${r.words} words, -${r.skippedSections} sections, -${r.skippedLines} lines)`), skipped_files: skipped.map((s) => `${s.path}: ${s.reason}`) } : {}),
  };

  if (AS_JSON) console.log(JSON.stringify(report, null, 2));
  else {
    const f = report.files;
    console.log(`brain->corpus ${report.mode}: ${report.brain} @ ${commit ?? '?'}`);
    console.log(`  files: ${f.scanned} scanned, ${f.selected} selected, ${f.skipped} skipped | new ${f.new}, changed ${f.changed}, unchanged ${f.unchanged}, removed ${f.removed}`);
    console.log(`  chunks: ${report.chunks.total} total, ${report.chunks.to_embed} to embed (max ${report.chunks.max_words} words)`);
    console.log(`  denylist: ${report.denylist.sections_dropped} sections, ${report.denylist.lines_dropped} lines dropped`);
    console.log(`  embedding estimate: ~${tokens} tokens, ~$${report.embedding_estimate.usd_changed} (full resync ~$${report.embedding_estimate.usd_full_resync})`);
    console.log(`  corpus state: ${report.corpus_state}; tier column: ${tierCol === null ? 'unknown' : tierCol}`);
    for (const l of report.changed_files.slice(0, 40)) console.log(`    ${l}`);
    if (report.changed_files.length > 40) console.log(`    … ${report.changed_files.length - 40} more`);
    for (const r of removed) console.log(`    removed ${r}`);
    if (VERBOSE) for (const s of skipped) console.log(`    skip ${s.path}: ${s.reason}`);
    console.log(`  staged: ${changedPath}`);
  }

  if (!EXECUTE) return;

  // ---------------------------------------------------------------- execute (guarded)
  const refuse = (why: string) => {
    console.error(`REFUSING --execute: ${why}`);
    process.exit(2);
  };
  const backup = todaysBackup();
  if (!backup) refuse('no successful backup from today in backups/ (run `npm run backup` first)');
  if (tierCol !== true) refuse('knowledge_chunks has no `tier` column yet (apply the evidence-tiers migration first); internal rows would be indistinguishable from evidence');
  if (!existsSync(INGEST_SCRIPT)) refuse(`ingest script missing: ${relative(APP_ROOT, INGEST_SCRIPT)}`);
  if (!syncChunks.length && !removed.length) {
    console.log('nothing to sync');
    return;
  }
  console.log(`backup ok: ${relative(APP_ROOT, backup!)}`);
  const run = (extra: string[]) =>
    spawnSync(process.execPath, ['--env-file=.env', '--import', 'tsx', INGEST_SCRIPT, ...extra, '--execute'], {
      cwd: APP_ROOT,
      stdio: 'inherit',
      env: { ...process.env, NODE_PATH: join(APP_ROOT, 'node_modules') },
    });
  if (syncChunks.length) {
    const r = run(['--file', changedPath, '--replace-by-source']);
    if (r.status !== 0) refuse(`ingest failed (exit ${r.status})`);
  }
  if (removed.length) {
    const help = spawnSync(process.execPath, ['--import', 'tsx', INGEST_SCRIPT, '--help'], { cwd: APP_ROOT, encoding: 'utf8', env: { ...process.env, NODE_PATH: join(APP_ROOT, 'node_modules') } });
    if (/--remove-sources/.test(`${help.stdout}${help.stderr}`)) {
      const r = run(['--remove-sources', removedPath]);
      if (r.status !== 0) refuse(`removing stale sources failed (exit ${r.status})`);
    } else {
      console.warn(`WARN: ${removed.length} note(s) left the brain but the ingest script has no --remove-sources; their chunks stay until removed by hand (list: ${removedPath})`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
