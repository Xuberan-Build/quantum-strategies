import { NextRequest, NextResponse } from 'next/server';
import { screenText } from '@/lib/read/safety';
import { eventContext, recordEvent, updateSessionData, type ReadFeedback } from '@/lib/read/store';
import { authorizeSession, bodySessionId, jsonError, limit, logRouteError, readJson } from '../_lib/http';
import { feedbackBodySchema, zodIssues } from '../_lib/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/read/feedback { sessionId, t?, accuracy?: 1-5, hardestPart?, moveCommitted? } → 204
 * Stored on the session (session_data.feedback). The free-text hardestPart is screened and
 * stored with its tier; it never goes into events.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const limited = limit(req, 'feedback', bodySessionId(body));
  if (limited) return limited;

  const parsed = feedbackBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid_body', { issues: zodIssues(parsed.error) });
  const { sessionId, t, accuracy, hardestPart, moveCommitted } = parsed.data;
  if (accuracy === undefined && hardestPart === undefined && moveCommitted === undefined) {
    return jsonError(400, 'empty_feedback');
  }

  try {
    const auth = await authorizeSession(req, sessionId, { linkToken: t });
    if (!auth) return jsonError(403, 'forbidden');
    const { row } = auth;
    if (!row.completed_at) return jsonError(409, 'not_complete');

    const prev = row.session_data?.feedback ?? {};
    const next: ReadFeedback = { ...prev, updatedAt: new Date().toISOString() };
    if (accuracy !== undefined) next.accuracy = accuracy;
    if (moveCommitted !== undefined) next.moveCommitted = moveCommitted;
    if (hardestPart !== undefined) {
      next.hardestPart = hardestPart;
      next.hardestPartSafetyTier = screenText(hardestPart).tier;
    }
    await updateSessionData(sessionId, { feedback: next });

    const ctx = eventContext(row);
    if (accuracy !== undefined) {
      await recordEvent({ event: 'read_accuracy_rated', sessionId, leadId: ctx.leadId, props: { ...ctx.props, accuracy } });
    }
    if (moveCommitted !== undefined) {
      await recordEvent({ event: 'read_move_committed', sessionId, leadId: ctx.leadId, props: { ...ctx.props, moveCommitted } });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    logRouteError('feedback', e);
    return jsonError(500, 'feedback_failed');
  }
}
