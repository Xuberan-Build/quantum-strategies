import { describe, expect, it } from 'vitest';
import { decideFounderAlert, decideUserEmail, isoWeek, pacificDay } from '../schedule';
import { NOW, daysAgo, owned, snap } from './fixtures';

const TUESDAY = new Date('2026-11-03T18:00:00Z');
/** Days before TUESDAY, the "now" for these snapshots. */
const ago = (n: number) => new Date(TUESDAY.getTime() - n * 86_400_000).toISOString();
const active = (idle: number) => snap({ access: owned({ 'perception-rite-scan-1': ago(30) }), lastSessionAt: ago(idle) }, TUESDAY);

describe('decideUserEmail', () => {
  it('sends one re-entry email, ever, after a long quiet stretch', () => {
    const s = snap();
    expect(decideUserEmail(s, [], NOW)).toEqual({ kind: 'reentry', key: 'reentry' });
    expect(decideUserEmail(s, [{ key: 'reentry', at: daysAgo(40) }], NOW)?.kind).toBe('weekly');
  });

  it('nudges at 4 and 10 days, keyed to the quiet stretch', () => {
    const d4 = decideUserEmail(active(5), [], TUESDAY)!;
    expect(d4.kind).toBe('nudge4');
    expect(d4.key).toBe(`nudge4:${pacificDay(ago(5))}`);
    expect(decideUserEmail(active(5), [{ key: d4.key, at: daysAgo(1) }], TUESDAY)).toBeNull();
    expect(decideUserEmail(active(11), [], TUESDAY)?.kind).toBe('nudge10');
  });

  it('starts fresh nudges after new activity', () => {
    const old = { key: `nudge4:${pacificDay(ago(20))}`, at: ago(16) };
    expect(decideUserEmail(active(5), [old], TUESDAY)?.kind).toBe('nudge4');
  });

  it('nothing for someone active in the last few days, except on Monday', () => {
    expect(decideUserEmail(active(1), [], TUESDAY)).toBeNull();
    const monday = snap({ access: owned({ 'perception-rite-scan-1': daysAgo(30) }), lastSessionAt: daysAgo(1) });
    expect(decideUserEmail(monday, [], NOW)).toEqual({ kind: 'weekly', key: `weekly:${isoWeek(NOW)}` });
  });

  it('keeps a gap of 3 days between emails, ignoring founder alerts', () => {
    expect(decideUserEmail(active(5), [{ key: 'reentry', at: daysAgo(1) }], TUESDAY)).toBeNull();
    expect(decideUserEmail(active(5), [{ key: 'alert:2026-10-01', at: daysAgo(1) }], TUESDAY)?.kind).toBe('nudge4');
  });

  it('celebrates a freshly finished Rite, even inside the gap', () => {
    const p = Object.fromEntries(owned().slice(0, 5).map((r) => [r.product_slug, daysAgo(1)]));
    const s = snap({ access: owned(p) }, TUESDAY);
    expect(decideUserEmail(s, [{ key: 'reentry', at: daysAgo(1) }], TUESDAY)).toEqual({ kind: 'complete', key: 'complete:perception', rite: 'perception' });
  });

  it('does not celebrate a Rite finished long ago', () => {
    const p = Object.fromEntries(owned().slice(0, 5).map((r) => [r.product_slug, daysAgo(100)]));
    expect(decideUserEmail(snap({ access: owned(p) }), [], NOW)?.kind).toBe('reentry');
  });

  it('respects the progress opt-out and skips people with nothing left', () => {
    expect(decideUserEmail(snap({ prefs: { progress: false, newsletter: true } }), [], NOW)).toBeNull();
    const all = Object.fromEntries(owned().map((r) => [r.product_slug, daysAgo(60)]));
    expect(decideUserEmail(snap({ access: owned(all) }), [], NOW)).toBeNull();
  });
});

describe('decideFounderAlert', () => {
  it('alerts once per quiet stretch after 7 days, regardless of opt-out', () => {
    expect(decideFounderAlert(active(6), [])).toBeNull();
    const a = decideFounderAlert(active(8), [])!;
    expect(a.key).toBe(`alert:${pacificDay(ago(8))}`);
    expect(decideFounderAlert(active(8), [{ key: a.key, at: daysAgo(1) }])).toBeNull();
    expect(decideFounderAlert(snap({ prefs: { progress: false, newsletter: false } }), [])).not.toBeNull();
  });
});

describe('dates', () => {
  it('uses Pacific calendar days and ISO weeks', () => {
    expect(pacificDay('2026-11-02T06:00:00Z')).toBe('2026-11-01');
    expect(isoWeek(NOW)).toBe('2026-W45');
  });
});
