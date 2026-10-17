/**
 * Founding Member offer for the beta cohort (pure logic, safe on client and server).
 *
 * The beta page promised: "Founding Member access offered at $60 (minus any à la
 * carte purchases you made)". Beta users already own all 11 products, so this file
 * decides two things only: who may buy, and what they pay. The server loads the
 * data (founding-member-server.ts); everything here is a pure function so it can be
 * unit tested.
 *
 * Offer design and founder decisions: brain/gtm/beta-conversion-offer.md
 */

import { FOUNDING_MEMBER_PRICE } from './constants';

/** Checkout metadata slug. Not in PRODUCTS, so /api/checkout rejects it. */
export const FOUNDING_MEMBER_SLUG = 'founding-member';

/**
 * When the founding price closes for the whole cohort. Enforced on the server
 * (eligibility below), so the deadline in the emails is real.
 * FOUNDER DECISION: confirm the date before email 1 goes out.
 */
export const FOUNDING_OFFER_CLOSES_AT = '2026-11-15T23:59:59-08:00';

/** Stripe won't charge less than $0.50, so a smaller balance counts as paid in full. */
export const MIN_CHARGE = 0.5;

/** The offer stays hidden until the founder approves its terms and sets FEATURE_FOUNDING_OFFER=true. */
export function isFoundingOfferEnabled(): boolean {
  return process.env.FEATURE_FOUNDING_OFFER === 'true';
}

export type FoundingIneligibleReason =
  | 'not_beta'
  | 'withdrawn'
  | 'already_member'
  | 'closed';

export interface FoundingParticipant {
  status: string | null;
  conversion_decision: string | null;
}

export type FoundingEligibility =
  | { eligible: true }
  | { eligible: false; reason: FoundingIneligibleReason };

export function checkFoundingEligibility(
  participant: FoundingParticipant | null,
  now: Date = new Date(),
  closesAt: string = FOUNDING_OFFER_CLOSES_AT
): FoundingEligibility {
  if (!participant) return { eligible: false, reason: 'not_beta' };
  if (participant.status === 'withdrawn') return { eligible: false, reason: 'withdrawn' };
  if (participant.conversion_decision === 'purchased') {
    return { eligible: false, reason: 'already_member' };
  }
  if (now.getTime() > new Date(closesAt).getTime()) return { eligible: false, reason: 'closed' };
  return { eligible: true };
}

/** A product_access row, as far as prior payments are concerned. */
export interface PaymentAccessRow {
  amount_paid: number | null;
  stripe_session_id: string | null;
  purchase_source: string | null;
}

/** A paid Stripe Checkout Session found for the user's email. Amount in cents. */
export interface PaidStripeSession {
  id: string;
  amount_total: number | null;
  product_slug?: string | null;
}

/**
 * Sum what a beta user has already paid us, in dollars.
 *
 * Counts each Stripe session once. A bundle writes the full bundle amount on every
 * product row it grants, so rows are grouped by session id. Beta grants and the
 * founding-member payment itself never count.
 *
 * Stripe sessions are included because a beta user who buys something they already
 * own (the July $17 Orientation purchase) gets no new product_access row: the
 * webhook keeps the beta row. The money only shows up in Stripe.
 *
 * `manualCredit` is beta_participants.total_amount_paid_before_offer, so the founder
 * can set a credit by hand. The larger of the two wins, so a manual entry can add
 * credit and never takes it away.
 */
export function computePriorPayments(
  accessRows: PaymentAccessRow[],
  stripeSessions: PaidStripeSession[] = [],
  manualCredit: number | null = null
): number {
  const bySession = new Map<string, number>();

  for (const row of accessRows) {
    const id = row.stripe_session_id;
    const amount = Number(row.amount_paid ?? 0);
    if (!id || id === 'beta_program' || row.purchase_source === 'beta_enrollment') continue;
    if (!(amount > 0)) continue;
    bySession.set(id, Math.max(bySession.get(id) ?? 0, amount));
  }

  for (const s of stripeSessions) {
    if (s.product_slug === FOUNDING_MEMBER_SLUG) continue;
    const amount = Number(s.amount_total ?? 0) / 100;
    if (!(amount > 0)) continue;
    bySession.set(s.id, Math.max(bySession.get(s.id) ?? 0, amount));
  }

  let total = 0;
  for (const amount of bySession.values()) total += amount;
  total = roundCents(total);

  const manual = Number(manualCredit ?? 0);
  return manual > total ? roundCents(manual) : total;
}

export interface FoundingPrice {
  /** What they've already paid, in dollars. */
  credit: number;
  /** What checkout will charge, in dollars. 0 means prior payments cover it. */
  price: number;
  /** True when nothing is left to pay. */
  covered: boolean;
}

/** $60 minus what they've paid, never below zero. Balances under $0.50 are waived. */
export function getFoundingMemberPrice(
  priorPayments: number,
  fullPrice: number = FOUNDING_MEMBER_PRICE
): FoundingPrice {
  const credit = roundCents(Math.max(0, Number(priorPayments) || 0));
  let price = roundCents(Math.max(0, fullPrice - credit));
  if (price < MIN_CHARGE) price = 0;
  return { credit, price, covered: price === 0 };
}

/** Maps beta_participants.current_rite to beta_conversion_results.purchased_at_stage. */
export function stageForRite(currentRite: string | null): string | null {
  switch (currentRite) {
    case 'perception':
      return 'during_rite_one';
    case 'orientation':
      return 'during_rite_two';
    case 'declaration':
      return 'during_rite_three';
    case 'complete':
      return 'after_completion';
    default:
      return null;
  }
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
