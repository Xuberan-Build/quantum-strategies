/**
 * Test fixtures for the Read UI: a cut-down question set in the shape of
 * spec v3 §5, and a mock ReadApi. Test-only; nothing in src imports this.
 */
import { vi } from 'vitest';
import type { ReadApi } from '../api';
import type { Segment } from '@/lib/read/types';
import { PREVIEW, RESULT_FIXTURE, questionsFor } from './fixtureData';

export * from './fixtureData';

export function createMockApi(overrides: Partial<ReadApi> = {}): { [K in keyof ReadApi]: ReturnType<typeof vi.fn> } & ReadApi {
  const api = {
    start: vi.fn(async () => ({ sessionId: 'sess-1' })),
    getQuestions: vi.fn(async ({ segment }: { segment?: Segment }) => questionsFor(segment)),
    saveAnswer: vi.fn(async () => ({ ok: true as const })),
    complete: vi.fn(async () => PREVIEW),
    unlock: vi.fn(async () => RESULT_FIXTURE),
    getResult: vi.fn(async () => RESULT_FIXTURE),
    event: vi.fn(async () => undefined),
    feedback: vi.fn(async () => undefined),
    ...overrides,
  };
  return api as never;
}
