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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

export async function POST(request: NextRequest) {
  console.log('Stripe webhook received');

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

  const session = stripeEvent.data.object as Stripe.Checkout.Session;

  console.log('=== CHECKOUT SESSION COMPLETED ===');
  console.log('Session ID:', session.id);
  console.log('Customer Email:', session.customer_details?.email);
  console.log('Amount:', session.amount_total);
  console.log('Metadata:', session.metadata);

  const customerEmail = session.customer_details?.email;
  const customerName = session.customer_details?.name || 'there';
  const amount = (session.amount_total || 0) / 100;

  if (!customerEmail) {
    console.error('No customer email found');
    return NextResponse.json({ error: 'No customer email' }, { status: 400 });
  }

  // Resolve product slug from metadata → success URL → fallback
  let productSlug = session.metadata?.product_slug || '';
  if (!productSlug && session.success_url) {
    const urlMatch = session.success_url.match(/\/products\/([^/]+)\//);
    if (urlMatch?.[1]) productSlug = urlMatch[1];
  }
  if (!productSlug) {
    console.error('Could not determine product slug from session');
    return NextResponse.json({ error: 'Unknown product' }, { status: 400 });
  }

  // Validate product exists (constants or DB — just used for fallback name here)
  const product = getProductBySlug(productSlug);
  const productName = product?.name ?? productSlug;

  console.log('Product slug:', productSlug, '— name:', productName);

  const timestamp = new Date().toISOString();
  let emailSent = '❌ Failed';

  // ── 1. GRANT ACCESS ─────────────────────────────────────────────────────────
  let accessResult = { userId: '', productsGranted: [productSlug], productAccessIds: [] as string[] };
  try {
    accessResult = await grantProductAccess({
      customerEmail,
      customerName,
      productSlug,
      sessionId: session.id,
      amountPaid: amount,
      purchaseDate: timestamp,
    });
  } catch (err: any) {
    console.error('⚠️ Grant access failed (non-fatal):', err.message);
  }

  // ── 2. SEND WELCOME EMAIL ────────────────────────────────────────────────────
  try {
    await sendWelcomeEmail({
      to: customerEmail,
      name: customerName,
      productName,
      productSlug,
      productsGranted: accessResult.productsGranted,
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
