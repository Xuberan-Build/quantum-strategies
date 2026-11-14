import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveProductSlugs } from '@/lib/stripe/webhook-handlers/grant-access';
import { isInitiationSlug } from '@/lib/beta/initiation';

/**
 * Paid-but-no-access check.
 *
 * Both past payment incidents were found by customers, not by us (brain/journey/incidents.md).
 * This lists recent paid Checkout sessions in Stripe and confirms each one left a record
 * in our database. It reads only; it never grants. A human decides what to do with a gap.
 */

export interface ReconcileGap {
  sessionId: string;
  created: string;
  email: string | null;
  amount: number;
  productSlug: string | null;
  reason: 'no_product_slug' | 'no_access_row' | 'initiation_not_recorded';
}

export interface ReconcileReport {
  checked: number;
  ok: number;
  gaps: ReconcileGap[];
}

function slugFor(session: Stripe.Checkout.Session): string | null {
  const fromMeta = session.metadata?.product_slug;
  if (fromMeta) return fromMeta;
  const m = session.success_url?.match(/\/products\/([^/]+)\//);
  return m?.[1] ?? null;
}

async function hasAccess(session: Stripe.Checkout.Session, slug: string): Promise<boolean> {
  // 1. The normal case: rows written for this exact session.
  const { data: bySession, error } = await supabaseAdmin
    .from('product_access')
    .select('id')
    .eq('stripe_session_id', session.id)
    .limit(1);
  if (error) throw new Error(`product_access lookup failed: ${error.message}`);
  if (bySession?.length) return true;

  // 2. The buyer already owned every product (earlier purchase, beta, upgrade). The webhook keeps
  //    the older row, so there is no row for this session, but nothing is missing.
  let userId = session.client_reference_id ?? null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (!userId && email) {
    const { data: u } = await supabaseAdmin.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    userId = u?.id ?? null;
  }
  if (!userId) return false;

  const wanted = await resolveProductSlugs(slug);
  const { data: owned, error: ownedErr } = await supabaseAdmin
    .from('product_access')
    .select('product_slug')
    .eq('user_id', userId)
    .eq('access_granted', true)
    .in('product_slug', wanted);
  if (ownedErr) throw new Error(`product_access lookup failed: ${ownedErr.message}`);
  const ownedSet = new Set((owned ?? []).map((r: { product_slug: string }) => r.product_slug));
  return wanted.every((s) => ownedSet.has(s));
}

async function initiationRecorded(sessionId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('beta_participants')
    .select('id')
    .eq('conversion_stripe_session_id', sessionId)
    .limit(1);
  if (error) throw new Error(`beta_participants lookup failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function reconcilePayments(stripe: Stripe, sinceHours = 48): Promise<ReconcileReport> {
  const since = Math.floor(Date.now() / 1000) - sinceHours * 3600;
  const report: ReconcileReport = { checked: 0, ok: 0, gaps: [] };

  for await (const session of stripe.checkout.sessions.list({ created: { gte: since }, status: 'complete', limit: 100 })) {
    if (session.mode !== 'payment') continue;
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') continue;
    // Tips and credit packs (Phase 2) are recorded elsewhere; they declare a kind.
    const kind = session.metadata?.kind;
    if (kind && kind !== 'product') continue;

    report.checked += 1;
    const slug = slugFor(session);
    const base = {
      sessionId: session.id,
      created: new Date(session.created * 1000).toISOString(),
      email: session.customer_details?.email ?? session.customer_email ?? null,
      amount: (session.amount_total ?? 0) / 100,
      productSlug: slug,
    };

    if (!slug) {
      report.gaps.push({ ...base, reason: 'no_product_slug' });
      continue;
    }
    if (isInitiationSlug(slug)) {
      if (await initiationRecorded(session.id)) report.ok += 1;
      else report.gaps.push({ ...base, reason: 'initiation_not_recorded' });
      continue;
    }
    if (await hasAccess(session, slug)) report.ok += 1;
    else report.gaps.push({ ...base, reason: 'no_access_row' });
  }

  return report;
}
