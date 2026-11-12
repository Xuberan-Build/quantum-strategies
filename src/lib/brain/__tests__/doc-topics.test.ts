import { describe, expect, it } from 'vitest';
import { docRun, docTopic } from '../doc-topics';

describe('docTopic', () => {
  it('puts run folders under Scripts & runs before the general content rule', () => {
    expect(docTopic('content/pipeline/runs/2026-11-11-caliber/scripts.md').id).toBe('scripts');
  });
  it('maps narrative, production and other content separately', () => {
    expect(docTopic('content/narrative/narrative.md').id).toBe('narrative');
    expect(docTopic('content/production/broll-strategy.md').id).toBe('production');
    expect(docTopic('content/briefing-standard.md').id).toBe('content');
  });
  it('maps top-level folders', () => {
    expect(docTopic('gtm/free-quiz-spec.md').label).toBe('Go-to-market');
    expect(docTopic('research/books/x.md').id).toBe('research');
  });
  it('falls back to a capitalised first folder', () => {
    expect(docTopic('market-notes/a.md')).toEqual({ id: 'market-notes', label: 'Market notes' });
    expect(docTopic('readme.md').id).toBe('other');
  });
});

describe('docRun', () => {
  it('extracts the run name', () => {
    expect(docRun('content/pipeline/runs/2026-11-11-caliber/scripts.md')).toBe('2026-11-11-caliber');
    expect(docRun('content/content-system.md')).toBeNull();
  });
});
