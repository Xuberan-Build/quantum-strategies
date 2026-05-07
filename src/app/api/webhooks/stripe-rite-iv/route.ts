import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe/config';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_CONFIG.webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    throw new Error('No customer email in checkout session');
  }

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', customerEmail)
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Using inviteUserByEmail instead of createUser(email_confirm:true) to prevent
    // account pre-emption attacks where an attacker pays with a victim's email.
    // New buyers receive a setup email; subscription is provisioned immediately.
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(customerEmail);

    if (inviteError || !inviteData?.user) {
      throw new Error(`Failed to invite user: ${inviteError?.message}`);
    }

    userId = inviteData.user.id;
  }

  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      current_period_end: null,
    });

  if (subError) {
    throw new Error(`Failed to create subscription: ${subError.message}`);
  }

  console.log(`✅ Subscription provisioned for user ${userId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`✅ Subscription ${subscriptionId} marked active`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`⚠️ Subscription ${subscriptionId} marked past_due`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }

  console.log(`❌ Subscription ${subscriptionId} cancelled`);
}
