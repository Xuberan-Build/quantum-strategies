import { describe, expect, it } from 'vitest';
import { latestSessionUpdate, withSessionCompletions } from '../progress';
import { daysAgo, owned, snap } from './fixtures';

describe('buildSnapshot', () => {
  it('starts at Rite I Perception, scan 1, for someone who has not started', () => {
    const s = snap();
    expect(s.started).toBe(false);
    expect(s.next).toMatchObject({ rite: 'perception', slug: 'perception-rite-scan-1' });
    expect(s.daysIdle).toBe(200); // idle since they joined
  });

  it('follows canon order: Perception, then Orientation, then Declaration', () => {
    const p = Object.fromEntries(owned().slice(0, 5).map((r) => [r.product_slug, daysAgo(30)]));
    expect(snap({ access: owned(p) }).next?.rite).toBe('orientation');
  });

  it('measures idle time from the latest session or completion', () => {
    const s = snap({ access: owned({ 'perception-rite-scan-1': daysAgo(9) }), lastSessionAt: daysAgo(5) });
    expect(s.daysIdle).toBe(5);
    expect(s.started).toBe(true);
  });

  it('marks a Rite complete with its latest completion date', () => {
    const p = { 'perception-rite-scan-1': daysAgo(9), 'perception-rite-scan-2': daysAgo(8), 'perception-rite-scan-3': daysAgo(7), 'perception-rite-scan-4': daysAgo(3), 'perception-rite-scan-5': daysAgo(2) };
    const r = snap({ access: owned(p) }).rites[0];
    expect(r).toMatchObject({ key: 'perception', done: 5, complete: true, completedAt: daysAgo(2) });
  });

  it('only counts products the user owns and skips people with no Rite products', () => {
    expect(snap({ access: [] }).eligible).toBe(false);
    const s = snap({ access: [{ product_slug: 'personal-alignment', completed_at: null }] });
    expect(s.eligible).toBe(true);
    expect(s.next?.slug).toBe('personal-alignment');
    expect(s.rites[0].owned).toBe(0);
  });
});

describe('withSessionCompletions', () => {
  it('fills a missing access completion from a completed session, keeping access when set', () => {
    const access = [
      { product_slug: 'perception-rite-scan-1', completed_at: null },
      { product_slug: 'perception-rite-scan-2', completed_at: daysAgo(3) },
      { product_slug: 'perception-rite-scan-3', completed_at: null },
    ];
    const sessions = [
      { product_slug: 'perception-rite-scan-1', updated_at: daysAgo(9), completed_at: daysAgo(9) },
      { product_slug: 'perception-rite-scan-2', updated_at: daysAgo(4), completed_at: daysAgo(4) },
      { product_slug: 'perception-rite-scan-3', updated_at: daysAgo(1), completed_at: null },
    ];
    expect(withSessionCompletions(access, sessions).map((r) => r.completed_at)).toEqual([daysAgo(9), daysAgo(3), null]);
    expect(latestSessionUpdate(sessions)).toBe(daysAgo(1));
  });
});
