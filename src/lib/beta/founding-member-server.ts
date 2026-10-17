/**
 * Server-only: load a beta participant's Founding Member offer and record the payment.
 * Uses the service role client and the Stripe secret key. Only call it with a user id
 * from the verified auth session or a verified Stripe webhook.
 */

import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  FOUNDING_MEMBER_SLUG,
  checkFoundingEligibility,
  computePriorPayments,
  getFoundingMemberPrice,
  stageForRite,
  type FoundingEligibility,
  type FoundingPrice,
  type PaidStripeSession,
} from './founding-member';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || '', {
      apiVersion: '2026-02-25.clover',
    });
  }
  return stripeClient;
}

export interface FoundingParticipantRow {
  id: string;
  user_id: string;
  status: string;
  current_rite: string | null;
  conversion_decision: string | null;
  conversion_offer_presented_at: string | null;
  total_amount_paid_before_offer: number | null;
  perception_completed_count: number | null;
  orientation_completed_count: number | null;
  declaration_completed_count: number | null;
}

const PARTICIPANT_COLUMNS =
  'id, user_id, status, current_rite, conversion_decision, conversion_offer_presented_at, ' +
  'total_amount_paid_before_offer, perception_completed_count, orientation_completed_count, ' +
  'declaration_completed_count';

export async function getBetaParticipant(userId: string): Promise<FoundingParticipantRow | null> {
  const { data, error } = await supabaseAdmin
    .from('beta_participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as FoundingParticipantRow) ?? null;
}

/** Paid Checkout Sessions for this email. Failure returns [] so the page still loads. */
async function getPaidStripeSessions(email: string | null | undefined): Promise<PaidStripeSession[]> {
  if (!email || !process.env.STRIPE_SECRET_KEY) return [];
  try {
    const list = await getStripe().checkout.sessions.list({
      customer_details: { email },
      status: 'complete',
      limit: 100,
    });
    return list.data
      .filter((s) => s.payment_status === 'paid')
      .map((s) => ({
        id: s.id,
        amount_total: s.amount_total,
        product_slug: s.metadata?.product_slug ?? null,
      }));
  } catch (err: any) {
    console.error('[founding] Stripe session lookup failed:', err?.message || err);
    return [];
  }
}

export interface FoundingOffer {
  participant: FoundingParticipantRow | null;
  eligibility: FoundingEligibility;
  pricing: FoundingPrice | null;
}

/** Eligibility plus server-side price. Price is only computed for eligible users. */
export async function getFoundingOffer(
  userId: string,
  email: string | null | undefined,
  now: Date = new Date()
): Promise<FoundingOffer> {
  const participant = await getBetaParticipant(userId);
  const eligibility = checkFoundingEligibility(participant, now);
  if (!eligibility.eligible || !participant) {
    return { participant, eligibility, pricing: null };
  }

  const [{ data: accessRows, error }, stripeSessions] = await Promise.all([
    supabaseAdmin
      .from('product_access')
      .select('amount_paid, stripe_session_id, purchase_source')
      .eq('user_id', userId),
    getPaidStripeSessions(email),
  ]);
  if (error) throw error;

  const credit = computePriorPayments(
    accessRows ?? [],
    stripeSessions,
    participant.total_amount_paid_before_offer
  );
  return { participant, eligibility, pricing: getFoundingMemberPrice(credit) };
}

/** First view of the offer: stamp when it was shown and what it was. Never overwrites. */
export async function markOfferPresented(participantId: string, price: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('beta_participants')
    .update({
      conversion_offer_presented_at: new Date().toISOString(),
      remaining_balance_offered: price,
    })
    .eq('id', participantId)
    .is('conversion_offer_presented_at', null);
  if (error) console.error('[founding] markOfferPresented failed:', error.message);
}

/**
 * Webhook: record a paid Founding Member checkout.
 * Writes beta_participants conversion fields and one beta_conversion_results row.
 * No product_access rows: beta users already own all 11 products with no expiry, and
 * "Founding Member" is a status (conversion_decision = 'purchased'), not a product.
 * Safe to run twice for the same session (Stripe retries).
 */
export async function recordFoundingMemberPayment(params: {
  userId: string;
  sessionId: string;
  amountPaid: number;
  credit: number;
}): Promise<{ recorded: boolean; reason?: string }> {
  const { userId, sessionId, amountPaid, credit } = params;
  const participant = await getBetaParticipant(userId);
  if (!participant) {
    console.error('[founding] Paid founding checkout but no beta_participants row', { userId, sessionId });
    return { recorded: false, reason: 'not_beta' };
  }

  const now = new Date().toISOString();
  const offerPresentedAt = participant.conversion_offer_presented_at ?? now;

  const { error: updateError } = await supabaseAdmin
    .from('beta_participants')
    .update({
      conversion_decision: 'purchased',
      conversion_decision_at: now,
      conversion_amount: amountPaid,
      conversion_stripe_session_id: sessionId,
      conversion_offer_presented_at: offerPresentedAt,
      total_amount_paid_before_offer: credit,
      remaining_balance_offered: amountPaid,
    })
    .eq('id', participant.id);
  if (updateError) throw updateError;

  const { error: resultError } = await supabaseAdmin.from('beta_conversion_results').upsert(
    {
      beta_participant_id: participant.id,
      user_id: userId,
      offer_presented_at: offerPresentedAt,
      offer_amount: amountPaid,
      offer_type: 'founding_member',
      total_paid_before_offer: credit,
      discount_amount: credit,
      purchased_at_stage: stageForRite(participant.current_rite),
      decision: 'purchased',
      decision_made_at: now,
      purchased_at: now,
      stripe_session_id: sessionId,
      amount_paid: amountPaid,
      final_total_investment: Math.round((credit + amountPaid) * 100) / 100,
      payment_plan: 'full',
    },
    { onConflict: 'beta_participant_id' }
  );
  if (resultError) {
    // The participant row is the source of truth; this table is reporting.
    console.error('[founding] beta_conversion_results upsert failed:', resultError.message);
  }

  console.log(`✅ Founding Member recorded for participant ${participant.id} (${sessionId})`);
  return { recorded: true };
}

export { FOUNDING_MEMBER_SLUG };
