/**
 * Validate a brain snapshot against the contract (src/lib/brain/snapshot.ts) and
 * upload it to the private Supabase Storage bucket `brain`.
 *
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/publish-snapshot.ts \
 *     <snapshot.json> [--no-upload] [--commit <sha>] [--errors-out <file>]
 *
 * Exit codes: 0 ok · 2 usage/IO · 3 validation failed (errors written to --errors-out) · 4 upload failed
 *
 * Writes nothing to the database. The only Storage writes are: create bucket `brain`
 * (private) if missing, and upsert snapshots/latest.json + snapshots/<YYYY-MM-DD>.json.
 *
 * After the snapshot, it also publishes the archive (never fatal, never changes the exit code):
 *   - brain/decks/*.json → decks/<id>.json + decks/index.json   (scripts/brain/lib/publish-decks.ts)
 *   - docs in brain/docs.json → docs/<slug>.md, docs/<slug>/<hash>.md, docs/index.json (lib/publish-docs.ts)
 * The brain dir is --brain-dir, else $BRAIN_DIR, else the parent of the snapshot's `.snapshots/` folder.
 * --no-archive skips it. With --no-upload the archive is only validated.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { BRAIN_BUCKET, BRAIN_LATEST_PATH, BrainSnapshotSchema } from '../../src/lib/brain/snapshot';
import { publishDecks } from './lib/publish-decks';
import { publishDocs } from './lib/publish-docs';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const file = args.find((a, i) => !a.startsWith('--') && !['--commit', '--errors-out', '--brain-dir'].includes(args[i - 1] ?? ''));

if (!file) {
  console.error('usage: publish-snapshot.ts <snapshot.json> [--no-upload] [--commit <sha>] [--errors-out <file>]');
  process.exit(2);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  const msg = `Could not read/parse ${file}: ${e instanceof Error ? e.message : e}`;
  console.error(msg);
  const errOut = opt('--errors-out');
  if (errOut) writeFileSync(errOut, msg + '\n');
  process.exit(3); // treat unparseable JSON as a validation failure so the tick can retry
}

const commit = opt('--commit');
if (commit && raw && typeof raw === 'object') (raw as Record<string, unknown>).brainCommit = commit;

const parsed = BrainSnapshotSchema.safeParse(raw);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`);
  const report = `Snapshot failed BrainSnapshotSchema validation (${lines.length} issue(s)):\n${lines.slice(0, 80).join('\n')}\n`;
  console.error(report);
  const errOut = opt('--errors-out');
  if (errOut) writeFileSync(errOut, report);
  process.exit(3);
}

const snap = parsed.data;
const body = JSON.stringify(snap, null, 2);
console.log(
  `valid: decks=${snap.decks.length} slides=${snap.decks.reduce((n, d) => n + d.slides.length, 0)} ` +
    `creators=${snap.creators.length} hooks=${snap.hooks.length} sources=${snap.sources.length} bytes=${body.length}`,
);

function archiveBrainDir(): string | null {
  const explicit = opt('--brain-dir') ?? process.env.BRAIN_DIR;
  if (explicit) return path.resolve(explicit);
  const snapDir = path.dirname(path.resolve(file as string));
  return path.basename(snapDir) === '.snapshots' ? path.dirname(snapDir) : null;
}

/** Deck archive + docs. Failures are logged, never fatal: the snapshot already succeeded. */
async function publishArchive(upload: boolean) {
  if (flag('--no-archive')) return;
  const brainDir = archiveBrainDir();
  if (!brainDir || !existsSync(brainDir)) {
    console.log('archive: no brain dir (pass --brain-dir or set BRAIN_DIR); skipping decks/docs');
    return;
  }
  try {
    await publishDecks({ dir: path.join(brainDir, 'decks'), upload });
  } catch (e) {
    console.error('archive: decks publish failed (snapshot unaffected):', e instanceof Error ? e.message : e);
  }
  try {
    await publishDocs({ brainDir, upload, commit });
  } catch (e) {
    console.error('archive: docs publish failed (snapshot unaffected):', e instanceof Error ? e.message : e);
  }
}

if (flag('--no-upload')) {
  console.log('--no-upload: skipping Storage upload');
  publishArchive(false).finally(() => process.exit(0));
}

async function upload() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: bucket } = await sb.storage.getBucket(BRAIN_BUCKET);
  if (!bucket) {
    const { error } = await sb.storage.createBucket(BRAIN_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`createBucket: ${error.message}`);
    console.log(`created private bucket "${BRAIN_BUCKET}"`);
  } else if (bucket.public) {
    throw new Error(`bucket "${BRAIN_BUCKET}" is PUBLIC — refusing to upload brain content. Make it private first.`);
  }

  const dated = `snapshots/${snap.generatedAt.slice(0, 10) || new Date().toISOString().slice(0, 10)}.json`;
  for (const path of [BRAIN_LATEST_PATH, dated]) {
    const { error } = await sb.storage
      .from(BRAIN_BUCKET)
      .upload(path, new Blob([body], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '60' });
    if (error) throw new Error(`upload ${path}: ${error.message}`);
    console.log(`uploaded ${BRAIN_BUCKET}/${path}`);
  }
}

if (!flag('--no-upload')) {
  upload()
    .catch((e) => {
      console.error('upload failed:', e instanceof Error ? e.message : e);
      process.exit(4);
    })
    .then(() => publishArchive(true));
}
