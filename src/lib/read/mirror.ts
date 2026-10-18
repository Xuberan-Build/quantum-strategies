// STUB: replaced on merge. Real week mirror: spec v3 §3.2 (scoring/content agent).
import type { ReadAnswers, WeekMirror } from './types';

export function buildWeekMirror(answers: ReadAnswers): WeekMirror {
  const p = answers.q7?.parts ?? {};
  const thing = typeof p.thing === 'string' ? p.thing : null;
  return {
    thing,
    hours: null,
    instead: null,
    wantOrShould: null,
    showsGap: true,
    line: thing ? `You keep meaning to get to "${thing}".` : '',
  };
}
