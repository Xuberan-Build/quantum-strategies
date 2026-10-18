import { NextRequest, NextResponse } from 'next/server';
import { READ_QUESTIONS, visibleQuestions } from '@/lib/read/questions';
import { screenAnswers } from '@/lib/read/safety';
import { scorePerceptionRead } from '@/lib/read/score';
import { buildWeekMirror } from '@/lib/read/mirror';
import { PATTERNS } from '@/lib/read/results';
import { eventContext, markComplete, recordEvent } from '@/lib/read/store';
import type { ReadAnswers, ReadPreview, SafetyResult, SafetyTier } from '@/lib/read/types';
import { authorizeSession, bodySessionId, jsonError, limit, logRouteError, readJson } from '../_lib/http';
import { segmentOf, sessionBodySchema, zodIssues } from '../_lib/validate';

export const dynamic = 'force-dynamic';

const RANK: Record<SafetyTier, number> = { none: 0, hardship: 1, clinical: 2, crisis: 3 };

function worst(a: SafetyResult | undefined, b: SafetyResult): SafetyResult {
  if (!a) return b;
  return {
    tier: RANK[a.tier] >= RANK[b.tier] ? a.tier : b.tier,
    matchedLists: [...new Set([...a.matchedLists, ...b.matchedLists])],
  };
}

/** The loudest Q2 pick as its label: parts.loudest, else the only pick. */
function youSaidFrom(answers: ReadAnswers, variant: string | null): string | null {
  const q2 = answers.q2;
  if (!q2) return null;
  const loudest = q2.parts?.loudest;
  const tag = typeof loudest === 'string' && loudest ? loudest : q2.choice?.length === 1 ? q2.choice[0] : null;
  if (!tag) return null;
  if (tag === 'say:other') return null; // their own words: not echoed before the gate
  const def = READ_QUESTIONS.find((q) => q.id === 'q2');
  const opt = (def?.options ?? []).find((o) => o.value === tag) as
    | { label: string; variantLabels?: Record<string, string> }
    | undefined;
  if (!opt) return null;
  // Option labels are written as quotations. The UI adds its own quote marks, so strip these
  // (same rule as loudestQuote in components/read/answers.ts) to avoid doubled quotes.
  const label = (variant && opt.variantLabels?.[variant]) || opt.label;
  return label.replace(/^["“]|["”]$/g, '');
}

/**
 * POST /api/read/complete { sessionId } → ReadPreview
 * Safety screen first (spec v3 §6). Crisis tier: no mirror, no pattern, no offer.
 * Idempotent: a completed session returns its stored preview.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  const limited = limit(req, 'complete', bodySessionId(body));
  if (limited) return limited;

  const parsed = sessionBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'invalid_body', { issues: zodIssues(parsed.error) });
  const { sessionId } = parsed.data;

  try {
    const auth = await authorizeSession(req, sessionId);
    if (!auth) return jsonError(403, 'forbidden');
    const { row } = auth;

    const stored = row.session_data?.preview;
    if (row.completed_at && stored) return NextResponse.json(stored satisfies ReadPreview);

    const answers: ReadAnswers = row.step_data ?? {};
    const variant = row.session_data?.variant ?? row.utm?.variant ?? null;
    const missing = visibleQuestions(segmentOf(answers), variant)
      .filter((q) => q.required && !answers[q.id])
      .map((q) => q.id);
    if (missing.length) return jsonError(400, 'incomplete', { missing });

    const safety = worst(row.session_data?.safety, screenAnswers(answers));
    const ctx = eventContext(row);

    if (safety.tier === 'crisis') {
      const preview: ReadPreview = { sessionId, safety, mirror: null, pattern: null };
      await markComplete(sessionId, { safety, scores: null, mirror: null, preview });
      await recordEvent({
        event: 'read_complete',
        sessionId,
        leadId: ctx.leadId,
        props: { ...ctx.props, pattern: null, tier: 'crisis' },
      });
      return NextResponse.json(preview);
    }

    const scores = scorePerceptionRead(answers);
    const mirror = buildWeekMirror(answers);
    const content = PATTERNS[scores.pattern];
    const preview: ReadPreview = {
      sessionId,
      safety,
      mirror,
      pattern: { id: scores.pattern, name: content.name, read: content.read },
      youSaid: youSaidFrom(answers, variant),
    };
    await markComplete(sessionId, { safety, scores, mirror, preview });
    await recordEvent({
      event: 'read_complete',
      sessionId,
      leadId: ctx.leadId,
      props: {
        ...ctx.props,
        pattern: scores.pattern,
        lowSignal: scores.lowSignal,
        tier: safety.tier,
        gap: mirror.showsGap,
        own: mirror.wantOrShould,
      },
    });
    return NextResponse.json(preview);
  } catch (e) {
    logRouteError('complete', e);
    return jsonError(500, 'complete_failed');
  }
}
