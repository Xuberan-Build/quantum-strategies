/**
 * Opt out of one email topic from a link in the email.
 *
 * POST only, so link scanners that prefetch GET URLs can't opt anyone out.
 *   - RFC 8058 one-click: mail clients POST `List-Unsubscribe=One-Click` to ?t=<token>
 *   - The /email/preferences page POSTs { t } as JSON
 * Idempotent. Signed-in users manage every topic in dashboard settings.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyOptOut } from '@/lib/progress-emails/links';
import { setEmailPreference } from '@/lib/progress-emails/preferences';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { errorMessage } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readToken(req: NextRequest): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get('t');
  if ((req.headers.get('content-type') || '').includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return typeof body?.t === 'string' ? body.t : fromQuery;
  }
  return fromQuery;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`email-prefs:${ip}`, { maxRequests: 30, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const payload = verifyOptOut(await readToken(req));
  if (!payload) return NextResponse.json({ error: 'This link is invalid.' }, { status: 400 });

  try {
    await setEmailPreference(payload.userId, { [payload.topic]: false }, 'one_click');
    return NextResponse.json({ ok: true, topic: payload.topic });
  } catch (err) {
    console.error('[email-prefs] opt-out failed:', errorMessage(err));
    return NextResponse.json({ error: 'Something went wrong. Reply to any email and I will take you off by hand.' }, { status: 500 });
  }
}
