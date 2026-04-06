import { sendEmail } from './gmail-sender';
import { getDay1Template } from './templates/day-1-check-in';
import { getDay3Template } from './templates/day-3-value-reminder';
import { getDay7Template } from './templates/day-7-upsell';
import { getProductBySlug } from '../constants/products';
import { BUSINESS } from '../../../config/business.config';

export interface PurchaseRecord {
  timestamp: string;
  email: string;
  name: string;
  product: string;
  productSlug: string;
  day1EmailSent?: string;
  day3EmailSent?: string;
  day7EmailSent?: string;
  sequenceStatus?: string;
}

/**
 * Calculate days since purchase
 */
export function calculateDaysSince(timestamp: string): number {
  const purchaseDate = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - purchaseDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get next product for upsell based on current product
 */
function getNextProduct(productSlug: string): { name: string; link: string } | null {
  // Define product progression
  const progression: Record<string, { slug: string; url: string }> = {
    'business-alignment': {
      slug: 'quantum-structure-profit-scale',
      url: 'https://www.quantumstrategies.online/products/quantum-structure-profit-scale'
    },
  };

  const nextProduct = progression[productSlug];
  if (!nextProduct) return null;

  const product = getProductBySlug(nextProduct.slug);
  return product ? { name: product.name, link: nextProduct.url } : null;
}

/**
 * Send Day 1 check-in email
 */
export async function sendDay1Email(purchase: PurchaseRecord): Promise<void> {
  const product = getProductBySlug(purchase.productSlug);
  if (!product) {
    throw new Error(`Product not found: ${purchase.productSlug}`);
  }

  const template = getDay1Template({
    name: purchase.name,
    product_name: product.name,
    gpt_link: product.gptLink ?? '',
    unsubscribe_link: `${BUSINESS.domain}/unsubscribe?email=${encodeURIComponent(purchase.email)}`,
  });

  await sendEmail({
    to: purchase.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    fromEmail: product.fromEmail,
    fromName: product.fromName,
  });
}

/**
 * Send Day 3 value reminder email
 */
export async function sendDay3Email(purchase: PurchaseRecord): Promise<void> {
  const product = getProductBySlug(purchase.productSlug);
  if (!product) {
    throw new Error(`Product not found: ${purchase.productSlug}`);
  }

  const template = getDay3Template({
    name: purchase.name,
    product_name: product.name,
    gpt_link: product.gptLink ?? '',
    unsubscribe_link: `${BUSINESS.domain}/unsubscribe?email=${encodeURIComponent(purchase.email)}`,
  });

  await sendEmail({
    to: purchase.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    fromEmail: product.fromEmail,
    fromName: product.fromName,
  });
}

/**
 * Send Day 7 upsell email
 */
export async function sendDay7Email(purchase: PurchaseRecord): Promise<void> {
  const product = getProductBySlug(purchase.productSlug);
  if (!product) {
    throw new Error(`Product not found: ${purchase.productSlug}`);
  }

  const nextProduct = getNextProduct(purchase.productSlug);
  if (!nextProduct) {
    console.log(`No upsell product defined for: ${purchase.productSlug}`);
    return; // Skip if no next product
  }

  const template = getDay7Template({
    name: purchase.name,
    product_name: product.name,
    next_product_name: nextProduct.name,
    next_product_link: nextProduct.link,
    unsubscribe_link: `${BUSINESS.domain}/unsubscribe?email=${encodeURIComponent(purchase.email)}`,
  });

  await sendEmail({
    to: purchase.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    fromEmail: product.fromEmail,
    fromName: product.fromName,
  });
}

/**
 * Determine which email (if any) should be sent for a purchase record
 */
export function determineEmailToSend(purchase: PurchaseRecord): 'day1' | 'day3' | 'day7' | null {
  // Skip if unsubscribed
  if (purchase.sequenceStatus === 'unsubscribed') {
    return null;
  }

  const daysSincePurchase = calculateDaysSince(purchase.timestamp);

  // Check in reverse order (prioritize later emails if multiple are due)
  if (daysSincePurchase >= 7 && !purchase.day7EmailSent) {
    return 'day7';
  }
  if (daysSincePurchase >= 3 && !purchase.day3EmailSent) {
    return 'day3';
  }
  if (daysSincePurchase >= 1 && !purchase.day1EmailSent) {
    return 'day1';
  }

  return null;
}
