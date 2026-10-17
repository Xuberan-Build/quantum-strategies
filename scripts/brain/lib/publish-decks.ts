/**
 * Validate brain/decks/*.json (ArchivedDeckSchema; plain DeckSchema JSON is valid) and
 * upload each to `brain/decks/<id>.json`, then merge decks/index.json. Retention: remote
 * decks without a local file are never deleted and stay in the index.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { buildDeckIndexEntry, isSafeId, mergeDeckIndex } from '../../../src/lib/brain/archive';
import {
  ArchivedDeckSchema,
  BRAIN_DECK_DIR,
  BRAIN_DECK_INDEX_PATH,
  DeckIndexSchema,
  type ArchivedDeck,
  type DeckIndex,
  type DeckIndexEntry,
} from '../../../src/lib/brain/snapshot';
import { downloadText, ensurePrivateBucket, serviceClient, uploadText } from './storage';

export interface PublishDecksResult {
  valid: number;
  invalid: string[]; // "<file>: <reason>"
  uploaded: number;
  index: DeckIndex | null;
}

export interface LocalDeck {
  file: string;
  deck: ArchivedDeck;
  entry: DeckIndexEntry;
}

export function readLocalDecks(dir: string): { decks: LocalDeck[]; invalid: string[] } {
  const decks: LocalDeck[] = [];
  const invalid: string[] = [];
  if (!existsSync(dir)) return { decks, invalid };
  const seen = new Set<string>();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'index.json').sort()) {
    const file = path.join(dir, name);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      invalid.push(`${name}: not valid JSON (${e instanceof Error ? e.message : e})`);
      continue;
    }
    const parsed = ArchivedDeckSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
      invalid.push(`${name}: ${issues.join('; ')}`);
      continue;
    }
    const deck = parsed.data;
    if (!isSafeId(deck.id)) {
      invalid.push(`${name}: id "${deck.id}" must be letters, digits, dot, dash or underscore`);
      continue;
    }
    if (seen.has(deck.id)) {
      invalid.push(`${name}: duplicate deck id "${deck.id}" (skipped)`);
      continue;
    }
    seen.add(deck.id);
    const mtime = statSync(file).mtime.toISOString().slice(0, 10);
    decks.push({ file: name, deck, entry: buildDeckIndexEntry(deck, name, mtime) });
  }
  return { decks, invalid };
}

export async function publishDecks(opts: { dir: string; upload: boolean; log?: (msg: string) => void }): Promise<PublishDecksResult> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const { decks, invalid } = readLocalDecks(opts.dir);
  for (const msg of invalid) log(`deck invalid: ${msg}`);
  log(`decks: ${decks.length} valid, ${invalid.length} invalid in ${opts.dir}`);
  const supersedes = Object.fromEntries(decks.filter((d) => d.deck.supersedes).map((d) => [d.deck.id, d.deck.supersedes as string]));

  if (!opts.upload) {
    return { valid: decks.length, invalid, uploaded: 0, index: mergeDeckIndex(null, decks.map((d) => d.entry), supersedes) };
  }

  const sb = serviceClient();
  await ensurePrivateBucket(sb);

  let remote: DeckIndex | null = null;
  const remoteText = await downloadText(sb, BRAIN_DECK_INDEX_PATH);
  if (remoteText) {
    const parsed = DeckIndexSchema.safeParse(JSON.parse(remoteText));
    if (parsed.success) remote = parsed.data;
    else throw new Error('remote decks/index.json failed validation; refusing to overwrite it (fix or move it first)');
  }

  let uploaded = 0;
  for (const { deck } of decks) {
    await uploadText(sb, `${BRAIN_DECK_DIR}/${deck.id}.json`, JSON.stringify(deck, null, 2), 'application/json');
    uploaded++;
  }
  const index = mergeDeckIndex(remote, decks.map((d) => d.entry), supersedes);
  await uploadText(sb, BRAIN_DECK_INDEX_PATH, JSON.stringify(index, null, 2), 'application/json');
  log(`uploaded ${uploaded} deck(s) + ${BRAIN_DECK_INDEX_PATH} (${index.decks.length} in index, ${index.decks.length - decks.length} retained remote-only)`);
  return { valid: decks.length, invalid, uploaded, index };
}
