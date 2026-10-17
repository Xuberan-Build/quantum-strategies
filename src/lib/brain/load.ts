/**
 * Server-only loader for the brain snapshot.
 *
 * Reads `snapshots/latest.json` from the private `brain` Storage bucket with the
 * service role and validates it against BrainSnapshotSchema. In development only,
 * falls back to `<repo>/brain/.snapshots/latest.json` (the brain repo is a private,
 * gitignored checkout; the file never lives in this repo).
 *
 * Importing supabaseAdmin and node:fs keeps this module out of client bundles.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildDeckIndexEntry, isSafeId, mergeDeckIndex, sortDeckEntries } from './archive';
import { listFeedbackFor, type BrainFeedbackRow } from './feedback';
import {
  ArchivedDeckSchema,
  BRAIN_BUCKET,
  BRAIN_DECK_DIR,
  BRAIN_DECK_INDEX_PATH,
  BRAIN_DOC_INDEX_PATH,
  BRAIN_LATEST_PATH,
  BrainSnapshotSchema,
  DeckIndexSchema,
  DocFileSchema,
  DocIndexSchema,
  docLatestPath,
  docVersionPath,
  type ArchivedDeck,
  type BrainSnapshot,
  type DeckIndex,
  type DeckIndexEntry,
  type DocIndexEntry,
} from './snapshot';

export type BrainSnapshotSource = 'storage' | 'local' | 'none';

export interface BrainSnapshotResult {
  snapshot: BrainSnapshot | null;
  source: BrainSnapshotSource;
  error?: string;
}

export interface BrainSnapshotRef {
  /** YYYY-MM-DD taken from the file name. */
  date: string;
  path: string;
  updatedAt: string | null;
  size: number | null;
}

const SNAPSHOT_DIR = 'snapshots';
const DATED_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

function localSnapshotDir(): string {
  return path.join(process.cwd(), 'brain', '.snapshots');
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

type ParseOutcome = { ok: true; snapshot: BrainSnapshot } | { ok: false; error: string };

/** Parses raw JSON text and validates it. Exported for tests. */
export function parseSnapshotText(text: string): ParseOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Snapshot is not valid JSON.' };
  }
  const result = BrainSnapshotSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `Snapshot failed schema validation (${issues}).` };
  }
  return { ok: true, snapshot: result.data };
}

async function loadFromStorage(): Promise<ParseOutcome> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(BRAIN_BUCKET).download(BRAIN_LATEST_PATH);
    if (error || !data) {
      const msg = error?.message?.trim();
      const readable = !msg || msg.startsWith('{') ? `${BRAIN_LATEST_PATH} not found (or the ${BRAIN_BUCKET} bucket is missing)` : msg;
      return { ok: false, error: `Storage: ${readable}` };
    }
    return parseSnapshotText(await data.text());
  } catch (err) {
    return { ok: false, error: `Storage: ${err instanceof Error ? err.message : 'download failed'}` };
  }
}

async function loadFromDisk(): Promise<ParseOutcome> {
  try {
    const text = await readFile(path.join(localSnapshotDir(), 'latest.json'), 'utf8');
    return parseSnapshotText(text);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return {
      ok: false,
      error: code === 'ENOENT' ? 'Local: brain/.snapshots/latest.json not found' : 'Local: could not read snapshot',
    };
  }
}

/**
 * The current snapshot. Memoised per request so the layout and page share one download.
 */
export const getBrainSnapshot = cache(async (): Promise<BrainSnapshotResult> => {
  const remote = await loadFromStorage();
  if (remote.ok) return { snapshot: remote.snapshot, source: 'storage' };

  if (isDevelopment()) {
    const local = await loadFromDisk();
    if (local.ok) return { snapshot: local.snapshot, source: 'local', error: remote.error };
    return { snapshot: null, source: 'none', error: `${remote.error} · ${local.error}` };
  }

  return { snapshot: null, source: 'none', error: remote.error };
});

/**
 * Dated snapshot history (`snapshots/<date>.json`), newest first.
 * In development, also lists dated files in brain/.snapshots when Storage is unavailable.
 */
export const listSnapshots = cache(async (): Promise<{ snapshots: BrainSnapshotRef[]; error?: string }> => {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BRAIN_BUCKET)
      .list(SNAPSHOT_DIR, { limit: 200, sortBy: { column: 'name', order: 'desc' } });
    if (error) throw new Error(error.message);
    const snapshots = (data ?? [])
      .map((file): BrainSnapshotRef | null => {
        const match = DATED_FILE.exec(file.name);
        if (!match) return null;
        const size = typeof file.metadata?.size === 'number' ? file.metadata.size : null;
        return { date: match[1], path: `${SNAPSHOT_DIR}/${file.name}`, updatedAt: file.updated_at ?? null, size };
      })
      .filter((ref): ref is BrainSnapshotRef => ref !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { snapshots };
  } catch (err) {
    const message = `Storage: ${err instanceof Error ? err.message : 'list failed'}`;
    if (!isDevelopment()) return { snapshots: [], error: message };
    try {
      const dir = localSnapshotDir();
      const names = await readdir(dir);
      const refs = await Promise.all(
        names.map(async (name): Promise<BrainSnapshotRef | null> => {
          const match = DATED_FILE.exec(name);
          if (!match) return null;
          const info = await stat(path.join(dir, name));
          return { date: match[1], path: `brain/.snapshots/${name}`, updatedAt: info.mtime.toISOString(), size: info.size };
        }),
      );
      return {
        snapshots: refs.filter((ref): ref is BrainSnapshotRef => ref !== null).sort((a, b) => b.date.localeCompare(a.date)),
        error: message,
      };
    } catch {
      return { snapshots: [], error: message };
    }
  }
});

/* ---------------------------------------------------------------- deck archive + docs */

async function downloadText(storagePath: string): Promise<{ text: string } | { error: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(BRAIN_BUCKET).download(storagePath);
    if (error || !data) {
      const msg = error?.message?.trim();
      return { error: `Storage: ${!msg || msg.startsWith('{') ? `${storagePath} not found` : msg}` };
    }
    return { text: await data.text() };
  } catch (err) {
    return { error: `Storage: ${err instanceof Error ? err.message : 'download failed'}` };
  }
}

/** Development only: build the index straight from brain/decks/*.json. */
async function localDeckIndex(): Promise<{ index: DeckIndex; decks: Map<string, ArchivedDeck> } | null> {
  try {
    const dir = path.join(process.cwd(), 'brain', BRAIN_DECK_DIR);
    const names = (await readdir(dir)).filter((n) => n.endsWith('.json') && n !== 'index.json');
    const decks = new Map<string, ArchivedDeck>();
    const entries: DeckIndexEntry[] = [];
    for (const name of names) {
      try {
        const parsed = ArchivedDeckSchema.safeParse(JSON.parse(await readFile(path.join(dir, name), 'utf8')));
        if (!parsed.success || !isSafeId(parsed.data.id)) continue;
        decks.set(parsed.data.id, parsed.data);
        entries.push(buildDeckIndexEntry(parsed.data, name));
      } catch {
        // skip unreadable files
      }
    }
    const supersedes = Object.fromEntries([...decks.values()].filter((d) => d.supersedes).map((d) => [d.id, d.supersedes as string]));
    return { index: mergeDeckIndex(null, entries, supersedes), decks };
  } catch {
    return null;
  }
}

export interface DeckArchiveResult {
  decks: DeckIndexEntry[];
  source: BrainSnapshotSource;
  error?: string;
}

/** decks/index.json, newest first. */
export const listArchivedDecks = cache(async (): Promise<DeckArchiveResult> => {
  const remote = await downloadText(BRAIN_DECK_INDEX_PATH);
  if ('text' in remote) {
    try {
      const parsed = DeckIndexSchema.safeParse(JSON.parse(remote.text));
      if (parsed.success) return { decks: sortDeckEntries(parsed.data.decks), source: 'storage' };
      return { decks: [], source: 'none', error: 'decks/index.json failed validation' };
    } catch {
      return { decks: [], source: 'none', error: 'decks/index.json is not valid JSON' };
    }
  }
  if (isDevelopment()) {
    const local = await localDeckIndex();
    if (local && local.index.decks.length) return { decks: local.index.decks, source: 'local', error: remote.error };
  }
  return { decks: [], source: 'none', error: remote.error };
});

/** One archived deck by id (decks/<id>.json). */
export const getArchivedDeck = cache(async (id: string): Promise<ArchivedDeck | null> => {
  if (!isSafeId(id)) return null;
  const remote = await downloadText(`${BRAIN_DECK_DIR}/${id}.json`);
  if ('text' in remote) {
    try {
      const parsed = ArchivedDeckSchema.safeParse(JSON.parse(remote.text));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through
    }
  }
  if (isDevelopment()) {
    const local = await localDeckIndex();
    return local?.decks.get(id) ?? null;
  }
  return null;
});

export interface DocListResult {
  docs: DocIndexEntry[];
  error?: string;
}

/** docs/index.json, sorted by brain path. */
export const listBrainDocs = cache(async (): Promise<DocListResult> => {
  const remote = await downloadText(BRAIN_DOC_INDEX_PATH);
  if ('error' in remote) return { docs: [], error: remote.error };
  try {
    const parsed = DocIndexSchema.safeParse(JSON.parse(remote.text));
    if (!parsed.success) return { docs: [], error: 'docs/index.json failed validation' };
    return { docs: parsed.data.docs };
  } catch {
    return { docs: [], error: 'docs/index.json is not valid JSON' };
  }
});

export interface BrainDocResult {
  entry: DocIndexEntry;
  markdown: string;
  /** Hash of the version shown: the current one unless an older retained version was asked for. */
  hash: string;
}

export const getBrainDoc = cache(async (slug: string, versionHash?: string): Promise<BrainDocResult | null> => {
  if (!isSafeId(slug)) return null;
  const { docs } = await listBrainDocs();
  const entry = docs.find((d) => d.slug === slug);
  if (!entry) return null;
  const old =
    versionHash && versionHash !== entry.hash && isSafeId(versionHash) && entry.versions.some((v) => v.hash === versionHash) ? versionHash : null;
  const res = await downloadText(old ? docVersionPath(slug, old) : docLatestPath(slug));
  if ('error' in res) return null;
  try {
    const file = DocFileSchema.safeParse(JSON.parse(res.text));
    if (!file.success) return null;
    return { entry, markdown: file.data.markdown, hash: old ?? file.data.hash };
  } catch {
    return null;
  }
});

/** Feedback rows for a deck (deck + slide notes) or a doc. Never throws; the table may not exist yet. */
export async function loadFeedback(targetType: 'deck' | 'doc', targetId: string): Promise<{ rows: BrainFeedbackRow[]; error?: string }> {
  try {
    const { data, error } = await listFeedbackFor(supabaseAdmin, targetType, targetId);
    if (error) return { rows: [], error: error.message };
    return { rows: data ?? [] };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : 'feedback unavailable' };
  }
}
