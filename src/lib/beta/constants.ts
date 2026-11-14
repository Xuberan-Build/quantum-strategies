/**
 * Beta Program Constants
 * Centralized configuration for the Three Rites beta program
 */

// Google Calendar appointment booking URL
export const BETA_CALENDAR_URL = 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2UQDRNp_nLalQ1CfFQUuc8UnWK5Q8NLN-IuRZ_HniqhZGyUA1Rm9jxC5ajyT9QnHsWZC1eLt4x?gv=true';

// Google Calendar embed component
export const BETA_CALENDAR_EMBED = `
<!-- Google Calendar Appointment Scheduling begin -->
<iframe src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ2UQDRNp_nLalQ1CfFQUuc8UnWK5Q8NLN-IuRZ_HniqhZGyUA1Rm9jxC5ajyT9QnHsWZC1eLt4x?gv=true" style="border: 0" width="100%" height="600" frameborder="0"></iframe>
<!-- end Google Calendar Appointment Scheduling -->
`;

// Initiation total target pricing
export const INITIATION_PRICE = 60;

// À la carte purchasing strategy:
// - Users can buy individual products throughout journey using existing Stripe product links
// - At completion, calculate total paid: SUM(all purchases)
// - Generate personalized discount code for remaining balance: $60 - total_paid
// - Example: Bought $15 worth → offer $45 discount code to reach $60 total

// All 11 products in the Three Rites journey
export const THREE_RITES_PRODUCTS = {
  PERCEPTION: [
    'perception-rite-scan-1', // Signal Awareness
    'perception-rite-scan-2', // Value Pattern Decoder
    'perception-rite-scan-3', // Boundary & Burnout
    'perception-rite-scan-4', // Money Signal
    'perception-rite-scan-5', // Competence Mapping
  ],
  ORIENTATION: [
    'personal-alignment',
    'business-alignment',
    'brand-alignment',
  ],
  DECLARATION: [
    'declaration-rite-life-vision',
    'declaration-rite-business-model',
    'declaration-rite-strategic-path',
  ],
} as const;

// Flatten all products into a single array
export const ALL_BETA_PRODUCTS = [
  ...THREE_RITES_PRODUCTS.PERCEPTION,
  ...THREE_RITES_PRODUCTS.ORIENTATION,
  ...THREE_RITES_PRODUCTS.DECLARATION,
] as const;

// Feedback form timing configuration
export const FEEDBACK_TIMING = {
  FIRST_PRODUCT: 30000, // 30 seconds (gives time to read deliverable)
  SUBSEQUENT_PRODUCTS: 10000, // 10 seconds (pattern established)
  CONSOLIDATION: 0, // Trigger immediately on completion, not time-based
} as const;

// Beta program dates (adjust as needed)
export const BETA_PROGRAM = {
  COHORT_NAME: 'Dinner Cohort 1',
  DURATION_WEEKS: 6,
} as const;

// Helper function to determine if a product is the first one
export function isFirstProduct(productSlug: string): boolean {
  return productSlug === THREE_RITES_PRODUCTS.PERCEPTION[0];
}

// Helper function to determine which Rite a product belongs to
export function getRiteForProduct(productSlug: string): 'perception' | 'orientation' | 'declaration' | null {
  if (THREE_RITES_PRODUCTS.PERCEPTION.includes(productSlug as any)) {
    return 'perception';
  }
  if (THREE_RITES_PRODUCTS.ORIENTATION.includes(productSlug as any)) {
    return 'orientation';
  }
  if (THREE_RITES_PRODUCTS.DECLARATION.includes(productSlug as any)) {
    return 'declaration';
  }
  return null;
}

// Helper function to get product position in journey
export function getProductPosition(productSlug: string): number {
  const index = ALL_BETA_PRODUCTS.indexOf(productSlug as any);
  return index === -1 ? 0 : index + 1; // 1-indexed
}

// Helper function to determine feedback timing for a product
export function getFeedbackTiming(productSlug: string): number {
  if (isFirstProduct(productSlug)) {
    return FEEDBACK_TIMING.FIRST_PRODUCT;
  }
  return FEEDBACK_TIMING.SUBSEQUENT_PRODUCTS;
}
