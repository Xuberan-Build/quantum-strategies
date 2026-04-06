import { stripe } from './config';

/**
 * Create a Stripe Checkout session for RITE IV subscription
 */
export async function createCheckoutSession(params: {
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: params.email,
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
  });

  return session;
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session;
}

/**
 * Get subscription status from Stripe
 */
export async function getSubscriptionStatus(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
  return {
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
