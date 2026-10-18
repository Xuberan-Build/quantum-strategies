import { describe, expect, it } from 'vitest';
import { MANIFESTATION_VARIANT, READ_QUESTIONS, READ_START_SCREEN, loudestTag, optionLabel, q11Outcome, q8Lines, visibleQuestions } from '../questions';

const q = (qs: ReturnType<typeof visibleQuestions>, id: string) => qs.find((x) => x.id === id)!;
const values = (qs: ReturnType<typeof visibleQuestions>, id: string) => (q(qs, id).options ?? []).map((o) => o.value);

describe('READ_QUESTIONS shape', () => {
  it('has twelve questions q1..q12 in order', () => {
    expect(READ_QUESTIONS.map((x) => x.id)).toEqual(Array.from({ length: 12 }, (_, i) => `q${i + 1}`));
    READ_QUESTIONS.forEach((x, i) => expect(x.order).toBe(i + 1));
  });

  it('uses tagged option values everywhere', () => {
    for (const x of READ_QUESTIONS) {
      for (const o of [...(x.options ?? []), ...(x.parts ?? []).flatMap((p) => p.options ?? [])]) {
        expect(o.value).toMatch(/^[a-z_]+:[a-z0-9_]+$/);
      }
    }
  });

  it('caps Q2 at three picks with a loudest part, and Q6 at two', () => {
    const q2 = READ_QUESTIONS[1];
    expect(q2.kind).toBe('multi_then_pick');
    expect(q2.maxPicks).toBe(3);
    expect(q2.parts?.find((p) => p.id === 'loudest')?.fromPicked).toBe(true);
    expect(READ_QUESTIONS[5].maxPicks).toBe(2);
  });

  it('gives Q7 the four week-mirror parts', () => {
    const q7 = READ_QUESTIONS[6];
    expect(q7.kind).toBe('week_mirror');
    expect(q7.parts?.map((p) => p.id)).toEqual(['thing', 'hours', 'instead', 'wantOrShould']);
    expect(q7.parts?.find((p) => p.id === 'instead')?.required).toBe(false);
    expect(q7.parts?.find((p) => p.id === 'wantOrShould')?.options?.map((o) => o.label)).toEqual(['Want', 'Supposed to', 'Not sure']);
  });

  it('puts the Q11 tried and out groups in one option list, and Q10 is a 1-10 scale', () => {
    const vals = READ_QUESTIONS[10].options!.map((o) => o.value);
    expect(vals.filter((v) => v.startsWith('tried:'))).toHaveLength(13);
    expect(vals.filter((v) => v.startsWith('out:'))).toEqual(['out:slipped', 'out:understood', 'out:worse', 'out:switched', 'out:helps']);
    expect(READ_QUESTIONS[10].parts).toBeUndefined();
    expect(READ_QUESTIONS[9].scale).toMatchObject({ min: 1, max: 10 });
  });

  it('frames the open questions on work, plans and this week (safety option 3), keeping the answer shapes', () => {
    const q8 = READ_QUESTIONS[7];
    const q9 = READ_QUESTIONS[8];
    expect(q8.question).toMatch(/work and your plans this month/);
    expect(q8.parts?.map((p) => p.id)).toEqual(['line1', 'line2', 'line3']);
    expect(q9.question).toMatch(/your work or your plans this week/);
    expect(q9.kind).toBe('text');
  });

  it('keeps banned words out of question copy', () => {
    const copy = JSON.stringify(READ_QUESTIONS) + JSON.stringify(READ_START_SCREEN);
    expect(copy).not.toMatch(/quantum|frequency|vibration|archetype|initiation/i);
    expect(copy).not.toContain('—');
  });
});

describe('visibleQuestions', () => {
  it('shows the underpricing option only to operators, side builders and multi-stream', () => {
    expect(values(visibleQuestions('operator'), 'q2')).toContain('say:undercharge');
    expect(values(visibleQuestions('side_builder'), 'q2')).toContain('say:undercharge');
    expect(values(visibleQuestions('multi_stream'), 'q2')).toContain('say:undercharge');
    expect(values(visibleQuestions('team_lead'), 'q2')).not.toContain('say:undercharge');
    expect(values(visibleQuestions('between_things'), 'q2')).not.toContain('say:undercharge');
    expect(values(visibleQuestions(), 'q2')).not.toContain('say:undercharge');
  });

  it('shows option m and the variant wordings only on manifestation traffic', () => {
    const def = visibleQuestions('operator');
    const man = visibleQuestions('operator', MANIFESTATION_VARIANT);
    expect(values(def, 'q2')).not.toContain('say:method');
    expect(values(man, 'q2')).toContain('say:method');
    const label = (qs: typeof def, v: string) => q(qs, 'q2').options!.find((o) => o.value === v)!.label;
    expect(label(def, 'say:stall')).toContain('start strong');
    expect(label(man, 'say:stall')).toContain('back at step 1');
    expect(label(man, 'say:empty')).toContain('empty cup');
    expect(label(man, 'say:not_enough')).toContain('affirming');
    // Same values either way, so scoring doesn't change.
    expect(values(man, 'q2').filter((v) => v !== 'say:method')).toEqual(values(def, 'q2'));
  });

  it('returns all twelve questions and strips variantLabels', () => {
    const qs = visibleQuestions('operator', MANIFESTATION_VARIANT);
    expect(qs).toHaveLength(12);
    expect(JSON.stringify(qs)).not.toContain('variantLabels');
  });
});

describe('answer readers', () => {
  it('reads the loudest pick, falling back to a single pick', () => {
    expect(loudestTag({ q2: { questionId: 'q2', choice: ['say:hide', 'say:many'], parts: { loudest: 'say:many' } } })).toBe('say:many');
    expect(loudestTag({ q2: { questionId: 'q2', choice: ['say:hide'] } })).toBe('say:hide');
    expect(loudestTag({ q2: { questionId: 'q2', choice: ['say:hide', 'say:many'] } })).toBeNull();
  });

  it('reads Q8 from parts or from newline text', () => {
    expect(q8Lines({ q8: { questionId: 'q8', text: 'a\n\nb\nc' } })).toEqual(['a', 'b', 'c']);
    expect(q8Lines({ q8: { questionId: 'q8', parts: { line1: 'x', line2: '', line3: 'z' } } })).toEqual(['x', 'z']);
  });

  it('reads the Q11 outcome from parts.out, parts.outcome or choice', () => {
    expect(q11Outcome({ q11: { questionId: 'q11', choice: ['tried:affirm'], parts: { out: 'out:worse' } } })).toBe('out:worse');
    expect(q11Outcome({ q11: { questionId: 'q11', choice: ['tried:affirm'], parts: { outcome: 'slipped' } } })).toBe('out:slipped');
    expect(q11Outcome({ q11: { questionId: 'q11', choice: ['tried:affirm', 'out:helps'] } })).toBe('out:helps');
  });

  it('reads the UI agent\'s Q7 and Q8 shapes', () => {
    expect(q8Lines({ q8: { questionId: 'q8', text: 'a\nb\nc', parts: { line1: 'a', line2: 'b', line3: 'c' } } })).toEqual(['a', 'b', 'c']);
  });

  it('finds labels in parts too', () => {
    expect(optionLabel('instead:others')).toBe("Other people's asks");
    expect(optionLabel('say:stall', MANIFESTATION_VARIANT)).toContain('step 1');
  });
});
