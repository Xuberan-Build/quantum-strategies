/**
 * Feature Flags
 *
 * Toggle optional capabilities on/off via environment variables.
 * Set the corresponding env var to "true" to enable a feature.
 *
 * Optional database migrations:
 *   FEATURE_AFFILIATES=true  → also run supabase/optional/affiliates.sql
 *   FEATURE_BETA=true        → also run supabase/optional/beta.sql
 */

function flag(envVar: string): boolean {
  return process.env[envVar]?.toLowerCase() === 'true';
}

export const FEATURES = {
  /**
   * Affiliate / referral system
   * Enables: affiliate tab in dashboard, referral tracking, Stripe Connect payouts
   * Requires: supabase/optional/affiliates.sql to be applied
   */
  affiliates: flag('FEATURE_AFFILIATES'),

  /**
   * Automated email sequences (Day 1 / 3 / 7 post-purchase)
   * Enables: cron job processing of email_sequences table
   */
  emailSequences: flag('FEATURE_EMAIL_SEQUENCES'),

  /**
   * Google Sheets CRM sync
   * Enables: syncing new purchases to a Google Sheet
   * Requires: GOOGLE_SHEET_ID, GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY
   */
  googleSheetsCRM: flag('FEATURE_SHEETS_CRM'),

  /**
   * Beta program
   * Enables: beta enrollment, feedback forms, beta-specific pages
   * Requires: supabase/optional/beta.sql to be applied
   */
  beta: flag('FEATURE_BETA'),
} as const;
