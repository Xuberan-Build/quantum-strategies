import { describe, expect, it } from 'vitest';
import { splitAfterSection } from '../split-sections';

const body = [
  '# Title',
  '',
  'Intro paragraph.',
  '',
  '## One',
  'First section.',
  '',
  '## Two',
  'Second section.',
  '',
  '## Three',
  'Third section.',
].join('\n');

describe('splitAfterSection', () => {
  it('splits before the third section, ignoring a title at the top', () => {
    const split = splitAfterSection(body, 2)!;
    expect(split.before).toContain('## Two');
    expect(split.before).not.toContain('## Three');
    expect(split.after.startsWith('## Three')).toBe(true);
  });

  it('returns null when there are too few sections', () => {
    expect(splitAfterSection('# Title\n\nText\n\n## One\nx\n\n## Two\ny', 2)).toBeNull();
    expect(splitAfterSection('', 2)).toBeNull();
  });

  it('ignores headings inside code fences', () => {
    const src = ['Intro', '## One', '```md', '## not a heading', '## nor this', '```', '## Two', 'x'].join('\n');
    expect(splitAfterSection(src, 2)).toBeNull();
  });

  it('refuses to split bodies with reference links or footnotes', () => {
    expect(splitAfterSection(`${body}\n\n[ref]: https://example.com`, 2)).toBeNull();
    expect(splitAfterSection(`${body}\n\n[^1]: A footnote.`, 2)).toBeNull();
  });

  it('refuses to split when a fence is left open', () => {
    expect(splitAfterSection(`Intro\n## One\nx\n## Two\n\`\`\`\n## Three\n`, 2)).toBeNull();
  });
});
