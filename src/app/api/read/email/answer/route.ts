/**
 * Day-7 one-click answers (POST from /read/email/answer, which the email links to).
 *
 *   { t }                         → records the answer in the signed token
 *   { t, mainThing?, whoHelps? }  → the PMF follow-ups (pmf token, very or somewhat)
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordEmailAnswer, recordPmfFollowup } from '@/lib/read/email-answers';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`read-answer:${ip}`, { maxRequests: 30, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.t !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  if ('mainThing' in body || 'whoHelps' in body) {
    const res = await recordPmfFollowup(body.t, { mainThing: body.mainThing, whoHelps: body.whoHelps });
    return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
  }

  const res = await recordEmailAnswer(body.t);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, question: res.question, value: res.value, followup: res.followup });
}
