import type { ReadResult } from '../types';

export const SESSION_ID = '11111111-1111-4111-8111-111111111111';
export const LEAD_ID = '22222222-2222-4222-8222-222222222222';
export const APP = 'https://app.example.test';

export function shouldsResult(overrides: Partial<ReadResult> = {}): ReadResult {
  return {
    sessionId: SESSION_ID,
    pattern: 'SHOULDS',
    patternName: 'Running on shoulds',
    usedFallback: false,
    offer: { productSlug: 'perception-rite-bundle', priceUsd: 12, scanSlug: 'perception-rite-scan-2', scanName: 'Value Pattern Decoder' },
    blocks: [
      {
        id: 'mirror',
        title: 'Your week',
        body: 'You keep meaning to get to "writing again".\nLast week it got 0 hours. Things you thought you should do got most of the rest.\nYou called it something you think you\'re supposed to want.',
      },
      { id: 'pattern', body: '**Your pattern: Running on shoulds.** Most of your week goes to what you think you should do.' },
      {
        id: 'move',
        title: 'One move this week',
        body: 'Take "writing again". On paper, finish this line: "I should do this because…". If the reason is someone else\'s opinion, drop it on purpose for 7 days. If the reason is yours, put one hour for it in your calendar now.',
        meta: { watch: 'Which feels lighter by Sunday: the thing you dropped or the hour you kept.' },
      },
      { id: 'offer', body: 'Your Read found plans that may not be yours.' },
    ],
    ...overrides,
  };
}
