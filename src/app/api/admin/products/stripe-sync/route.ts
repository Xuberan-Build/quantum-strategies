import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { validateAdminApiRequest } from '@/lib/admin/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  let body: { stripe_product_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { stripe_product_id } = body;
  if (!stripe_product_id?.trim()) {
    return NextResponse.json({ error: 'stripe_product_id is required' }, { status: 400 });
  }

  try {
    const product = await stripe.products.retrieve(stripe_product_id.trim());

    let default_price_id: string | null = null;
    if (product.default_price) {
      default_price_id = typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price.id;
    }

    return NextResponse.json({
      stripe_product_id: product.id,
      product_name: product.name,
      default_price_id,
    });
  } catch (err) {
    const stripeErr = err as { message?: string; code?: string };
    const message = stripeErr.message ?? 'Stripe request failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
