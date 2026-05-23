/**
 * Client-side Stripe Checkout helper
 * Creates checkout session with referral tracking
 */

export async function createCheckoutSession(productSlug: string): Promise<string> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productSlug }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  const { url } = await response.json();
  return url;
}

/**
 * Redirect to Stripe Checkout — throws on failure so the caller can handle it.
 */
export async function redirectToCheckout(productSlug: string): Promise<void> {
  const url = await createCheckoutSession(productSlug);
  window.location.href = url;
}
