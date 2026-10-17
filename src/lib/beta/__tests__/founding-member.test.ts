import { describe, it, expect } from 'vitest';
import {
  FOUNDING_MEMBER_SLUG,
  checkFoundingEligibility,
  computePriorPayments,
  getFoundingMemberPrice,
  stageForRite,
  type PaymentAccessRow,
} from '../founding-member';
import { getProductBySlug } from '@/lib/constants/products';
import { BUNDLE_CONTENTS } from '@/lib/constants/bundles';

const CLOSES = '2026-11-15T23:59:59-08:00';
const BEFORE = new Date('2026-10-20T12:00:00Z');
const AFTER = new Date('2026-11-16T08:00:00Z');

const active = { status: 'active', conversion_decision: null };

const betaRow = (): PaymentAccessRow => ({
  amount_paid: 0,
  stripe_session_id: 'beta_program',
  purchase_source: 'beta_enrollment',
});

describe('checkFoundingEligibility', () => {
  it('rejects users with no beta_participants row', () => {
    expect(checkFoundingEligibility(null, BEFORE, CLOSES)).toEqual({ eligible: false, reason: 'not_beta' });
  });

  it('accepts an active beta participant before the deadline', () => {
    expect(checkFoundingEligibility(active, BEFORE, CLOSES)).toEqual({ eligible: true });
  });

  it('accepts completed participants and people who declined earlier', () => {
    expect(checkFoundingEligibility({ status: 'completed', conversion_decision: null }, BEFORE, CLOSES).eligible).toBe(true);
    expect(checkFoundingEligibility({ status: 'active', conversion_decision: 'declined' }, BEFORE, CLOSES).eligible).toBe(true);
    expect(checkFoundingEligibility({ status: 'active', conversion_decision: 'pending' }, BEFORE, CLOSES).eligible).toBe(true);
  });

  it('rejects withdrawn participants', () => {
    expect(checkFoundingEligibility({ status: 'withdrawn', conversion_decision: null }, BEFORE, CLOSES))
      .toEqual({ eligible: false, reason: 'withdrawn' });
  });

  it('rejects people who already bought', () => {
    expect(checkFoundingEligibility({ status: 'active', conversion_decision: 'purchased' }, BEFORE, CLOSES))
      .toEqual({ eligible: false, reason: 'already_member' });
  });

  it('closes after the deadline and stays open up to it', () => {
    expect(checkFoundingEligibility(active, AFTER, CLOSES)).toEqual({ eligible: false, reason: 'closed' });
    expect(checkFoundingEligibility(active, new Date(CLOSES), CLOSES)).toEqual({ eligible: true });
  });

  it('reports already_member over closed, so members still see their page', () => {
    expect(checkFoundingEligibility({ status: 'active', conversion_decision: 'purchased' }, AFTER, CLOSES).reason)
      .toBe('already_member');
  });
});

describe('computePriorPayments', () => {
  it('is zero for a beta user who has paid nothing', () => {
    expect(computePriorPayments(Array.from({ length: 11 }, betaRow))).toBe(0);
  });

  it('counts a bundle once even though every granted row carries the bundle amount', () => {
    const rows: PaymentAccessRow[] = ['a', 'b', 'c'].map(() => ({
      amount_paid: 17,
      stripe_session_id: 'cs_bundle',
      purchase_source: 'bundle',
    }));
    expect(computePriorPayments(rows)).toBe(17);
  });

  it('adds separate single purchases', () => {
    const rows: PaymentAccessRow[] = [
      { amount_paid: 3, stripe_session_id: 'cs_1', purchase_source: 'single' },
      { amount_paid: 7, stripe_session_id: 'cs_2', purchase_source: 'single' },
    ];
    expect(computePriorPayments(rows)).toBe(10);
  });

  it('credits a Stripe payment that never produced an access row (bought what they already owned)', () => {
    const credit = computePriorPayments(Array.from({ length: 11 }, betaRow), [
      { id: 'cs_july', amount_total: 1700, product_slug: 'orientation-bundle' },
    ]);
    expect(credit).toBe(17);
  });

  it('does not double count a session seen in both product_access and Stripe', () => {
    const credit = computePriorPayments(
      [{ amount_paid: 17, stripe_session_id: 'cs_july', purchase_source: 'bundle' }],
      [{ id: 'cs_july', amount_total: 1700 }]
    );
    expect(credit).toBe(17);
  });

  it('ignores the founding-member payment itself and unpaid sessions', () => {
    const credit = computePriorPayments([], [
      { id: 'cs_f', amount_total: 4300, product_slug: FOUNDING_MEMBER_SLUG },
      { id: 'cs_zero', amount_total: 0 },
      { id: 'cs_null', amount_total: null },
    ]);
    expect(credit).toBe(0);
  });

  it('ignores rows with no session id and the beta_program marker', () => {
    const credit = computePriorPayments([
      { amount_paid: 9, stripe_session_id: null, purchase_source: 'admin' },
      { amount_paid: 9, stripe_session_id: 'beta_program', purchase_source: 'single' },
    ]);
    expect(credit).toBe(0);
  });

  it('uses a manual credit when it is larger, and never lowers the computed one', () => {
    expect(computePriorPayments([], [], 17)).toBe(17);
    expect(computePriorPayments([], [{ id: 'cs', amount_total: 2400 }], 17)).toBe(24);
    expect(computePriorPayments([], [], null)).toBe(0);
  });
});

describe('getFoundingMemberPrice', () => {
  it('charges $60 when nothing has been paid', () => {
    expect(getFoundingMemberPrice(0)).toEqual({ credit: 0, price: 60, covered: false });
  });

  it('takes prior payments off the $60', () => {
    expect(getFoundingMemberPrice(17)).toEqual({ credit: 17, price: 43, covered: false });
    expect(getFoundingMemberPrice(15)).toEqual({ credit: 15, price: 45, covered: false });
  });

  it('never goes below zero', () => {
    expect(getFoundingMemberPrice(75)).toEqual({ credit: 75, price: 0, covered: true });
    expect(getFoundingMemberPrice(60)).toEqual({ credit: 60, price: 0, covered: true });
  });

  it('waives a balance under Stripe\'s 50 cent minimum', () => {
    expect(getFoundingMemberPrice(59.6)).toEqual({ credit: 59.6, price: 0, covered: true });
    expect(getFoundingMemberPrice(59.5).price).toBe(0.5);
  });

  it('treats bad input as nothing paid', () => {
    expect(getFoundingMemberPrice(NaN).price).toBe(60);
    expect(getFoundingMemberPrice(-10).price).toBe(60);
  });
});

describe('stageForRite', () => {
  it('maps current_rite to purchased_at_stage', () => {
    expect(stageForRite('perception')).toBe('during_rite_one');
    expect(stageForRite('orientation')).toBe('during_rite_two');
    expect(stageForRite('declaration')).toBe('during_rite_three');
    expect(stageForRite('complete')).toBe('after_completion');
    expect(stageForRite(null)).toBeNull();
  });
});

describe('normal checkout is unaffected', () => {
  it('founding-member is not a sellable product or bundle, so /api/checkout rejects it', () => {
    expect(getProductBySlug(FOUNDING_MEMBER_SLUG)).toBeNull();
    expect(BUNDLE_CONTENTS[FOUNDING_MEMBER_SLUG]).toBeUndefined();
  });
});
