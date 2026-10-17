/**
 * "Complete the Rite" upgrade pricing (pure, no I/O).
 *
 * Offer: anyone who owns at least one product in a Rite can get the rest of it
 * so that their total spend on that Rite is the bundle price + $1.
 *
 *   price = clamp( (bundle + 1) - paidSoFar, 1, cost of the missing products one by one )
 *
 * Rules:
 * - Only rows with access_granted = true count as owned.
 * - Free access (beta enrollment) counts as owned but as $0 paid.
 * - If the user paid nothing for the Rite, the +$1 does not apply: the target is the
 *   bundle price itself (still capped at the individual price of the missing products).
 * - amount_paid is in DOLLARS (the webhook stores amount_total / 100). On a bundle
 *   purchase every component row carries the full session total, so amounts are
 *   counted once per stripe_session_id, never once per row.
 * - If amount_paid is null on a paid row, fall back to list prices.
 * - Returns null when there is nothing to offer: owns none, owns all, or the offer
 *   would not save anything over buying the missing products individually.
 */

import { BUNDLE_CONTENTS } from '@/lib/constants/bundles';
import { PRODUCTS } from '@/lib/constants/products';

export interface AccessRowInput {
  product_slug: string;
  access_granted?: boolean | null;
  amount_paid?: number | string | null;
  stripe_session_id?: string | null;
  purchase_source?: string | null;
  bundle_slug?: string | null;
}

export interface CompleteRiteOffer {
  bundleSlug: string;
  /** Slugs the user still needs, in bundle order. */
  missingSlugs: string[];
  /** Slugs the user already has, in bundle order. */
  ownedSlugs: string[];
  /** Upgrade price in dollars. */
  price: number;
  /** Dollars saved versus buying the missing products one by one. */
  savings: number;
  /** Dollars the user has already paid toward this Rite. */
  paidSoFar: number;
}

const UPGRADE_MARKUP_CENTS = 100;
const MIN_PRICE_CENTS = 100;

const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => cents / 100;

function listPriceCents(slug: string): number {
  return toCents(PRODUCTS[slug]?.price ?? 0);
}

function isFreeRow(row: AccessRowInput): boolean {
  return row.purchase_source === 'beta_enrollment' || row.stripe_session_id === 'beta_program';
}

function parseAmount(value: AccessRowInput['amount_paid']): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Dollars (as cents) the user has paid toward the given components. */
function paidCentsForRows(rows: AccessRowInput[], bundleSlug: string): number {
  // Group by purchase: one stripe session is one payment, whatever the row count.
  const groups = new Map<string, AccessRowInput[]>();
  rows.forEach((row, i) => {
    if (isFreeRow(row)) return;
    const key = row.stripe_session_id ? `s:${row.stripe_session_id}` : `r:${i}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  let total = 0;
  for (const group of groups.values()) {
    const amounts = group.map((r) => parseAmount(r.amount_paid)).filter((a): a is number => a !== null);
    if (amounts.length > 0) {
      total += toCents(Math.max(...amounts));
      continue;
    }
    // Legacy row without an amount: assume list price.
    const isBundleSale = group.some((r) => r.bundle_slug === bundleSlug || r.purchase_source === 'bundle');
    total += isBundleSale
      ? listPriceCents(bundleSlug)
      : group.reduce((sum, r) => sum + listPriceCents(r.product_slug), 0);
  }
  return total;
}

export function getCompleteRiteOffer(
  accessRows: AccessRowInput[],
  bundleSlug: string,
): CompleteRiteOffer | null {
  const components = BUNDLE_CONTENTS[bundleSlug];
  const bundle = PRODUCTS[bundleSlug];
  if (!components || !bundle) return null;

  const granted = accessRows.filter((r) => r.access_granted && components.includes(r.product_slug));
  const ownedSet = new Set(granted.map((r) => r.product_slug));
  const ownedSlugs = components.filter((s) => ownedSet.has(s));
  const missingSlugs = components.filter((s) => !ownedSet.has(s));

  if (ownedSlugs.length === 0 || missingSlugs.length === 0) return null;

  const paidCents = paidCentsForRows(granted, bundleSlug);
  const bundleCents = toCents(bundle.price);
  const individualCents = missingSlugs.reduce((sum, s) => sum + listPriceCents(s), 0);

  const targetTotal = paidCents > 0 ? bundleCents + UPGRADE_MARKUP_CENTS : bundleCents;
  const priceCents = Math.max(MIN_PRICE_CENTS, Math.min(targetTotal - paidCents, individualCents));
  const savingsCents = individualCents - priceCents;

  if (savingsCents <= 0) return null;

  return {
    bundleSlug,
    missingSlugs,
    ownedSlugs,
    price: toDollars(priceCents),
    savings: toDollars(savingsCents),
    paidSoFar: toDollars(paidCents),
  };
}

/** Offers for every Rite the user qualifies for. */
export function getCompleteRiteOffers(accessRows: AccessRowInput[]): CompleteRiteOffer[] {
  return Object.keys(BUNDLE_CONTENTS)
    .map((bundleSlug) => getCompleteRiteOffer(accessRows, bundleSlug))
    .filter((o): o is CompleteRiteOffer => o !== null);
}

/** True when the user already owns every product in the Rite. */
export function ownsWholeRite(accessRows: AccessRowInput[], bundleSlug: string): boolean {
  const components = BUNDLE_CONTENTS[bundleSlug];
  if (!components) return false;
  const owned = new Set(accessRows.filter((r) => r.access_granted).map((r) => r.product_slug));
  return components.every((s) => owned.has(s));
}
