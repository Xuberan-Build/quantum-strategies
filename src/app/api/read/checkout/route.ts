/**
 * Checkout bridge, step 1 for a signed-in visitor: link their Read lead(s) to the
 * account, attach the Read session when the emails match, and record
 * read_checkout_started. The client then calls /api/checkout with
 * productSlug 'perception-rite-bundle' (complete-the-Rite pricing applies there).
 *
 * POST { sessionId } → 200 { ok: true } | 401 { needsSignIn: true }
 * Linking and event failures are logged and never block checkout.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/read/email-links';
import { linkReadLeadsToUser, recordReadCheckoutStarted } from '@/lib/read/lead-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (!isUuid(sessionId)) return NextResponse.json({ error: 'Invalid session' }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ needsSignIn: true }, { status: 401 });

  try {
    if (user.email) await linkReadLeadsToUser({ userId: user.id, email: user.email, sessionId });
  } catch (err: any) {
    console.error('[read-checkout] lead link failed (non-fatal):', err?.message);
  }
  try {
    await recordReadCheckoutStarted({ userId: user.id, email: user.email ?? null, sessionId });
  } catch (err: any) {
    console.error('[read-checkout] event failed (non-fatal):', err?.message);
  }
  return NextResponse.json({ ok: true });
}
