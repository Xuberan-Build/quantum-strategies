/**
 * The Perception Read: day-7 one-click answers and the PMF follow-ups. Server-only.
 *
 * Every answer is an append-only event; analysis takes the latest per lead and question.
 *   move   → move_done_day7   { answer: yes | started_stopped | no }        (H9)
 *   rerate → day7_rerating    { rating: 1..10, baseline }                   (Q10 re-rating)
 *   pmf    → day7_pmf         { answer: very | somewhat | not | have_it }   (H5)
 * "very" and "somewhat" unlock the Superhuman follow-ups (day7_pmf_followup):
 *   "What's the main thing you got from the Read?" and "Who do you think this would help most?"
 */

import { verifyReadLink, type ReadAnswerQuestion } from './email-links';
import { getLeadById, logReadEvent, type ReadEventInput, type ReadLeadRow } from './email-store';

export const ANSWER_EVENTS: Record<ReadAnswerQuestion, string> = {
  move: 'move_done_day7',
  rerate: 'day7_rerating',
  pmf: 'day7_pmf',
};

export const PMF_FOLLOWUP_VALUES = ['very', 'somewhat'];
export const FOLLOWUP_MAX_CHARS = 1000;

export interface AnswerDeps {
  getLead?: (id: string) => Promise<ReadLeadRow | null>;
  logEvent?: (input: ReadEventInput) => Promise<unknown>;
  now?: number;
}

export type AnswerOutcome =
  | { ok: true; question: ReadAnswerQuestion; value: string; followup: boolean }
  | { ok: false; status: 400 | 404 | 500; error: string };

export async function recordEmailAnswer(token: unknown, deps: AnswerDeps = {}): Promise<AnswerOutcome> {
  const getLead = deps.getLead ?? getLeadById;
  const logEvent = deps.logEvent ?? logReadEvent;
  const payload = verifyReadLink(token, deps.now);
  if (!payload || payload.kind !== 'answer') return { ok: false, status: 400, error: 'This link is invalid or has expired.' };

  try {
    const lead = await getLead(payload.leadId);
    if (!lead) return { ok: false, status: 404, error: 'We could not find this Read.' };

    const props: Record<string, unknown> =
      payload.question === 'rerate'
        ? { rating: Number(payload.value), source: 'email_day7' }
        : { answer: payload.value, source: 'email_day7' };
    if (payload.question === 'pmf') props.pattern = lead.pattern;

    await logEvent({
      sessionId: lead.session_id,
      leadId: lead.id,
      userId: lead.user_id,
      event: ANSWER_EVENTS[payload.question],
      props,
    });
    return {
      ok: true,
      question: payload.question,
      value: payload.value,
      followup: payload.question === 'pmf' && PMF_FOLLOWUP_VALUES.includes(payload.value),
    };
  } catch (err: any) {
    console.error('[read-email] answer not recorded:', err?.message);
    return { ok: false, status: 500, error: 'Something went wrong saving your answer.' };
  }
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().slice(0, FOLLOWUP_MAX_CHARS);
  return t || null;
}

/** The two Superhuman follow-ups. Needs a valid pmf token answered very or somewhat. */
export async function recordPmfFollowup(
  token: unknown,
  body: { mainThing?: unknown; whoHelps?: unknown },
  deps: AnswerDeps = {},
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 500; error: string }> {
  const getLead = deps.getLead ?? getLeadById;
  const logEvent = deps.logEvent ?? logReadEvent;
  const payload = verifyReadLink(token, deps.now);
  if (!payload || payload.kind !== 'answer' || payload.question !== 'pmf' || !PMF_FOLLOWUP_VALUES.includes(payload.value)) {
    return { ok: false, status: 400, error: 'This link is invalid or has expired.' };
  }
  const mainThing = clean(body.mainThing);
  const whoHelps = clean(body.whoHelps);
  if (!mainThing && !whoHelps) return { ok: false, status: 400, error: 'Write an answer to at least one question.' };

  try {
    const lead = await getLead(payload.leadId);
    if (!lead) return { ok: false, status: 404, error: 'We could not find this Read.' };
    await logEvent({
      sessionId: lead.session_id,
      leadId: lead.id,
      userId: lead.user_id,
      event: 'day7_pmf_followup',
      props: { pmf: payload.value, main_thing: mainThing, who_helps: whoHelps, pattern: lead.pattern },
    });
    return { ok: true };
  } catch (err: any) {
    console.error('[read-email] PMF follow-up not recorded:', err?.message);
    return { ok: false, status: 500, error: 'Something went wrong saving your answer.' };
  }
}
