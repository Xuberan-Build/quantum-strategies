/**
 * Client for the Perception Read API (src/lib/read/CONTRACT.md).
 *
 * The UI only talks to the API through the `ReadApi` interface, so tests (and any
 * local stub) can swap the implementation through `ReadApiProvider`. The default
 * export below is the real fetch client and is the only one used in production.
 */
import type {
  ReadAnswer,
  ReadEvent,
  ReadLeadInput,
  ReadPreview,
  ReadQuestion,
  ReadResult,
  ReadUtm,
  SafetyResult,
  Segment,
} from '@/lib/read/types';

export interface ReadEventInput {
  sessionId?: string;
  event: ReadEvent;
  step?: number;
  props?: Record<string, unknown>;
}

export interface ReadFeedbackInput {
  sessionId: string;
  accuracy?: number;
  hardestPart?: string;
  moveCommitted?: boolean;
}

export interface ReadApi {
  start(input: { utm?: ReadUtm; variant?: string }): Promise<{ sessionId: string }>;
  getQuestions(input: { segment?: Segment; variant?: string }): Promise<ReadQuestion[]>;
  saveAnswer(sessionId: string, answer: ReadAnswer): Promise<{ ok: true; safety?: SafetyResult }>;
  complete(sessionId: string): Promise<ReadPreview>;
  unlock(sessionId: string, lead: ReadLeadInput): Promise<ReadResult>;
  getResult(sessionId: string, token?: string): Promise<ReadResult>;
  /** Fire and forget. Never throws. */
  event(input: ReadEventInput): Promise<void>;
  feedback(input: ReadFeedbackInput): Promise<void>;
}

export class ReadApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReadApiError';
    this.status = status;
  }
}

type FetchLike = typeof fetch;

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      // body was empty or not JSON
    }
    throw new ReadApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function createReadApi(fetchImpl: FetchLike = (...args) => fetch(...args), base = '/api/read'): ReadApi {
  const post = <T>(path: string, body: unknown, init: RequestInit = {}) =>
    fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
      ...init,
    }).then((res) => parse<T>(res));

  return {
    start: (input) => post('/start', input),

    async getQuestions({ segment, variant }) {
      const params = new URLSearchParams();
      if (segment) params.set('segment', segment);
      if (variant) params.set('variant', variant);
      const qs = params.toString();
      const res = await fetchImpl(`${base}/questions${qs ? `?${qs}` : ''}`, { credentials: 'same-origin' });
      const body = await parse<{ questions: ReadQuestion[] }>(res);
      return body.questions;
    },

    saveAnswer: (sessionId, answer) => post('/answer', { sessionId, answer }),

    complete: (sessionId) => post('/complete', { sessionId }),

    unlock: (sessionId, lead) => post('/unlock', { sessionId, lead }),

    async getResult(sessionId, token) {
      const qs = token ? `?t=${encodeURIComponent(token)}` : '';
      const res = await fetchImpl(`${base}/result/${encodeURIComponent(sessionId)}${qs}`, {
        credentials: 'same-origin',
      });
      return parse<ReadResult>(res);
    },

    async event(input) {
      try {
        // keepalive so an event fired on a link click survives the navigation
        await post('/event', input, { keepalive: true });
      } catch {
        // events must never break the flow
      }
    },

    feedback: (input) => post('/feedback', input),
  };
}

export const readApi: ReadApi = createReadApi();
