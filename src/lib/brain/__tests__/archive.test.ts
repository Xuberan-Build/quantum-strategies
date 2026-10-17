import { describe, expect, it } from 'vitest';
import {
  buildDeckIndexEntry,
  collectTags,
  deckCreatedAt,
  docSlug,
  docTitle,
  groupByMonth,
  isSafeId,
  matchManifestPattern,
  mergeDeckIndex,
  mergeDocIndex,
} from '../archive';
import { ArchivedDeckSchema, DeckIndexSchema, DeckSchema, DocIndexSchema, type DeckIndexEntry } from '../snapshot';

/* Synthetic fixtures. No real brain content. */
const plainDeck = {
  id: '2026-10-01-alpha',
  title: 'Alpha',
  period: '2026-W40',
  summary: 'Synthetic summary.',
  slides: [{ id: 's1', kind: 'headline', title: 'One' }],
};

const entry = (id: string, createdAt: string, extra: Partial<DeckIndexEntry> = {}): DeckIndexEntry => ({
  id,
  title: id,
  period: 'p',
  summary: 's',
  createdAt,
  status: 'current',
  slideCount: 1,
  tags: [],
  ...extra,
});

describe('ArchivedDeckSchema', () => {
  it('accepts plain DeckSchema JSON unchanged', () => {
    expect(DeckSchema.safeParse(plainDeck).success).toBe(true);
    const parsed = ArchivedDeckSchema.parse(plainDeck);
    expect(parsed.status).toBeUndefined();
    expect(parsed.slides).toHaveLength(1);
  });

  it('accepts the optional archive metadata', () => {
    const parsed = ArchivedDeckSchema.parse({
      ...plainDeck,
      source: 'gtm/report.md',
      createdAt: '2026-10-01T10:00:00Z',
      status: 'superseded',
      supersedes: 'older',
      externalUrl: 'https://claude.ai/artifact/x',
      tags: ['gtm'],
    });
    expect(parsed.tags).toEqual(['gtm']);
  });

  it('rejects an unknown status and a non-URL externalUrl', () => {
    expect(ArchivedDeckSchema.safeParse({ ...plainDeck, status: 'draft' }).success).toBe(false);
    expect(ArchivedDeckSchema.safeParse({ ...plainDeck, externalUrl: 'not a url' }).success).toBe(false);
  });
});

describe('deck index builder', () => {
  it('derives createdAt from the field, then the file name, then the id', () => {
    expect(deckCreatedAt({ id: 'x', createdAt: '2026-01-02' }, '2025-05-05-x.json')).toBe('2026-01-02');
    expect(deckCreatedAt({ id: 'x' }, 'decks/2025-05-05-x.json')).toBe('2025-05-05');
    expect(deckCreatedAt({ id: '2024-03-03-x' })).toBe('2024-03-03');
    expect(deckCreatedAt({ id: 'x' }, undefined, '2020-01-01')).toBe('2020-01-01');
  });

  it('builds a valid entry with defaults', () => {
    const e = buildDeckIndexEntry(ArchivedDeckSchema.parse(plainDeck), '2026-10-01-alpha.json');
    expect(e).toMatchObject({ id: '2026-10-01-alpha', status: 'current', slideCount: 1, tags: [], createdAt: '2026-10-01' });
    expect(e.source).toBeUndefined();
    expect(DeckIndexSchema.safeParse({ version: 1, updatedAt: 'now', decks: [e] }).success).toBe(true);
  });

  it('keeps remote-only decks (retention), lets local win, sorts newest first', () => {
    const remote = { version: 1 as const, updatedAt: 'then', decks: [entry('old', '2026-01-01'), entry('mid', '2026-05-01', { title: 'stale' })] };
    const merged = mergeDeckIndex(remote, [entry('mid', '2026-05-01', { title: 'fresh' }), entry('new', '2026-10-01')], {}, 'now');
    expect(merged.decks.map((d) => d.id)).toEqual(['new', 'mid', 'old']);
    expect(merged.decks.find((d) => d.id === 'mid')?.title).toBe('fresh');
    expect(merged.updatedAt).toBe('now');
  });

  it('marks a superseded deck unless it is archived', () => {
    const merged = mergeDeckIndex(null, [entry('a', '2026-01-01'), entry('b', '2026-01-02', { status: 'archived' }), entry('c', '2026-02-01')], { c: 'a', d: 'b' });
    expect(merged.decks.find((d) => d.id === 'a')?.status).toBe('superseded');
    expect(merged.decks.find((d) => d.id === 'b')?.status).toBe('archived');
  });

  it('groups by month and collects tags by use', () => {
    const groups = groupByMonth([entry('a', '2026-10-17T05:00:00Z'), entry('b', '2026-10-01'), entry('c', '2026-09-30'), entry('d', 'unknown')]);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['2026-10', 2],
      ['2026-09', 1],
      ['undated', 1],
    ]);
    expect(groups[0].label).toBe('October 2026');
    expect(collectTags([{ tags: ['x', 'y'] }, { tags: ['y'] }])).toEqual(['y', 'x']);
  });

  it('only accepts storage-safe ids', () => {
    expect(isSafeId('2026-10-17-quiz.v2')).toBe(true);
    expect(isSafeId('../etc')).toBe(false);
    expect(isSafeId('a/b')).toBe(false);
    expect(isSafeId('')).toBe(false);
  });
});

describe('doc index builder', () => {
  it('slugs and titles docs', () => {
    expect(docSlug('gtm/free-quiz-spec.md')).toBe('gtm--free-quiz-spec');
    expect(docSlug('research/language/Audience Vocab.md')).toBe('research--language--audience-vocab');
    expect(docTitle('intro\n# The Title #\n', 'x.md')).toBe('The Title');
    expect(docTitle('no heading', 'gtm/beta-offer.md')).toBe('Beta Offer');
  });

  it('expands manifest patterns within one folder', () => {
    const files = ['research/language/a.md', 'research/language/b.md', 'research/other/c.md'];
    expect(matchManifestPattern('research/language/*.md', files)).toEqual(['research/language/a.md', 'research/language/b.md']);
    expect(matchManifestPattern('research/other/c.md', files)).toEqual(['research/other/c.md']);
    expect(matchManifestPattern('missing.md', files)).toEqual([]);
  });

  it('accumulates versions, keeps unchanged publishedAt, and retains unlisted docs', () => {
    const base = { slug: 'd', title: 'D', path: 'd.md', updatedAt: 'u', bytes: 1 };
    const first = mergeDocIndex(null, [{ ...base, hash: 'h1', publishedAt: 't1' }, { ...base, slug: 'e', path: 'e.md', hash: 'e1', publishedAt: 't1' }], 't1');
    const same = mergeDocIndex(first, [{ ...base, hash: 'h1', publishedAt: 't2' }], 't2');
    expect(same.docs.find((d) => d.slug === 'd')).toMatchObject({ publishedAt: 't1', versions: [{ hash: 'h1', publishedAt: 't1' }] });
    const changed = mergeDocIndex(same, [{ ...base, hash: 'h2', publishedAt: 't3' }], 't3');
    const d = changed.docs.find((x) => x.slug === 'd')!;
    expect(d.hash).toBe('h2');
    expect(d.versions.map((v) => v.hash)).toEqual(['h2', 'h1']);
    expect(changed.docs.map((x) => x.slug)).toContain('e');
    expect(DocIndexSchema.safeParse(changed).success).toBe(true);
  });
});
