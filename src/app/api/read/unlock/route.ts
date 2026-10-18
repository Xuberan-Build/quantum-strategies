import { NextRequest, NextResponse, after } from 'next/server';
import { buildResult } from '@/lib/read/results';
import { onReadUnlocked } from '@/lib/read/emails';
import {
  createLead,
  eventContext,
  linkLeadToSession,
  recordEvent,
  resultUrl,
  updateSessionData,
} from '@/lib/read/store';
import type { ReadAnswers, ReadResult } from '@/lib/read/types';
import { authorizeSession, bodySessionId, jsonError, limit, logRouteError, readJson } from '../_lib/http';
import { unlockBodySchema, zodIssues } from '../_lib/validate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // buildResult may call the mirror-paragraph model

/**
 * POST /api/read/unlock { sessionId, lead: ReadLeadInput } → ReadResult
 * The email gate (spec v3 §8.2): creates/refreshes the lead, builds and stores the full result,
 * sends the transactional result email and schedules the follow-ups.
 * Crisis-tier sessions have no gate (spec v3 §6) and are refused.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const limited = limit(req, 'unlock', bodySessionId(body));
  if (limited) return limited;

  const parsed = unlockBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid_body', { issues: zodIssues(parsed.error) });
  const { sessionId, lead: leadInput } = parsed.data;

  try {
    const auth = await authorizeSession(req, sessionId);
    if (!auth) return jsonError(403, 'forbidden');
    const { row } = auth;
    const sd = row.session_data ?? {};

    if (!row.completed_at || !sd.preview) return jsonError(409, 'not_complete');
    if (sd.safety?.tier === 'crisis' || !sd.scores || !sd.mirror) return jsonError(403, 'no_gate_for_session');

    const lead = await createLead({
      email: leadInput.email,
      consentMarketing: leadInput.consentMarketing,
      utm: leadInput.utm ?? row.utm ?? undefined,
      sessionId,
      pattern: sd.scores.pattern,
    });
    await linkLeadToSession(sessionId, lead.id);

    const ctx = eventContext(row);
    await recordEvent({
      event: 'read_email_submit',
      sessionId,
      leadId: lead.id,
      props: { ...ctx.props, consentMarketing: leadInput.consentMarketing },
    });

    let result: ReadResult | undefined = sd.result;
    if (!result) {
      result = await buildResult({
        sessionId,
        answers: (row.step_data ?? {}) as ReadAnswers,
        scores: sd.scores,
        mirror: sd.mirror,
        safety: sd.safety ?? { tier: 'none', matchedLists: [] },
        utm: row.utm ?? undefined,
      });
      await updateSessionData(sessionId, { result, unlockedAt: new Date().toISOString() });
    }

    // Result email + follow-up scheduling run after the response; they never throw
    // and never block the result on screen.
    const unlocked = result;
    after(() =>
      onReadUnlocked({
        lead,
        result: unlocked,
        resultUrl: resultUrl(sessionId),
        mirror: sd.mirror,
        answers: (row.step_data ?? {}) as ReadAnswers,
      }).catch((e) => logRouteError('unlock:email', e)),
    );

    return NextResponse.json(result);
  } catch (e) {
    logRouteError('unlock', e);
    return jsonError(500, 'unlock_failed');
  }
}
