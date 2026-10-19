/**
 * Pure helpers for the deck archive and the published-docs index.
 * Shared by the publish scripts (scripts/brain/publish-decks.ts, publish-docs.ts)
 * and the admin pages. No I/O here, so it is safe to import anywhere and easy to test.
 */
import { deckContentHash } from './deck-hash';
import type { ArchivedDeck, DeckIndex, DeckIndexEntry, DocIndex, DocIndexEntry } from './snapshot';

/** Storage-safe id: letters, digits, dot, dash, underscore; no leading dot. */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

export function isSafeId(id: string): boolean {
  return SAFE_ID.test(id) && !id.includes('..');
}

const FILE_DATE = /^(\d{4}-\d{2}-\d{2})/;

/** createdAt: explicit field, else the YYYY-MM-DD prefix of the file name or id, else the fallback. */
export function deckCreatedAt(deck: Pick<ArchivedDeck, 'createdAt' | 'id'>, fileName?: string, fallback?: string): string {
  if (deck.createdAt) return deck.createdAt;
  const fromFile = fileName ? FILE_DATE.exec(fileName.replace(/^.*\//, '')) : null;
  if (fromFile) return fromFile[1];
  const fromId = FILE_DATE.exec(deck.id);
  if (fromId) return fromId[1];
  return fallback ?? new Date().toISOString().slice(0, 10);
}

export function buildDeckIndexEntry(deck: ArchivedDeck, fileName?: string, fallbackDate?: string): DeckIndexEntry {
  return {
    id: deck.id,
    title: deck.title,
    period: deck.period,
    summary: deck.summary,
    createdAt: deckCreatedAt(deck, fileName, fallbackDate),
    status: deck.status ?? 'current',
    ...(deck.source ? { source: deck.source } : {}),
    slideCount: deck.slides.length,
    ...(deck.externalUrl ? { externalUrl: deck.externalUrl } : {}),
    tags: deck.tags ?? [],
    contentHash: deckContentHash(deck),
  };
}

/** Newest first by createdAt, then id descending for a stable order. */
export function sortDeckEntries(entries: DeckIndexEntry[]): DeckIndexEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/**
 * Merge freshly built entries into the remote index. Retention: remote entries that no
 * longer have a local file are kept. Local entries replace remote ones with the same id.
 * A deck named in another deck's `supersedes` is shown as 'superseded' unless it is archived.
 */
export function mergeDeckIndex(
  remote: DeckIndex | null,
  local: DeckIndexEntry[],
  supersedes: Record<string, string> = {},
  now: string = new Date().toISOString(),
): DeckIndex {
  const byId = new Map<string, DeckIndexEntry>();
  for (const entry of remote?.decks ?? []) byId.set(entry.id, entry);
  for (const entry of local) byId.set(entry.id, entry);
  for (const replacedId of Object.values(supersedes)) {
    const replaced = byId.get(replacedId);
    if (replaced && replaced.status === 'current') byId.set(replacedId, { ...replaced, status: 'superseded' });
  }
  return { version: 1, updatedAt: now, decks: sortDeckEntries([...byId.values()]) };
}

export interface MonthGroup<T> {
  key: string; // YYYY-MM, or 'undated'
  label: string; // "October 2026"
  items: T[];
}

/** Groups entries (already sorted newest first) by the YYYY-MM of `createdAt`. */
export function groupByMonth<T extends { createdAt: string }>(entries: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const entry of entries) {
    const m = /^(\d{4})-(\d{2})/.exec(entry.createdAt);
    const key = m ? `${m[1]}-${m[2]}` : 'undated';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const label = m
        ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        : 'Undated';
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(entry);
  }
  return groups;
}

/** All tags across entries, most used first. */
export function collectTags(entries: { tags: string[] }[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/* ---------------------------------------------------------------- docs */

/** "gtm/free-quiz-spec.md" -> "gtm--free-quiz-spec" (flat, URL- and storage-safe). */
export function docSlug(brainPath: string): string {
  return brainPath
    .replace(/^\/+/, '')
    .replace(/\.md$/i, '')
    .split('/')
    .map((part) => part.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('--');
}

/** First "# " heading, else the file name in title case. */
export function docTitle(markdown: string, brainPath: string): string {
  const h1 = /^#\s+(.+?)\s*#*\s*$/m.exec(markdown);
  if (h1) return h1[1].trim();
  const base = brainPath.replace(/^.*\//, '').replace(/\.md$/i, '');
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Merge a freshly published doc into the index. Versions accumulate (newest first) and
 * docs that are no longer in the manifest stay listed (retention).
 */
export function mergeDocIndex(remote: DocIndex | null, fresh: Omit<DocIndexEntry, 'versions'>[], now: string = new Date().toISOString()): DocIndex {
  const bySlug = new Map<string, DocIndexEntry>();
  for (const d of remote?.docs ?? []) bySlug.set(d.slug, d);
  for (const doc of fresh) {
    const prev = bySlug.get(doc.slug);
    const versions = prev?.versions ?? [];
    const same = versions.find((v) => v.hash === doc.hash);
    const nextVersions = same
      ? versions
      : [{ hash: doc.hash, publishedAt: doc.publishedAt, ...(doc.brainCommit ? { brainCommit: doc.brainCommit } : {}) }, ...versions];
    // Unchanged content keeps its original publishedAt.
    const publishedAt = same && prev?.hash === doc.hash ? prev.publishedAt : doc.publishedAt;
    bySlug.set(doc.slug, { ...doc, publishedAt, versions: nextVersions });
  }
  const docs = [...bySlug.values()].sort((a, b) => a.path.localeCompare(b.path));
  return { version: 1, updatedAt: now, docs };
}

/** Expands a manifest of brain-relative paths; `*` matches within one path segment (file names only). */
export function matchManifestPattern(pattern: string, candidates: string[]): string[] {
  if (!pattern.includes('*')) return candidates.includes(pattern) ? [pattern] : [];
  const re = new RegExp(
    '^' +
      pattern
        .split('*')
        .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*') +
      '$',
  );
  return candidates.filter((c) => re.test(c)).sort();
}
