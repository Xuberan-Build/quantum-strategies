import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: { from: vi.fn() }, createServerSupabaseClient: vi.fn() }));

import { buildDeckIndexEntry } from '../archive';
import {
  DeckReadInputSchema,
  deckContentHash,
  deckNoteStats,
  deckReadStatus,
  deckReadUpsertRow,
  filterByReadStatus,
  nextUnreadDeck,
  readCounts,
  resumeIndex,
  sortUnreadFirst,
  stableStringify,
  type DeckReadStatus,
} from '../deck-reads';
import { formatInboxEntry, type BrainFeedbackRow } from '../feedback';
import { mergeDeckList, readingQueue } from '../reading';
import type { BrainSnapshot, DeckIndexEntry } from '../snapshot';

/* Synthetic fixtures only. */
const deck = {
  id: 'deck-a',
  title: 'Synthetic A',
  period: '2000-W01',
  summary: 'A synthetic deck.',
  slides: [
    { id: 's1', kind: 'headline' as const, title: 'One' },
    { id: 's2', kind: 'list' as const, title: 'Two', bullets: ['x', 'y'] },
  ],
};

describe('deckContentHash', () => {
  it('is stable across key order and ignores archive metadata', () => {
    const reordered = { slides: deck.slides.map((s) => ({ title: s.title, ...s })), summary: deck.summary, period: deck.period, title: deck.title, id: 'other' };
    expect(deckContentHash(reordered)).toBe(deckContentHash(deck));
    expect(deckContentHash({ ...deck, status: 'superseded', tags: ['t'], createdAt: '2001-01-01' } as typeof deck)).toBe(deckContentHash(deck));
    expect(deckContentHash(deck)).toMatch(/^c1-[0-9a-f]{14}$/);
  });

  it('changes when anything a reader sees changes', () => {
    const base = deckContentHash(deck);
    expect(deckContentHash({ ...deck, title: 'Synthetic A2' })).not.toBe(base);
    expect(deckContentHash({ ...deck, slides: [deck.slides[0], { ...deck.slides[1], bullets: ['x', 'z'] }] })).not.toBe(base);
    expect(deckContentHash({ ...deck, slides: [deck.slides[1], deck.slides[0]] })).not.toBe(base);
  });

  it('stableStringify sorts keys and drops undefined values', () => {
    expect(stableStringify({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe('{"a":[2,{"c":3}],"b":1}');
  });

  it('is written onto deck index entries', () => {
    expect(buildDeckIndexEntry(deck, '2000-01-01-a.json').contentHash).toBe(deckContentHash(deck));
  });
});

describe('deckReadStatus', () => {
  const H = 'c1-aaaa';
  it('is unread without a receipt or after Mark unread', () => {
    expect(deckReadStatus(null, H)).toBe('unread');
    expect(deckReadStatus({ read_at: null, content_hash: H }, H)).toBe('unread');
  });
  it('is read when the hash matches or either hash is unknown', () => {
    expect(deckReadStatus({ read_at: '2000-01-01T00:00:00Z', content_hash: H }, H)).toBe('read');
    expect(deckReadStatus({ read_at: '2000-01-01T00:00:00Z', content_hash: H }, undefined)).toBe('read');
    expect(deckReadStatus({ read_at: '2000-01-01T00:00:00Z', content_hash: null }, H)).toBe('read');
  });
  it('is updated when the content changed after it was read', () => {
    expect(deckReadStatus({ read_at: '2000-01-01T00:00:00Z', content_hash: H }, 'c1-bbbb')).toBe('updated');
  });
});

describe('list helpers', () => {
  const items: { id: string; createdAt: string; status: DeckReadStatus }[] = [
    { id: 'a', createdAt: '2000-01-05', status: 'read' },
    { id: 'b', createdAt: '2000-01-04', status: 'unread' },
    { id: 'c', createdAt: '2000-01-03', status: 'updated' },
    { id: 'd', createdAt: '2000-01-06', status: 'unread' },
  ];

  it('sorts unread first, then updated, then read, newest first within each', () => {
    expect(sortUnreadFirst(items).map((d) => d.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('filters and counts', () => {
    expect(filterByReadStatus(items, 'unread').map((d) => d.id)).toEqual(['b', 'd']);
    expect(filterByReadStatus(items, 'all')).toHaveLength(4);
    expect(readCounts(items)).toEqual({ unread: 2, updated: 1, read: 1, all: 4 });
  });
});

describe('nextUnreadDeck', () => {
  const q = (s: string) => s.split(' ').map((p) => ({ id: p.slice(0, 1), status: ({ u: 'unread', p: 'updated', r: 'read' } as const)[p.slice(1) as 'u' | 'p' | 'r'] }));

  it('picks the next unread deck after the current one, wrapping around', () => {
    expect(nextUnreadDeck(q('ar bu cr du'), 'b')?.id).toBe('d');
    expect(nextUnreadDeck(q('au br cr dr'), 'c')?.id).toBe('a');
  });
  it('never returns the current deck, and prefers unread over updated', () => {
    expect(nextUnreadDeck(q('au br'), 'a')).toBeNull();
    expect(nextUnreadDeck(q('ar bp cu'), 'a')?.id).toBe('c');
    expect(nextUnreadDeck(q('ar bp cr'), 'a')?.id).toBe('b');
  });
  it('starts from the top when the current deck is not listed', () => {
    expect(nextUnreadDeck(q('ar bu cu'), 'zz')?.id).toBe('b');
  });
});

describe('resumeIndex', () => {
  it('resumes unfinished reads only, clamped to the deck', () => {
    expect(resumeIndex({ read_at: null, content_hash: null, last_slide: 3 }, 'unread', 10)).toBe(3);
    expect(resumeIndex({ read_at: null, content_hash: null, last_slide: 30 }, 'unread', 10)).toBe(9);
    expect(resumeIndex({ read_at: 'x', content_hash: 'h', last_slide: 3 }, 'read', 10)).toBe(0);
    expect(resumeIndex({ read_at: 'x', content_hash: 'h', last_slide: 3 }, 'updated', 10)).toBe(3);
    expect(resumeIndex(null, 'unread', 10)).toBe(0);
  });
});

describe('DeckReadInputSchema + deckReadUpsertRow', () => {
  const NOW = '2000-01-01T00:00:00.000Z';
  it('validates input', () => {
    expect(DeckReadInputSchema.safeParse({ deck_id: 'deck-a', last_slide: 2 }).success).toBe(true);
    expect(DeckReadInputSchema.safeParse({ deck_id: 'deck-a', read: true, content_hash: 'c1-x' }).success).toBe(true);
    expect(DeckReadInputSchema.safeParse({ deck_id: 'deck-a', read: true }).success).toBe(false);
    expect(DeckReadInputSchema.safeParse({ deck_id: 'deck-a' }).success).toBe(false);
    expect(DeckReadInputSchema.safeParse({ deck_id: '../x', read: false }).success).toBe(false);
    expect(DeckReadInputSchema.safeParse({ deck_id: 'deck-a', last_slide: -1 }).success).toBe(false);
  });
  it('only touches the columns being changed', () => {
    expect(deckReadUpsertRow({ deck_id: 'd', last_slide: 4 }, 'u1', NOW)).toEqual({ user_id: 'u1', deck_id: 'd', updated_at: NOW, last_slide: 4 });
    expect(deckReadUpsertRow({ deck_id: 'd', read: true, content_hash: 'h' }, 'u1', NOW)).toEqual({ user_id: 'u1', deck_id: 'd', updated_at: NOW, read_at: NOW, content_hash: 'h' });
    expect(deckReadUpsertRow({ deck_id: 'd', read: false }, 'u1', NOW)).toEqual({ user_id: 'u1', deck_id: 'd', updated_at: NOW, read_at: null });
  });
});

describe('deckNoteStats', () => {
  it('counts open and unsynced notes per deck', () => {
    expect(
      deckNoteStats([
        { target_id: 'a', status: 'open', synced_to_brain_at: null },
        { target_id: 'a', status: 'resolved', synced_to_brain_at: '2000-01-01' },
        { target_id: 'a', status: 'open', synced_to_brain_at: '2000-01-01' },
        { target_id: 'b', status: 'applied', synced_to_brain_at: null },
      ]),
    ).toEqual({ a: { open: 2, unsynced: 1 }, b: { open: 0, unsynced: 1 } });
  });
});

describe('mergeDeckList + readingQueue', () => {
  const entry = (id: string, createdAt: string, contentHash?: string): DeckIndexEntry => ({
    id,
    title: id,
    period: 'p',
    summary: 's',
    createdAt,
    status: 'current',
    slideCount: 1,
    tags: [],
    ...(contentHash ? { contentHash } : {}),
  });
  const snapshot = { generatedAt: '2000-02-01T00:00:00Z', decks: [deck] } as unknown as BrainSnapshot;

  it('adds snapshot-only decks and takes hashes from the snapshot version', () => {
    const list = mergeDeckList([entry('old', '2000-01-01', 'c1-old'), entry('deck-a', '2000-01-02', 'c1-archived')], snapshot);
    expect(list.map((d) => d.id)).toEqual(['deck-a', 'old']);
    expect(list.find((d) => d.id === 'deck-a')?.contentHash).toBe(deckContentHash(deck));
    const onlySnapshot = mergeDeckList([], snapshot);
    expect(onlySnapshot[0]).toMatchObject({ id: 'deck-a', tags: ['snapshot'], contentHash: deckContentHash(deck) });
  });

  it('builds the reading queue in archive order with read status', () => {
    const decks = [entry('x', '2000-01-03', 'c1-new'), entry('y', '2000-01-02', 'c1-y')];
    const queue = readingQueue(decks, { x: { read_at: 't', content_hash: 'c1-old', last_slide: 0 }, y: { read_at: 't', content_hash: 'c1-y', last_slide: 0 } });
    expect(queue).toEqual([
      { id: 'x', title: 'x', status: 'updated' },
      { id: 'y', title: 'y', status: 'read' },
    ]);
  });
});

describe('formatInboxEntry slide context', () => {
  it('keeps the deck title, slide number and slide title', () => {
    const row: BrainFeedbackRow = {
      id: '0b8f1c1e-5d1a-4c1b-9a77-1f2e3d4c5b6a',
      created_at: '2000-01-01T00:00:00Z',
      updated_at: null,
      author_id: null,
      target_type: 'slide',
      target_id: 'deck-a',
      deck_id: 'deck-a',
      slide_id: 's2',
      anchor: null,
      kind: 'change',
      body: 'Tighten.',
      status: 'open',
      resolved_note: null,
      reply: null,
      replied_at: null,
      synced_to_brain_at: null,
    };
    const md = formatInboxEntry(row, {
      deckTitles: { 'deck-a': 'Synthetic A' },
      slideTitles: { 'deck-a/s2': 'Two' },
      slideNumbers: { 'deck-a/s2': { n: 2, of: 2 } },
    });
    expect(md).toContain('- deck: `deck-a` (Synthetic A)');
    expect(md).toContain('- slide: 2 of 2 · `s2` (Two)');
  });
});
