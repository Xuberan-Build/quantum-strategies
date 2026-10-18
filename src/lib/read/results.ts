// STUB: replaced on merge. Real pattern content + result builder: spec v3 §8 (scoring/content agent).
import type { PatternId, PatternScores, ReadAnswers, ReadResult, ReadUtm, SafetyResult, WeekMirror } from './types';

export interface PatternContent {
  name: string;
  read: string;
  scanSlug: string;
  scanName: string;
  [key: string]: unknown;
}

const stub = (name: string): PatternContent => ({
  name,
  read: `${name} (stub read)`,
  scanSlug: 'perception-rite-scan-1',
  scanName: 'Scan',
});

export const PATTERNS: Record<PatternId, PatternContent> = {
  SHOULDS: stub('Running on shoulds'),
  NOT_CAUGHT_UP: stub('Not caught up'),
  ON_EMPTY: stub('Yes to everyone but you'),
  NO_THREAD: stub('No thread'),
  SMALLER: stub('Smaller'),
};

export async function buildResult(input: {
  sessionId: string;
  answers: ReadAnswers;
  scores: PatternScores;
  mirror: WeekMirror;
  safety: SafetyResult;
  utm?: ReadUtm;
}): Promise<ReadResult> {
  const crisis = input.safety.tier === 'crisis';
  const p = PATTERNS[input.scores.pattern];
  return {
    sessionId: input.sessionId,
    pattern: crisis ? null : input.scores.pattern,
    patternName: crisis ? null : p.name,
    blocks: [{ id: 'mirror', body: input.mirror.line }],
    offer: crisis
      ? null
      : { productSlug: 'perception-rite-bundle', priceUsd: 12, scanSlug: p.scanSlug, scanName: p.scanName },
    usedFallback: false,
  };
}
