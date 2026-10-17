/**
 * Founding Member checkout (beta cohort only).
 *
 * Separate from /api/checkout so normal products are untouched. Eligibility is checked
 * against beta_participants and the price is computed here ($60 minus what the user
 * has already paid). The client sends nothing but its auth cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { APP_URL } from '@/lib/config/urls';
import { getFoundingOffer } from '@/lib/beta/founding-member-server';
import { FOUNDING_MEMBER_SLUG } from '@/lib/beta/founding-member';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || '', {
  apiVersion: '2026-02-25.clover',
});

const INELIGIBLE_MESSAGES: Record<string, { status: number; error: string }> = {
  not_beta: { status: 403, error: 'The Founding Member offer is only open to beta participants.' },
  withdrawn: { status: 403, error: 'The Founding Member offer is only open to active beta participants.' },
  already_member: { status: 409, error: 'You are already a Founding Member.' },
  closed: { status: 410, error: 'The Founding Member offer has closed.' },
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
    }

    const offer = await getFoundingOffer(user.id, user.email);
    if (!offer.eligibility.eligible) {
      const msg = INELIGIBLE_MESSAGES[offer.eligibility.reason];
      return NextResponse.json({ error: msg.error, reason: offer.eligibility.reason }, { status: msg.status });
    }

    const pricing = offer.pricing!;
    if (pricing.covered) {
      return NextResponse.json(
        {
          error: 'What you have already paid covers the Founding Member price. Reply to Austin and he will mark you as a Founding Member.',
          reason: 'covered',
        },
        { status: 409 }
      );
    }

    const appBaseUrl = APP_URL || new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Quantum Strategies Founding Member',
              description:
                pricing.credit > 0
                  ? `$60 minus the $${pricing.credit} you have already paid`
                  : 'Founding Member of the Three Rites beta cohort',
            },
            unit_amount: Math.round(pricing.price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${appBaseUrl}/dashboard/founding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/dashboard/founding`,
      metadata: {
        product_slug: FOUNDING_MEMBER_SLUG,
        founding_credit: String(pricing.credit),
        beta_participant_id: offer.participant!.id,
      },
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
      customer_email: user.email || undefined,
      client_reference_id: user.id,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Founding Member checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
