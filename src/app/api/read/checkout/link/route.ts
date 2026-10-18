/**
 * Checkout bridge, not signed in: email a Supabase magic link to the Read lead's
 * address. The link signs them in (creating the account if it's new) and returns to
 * /read/checkout?session=<id> through /api/auth/callback, which then starts checkout.
 *
 * POST { sessionId } → 200 { ok: true, maskedEmail } | 404 { error } (no lead)
 * The full address never leaves the server. Supabase sends the email (auth SMTP),
 * so this doesn't depend on the app's Gmail/Resend config.
 *
 * Supabase Auth must allow the redirect: <app>/api/auth/callback** in the redirect URL list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/config/urls';
import { bridgeCallbackUrl, isUuid, maskEmail } from '@/lib/read/email-links';
import { getLeadBySession } from '@/lib/read/email-store';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Invalid session' }, { status: 400 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const perIp = checkRateLimit(`read-link-ip:${ip}`, { maxRequests: 10, windowMs: 10 * 60_000 });
  const perSession = checkRateLimit(`read-link-session:${sessionId}`, { maxRequests: 3, windowMs: 10 * 60_000 });
  if (!perIp.allowed || !perSession.allowed) {
    return NextResponse.json({ error: 'We just sent a link. Check your inbox, or try again in a few minutes.' }, { status: 429 });
  }

  let email: string | null = null;
  try {
    email = (await getLeadBySession(sessionId))?.email ?? null;
  } catch (err: any) {
    console.error('[read-checkout-link] lead lookup failed:', err?.message);
    return NextResponse.json({ error: 'Something went wrong. Try again in a minute.' }, { status: 500 });
  }
  if (!email) return NextResponse.json({ error: 'No email on this Read.' }, { status: 404 });

  // The link must come back to this host so the PKCE cookie set here is readable there.
  const origin = APP_URL || req.nextUrl.origin;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: bridgeCallbackUrl(origin, sessionId), shouldCreateUser: true },
  });
  if (error) {
    console.error('[read-checkout-link] signInWithOtp failed:', error.message);
    return NextResponse.json({ error: 'We could not send the link. Try again in a minute.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, maskedEmail: maskEmail(email) });
}
