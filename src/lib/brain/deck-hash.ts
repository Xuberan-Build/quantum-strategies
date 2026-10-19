/**
 * Deck content hash, used by the reading workflow (deck-reads.ts) to spot decks that changed
 * after they were read, and stored on deck index entries by buildDeckIndexEntry (archive.ts).
 * No imports, so archive.ts and deck-reads.ts can both use it without an import cycle.
 */

/** JSON with object keys sorted, so the same content always serialises the same way. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** cyrb53: small, fast, isomorphic 53-bit string hash (change detection, not security). */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export interface HashableDeck {
  title: string;
  period: string;
  summary: string;
  slides: unknown[];
}

/**
 * Hash of what a reader actually reads: title, period, summary and slides. Archive metadata
 * (status, tags, supersedes, createdAt) is left out, so superseding a deck does not make it
 * "updated".
 */
export function deckContentHash(deck: HashableDeck): string {
  const text = stableStringify({ title: deck.title, period: deck.period, summary: deck.summary, slides: deck.slides });
  return `c1-${cyrb53(text).toString(16).padStart(14, '0')}`;
}
