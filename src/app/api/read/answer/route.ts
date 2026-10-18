import { NextRequest, NextResponse } from 'next/server';
import { screenAnswers } from '@/lib/read/safety';
import { eventContext, recordEvent, saveAnswer, updateSessionData } from '@/lib/read/store';
import type { SafetyResult, SafetyTier } from '@/lib/read/types';
import { authorizeSession, bodySessionId, jsonError, limit, logRouteError, readJson } from '../_lib/http';
import { answerBodySchema, checkAnswer, findQuestion, zodIssues } from '../_lib/validate';

export const dynamic = 'force-dynamic';

const RANK: Record<SafetyTier, number> = { none: 0, hardship: 1, clinical: 2, crisis: 3 };

/** POST /api/read/answer { sessionId, answer } → { ok: true, safety? } (safety only when a tier fired). */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const limited = limit(req, 'answer', bodySessionId(body));
  if (limited) return limited;

  const parsed = answerBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid_body', { issues: zodIssues(parsed.error) });
  const { sessionId, answer } = parsed.data;

  const invalid = checkAnswer(answer);
  if (invalid) return jsonError(400, invalid, { questionId: answer.questionId });

  try {
    const auth = await authorizeSession(req, sessionId);
    if (!auth) return jsonError(403, 'forbidden');
    const { row } = auth;
    if (row.completed_at) return jsonError(409, 'already_complete');

    const safety = screenAnswers({ [answer.questionId]: answer });
    const saved = await saveAnswer(sessionId, answer, findQuestion(answer.questionId)?.order);
    if (!saved) return jsonError(409, 'already_complete');

    const ctx = eventContext(row);
    if (safety.tier !== 'none') {
      const prev = row.session_data?.safety;
      if (!prev || RANK[safety.tier] > RANK[prev.tier]) {
        const worst: SafetyResult = {
          tier: safety.tier,
          matchedLists: [...new Set([...(prev?.matchedLists ?? []), ...safety.matchedLists])],
        };
        await updateSessionData(sessionId, { safety: worst });
      }
      await recordEvent({
        event: 'read_safety_triggered',
        sessionId,
        leadId: ctx.leadId,
        step: answer.questionId,
        props: { ...ctx.props, tier: safety.tier },
      });
    }
    await recordEvent({
      event: 'read_step_submit',
      sessionId,
      leadId: ctx.leadId,
      step: answer.questionId,
      // Tags only. Free text never goes into events.
      props: { ...ctx.props, choice: answer.choice ?? null, hasText: !!answer.text },
    });

    return NextResponse.json(safety.tier === 'none' ? { ok: true } : { ok: true, safety });
  } catch (e) {
    logRouteError('answer', e);
    return jsonError(500, 'answer_failed');
  }
}
