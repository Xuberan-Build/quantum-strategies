// STUB: replaced on merge. Real scorer: spec v3 §7 (scoring/content agent).
import type { PatternId, PatternScores, ReadAnswers } from './types';

export function scorePerceptionRead(answers: ReadAnswers): PatternScores {
  const scores: Record<PatternId, number> = { SHOULDS: 0, NOT_CAUGHT_UP: 0, ON_EMPTY: 0, NO_THREAD: 0, SMALLER: 0 };
  if (answers.q2?.choice?.includes('say:shoulds')) scores.SHOULDS += 3;
  if (answers.q2?.choice?.includes('say:stall')) scores.NOT_CAUGHT_UP += 2;
  const pattern = (Object.keys(scores) as PatternId[]).reduce<PatternId>(
    (a, b) => (scores[b] > scores[a] ? b : a),
    'SHOULDS'
  );
  return { scores, pattern, lowSignal: scores[pattern] === 0, reasons: ['stub'] };
}
