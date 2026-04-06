import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

export const STRIPE_CONFIG = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,

  // RITE IV Product Configuration
  riteIV: {
    productName: 'RITE IV — EXECUTION',
    priceId: process.env.STRIPE_RITE_IV_PRICE_ID!,
    billingInterval: 'month' as const,
    currency: 'usd',
  },
} as const;
