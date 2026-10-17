/** Small markdown helpers for the graph extractors. Pure, no I/O. */
import path from 'node:path';

export const clean = (s: string): string =>
  s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/[*`>]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const cells = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const isSep = (line: string) => /^\s*\|?\s*:?-{2,}/.test(line);

export interface MdTable {
  header: string[];
  rows: string[][];
  /** Nearest heading above the table (cleaned). */
  heading: string;
  line: number;
}

export function tables(md: string): MdTable[] {
  const out: MdTable[] = [];
  const lines = md.split('\n');
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (h) {
      heading = clean(h[1]);
      continue;
    }
    if (/^\s*\|/.test(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(lines[i]).map(clean);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) rows.push(cells(lines[j]));
      out.push({ header, rows, heading, line: i + 1 });
      i = j - 1;
    }
  }
  return out;
}

export function findTable(md: string, ...headerPatterns: RegExp[]): MdTable | undefined {
  return tables(md).find((t) => headerPatterns.every((p) => t.header.some((h) => p.test(h))));
}

export function col(t: MdTable, pattern: RegExp): number {
  return t.header.findIndex((h) => pattern.test(h));
}

export interface MdSection {
  level: number;
  title: string;
  body: string;
  line: number;
}

/** Split into sections at headings of `level` (e.g. 3 = ###). Body excludes deeper headings' own lines? No: it includes everything until the next heading of the same or higher level. */
export function sections(md: string, level: number): MdSection[] {
  const lines = md.split('\n');
  const out: MdSection[] = [];
  let cur: MdSection | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (cur) out.push({ ...cur, body: buf.join('\n').trim() });
    buf.length = 0;
  };
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h = !inFence ? line.match(/^(#{1,6})\s+(.*)$/) : null;
    if (h && h[1].length <= level) {
      flush();
      cur = h[1].length === level ? { level, title: h[2].trim(), body: '', line: i + 1 } : null;
      continue;
    }
    if (cur) buf.push(line);
  }
  flush();
  return out;
}

export function h1(md: string): string | null {
  const m = stripFrontmatter(md).match(/^#\s+(.+)$/m);
  return m ? clean(m[1]) : null;
}

export function stripFrontmatter(md: string): string {
  return md.startsWith('---\n') ? md.replace(/^---\n[\s\S]*?\n---\n?/, '') : md;
}

/** First prose paragraph after the H1: skips headings, tables, lists of metadata, quotes and code. */
export function firstParagraph(md: string, max = 400): string | null {
  const body = stripFrontmatter(md);
  const blocks = body.split(/\n\s*\n/);
  let inFence = false;
  let listFallback: string | null = null;
  for (const raw of blocks) {
    const b = raw.trim();
    if (!b) continue;
    const fences = (b.match(/```/g) ?? []).length;
    if (inFence || b.startsWith('```')) {
      if (fences % 2 === 1) inFence = !inFence;
      continue;
    }
    if (/^#{1,6}\s/.test(b) && !b.includes('\n')) continue;
    if (/^\|/.test(b) || /^---+$/.test(b) || /^<!--/.test(b)) continue;
    const text = clean(b.replace(/^#{1,6}\s+.*$/gm, ''));
    if (text.length < 20) continue;
    // Metadata lines ("Date: … · Status: …", "Tags: …") are not a summary.
    if (/^(date|status|tags|owner|built from|source)\s*:/i.test(text)) continue;
    const out = text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
    if (/^\s*(?:[-*]|\d+\.)\s/.test(b.replace(/^#{1,6}\s+.*\n?/gm, ''))) {
      listFallback ??= out;
      continue;
    }
    return out;
  }
  return listFallback;
}

export interface LinkRef {
  target: string;
  kind: 'wikilink' | 'markdown' | 'path';
}

/**
 * Links out of a note: [[wikilinks]], relative markdown links to .md files, and backticked or bare
 * brain paths like `gtm/free-quiz-spec-v2.md` (the brain's usual way of citing another note).
 */
export function extractLinks(md: string): LinkRef[] {
  const out: LinkRef[] = [];
  for (const m of md.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) out.push({ target: m[1].trim(), kind: 'wikilink' });
  for (const m of md.matchAll(/\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
    if (!/^[a-z]+:\/\//i.test(m[1])) out.push({ target: decodeURI(m[1]), kind: 'markdown' });
  }
  for (const m of md.matchAll(/`((?:brain\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\.md)(?:#[^`]*)?`/g)) out.push({ target: m[1], kind: 'path' });
  return out;
}

/**
 * Resolve a link target to a brain-relative .md path from `fromPath`, using `known` (all brain .md paths).
 * Wikilinks resolve by path, then by basename (unique match only).
 */
export function resolveLink(ref: LinkRef, fromPath: string, known: Set<string>, byBase: Map<string, string[]>): string | null {
  let t = ref.target.replace(/^\.\//, '').replace(/^brain\//, '');
  if (ref.kind === 'wikilink' && !t.endsWith('.md')) t = `${t}.md`;
  const candidates = [path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), t)), path.posix.normalize(t)];
  for (const c of candidates) if (known.has(c)) return c;
  if (ref.kind !== 'markdown') {
    const base = path.posix.basename(t).toLowerCase();
    const hits = byBase.get(base) ?? [];
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** Case-insensitive keyword regexes; invalid patterns are escaped and matched literally. */
export function keywordMatchers(keywords: string[]): RegExp[] {
  return keywords.map((k) => {
    try {
      return new RegExp(k, 'i');
    } catch {
      return new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  });
}

export function matchesAny(text: string, res: RegExp[]): boolean {
  return res.some((r) => r.test(text));
}

export function parseIntLoose(s: string | undefined): number | null {
  if (!s) return null;
  const m = clean(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
