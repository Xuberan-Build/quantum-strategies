/**
 * Server-only loaders for the deck reading workflow: the merged deck list (archive +
 * snapshot, with content hashes), the current admin's read receipts and per-deck note stats.
 * Every loader degrades to an error string instead of throwing (brain_deck_reads may not
 * exist until its migration is pushed).
 */
import { cache } from 'react';
import { createServerSupabaseClient, supabaseAdmin } from '@/lib/supabase/server';
import { deckContentHash } from './deck-hash';
import { deckNoteStats, deckReadStatus, listDeckReads, type DeckNoteStats, type DeckReadState, type DeckReadStatus } from './deck-reads';
import { BRAIN_FEEDBACK_TABLE } from './feedback';
import { getBrainSnapshot, listArchivedDecks, type BrainSnapshotSource } from './load';
import type { BrainSnapshot, DeckIndexEntry } from './snapshot';

/**
 * Archive entries plus snapshot decks that are not (yet) archived (tagged "snapshot"), newest
 * first. A deck in the snapshot is presented from the snapshot (see deck/[id]/page.tsx), so its
 * content hash is taken from there, keeping the list and the presenter in agreement.
 */
export function mergeDeckList(archive: DeckIndexEntry[], snapshot: BrainSnapshot | null): DeckIndexEntry[] {
  const snapshotDecks = new Map((snapshot?.decks ?? []).map((d) => [d.id, d]));
  const archivedIds = new Set(archive.map((d) => d.id));
  const archived = archive.map((d) => {
    const fromSnapshot = snapshotDecks.get(d.id);
    return fromSnapshot ? { ...d, contentHash: deckContentHash(fromSnapshot) } : d;
  });
  const fromSnapshot: DeckIndexEntry[] = (snapshot?.decks ?? [])
    .filter((d) => !archivedIds.has(d.id))
    .map((d, i) => ({
      id: d.id,
      title: d.title,
      period: d.period,
      summary: d.summary,
      createdAt: snapshot!.generatedAt,
      status: i === 0 ? 'current' : 'superseded',
      slideCount: d.slides.length,
      tags: ['snapshot'],
      contentHash: deckContentHash(d),
    }));
  return [...archived, ...fromSnapshot].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export interface DeckListResult {
  decks: DeckIndexEntry[];
  archiveSource: BrainSnapshotSource;
  archiveError?: string;
}

export const loadDeckList = cache(async (): Promise<DeckListResult> => {
  const [archive, { snapshot }] = await Promise.all([listArchivedDecks(), getBrainSnapshot()]);
  return { decks: mergeDeckList(archive.decks, snapshot), archiveSource: archive.source, archiveError: archive.error };
});

/** The signed-in admin's user id (the admin layout and middleware already enforce admin). */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
});

export interface ReadsResult {
  reads: Record<string, DeckReadState>;
  error?: string;
}

/** The current admin's read receipts, keyed by deck id. */
export const loadDeckReads = cache(async (): Promise<ReadsResult> => {
  const userId = await getCurrentUserId();
  if (!userId) return { reads: {}, error: 'not signed in' };
  try {
    const { data, error } = await listDeckReads(supabaseAdmin, userId);
    if (error) return { reads: {}, error: error.message };
    const reads: Record<string, DeckReadState> = {};
    for (const r of data ?? []) reads[r.deck_id] = { content_hash: r.content_hash, read_at: r.read_at, last_slide: r.last_slide };
    return { reads };
  } catch (err) {
    return { reads: {}, error: err instanceof Error ? err.message : 'read status unavailable' };
  }
});

/** Open-note and waiting-for-sync counts per deck (deck + slide notes). */
export const loadDeckNoteStats = cache(async (): Promise<{ stats: Record<string, DeckNoteStats>; error?: string }> => {
  try {
    const { data, error } = await supabaseAdmin
      .from(BRAIN_FEEDBACK_TABLE)
      .select('target_id, status, synced_to_brain_at')
      .in('target_type', ['deck', 'slide'])
      .limit(5000)
      .returns<{ target_id: string; status: string; synced_to_brain_at: string | null }[]>();
    if (error) return { stats: {}, error: error.message };
    return { stats: deckNoteStats(data ?? []) };
  } catch (err) {
    return { stats: {}, error: err instanceof Error ? err.message : 'notes unavailable' };
  }
});

export interface DeckQueueItem {
  id: string;
  title: string;
  status: DeckReadStatus;
}

/** Every deck in archive order with the current admin's read status (for "Next unread deck"). */
export function readingQueue(decks: DeckIndexEntry[], reads: Record<string, DeckReadState>): DeckQueueItem[] {
  return decks.map((d) => ({ id: d.id, title: d.title, status: deckReadStatus(reads[d.id], d.contentHash) }));
}
