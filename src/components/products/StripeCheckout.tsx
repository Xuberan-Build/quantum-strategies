"use client";

import { useState } from "react";
import { redirectToCheckout } from "@/lib/stripe/checkout";
import styles from "./stripe-checkout.module.css";

interface StripeCheckoutProps {
  paymentLink?: string;
  productName: string;
  price: number;
  productSlug?: string;
}

export default function StripeCheckout({ paymentLink, productName, price, productSlug }: StripeCheckoutProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const handleCheckout = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    let navigating = false;

    try {
      if (productSlug) {
        await redirectToCheckout(productSlug);
        navigating = true;
        return;
      }

      if (paymentLink) {
        window.location.href = paymentLink;
        navigating = true;
        return;
      }

      console.error("No checkout configuration available");
      alert("Payment not configured. Please contact support.");
    } catch (error: any) {
      const message: string = error?.message || '';
      console.error("Checkout error:", error);

      if (message.toLowerCase().includes('sign in')) {
        navigating = true;
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      alert("Checkout failed. Please try again or contact support.");
    } finally {
      if (!navigating) setIsProcessing(false);
    }
  };

  // Show error state if keys are missing
  if (!publishableKey) {
    return (
      <div className={styles.checkoutContainer}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>⚠️ Stripe Not Configured</p>
          <p className={styles.placeholderText}>
            Add your Stripe keys to the <code>.env</code> file to enable payments.
          </p>
        </div>
      </div>
    );
  }

  // Show error if payment link is missing and API checkout cannot be used
  if (!paymentLink && !productSlug) {
    return (
      <div className={styles.checkoutContainer}>
        <div className={styles.placeholder}>
          <p className={styles.placeholderTitle}>⚠️ Payment Not Configured</p>
          <p className={styles.placeholderText}>
            Product requires a payment link to be configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.checkoutContainer}>
      <button
        onClick={handleCheckout}
        className={styles.checkoutButton}
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing...' : `Purchase ${productName} - $${price}`}
      </button>
      <p className={styles.checkoutNote}>
        Secure checkout powered by Stripe • Instant access
      </p>
    </div>
  );
}
