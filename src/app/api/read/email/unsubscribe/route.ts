/**
 * Unsubscribe from Perception Read emails.
 *
 * POST only, so link scanners that prefetch GET URLs can't unsubscribe anyone.
 *   - RFC 8058 one-click: mail clients POST `List-Unsubscribe=One-Click` to ?t=<token>
 *   - The /read/email/unsubscribe page POSTs { t } as JSON
 * Unsubscribes every lead with the same email. Idempotent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyReadLink } from '@/lib/read/email-links';
import { unsubscribeLead } from '@/lib/read/email-store';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readToken(req: NextRequest): Promise<{ token: string | null; via: string }> {
  const fromQuery = req.nextUrl.searchParams.get('t');
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return { token: typeof body?.t === 'string' ? body.t : fromQuery, via: 'page' };
  }
  // application/x-www-form-urlencoded (one-click) or anything else
  return { token: fromQuery, via: 'one_click' };
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(`read-unsub:${ip}`, { maxRequests: 30, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { token, via } = await readToken(req);
  const payload = verifyReadLink(token);
  if (!payload || payload.kind !== 'unsubscribe') {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 400 });
  }

  try {
    const found = await unsubscribeLead(payload.leadId, via);
    if (!found) return NextResponse.json({ error: 'We could not find this email.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[read-unsubscribe] failed:', err?.message);
    return NextResponse.json({ error: 'Something went wrong. Reply to any email and we will remove you by hand.' }, { status: 500 });
  }
}
