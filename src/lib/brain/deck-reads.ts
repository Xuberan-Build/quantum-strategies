/**
 * Deck reading workflow: per-admin read receipts for brain decks, stored in the
 * `brain_deck_reads` table (service role only, behind the admin check).
 *
 * Read receipts are deliberately separate from brain_feedback, so pull-feedback.ts never
 * carries them into the brain as feedback.
 *
 * Pure module: schemas, the deck content hash, status/filter/sort/next-unread logic and
 * data helpers that take a client. Safe to import from client components.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SAFE_ID } from './archive';

export const BRAIN_DECK_READS_TABLE = 'brain_deck_reads';

export const DECK_READ_COLUMNS = 'id, user_id, deck_id, content_hash, read_at, last_slide, created_at, updated_at';

export interface DeckReadRow {
  id: string;
  user_id: string;
  deck_id: string;
  content_hash: string | null;
  read_at: string | null;
  last_slide: number;
  created_at: string;
  updated_at: string;
}

/** What the UI needs from a row. */
export type DeckReadState = Pick<DeckReadRow, 'content_hash' | 'read_at' | 'last_slide'>;

export type DeckReadStatus = 'unread' | 'updated' | 'read';

/* ---------------------------------------------------------------- content hash (deck-hash.ts) */

export { deckContentHash, stableStringify, type HashableDeck } from './deck-hash';

/* ---------------------------------------------------------------- status */

/**
 * unread: never read, or marked unread. updated: read, but the deck's content hash has changed
 * since (only when both hashes are known). read: otherwise.
 */
export function deckReadStatus(read: Pick<DeckReadState, 'read_at' | 'content_hash'> | null | undefined, currentHash?: string | null): DeckReadStatus {
  if (!read?.read_at) return 'unread';
  if (currentHash && read.content_hash && read.content_hash !== currentHash) return 'updated';
  return 'read';
}

export const READ_STATUS_LABEL: Record<DeckReadStatus, string> = {
  unread: 'Unread',
  updated: 'Updated since you read it',
  read: 'Read',
};

export type DeckReadFilter = DeckReadStatus | 'all';

const STATUS_RANK: Record<DeckReadStatus, number> = { unread: 0, updated: 1, read: 2 };

export interface DeckWithStatus {
  id: string;
  createdAt: string;
  status: DeckReadStatus;
}

export function filterByReadStatus<T extends { status: DeckReadStatus }>(items: T[], filter: DeckReadFilter): T[] {
  return filter === 'all' ? items : items.filter((d) => d.status === filter);
}

/** Unread first, then updated, then read; newest first (then id descending) within each. */
export function sortUnreadFirst<T extends DeckWithStatus>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function readCounts(items: { status: DeckReadStatus }[]): Record<DeckReadFilter, number> {
  const counts: Record<DeckReadFilter, number> = { unread: 0, updated: 0, read: 0, all: items.length };
  for (const d of items) counts[d.status] += 1;
  return counts;
}

/**
 * The next deck to read after `currentId`: the first unread or updated deck that comes after
 * it in archive order (newest first), wrapping around to the top. Never the current deck.
 * Unread decks win over updated ones. When the current deck is not in the list, starts from
 * the top.
 */
export function nextUnreadDeck<T extends { id: string; status: DeckReadStatus }>(ordered: T[], currentId: string): T | null {
  const at = ordered.findIndex((d) => d.id === currentId);
  const rotated = at < 0 ? ordered : [...ordered.slice(at + 1), ...ordered.slice(0, at)];
  return rotated.find((d) => d.status === 'unread') ?? rotated.find((d) => d.status === 'updated') ?? null;
}

/** Where to open a deck when no ?s= is given: resume an unfinished read, else the first slide. */
export function resumeIndex(read: DeckReadState | null | undefined, status: DeckReadStatus, slideCount: number): number {
  if (!read || status === 'read' || slideCount <= 0) return 0;
  const last = Math.trunc(read.last_slide ?? 0);
  if (last <= 0) return 0;
  return Math.min(slideCount - 1, last);
}

/* ---------------------------------------------------------------- API input */

export const DeckReadInputSchema = z
  .object({
    deck_id: z.string().regex(SAFE_ID, 'invalid deck_id'),
    last_slide: z.number().int().min(0).max(999).optional(),
    read: z.boolean().optional(),
    content_hash: z.string().min(1).max(80).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.read === undefined && v.last_slide === undefined) ctx.addIssue({ code: 'custom', path: ['read'], message: 'Nothing to update.' });
    if (v.read === true && !v.content_hash) ctx.addIssue({ code: 'custom', path: ['content_hash'], message: 'content_hash is required to mark a deck read' });
  });

export type DeckReadInput = z.infer<typeof DeckReadInputSchema>;

/**
 * Upsert payload. Only the columns being changed are included, so a progress update never
 * clears read_at and marking read never moves last_slide.
 */
export function deckReadUpsertRow(input: DeckReadInput, userId: string, now: string = new Date().toISOString()) {
  const row: Record<string, unknown> = { user_id: userId, deck_id: input.deck_id, updated_at: now };
  if (input.last_slide !== undefined) row.last_slide = input.last_slide;
  if (input.read === true) {
    row.read_at = now;
    row.content_hash = input.content_hash;
  } else if (input.read === false) {
    row.read_at = null;
  }
  return row;
}

/* ---------------------------------------------------------------- data helpers (pass a service-role client) */

export async function listDeckReads(client: SupabaseClient, userId: string, deckId?: string) {
  let query = client.from(BRAIN_DECK_READS_TABLE).select(DECK_READ_COLUMNS).eq('user_id', userId);
  if (deckId) query = query.eq('deck_id', deckId);
  return query.limit(2000).returns<DeckReadRow[]>();
}

export async function upsertDeckRead(client: SupabaseClient, input: DeckReadInput, userId: string) {
  return client
    .from(BRAIN_DECK_READS_TABLE)
    .upsert(deckReadUpsertRow(input, userId), { onConflict: 'user_id,deck_id' })
    .select(DECK_READ_COLUMNS)
    .single<DeckReadRow>();
}

/* ---------------------------------------------------------------- note stats per deck */

export interface DeckNoteStats {
  open: number;
  unsynced: number;
}

/** Per-deck counts from brain_feedback rows (deck and slide notes). */
export function deckNoteStats(rows: { target_id: string; status: string; synced_to_brain_at: string | null }[]): Record<string, DeckNoteStats> {
  const out: Record<string, DeckNoteStats> = {};
  for (const r of rows) {
    const s = (out[r.target_id] ??= { open: 0, unsynced: 0 });
    if (r.status === 'open') s.open += 1;
    if (!r.synced_to_brain_at) s.unsynced += 1;
  }
  return out;
}

/** The local command that carries notes into brain/feedback (the website cannot write to the brain). */
export const FEEDBACK_SYNC_COMMAND = 'scripts/brain/tick.sh --only feedback';
