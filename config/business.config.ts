/**
 * Business Configuration
 *
 * Central config object sourced from environment variables.
 * Used throughout the app to eliminate hardcoded business-specific values.
 *
 * Set these in your .env.local (development) or deployment environment (production).
 */

export const BUSINESS = {
  /** Display name for your business (e.g. "Acme Corp") */
  name: process.env.BUSINESS_NAME ?? 'Your Business',

  /** Public-facing domain, no trailing slash (e.g. "https://yourdomain.com") */
  domain: process.env.NEXT_PUBLIC_DOMAIN ?? 'http://localhost:3000',

  /** Comma-separated admin email addresses */
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean),

  /** Transactional email sender */
  sender: {
    email: process.env.SENDER_EMAIL ?? 'noreply@example.com',
    name: process.env.SENDER_NAME ?? 'Your Business',
  },

  /** Brand colors — used in email templates and can be referenced in CSS vars */
  brand: {
    primary: process.env.BRAND_PRIMARY ?? '#030048',
    accent: process.env.BRAND_ACCENT ?? '#6C5CE7',
  },

  /** Optional: Google Sheet ID for CRM sync (requires FEATURE_SHEETS_CRM=true) */
  googleSheetId: process.env.GOOGLE_SHEET_ID,
} as const;
