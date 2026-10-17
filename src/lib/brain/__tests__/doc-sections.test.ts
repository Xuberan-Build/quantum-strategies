import { describe, expect, it } from 'vitest';
import { locateAnchor, splitDoc } from '../doc-sections';

/* Synthetic doc. No real brain content. */
const DOC = `---
title: ignored
---
# Field Guide

Intro paragraph with **bold** text
that wraps onto two lines.

## Setup

- First item
  continues here
- Second item
  - nested child

1. Ordered one
2. Ordered two

| Name | Value |
| --- | --- |
| alpha | 1 |
| beta | 2 |

> A quoted line

\`\`\`ts
const x = 1;
\`\`\`

---

## Usage

Final paragraph.
`;

describe('splitDoc', () => {
  const blocks = splitDoc(DOC);

  it('splits into typed blocks with heading paths', () => {
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'listItem',
      'listItem',
      'listItem',
      'listItem',
      'tableRow',
      'tableRow',
      'quote',
      'code',
      'rule',
      'heading',
      'paragraph',
    ]);
    const second = blocks[4];
    expect(second.headingPath).toEqual(['Field Guide', 'Setup']);
    expect(second.markdown).toContain('nested child');
    expect(blocks[3].text).toBe('First item continues here');
    expect(blocks[1].text).toBe('Intro paragraph with bold text that wraps onto two lines.');
  });

  it('keeps the table header on every row and flags the first', () => {
    const rows = blocks.filter((b) => b.type === 'tableRow');
    expect(rows[0].firstRow).toBe(true);
    expect(rows[1].firstRow).toBe(false);
    expect(rows[1].markdown.split('\n')).toHaveLength(3);
    expect(rows[1].text).toBe('beta 2');
  });

  it('gives unique, stable ids', () => {
    const ids = blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(splitDoc(DOC).map((b) => b.id)).toEqual(ids);
    expect(blocks[2].id).toBe('field-guide-setup');
  });
});

describe('locateAnchor', () => {
  const v1 = splitDoc(DOC);
  const target = v1.find((b) => b.text.startsWith('Second item'))!;

  it('finds the exact block on the same version', () => {
    expect(locateAnchor(v1, { headingPath: target.headingPath, blockId: target.id, versionHash: 'h1', quote: 'Second item' }, 'h1')).toEqual({
      blockId: target.id,
      how: 'exact',
    });
  });

  it('re-finds a quote after the doc changes', () => {
    const v2 = splitDoc(DOC.replace('Intro paragraph', 'New lead paragraph.\n\nIntro paragraph').replace('## Setup', '## Setup steps'));
    const match = locateAnchor(v2, { headingPath: ['Field Guide', 'Setup'], blockId: target.id, versionHash: 'h1', quote: 'second  ITEM' }, 'h2');
    expect(match.how).toBe('quote');
    expect(v2.find((b) => b.id === match.blockId)?.text).toContain('Second item');
  });

  it('falls back to the heading, then orphaned', () => {
    const v3 = splitDoc('# Field Guide\n\n## Setup\n\nAll rewritten.\n');
    expect(locateAnchor(v3, { headingPath: ['Field Guide', 'Setup'], quote: 'Second item', versionHash: 'h1' }, 'h3')).toMatchObject({ how: 'heading' });
    expect(locateAnchor(splitDoc('# Other\n\nText.'), { headingPath: ['Field Guide', 'Setup'], quote: 'Second item' }, 'h4')).toEqual({
      blockId: null,
      how: 'orphaned',
    });
  });
});
