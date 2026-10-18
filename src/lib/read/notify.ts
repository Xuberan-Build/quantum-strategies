/**
 * Thin adapter between the Read API routes and the email layer (src/lib/read/emails.ts,
 * owned by the email/checkout agent). The routes only import from here.
 *
 * MERGE: once src/lib/read/emails.ts exists, replace the two no-op bodies below with:
 *   export { sendReadResultEmail, scheduleReadFollowups } from './emails';
 * The argument shapes here are the contract the email agent's functions must accept.
 */
import type { PatternId, ReadResult } from './types';
import type { ReadLeadRecord } from './store';

export interface SendReadResultEmailInput {
  lead: ReadLeadRecord;
  result: ReadResult;
  /** Absolute URL with the signed ?t= token, valid without the cookie. */
  resultUrl: string;
}

export interface ScheduleReadFollowupsInput {
  leadId: string;
  sessionId: string;
  pattern: PatternId | null;
}

export async function sendReadResultEmail(_input: SendReadResultEmailInput): Promise<void> {
  // No-op until emails.ts is merged.
}

export async function scheduleReadFollowups(_input: ScheduleReadFollowupsInput): Promise<void> {
  // No-op until emails.ts is merged.
}
