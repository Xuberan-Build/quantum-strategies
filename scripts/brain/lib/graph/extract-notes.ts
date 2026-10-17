/**
 * notes: every brain .md as a `note` node, with links_to edges from [[wikilinks]], relative markdown
 * links and cited brain paths (`gtm/foo.md`). Weight = 1 + inbound links.
 */
import path from 'node:path';
import { listBrainFiles, readBrain, type ExtractContext } from './context';
import { noteId } from './ids';
import { extractLinks, firstParagraph, h1, resolveLink, stripFrontmatter } from './md';
import type { ExtractResult, GraphEdge, GraphNode } from './types';

const EMBED_CHARS = 6000;

export function extractNotes(ctx: ExtractContext): ExtractResult {
  const files = listBrainFiles(ctx, '.md');
  const known = new Set(files);
  const byBase = new Map<string, string[]>();
  for (const f of files) {
    const b = path.posix.basename(f).toLowerCase();
    byBase.set(b, [...(byBase.get(b) ?? []), f]);
  }
  const nodes: GraphNode[] = [];
  const edges = new Map<string, GraphEdge>();
  const inbound = new Map<string, number>();
  let unresolved = 0;

  for (const rel of files) {
    const md = readBrain(ctx, rel) ?? '';
    const title = h1(md) ?? path.posix.basename(rel, '.md');
    const summary = firstParagraph(md);
    const body = stripFrontmatter(md);
    const id = noteId(rel);
    nodes.push({
      id,
      type: 'note',
      label: title,
      summary,
      source_path: rel,
      props: { folder: path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel), words: body.split(/\s+/).filter(Boolean).length },
      embedText: `${title}\n\n${body.slice(0, EMBED_CHARS)}`,
    });
    for (const ref of extractLinks(md)) {
      const target = resolveLink(ref, rel, known, byBase);
      if (!target) {
        unresolved++;
        continue;
      }
      if (target === rel) continue;
      const dst = noteId(target);
      const key = `${id}>${dst}`;
      const prev = edges.get(key);
      if (prev) {
        const kinds = new Set([...((prev.props?.kinds as string[]) ?? []), ref.kind]);
        prev.props = { ...prev.props, kinds: [...kinds].sort(), count: ((prev.props?.count as number) ?? 1) + 1 };
        prev.weight = Math.min(5, (prev.weight ?? 1) + 0.5);
      } else {
        edges.set(key, { src: id, dst, type: 'links_to', weight: 1, props: { kinds: [ref.kind], count: 1 } });
        inbound.set(dst, (inbound.get(dst) ?? 0) + 1);
      }
    }
  }
  for (const n of nodes) n.weight = 1 + (inbound.get(n.id) ?? 0);
  return { nodes, edges: [...edges.values()], warnings: unresolved ? [`${unresolved} note links did not resolve to a brain .md file`] : [] };
}
