import { describe, it, expect } from 'vitest';
import {
  getCompleteRiteOffer,
  getCompleteRiteOffers,
  ownsWholeRite,
  type AccessRowInput,
} from '../complete-the-rite';

const ORI = 'orientation-bundle';
const PER = 'perception-rite-bundle';
const DEC = 'declaration-rite-bundle';

const single = (slug: string, amount: number | null, session = `cs_${slug}`): AccessRowInput => ({
  product_slug: slug,
  access_granted: true,
  amount_paid: amount,
  stripe_session_id: session,
  purchase_source: 'single',
  bundle_slug: null,
});

const beta = (slug: string): AccessRowInput => ({
  product_slug: slug,
  access_granted: true,
  amount_paid: null,
  stripe_session_id: 'beta_program',
  purchase_source: 'beta_enrollment',
  bundle_slug: null,
});

const scans = (n: number) => Array.from({ length: n }, (_, i) => `perception-rite-scan-${i + 1}`);

describe('getCompleteRiteOffer', () => {
  it('Orientation: owns one at $7, remaining two for $11', () => {
    const offer = getCompleteRiteOffer([single('personal-alignment', 7)], ORI)!;
    expect(offer.price).toBe(11);
    expect(offer.savings).toBe(3);
    expect(offer.paidSoFar).toBe(7);
    expect(offer.missingSlugs).toEqual(['business-alignment', 'brand-alignment']);
    expect(offer.ownedSlugs).toEqual(['personal-alignment']);
    expect(offer.bundleSlug).toBe(ORI);
  });

  it('Orientation: owns two at $14, last one for $4', () => {
    const offer = getCompleteRiteOffer(
      [single('personal-alignment', 7), single('business-alignment', 7)],
      ORI,
    )!;
    expect(offer.price).toBe(4);
    expect(offer.missingSlugs).toEqual(['brand-alignment']);
  });

  it('Perception: owns one scan, other four for $10', () => {
    const offer = getCompleteRiteOffer([single('perception-rite-scan-2', 3)], PER)!;
    expect(offer.price).toBe(10);
    expect(offer.savings).toBe(2);
    expect(offer.missingSlugs).toHaveLength(4);
  });

  it('Perception: owns two scans, other three for $7', () => {
    const offer = getCompleteRiteOffer(
      [single('perception-rite-scan-1', 3), single('perception-rite-scan-2', 3)],
      PER,
    )!;
    expect(offer.price).toBe(7);
    expect(offer.savings).toBe(2);
  });

  it('Perception: owns four scans, last one for $1 (floor, below $3 individual)', () => {
    const offer = getCompleteRiteOffer(scans(4).map((s) => single(s, 3)), PER)!;
    expect(offer.price).toBe(1);
    expect(offer.savings).toBe(2);
  });

  it('Declaration: owns one, other two for $16', () => {
    const offer = getCompleteRiteOffer([single('declaration-rite-life-vision', 9)], DEC)!;
    expect(offer.price).toBe(16);
    expect(offer.savings).toBe(2);
  });

  it('Declaration: owns two, last for $7', () => {
    const offer = getCompleteRiteOffer(
      [single('declaration-rite-life-vision', 9), single('declaration-rite-business-model', 9)],
      DEC,
    )!;
    expect(offer.price).toBe(7);
  });

  it('returns null when the user owns nothing in the Rite', () => {
    expect(getCompleteRiteOffer([], ORI)).toBeNull();
    expect(getCompleteRiteOffer([single('perception-rite-scan-1', 3)], ORI)).toBeNull();
  });

  it('returns null when the user owns every product', () => {
    const rows = ['personal-alignment', 'business-alignment', 'brand-alignment'].map((s) => single(s, 7));
    expect(getCompleteRiteOffer(rows, ORI)).toBeNull();
  });

  it('returns null for an unknown or non-bundle slug', () => {
    expect(getCompleteRiteOffer([single('personal-alignment', 7)], 'personal-alignment')).toBeNull();
    expect(getCompleteRiteOffer([single('personal-alignment', 7)], 'nope')).toBeNull();
  });

  it('ignores rows where access is not granted', () => {
    const row = { ...single('personal-alignment', 7), access_granted: false };
    expect(getCompleteRiteOffer([row], ORI)).toBeNull();
  });

  it('counts a bundle session once, not once per row', () => {
    // 3 of 5 scans came from a $12 bundle purchase; each row carries amount 12.
    const bundleRows: AccessRowInput[] = scans(5).map((s) => ({
      ...single(s, 12, 'cs_bundle'),
      purchase_source: 'bundle',
      bundle_slug: PER,
    }));
    // Pretend two rows were revoked, so three remain granted.
    const rows = bundleRows.map((r, i) => (i >= 3 ? { ...r, access_granted: false } : r));
    const offer = getCompleteRiteOffer(rows, PER)!;
    expect(offer.paidSoFar).toBe(12);
    // (12 + 1) - 12 = 1, two missing scans cost $6 individually
    expect(offer.price).toBe(1);
    expect(offer.savings).toBe(5);
  });

  it('adds up separate purchases of different sessions', () => {
    const rows = [single('perception-rite-scan-1', 3, 'a'), single('perception-rite-scan-2', 3, 'b')];
    expect(getCompleteRiteOffer(rows, PER)!.paidSoFar).toBe(6);
  });

  it('respects a discounted amount_paid', () => {
    // Paid $5 for an Orientation after a promo code: (17 + 1) - 5 = 13, capped at $14.
    const offer = getCompleteRiteOffer([single('personal-alignment', 5)], ORI)!;
    expect(offer.paidSoFar).toBe(5);
    expect(offer.price).toBe(13);
    expect(offer.savings).toBe(1);
  });

  it('upgrade rows carry their own session, so a later upgrade is not double counted', () => {
    const rows = [
      single('personal-alignment', 7, 's1'),
      { ...single('business-alignment', 11, 's2'), purchase_source: 'bundle', bundle_slug: ORI },
      { ...single('brand-alignment', 11, 's2'), purchase_source: 'bundle', bundle_slug: ORI },
    ];
    expect(getCompleteRiteOffer(rows, ORI)).toBeNull();
    expect(ownsWholeRite(rows, ORI)).toBe(true);
  });

  it('falls back to list price when amount_paid is null on a single purchase', () => {
    const offer = getCompleteRiteOffer([single('personal-alignment', null)], ORI)!;
    expect(offer.paidSoFar).toBe(7);
    expect(offer.price).toBe(11);
  });

  it('falls back to the bundle price for a legacy bundle session without amounts', () => {
    const rows: AccessRowInput[] = ['personal-alignment', 'business-alignment'].map((s) => ({
      ...single(s, null, 'cs_old'),
      purchase_source: 'bundle',
      bundle_slug: ORI,
    }));
    const offer = getCompleteRiteOffer(rows, ORI)!;
    expect(offer.paidSoFar).toBe(17);
    expect(offer.price).toBe(1);
  });

  it('treats a string amount_paid from the database as a number', () => {
    const offer = getCompleteRiteOffer([single('personal-alignment', '7.00' as unknown as number)], ORI)!;
    expect(offer.price).toBe(11);
  });

  describe('free and beta access', () => {
    it('free-only access never gets a discount: the bundle price is capped by individual prices', () => {
      // Orientation: missing two cost $14 individually, bundle is $17, so the price would be $14. No saving: null.
      expect(getCompleteRiteOffer([beta('personal-alignment')], ORI)).toBeNull();
      // Declaration: missing two cost $18, bundle is $24. Null.
      expect(getCompleteRiteOffer([beta('declaration-rite-life-vision')], DEC)).toBeNull();
      // Perception: other four scans cost $12, same as the bundle. Null.
      expect(getCompleteRiteOffer([beta('perception-rite-scan-1')], PER)).toBeNull();
    });

    it('mixed free and paid: only the paid amount counts', () => {
      // (12 + 1) - 3 = 10, but the three missing scans cost $9 individually: no saving, so null.
      expect(
        getCompleteRiteOffer([beta('perception-rite-scan-1'), single('perception-rite-scan-2', 3)], PER),
      ).toBeNull();
      // With two paid scans and one free: paid $6, (12 + 1) - 6 = 7, two missing cost $6: null.
      // With one free and two paid Orientations: paid $14, 18 - 14 = 4 vs $7 individual: offer.
      const offer = getCompleteRiteOffer(
        [single('personal-alignment', 7), single('business-alignment', 7)],
        ORI,
      )!;
      expect(offer.price).toBe(4);
    });

    it('owning every product through beta gives no offer', () => {
      const rows = ['personal-alignment', 'business-alignment', 'brand-alignment'].map(beta);
      expect(getCompleteRiteOffer(rows, ORI)).toBeNull();
    });
  });
});

describe('getCompleteRiteOffers', () => {
  it('returns one offer per qualifying Rite', () => {
    const offers = getCompleteRiteOffers([
      single('personal-alignment', 7),
      single('perception-rite-scan-1', 3),
    ]);
    expect(offers.map((o) => o.bundleSlug).sort()).toEqual([ORI, PER].sort());
  });

  it('returns an empty list for no access', () => {
    expect(getCompleteRiteOffers([])).toEqual([]);
  });
});
