/**
 * /read/checkout?session=<id>: the bridge from a Perception Read result to Rite I.
 *
 * Signed in  → link the lead, record read_checkout_started, start /api/checkout
 *              with productSlug 'perception-rite-bundle' (complete-the-Rite pricing
 *              applies server-side), redirect to Stripe.
 * Signed out → offer a magic link to the lead's email (account created on first
 *              sign-in), which returns here and continues.
 */

import type { Metadata } from 'next';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isUuid, maskEmail } from '@/lib/read/email-links';
import { getLeadBySession } from '@/lib/read/email-store';
import ReadCheckoutClient from './ReadCheckoutClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Get Rite I',
  robots: { index: false, follow: false },
};

export default async function ReadCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; signin?: string }>;
}) {
  const params = await searchParams;
  const sessionId = isUuid(params.session) ? params.session : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let leadEmailMasked: string | null = null;
  if (!user && sessionId) {
    try {
      const lead = await getLeadBySession(sessionId);
      leadEmailMasked = lead?.email ? maskEmail(lead.email) : null;
    } catch (err: any) {
      console.error('[read-checkout] lead lookup failed:', err?.message);
    }
  }

  return (
    <ReadCheckoutClient
      sessionId={sessionId}
      signedIn={Boolean(user)}
      leadEmailMasked={leadEmailMasked}
      signinFailed={params.signin === 'failed'}
    />
  );
}
