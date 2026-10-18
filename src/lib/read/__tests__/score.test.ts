import { describe, expect, it } from 'vitest';
import { READ_SCORING_CONFIG, decidingRule, fallbackPattern, scorePerceptionRead, secondaryPattern } from '../score';
import type { ReadAnswers } from '../types';
import { NOT_CAUGHT_UP_ANSWERS, NO_THREAD_ANSWERS, ON_EMPTY_ANSWERS, SHOULDS_ANSWERS, SMALLER_ANSWERS } from './fixtures';

describe('scorePerceptionRead: one crafted set per pattern', () => {
  it.each([
    ['SHOULDS', SHOULDS_ANSWERS],
    ['NOT_CAUGHT_UP', NOT_CAUGHT_UP_ANSWERS],
    ['ON_EMPTY', ON_EMPTY_ANSWERS],
    ['NO_THREAD', NO_THREAD_ANSWERS],
    ['SMALLER', SMALLER_ANSWERS],
  ] as const)('%s', (expected, answers) => {
    const r = scorePerceptionRead(answers);
    expect(r.pattern).toBe(expected);
    expect(r.lowSignal).toBe(false);
    expect(decidingRule(r)).toBe('top_score');
    expect(r.reasons.length).toBeGreaterThan(2);
  });

  it('adds up the SHOULDS points as the table says', () => {
    const r = scorePerceptionRead(SHOULDS_ANSWERS);
    // q2 shoulds 2 + know_dont 2 + loudest 2 · q4 should 3 · q7 own:should 2 + hours:0 with should 2 + instead:shoulds 1
    expect(r.scores.SHOULDS).toBe(14);
    expect(r.scores.NOT_CAUGHT_UP).toBe(1);
  });

  it('adds the gap check, the self-verdict word once and the hedge once', () => {
    const ncu = scorePerceptionRead(NOT_CAUGHT_UP_ANSWERS);
    // q2 2+2+2 · q3 avoid 1 · q4 verdict 3 · q5 deflect 1 · gap 2 · self-verdict 2 (once, though "always" and "not good enough" both hit)
    expect(ncu.scores.NOT_CAUGHT_UP).toBe(15);
    expect(ncu.reasons.some((x) => x.startsWith('gap check'))).toBe(true);
    const sm = scorePerceptionRead(SMALLER_ANSWERS);
    // q2 2+2+2 · q4 seen 3 · q5 just 2 · hedge "just" 2
    expect(sm.scores.SMALLER).toBe(13);
    // The named skill appears in Q8, so no gap point.
    expect(sm.reasons.some((x) => x.startsWith('gap check'))).toBe(false);
  });

  it('never scores Q11 or Q12', () => {
    const base = scorePerceptionRead(SHOULDS_ANSWERS).scores;
    const changed = scorePerceptionRead({
      ...SHOULDS_ANSWERS,
      q11: { questionId: 'q11', choice: ['tried:therapy', 'tried:chart'], parts: { outcome: 'out:worse' } },
      q12: { questionId: 'q12', choice: ['spent:2000_plus'] },
    }).scores;
    expect(changed).toEqual(base);
  });

  it('ignores chart data even if a client sends it', () => {
    const withChart = { ...SHOULDS_ANSWERS, chart: { questionId: 'chart', parts: { type: 'Projector', profile: '4/6' } } } as ReadAnswers;
    expect(scorePerceptionRead(withChart).scores).toEqual(scorePerceptionRead(SHOULDS_ANSWERS).scores);
  });
});

describe('ties', () => {
  it('go to the loudest pick when its pattern is tied, even if it sits later in the order', () => {
    const answers: ReadAnswers = {
      q1: { questionId: 'q1', choice: ['seg:multi'] },
      q2: { questionId: 'q2', choice: ['say:many', 'say:no_guilt'], parts: { loudest: 'say:many' } },
      q3: { questionId: 'q3', choice: ['fav:yes_late'] },
      q10: { questionId: 'q10', number: 2 },
    };
    const r = scorePerceptionRead(answers);
    expect(r.scores.NO_THREAD).toBe(5);
    expect(r.scores.ON_EMPTY).toBe(5);
    expect(r.pattern).toBe('NO_THREAD');
    expect(decidingRule(r)).toBe('tie_loudest');
  });

  it('use the order SHOULDS first when the loudest pick is split', () => {
    const answers: ReadAnswers = {
      q2: { questionId: 'q2', choice: ['say:behind'], parts: { loudest: 'say:behind' } },
      q4: { questionId: 'q4', choice: ['stall:should'] },
      q5: { questionId: 'q5', choice: ['desc:deflect'] },
      q6: { questionId: 'q6', choice: ['come:fix'] },
      q8: { questionId: 'q8', parts: { line1: 'loves cooking' } },
    };
    const r = scorePerceptionRead(answers);
    expect(r.scores.SHOULDS).toBe(5);
    expect(r.scores.NOT_CAUGHT_UP).toBe(5);
    expect(r.pattern).toBe('SHOULDS');
    expect(decidingRule(r)).toBe('tie_order');
    expect(secondaryPattern(r)).toBe('NOT_CAUGHT_UP');
  });

  it('use the order when the loudest pick is "something else"', () => {
    const answers: ReadAnswers = {
      q2: { questionId: 'q2', choice: ['say:other', 'say:hide'], parts: { loudest: 'say:other' }, text: 'I keep comparing myself' },
      q3: { questionId: 'q3', choice: ['fav:yes_late'] },
      q4: { questionId: 'q4', choice: ['stall:others'] },
      q5: { questionId: 'q5', choice: ['desc:just'] },
      q9: { questionId: 'q9', text: 'hopefully next month' },
    };
    const r = scorePerceptionRead(answers);
    expect(r.scores.ON_EMPTY).toBe(5);
    expect(r.scores.SMALLER).toBe(6);
    expect(r.pattern).toBe('SMALLER');
    // deflect instead of just: SMALLER 2 + 1 + hedge 2 = 5, tied with ON_EMPTY 5.
    const tie = scorePerceptionRead({ ...answers, q5: { questionId: 'q5', choice: ['desc:deflect'] } });
    expect(tie.scores.SMALLER).toBe(5);
    expect(tie.pattern).toBe('ON_EMPTY');
    expect(decidingRule(tie)).toBe('tie_order');
  });
});

describe('low signal and the spread guard', () => {
  const thin: ReadAnswers = { q2: { questionId: 'q2', choice: ['say:hide'], parts: { loudest: 'say:hide' } } };

  it('falls back to SHOULDS below 5', () => {
    const r = scorePerceptionRead(thin);
    expect(r.scores.SMALLER).toBe(4);
    expect(r.pattern).toBe('SHOULDS');
    expect(r.lowSignal).toBe(true);
    expect(decidingRule(r)).toBe('low_signal');
  });

  it('handles empty answers', () => {
    const r = scorePerceptionRead({});
    expect(r.pattern).toBe('SHOULDS');
    expect(r.lowSignal).toBe(true);
  });

  it('takes a population fallback from fallbackPattern', () => {
    expect(READ_SCORING_CONFIG.shouldsShareGuard).toBe(0.4);
    expect(fallbackPattern(0.4)).toBe('SHOULDS');
    expect(fallbackPattern(0.41)).toBe('NOT_CAUGHT_UP');
    expect(scorePerceptionRead(thin, { fallback: fallbackPattern(0.55) }).pattern).toBe('NOT_CAUGHT_UP');
  });
});

describe('Q7 hours-gap rule', () => {
  const q7 = (hours: string, own?: string): ReadAnswers => ({
    q7: { questionId: 'q7', parts: { thing: 'x', hours, ...(own ? { wantOrShould: own } : {}) } },
  });

  it('gives +2 for low hours only with should or unsure, +1 with want', () => {
    expect(scorePerceptionRead(q7('hours:0', 'own:should')).scores.SHOULDS).toBe(4); // own 2 + hours 2
    expect(scorePerceptionRead(q7('hours:1_2', 'own:unsure')).scores.SHOULDS).toBe(3); // own 1 + hours 2
    expect(scorePerceptionRead(q7('hours:0', 'own:want')).scores.SHOULDS).toBe(1); // hours 1
    expect(scorePerceptionRead(q7('hours:0')).scores.SHOULDS).toBe(0);
  });

  it('gives nothing for 3+ hours', () => {
    expect(scorePerceptionRead(q7('hours:3_5', 'own:should')).scores.SHOULDS).toBe(2);
    expect(scorePerceptionRead(q7('hours:10_plus', 'own:want')).scores.SHOULDS).toBe(0);
  });

  it('accepts a number of hours and a bare want-or-should', () => {
    const r = scorePerceptionRead({ q7: { questionId: 'q7', parts: { hours: 0, wantOrShould: 'should' } } });
    expect(r.scores.SHOULDS).toBe(4);
  });
});

describe('safety and scoring', () => {
  it('never uses tier-2 text as an input', () => {
    const clean: ReadAnswers = { q9: { questionId: 'q9', text: 'I just never finish' } };
    const clinical: ReadAnswers = { q9: { questionId: 'q9', text: 'I just never finish because of my depression' } };
    expect(scorePerceptionRead(clean).scores.SMALLER).toBe(2);
    expect(scorePerceptionRead(clean).scores.NOT_CAUGHT_UP).toBe(2);
    const r = scorePerceptionRead(clinical);
    expect(r.scores.SMALLER).toBe(0);
    expect(r.scores.NOT_CAUGHT_UP).toBe(0);
    expect(r.reasons).toContain('text excluded by safety screen');
  });
});
