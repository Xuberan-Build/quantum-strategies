import { describe, expect, it } from 'vitest';
import { buildWeekMirror, weekMirrorLines } from '../mirror';
import type { ReadAnswers } from '../types';

const q7 = (parts: Record<string, string | number | null>): ReadAnswers => ({ q7: { questionId: 'q7', parts } });

describe('buildWeekMirror', () => {
  it('shows the gap in their words for 0-5 hours (spec §8.1 example)', () => {
    const m = buildWeekMirror(q7({ thing: 'the online course I started in spring', hours: 'hours:1_2', instead: 'instead:others', wantOrShould: 'own:want' }));
    expect(m.showsGap).toBe(true);
    expect(m.hours).toBe(1);
    expect(m.thing).toBe('the online course I started in spring');
    expect(weekMirrorLines(m)).toEqual([
      'You keep meaning to get to "the online course I started in spring".',
      "Last week it got 1–2 hours. Other people's asks got most of the rest.",
      'You called it something you want.',
    ]);
  });

  it('matches the SHOULDS example', () => {
    const m = buildWeekMirror(q7({ thing: 'writing again', hours: 'hours:0', instead: 'instead:shoulds', wantOrShould: 'own:should' }));
    expect(m.line).toBe(
      'You keep meaning to get to "writing again".\nLast week it got 0 hours. Things you thought you should do got most of the rest.\nYou called it something you think you\'re supposed to want.',
    );
  });

  it.each(['hours:6_10', 'hours:10_plus'])('never invents a gap at %s', (hours) => {
    const m = buildWeekMirror(q7({ thing: 'my shop', hours, instead: 'instead:others', wantOrShould: 'own:should' }));
    expect(m.showsGap).toBe(false);
    expect(m.hours).toBeGreaterThanOrEqual(6);
    expect(m.line).toContain("That's real time.");
    expect(m.line).not.toContain('got most of the rest');
  });

  it('stops after the hours when "instead" is skipped or unsure', () => {
    expect(weekMirrorLines(buildWeekMirror(q7({ thing: 'x', hours: 'hours:3_5', wantOrShould: 'own:unsure' })))[1]).toBe('Last week it got 3–5 hours.');
    expect(weekMirrorLines(buildWeekMirror(q7({ thing: 'x', hours: 'hours:0', instead: 'instead:unsure' })))[1]).toBe('Last week it got 0 hours.');
  });

  it("doesn't quote a Q7 thing that trips tier 2", () => {
    const m = buildWeekMirror(q7({ thing: 'getting my ADHD meds sorted', hours: 'hours:0', wantOrShould: 'own:want' }));
    expect(m.thing).toBeNull();
    expect(m.line).toContain('the thing you named');
    expect(m.line).not.toMatch(/adhd/i);
  });

  it('accepts a number of hours and a bare want-or-should', () => {
    const m = buildWeekMirror({ q7: { questionId: 'q7', number: 8, parts: { thing: 'x', wantOrShould: 'should' } } });
    expect(m.hours).toBe(6);
    expect(m.showsGap).toBe(false);
    expect(m.wantOrShould).toBe('should');
  });

  it('handles missing answers without inventing anything', () => {
    const m = buildWeekMirror({});
    expect(m.showsGap).toBe(false);
    expect(m.hours).toBeNull();
    expect(m.line).toBe("You didn't name the thing you keep meaning to get to.");
  });

  it('never says values, aligned or misaligned', () => {
    for (const own of ['own:want', 'own:should', 'own:unsure']) {
      for (const hours of ['hours:0', 'hours:1_2', 'hours:3_5', 'hours:6_10', 'hours:10_plus']) {
        const m = buildWeekMirror(q7({ thing: 'x', hours, instead: 'instead:work', wantOrShould: own }));
        expect(m.line).not.toMatch(/values|aligned|misaligned|—/i);
      }
    }
  });
});
