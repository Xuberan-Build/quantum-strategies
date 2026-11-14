/**
 * Stripe Webhook — Orchestrator
 *
 * Verifies the signature then delegates to focused handler modules:
 *   - grant-access     : create user + grant product_access rows
 *   - send-welcome-email: customer welcome + admin notification
 *   - sync-crm         : Google Sheets logging (feature-flagged)
 *   - process-affiliate: referral commission (feature-flagged)
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getProductBySlug } from '@/lib/constants/products';
import { grantProductAccess } from '@/lib/stripe/webhook-handlers/grant-access';
import { sendWelcomeEmail, sendAdminNotification } from '@/lib/stripe/webhook-handlers/send-welcome-email';
import { syncToCRM } from '@/lib/stripe/webhook-handlers/sync-crm';
import { processAffiliate } from '@/lib/stripe/webhook-handlers/process-affiliate';
import { syncCustomer } from '@/lib/google-sheets/customer-sync';
import { FEATURES } from '../../../../config/features.config';
import { enrollInPurchaseCampaigns } from '@/lib/crm/auto-enroll';
import { isInitiationSlug } from '@/lib/beta/initiation';
import { recordInitiationPayment } from '@/lib/beta/initiation-server';
import { recordReadPurchase } from '@/lib/read/lead-link';
import { supabaseAdmin } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('Missing signature or webhook secret');
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
  }

  const body = await request.text();

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  // The webhook endpoint is registered on API version 2020-08-27, which predates the
  // customer_details field (added 2021-09-20). Re-fetch the session with the current SDK
  // version when customer_details is absent so we always have the full object.
  let session = stripeEvent.data.object as Stripe.Checkout.Session;
  if (!session.customer_details?.email && !session.customer_email) {
    try {
      session = await stripe.checkout.sessions.retrieve(session.id);
      console.log('Re-fetched session for full customer details:', session.id);
    } catch (err: any) {
      console.error('Failed to re-fetch session:', err.message);
    }
  }

  // Never grant for a session Stripe says is unpaid (delayed payment methods arrive this way).
  // Only the explicit 'unpaid' value blocks: older endpoint API versions may omit the field,
  // and 'no_payment_required' (100% promo codes) must still grant.
  if (session.payment_status === 'unpaid') {
    console.warn('Checkout completed but not paid, skipping grant:', session.id, session.payment_status);
    return NextResponse.json({ received: true, skipped: 'unpaid' });
  }

  const customerEmail = session.customer_details?.email || session.customer_email || null;
  const customerName = session.customer_details?.name || 'there';
  const amount = (session.amount_total || 0) / 100;

  if (!customerEmail) {
    console.error('No customer email found in session:', session.id);
    return NextResponse.json({ error: 'No customer email' }, { status: 400 });
  }

  // Resolve product slug from metadata → success URL → fallback
  let productSlug = session.metadata?.product_slug || '';
  if (!productSlug && session.success_url) {
    const urlMatch = session.success_url.match(/\/products\/([^/]+)\//);
    if (urlMatch?.[1]) productSlug = urlMatch[1];
  }
  if (!productSlug) {
    // A 4xx makes Stripe retry for days and can get the endpoint disabled, which blocks every
    // other purchase. Acknowledge, alert, and let the reconciliation check surface it.
    console.error('Could not determine product slug from session:', session.id);
    try {
      await sendAdminNotification({ customerEmail, customerName, productName: 'UNKNOWN PRODUCT, nothing granted, check Stripe', amount, sessionId: session.id });
    } catch (err: any) {
      console.error('⚠️ Admin notification failed (non-fatal):', err.message);
    }
    return NextResponse.json({ received: true, skipped: 'unknown_product' });
  }

  // Initiation (beta cohort): a status, not a product. Record it and stop, so no
  // product_access row, welcome email, affiliate commission or campaign is triggered.
  if (isInitiationSlug(productSlug)) {
    const userId = session.client_reference_id;
    if (!userId) {
      console.error('Initiation session without client_reference_id:', session.id);
      return NextResponse.json({ error: 'Missing user' }, { status: 400 });
    }
    let recorded = false;
    try {
      ({ recorded } = await recordInitiationPayment({
        userId,
        sessionId: session.id,
        amountPaid: amount,
        // founding_credit: the key's old name, on sessions created before 2026-11-14.
        credit: Number(session.metadata?.initiation_credit ?? session.metadata?.founding_credit ?? 0) || 0,
      }));
    } catch (err: any) {
      console.error('❌ Initiation record failed:', err.message);
      return NextResponse.json({ error: 'Initiation record failed' }, { status: 500 });
    }
    try {
      await sendAdminNotification({ customerEmail, customerName, productName: recorded ? 'Initiation (beta cohort)' : 'Initiation (beta cohort, NOT RECORDED, check beta_participants)', amount, sessionId: session.id });
    } catch (err: any) {
      console.error('⚠️ Admin notification failed (non-fatal):', err.message);
    }
    return NextResponse.json({ received: true, initiation: true });
  }

  // Validate product exists (constants or DB — just used for fallback name here)
  const product = getProductBySlug(productSlug);
  const productName = product?.name ?? productSlug;

  const timestamp = new Date().toISOString();
  let emailSent = '❌ Failed';

  // ── 0. REPLAY CHECK ─────────────────────────────────────────────────────────
  // Stripe retries on any non-2xx and may deliver an event more than once. If this session
  // already produced access rows, the side effects below (emails, affiliate, campaigns, CRM)
  // have run before, so only re-run the grant, which is itself idempotent.
  const { data: priorRows, error: priorErr } = await supabaseAdmin
    .from('product_access')
    .select('id')
    .eq('stripe_session_id', session.id)
    .limit(1);
  if (priorErr) {
    console.error('❌ Replay check failed:', priorErr.message);
    return NextResponse.json({ error: 'Replay check failed' }, { status: 500 });
  }
  const isReplay = (priorRows?.length ?? 0) > 0;

  // ── 1. GRANT ACCESS ─────────────────────────────────────────────────────────
  // client_reference_id is the Supabase auth user.id set during checkout session creation.
  // Using it directly avoids a fallible email lookup and ensures the UUID matches auth.
  const authUserId = session.client_reference_id || undefined;

  let accessResult = { userId: '', productsGranted: [productSlug], productAccessIds: [] as string[] };
  try {
    accessResult = await grantProductAccess({
      customerEmail,
      customerName,
      productSlug,
      sessionId: session.id,
      amountPaid: amount,
      purchaseDate: timestamp,
      authUserId,
      upgradeSlugs:
        session.metadata?.upgrade === 'complete_rite'
          ? session.metadata?.missing?.split(',').filter(Boolean)
          : undefined,
    });
  } catch (err: any) {
    // Fatal: the customer paid and has nothing. Return 500 so Stripe retries (the grant is
    // idempotent), and tell the founder now rather than when the customer writes in.
    console.error('❌ Grant access failed:', err.message);
    try {
      await sendAdminNotification({ customerEmail, customerName, productName: `GRANT FAILED for ${productName}, Stripe will retry, check product_access`, amount, sessionId: session.id });
    } catch (notifyErr: any) {
      console.error('⚠️ Admin notification failed:', notifyErr.message);
    }
    return NextResponse.json({ error: 'Grant failed' }, { status: 500 });
  }

  if (isReplay) {
    console.log('Replayed session, grant re-checked, side effects skipped:', session.id);
    return NextResponse.json({ received: true, replay: true });
  }

  // ── 2. SEND WELCOME EMAIL ────────────────────────────────────────────────────
  try {
    await sendWelcomeEmail({
      to: customerEmail,
      name: customerName,
      productName,
      productSlug,
      productsGranted: accessResult.productsGranted,
      userId: accessResult.userId || undefined,
      isUpgrade: session.metadata?.upgrade === 'complete_rite',
      upgradeMissingSlugs: session.metadata?.missing?.split(',').filter(Boolean),
    });
    emailSent = '✅ Sent';
  } catch (err: any) {
    console.error('⚠️ Welcome email failed (non-fatal):', err.message);
    emailSent = `❌ Failed: ${err.message}`;
  }

  // ── 2b. ADMIN NOTIFICATION ───────────────────────────────────────────────────
  try {
    await sendAdminNotification({ customerEmail, customerName, productName, amount, sessionId: session.id });
  } catch (err: any) {
    console.error('⚠️ Admin notification failed (non-fatal):', err.message);
  }

  // ── 3. AFFILIATE PROCESSING ──────────────────────────────────────────────────
  if (accessResult.userId) {
    try {
      await processAffiliate({
        userId: accessResult.userId,
        customerEmail,
        referralCode: session.metadata?.referral_code,
        sessionId: session.id,
        paymentIntentId: session.payment_intent as string | null,
        amountCents: session.amount_total || 0,
        productSlug,
      });
    } catch (err: any) {
      console.error('⚠️ Affiliate processing failed (non-fatal):', err.message);
    }
  }

  // ── 3b. CAMPAIGN PURCHASE TRIGGER ───────────────────────────────────────────
  if (accessResult.userId) {
    enrollInPurchaseCampaigns(accessResult.userId, productSlug).catch(() => {});
  }

  // ── 3c. PERCEPTION READ PURCHASE ────────────────────────────────────────────
  // read_purchase when the buyer took the free Read (lead by email or bridge session).
  try {
    await recordReadPurchase({
      email: customerEmail,
      userId: accessResult.userId || authUserId || null,
      productSlug,
      stripeSessionId: session.id,
      amount,
      readSessionId: session.metadata?.read_session_id ?? null,
    });
  } catch (err: any) {
    console.error('⚠️ Read purchase event failed (non-fatal):', err.message);
  }

  // ── 4. CRM SYNC (Sheets) ─────────────────────────────────────────────────────
  try {
    await syncToCRM({
      timestamp,
      email: customerEmail,
      name: customerName,
      product: productName,
      amount,
      sessionId: session.id,
      emailSent,
      status: emailSent.startsWith('✅') ? 'Complete' : 'Email Failed',
      productSlugs: accessResult.productsGranted,
      userId: accessResult.userId,
      productAccessIds: accessResult.productAccessIds,
      stripePaymentIntentId: session.payment_intent as string | null,
      stripeCustomerId: (session.customer as string | null) || null,
    });
  } catch (err: any) {
    console.error('⚠️ CRM sync failed (non-fatal):', err.message);
  }

  // ── 4b. CUSTOMER PROFILE SYNC ────────────────────────────────────────────────
  if (FEATURES.googleSheetsCRM) {
    try {
      await syncCustomer({ email: customerEmail, name: customerName, purchaseDate: timestamp, product: productName, amount });
    } catch (err: any) {
      console.error('⚠️ Customer sync failed (non-fatal):', err.message);
    }
  }

  return NextResponse.json({ received: true, email: emailSent });
}
