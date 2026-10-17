/**
 * Splits a brain markdown doc into anchorable blocks (headings, paragraphs, list items,
 * table rows, quotes, code) and re-finds comment anchors after the doc changes.
 *
 * An anchor stores the heading path, a quote of the selected text, the block id and the
 * doc version hash it was made on. Re-finding prefers: exact block on the same version →
 * a block containing the quote (same heading path first) → the heading itself → orphaned.
 */

export type DocBlockType = 'heading' | 'paragraph' | 'listItem' | 'tableRow' | 'quote' | 'code' | 'rule' | 'html';

export interface DocBlock {
  id: string;
  type: DocBlockType;
  /** Heading level for headings (1-6). */
  level?: number;
  /** Headings above this block, outermost first. A heading's own path includes itself. */
  headingPath: string[];
  /** Markdown to render for this block on its own. */
  markdown: string;
  /** Plain text, for quote matching. */
  text: string;
  /** For table rows: the header + separator lines, so the row renders as a table. */
  tableHeader?: string;
  /** True for the first row of a table (renders its header visibly). */
  firstRow?: boolean;
}

export interface DocAnchor {
  headingPath: string[];
  quote?: string;
  versionHash?: string;
  blockId?: string;
}

export function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[`*_~[\]()<>#!]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section'
  );
}

/** Strips inline markdown so quotes from the rendered page match the source. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\[[ xX]\]\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeQuote(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s{0,3}(```+|~~~+)/;
const LIST_ITEM = /^(\s{0,3})([-*+]|\d+[.)])\s+/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line) || (line.includes('|') && line.trim().length > 0 && !line.trim().startsWith('>'));

/** Front matter (--- ... ---) is not part of the readable doc. */
function stripFrontMatter(lines: string[]): string[] {
  if (lines[0]?.trim() !== '---') return lines;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  return end > 0 ? lines.slice(end + 1) : lines;
}

export function splitDoc(markdown: string): DocBlock[] {
  const lines = stripFrontMatter(markdown.replace(/\r\n?/g, '\n').split('\n'));
  const blocks: DocBlock[] = [];
  const path: { level: number; title: string }[] = [];
  const counters = new Map<string, number>();
  const usedIds = new Set<string>();

  const sectionKey = () => (path.length ? path.map((p) => slugifyHeading(p.title)).join('.') : 'top');
  const nextId = (prefix: string) => {
    const key = sectionKey();
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    let id = `${prefix}${key === 'top' ? 'top' : slugifyHeading(path[path.length - 1].title)}-${n}`;
    while (usedIds.has(id)) id += 'x';
    usedIds.add(id);
    return id;
  };
  const push = (block: Omit<DocBlock, 'id' | 'headingPath'>) => {
    blocks.push({ id: nextId(''), headingPath: path.map((p) => p.title), ...block });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = plainText(heading[2]);
      while (path.length && path[path.length - 1].level >= level) path.pop();
      path.push({ level, title });
      let id = slugifyHeading(path.map((p) => p.title).join(' '));
      while (usedIds.has(id)) id += '-x';
      usedIds.add(id);
      blocks.push({ id, type: 'heading', level, headingPath: path.map((p) => p.title), markdown: line.trim(), text: title });
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const start = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) i++;
      i = Math.min(i + 1, lines.length);
      const md = lines.slice(start, i).join('\n');
      push({ type: 'code', markdown: md, text: lines.slice(start + 1, i - 1).join(' ').replace(/\s+/g, ' ').trim() });
      continue;
    }

    if (RULE.test(line)) {
      push({ type: 'rule', markdown: '---', text: '' });
      i++;
      continue;
    }

    // Table: a header line followed by a separator line.
    if (isTableLine(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const header = `${line}\n${lines[i + 1]}`;
      i += 2;
      let first = true;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        push({ type: 'tableRow', markdown: `${header}\n${lines[i]}`, text: plainText(lines[i]), tableHeader: header, firstRow: first });
        first = false;
        i++;
      }
      if (first) push({ type: 'tableRow', markdown: header, text: plainText(line), tableHeader: header, firstRow: true });
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const start = i;
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) i++;
      const md = lines.slice(start, i).join('\n');
      push({ type: 'quote', markdown: md, text: plainText(md.replace(/^\s{0,3}>\s?/gm, '')) });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item && item[1].length === 0) {
      // A top-level list item plus its continuation and nested lines.
      const start = i;
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          // Blank line: continue only if the next line is indented (still inside the item).
          if (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1])) {
            i++;
            continue;
          }
          break;
        }
        const nested = LIST_ITEM.exec(l);
        if (nested && nested[1].length === 0) break;
        if (HEADING.test(l) || FENCE.test(l)) break;
        if (!/^\s/.test(l) && !nested) {
          // Lazy continuation line of the paragraph inside the item.
          i++;
          continue;
        }
        i++;
      }
      const md = lines.slice(start, i).join('\n');
      push({ type: 'listItem', markdown: md, text: plainText(md) });
      continue;
    }

    if (/^\s*</.test(line)) {
      const start = i;
      while (i < lines.length && lines[i].trim()) i++;
      push({ type: 'html', markdown: lines.slice(start, i).join('\n'), text: plainText(lines.slice(start, i).join(' ').replace(/<[^>]+>/g, ' ')) });
      continue;
    }

    // Paragraph: until a blank line or the start of another block.
    const start = i;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !FENCE.test(lines[i]) &&
      !/^\s{0,3}>/.test(lines[i]) &&
      !(LIST_ITEM.exec(lines[i])?.[1].length === 0) &&
      !(isTableLine(lines[i]) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]))
    )
      i++;
    const md = lines.slice(start, i).join('\n');
    push({ type: 'paragraph', markdown: md, text: plainText(md) });
  }
  return blocks;
}

export type AnchorMatch = { blockId: string; how: 'exact' | 'quote' | 'heading' } | { blockId: null; how: 'orphaned' };

const samePath = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => normalizeQuote(x) === normalizeQuote(b[i]));

/** Re-find where a comment belongs in the current version of the doc. */
export function locateAnchor(blocks: DocBlock[], anchor: DocAnchor, currentHash?: string): AnchorMatch {
  if (anchor.blockId && anchor.versionHash && currentHash && anchor.versionHash === currentHash) {
    if (blocks.some((b) => b.id === anchor.blockId)) return { blockId: anchor.blockId, how: 'exact' };
  }
  const quote = anchor.quote ? normalizeQuote(anchor.quote) : '';
  if (quote) {
    const hits = blocks.filter((b) => normalizeQuote(b.text).includes(quote));
    if (hits.length) {
      const inSection = hits.find((b) => samePath(b.headingPath, anchor.headingPath));
      const sameBlock = anchor.blockId ? hits.find((b) => b.id === anchor.blockId) : undefined;
      return { blockId: (sameBlock ?? inSection ?? hits[0]).id, how: 'quote' };
    }
  }
  if (!quote && anchor.blockId && blocks.some((b) => b.id === anchor.blockId && samePath(b.headingPath, anchor.headingPath))) {
    return { blockId: anchor.blockId, how: 'exact' };
  }
  if (anchor.headingPath.length) {
    const heading = blocks.find((b) => b.type === 'heading' && samePath(b.headingPath, anchor.headingPath));
    if (heading) return { blockId: heading.id, how: 'heading' };
    // The heading was renamed or moved: fall back to its last segment anywhere.
    const last = normalizeQuote(anchor.headingPath[anchor.headingPath.length - 1]);
    const loose = blocks.find((b) => b.type === 'heading' && normalizeQuote(b.text) === last);
    if (loose) return { blockId: loose.id, how: 'heading' };
  }
  return { blockId: null, how: 'orphaned' };
}
