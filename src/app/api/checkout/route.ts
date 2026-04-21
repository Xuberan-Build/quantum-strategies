/**
 * Create Stripe Checkout Session
 *
 * Product configuration (success URL, promo codes) is driven by
 * product_definitions columns — no hardcoded slug checks here.
 *
 * product_definitions columns used:
 *   - post_purchase_redirect TEXT  — custom redirect after purchase (default: /dashboard)
 *   - allow_promo_codes BOOLEAN    — whether promo codes are accepted (default: true)
 *   - bundle_products JSONB        — slugs granted when this bundle is purchased
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getProductBySlug } from '@/lib/constants/products';
import { APP_URL, MARKETING_URL } from '@/lib/config/urls';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() || '', {
  apiVersion: '2025-12-15.clover',
});

export async function POST(req: NextRequest) {
  try {
    const { productSlug } = await req.json();

    if (!productSlug || typeof productSlug !== 'string') {
      return NextResponse.json({ error: 'productSlug is required' }, { status: 400 });
    }

    // Validate product exists
    const product = getProductBySlug(productSlug);
    if (!product) {
      return NextResponse.json({ error: 'Invalid product' }, { status: 400 });
    }

    // Fetch DB-driven settings for this product
    const { data: definition } = await supabaseAdmin
      .from('product_definitions')
      .select('post_purchase_redirect, allow_promo_codes, bundle_products')
      .eq('slug', productSlug)
      .single();

    // Determine success URL from product_definitions.post_purchase_redirect (default: /dashboard)
    const requestOrigin = new URL(req.url).origin;
    const appBaseUrl = APP_URL || requestOrigin;
    const marketingBaseUrl = MARKETING_URL || requestOrigin;

    const postPurchaseRedirect = definition?.post_purchase_redirect ?? '/dashboard';
    const separator = postPurchaseRedirect.includes('?') ? '&' : '?';
    const successUrl = `${appBaseUrl}${postPurchaseRedirect}${separator}session_id={CHECKOUT_SESSION_ID}`;

    // Promo codes from product_definitions.allow_promo_codes (default: true)
    const allowPromoCodes = definition?.allow_promo_codes ?? true;

    // Bundle metadata from product_definitions.bundle_products JSONB
    const bundleProducts: string[] = (definition?.bundle_products && Array.isArray(definition.bundle_products))
      ? definition.bundle_products
      : [];

    // Referral code from cookie
    const cookieStore = await cookies();
    const referralCode = cookieStore.get('referral_code')?.value || '';

    console.log('Creating checkout session:', {
      product: productSlug,
      referralCode: referralCode || 'none',
      successUrl,
      allowPromoCodes,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: `${product.estimatedDuration || '15-30 minutes'} guided experience`,
            },
            unit_amount: product.price * 100,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: `${marketingBaseUrl}/products/${productSlug}`,
      metadata: {
        product_slug: productSlug,
        referral_code: referralCode,
        ...(bundleProducts.length > 0 && { bundle_products: bundleProducts.join(',') }),
      },
      allow_promotion_codes: allowPromoCodes,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout session creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
