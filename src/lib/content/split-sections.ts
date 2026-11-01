/**
 * Split a Markdown/MDX article body after its Nth section, so something (the Perception
 * Read card on small screens) can sit between the halves.
 *
 * A section starts at a level-1 or level-2 heading ("# " or "## "; body "#" renders as
 * <h2>, see proseComponents). A title heading at the very top, before any text, doesn't
 * count. Headings inside fenced code don't count.
 *
 * Returns null whenever splitting could change how the body renders:
 *   - fewer than N+1 sections (nothing to put the card between)
 *   - reference-style link definitions ("[id]: https://...") or footnotes, which only
 *     resolve when the whole document is compiled together
 *   - an unclosed code fence
 */
export interface SplitBody {
  before: string;
  after: string;
}

const HEADING = /^ {0,3}#{1,2}\s+\S/;
const FENCE = /^ {0,3}(```|~~~)/;
const REFERENCE_DEF = /^ {0,3}\[[^\]]+\]:\s*\S/m;

export function splitAfterSection(source: string, sections = 2): SplitBody | null {
  if (!source || sections < 1) return null;
  if (REFERENCE_DEF.test(source)) return null;

  const lines = source.split('\n');
  const starts: number[] = [];
  let inFence: string | null = null;
  let seenText = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(FENCE);
    if (fence) {
      if (inFence === null) inFence = fence[1];
      else if (fence[1] === inFence) inFence = null;
      seenText = true;
      continue;
    }
    if (inFence !== null) continue;

    if (HEADING.test(line)) {
      if (seenText) starts.push(i);
      continue;
    }
    if (line.trim()) seenText = true;
  }

  if (inFence !== null) return null;
  if (starts.length < sections + 1) return null;

  const cut = starts[sections];
  const before = lines.slice(0, cut).join('\n').trimEnd();
  const after = lines.slice(cut).join('\n');
  if (!before.trim() || !after.trim()) return null;
  return { before, after };
}
