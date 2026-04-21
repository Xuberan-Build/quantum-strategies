/**
 * Database TypeScript Types
 * Auto-generated types for Supabase database schema
 * Last updated: 2025-12-27
 */

// ============================================================================
// Email Sequences
// ============================================================================

export type EmailStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';
export type SequenceType =
  | 'affiliate_invitation'
  | 'blueprint_day1'
  | 'blueprint_day3'
  | 'blueprint_day7';
export type TriggerEvent = 'deliverable_completed';

export interface EmailContent {
  product_name: string;
  product_slug: string;
  deliverable_preview: string;
  user_first_name: string;
  user_email: string;
  closing_gate?: string;
  dashboard_url?: string;
}

export interface EmailSequence {
  id: string;
  user_id: string;

  // Sequence metadata
  sequence_type: SequenceType;
  trigger_event: TriggerEvent;
  trigger_timestamp: string; // ISO timestamp

  // Scheduling
  scheduled_send_at: string; // ISO timestamp
  delay_minutes: number;

  // Delivery status
  email_status: EmailStatus;
  sent_at: string | null; // ISO timestamp
  failed_at: string | null; // ISO timestamp
  failure_reason: string | null;
  retry_count: number;

  // Email content
  email_content: EmailContent;

  // Timestamps
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface EmailSequenceInsert {
  user_id: string;
  sequence_type: SequenceType;
  trigger_event: TriggerEvent;
  trigger_timestamp: string;
  scheduled_send_at: string;
  delay_minutes?: number;
  email_content: EmailContent;
}

export interface EmailSequenceUpdate {
  email_status?: EmailStatus;
  sent_at?: string;
  failed_at?: string;
  failure_reason?: string;
  retry_count?: number;
}

// ============================================================================
// Users
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;

  // Affiliate fields
  is_affiliate: boolean;
  total_earnings_cents: number;
  available_balance_cents: number;
  affiliate_opted_out: boolean;
  affiliate_enrolled_at: string | null;
  first_affiliate_visit: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Product Access
// ============================================================================

export interface ProductAccess {
  id: string;
  user_id: string;
  product_slug: string;
  access_granted_at: string;
  access_expires_at: string | null;
  purchase_id: string | null;
  created_at: string;
}

// ============================================================================
// Product Sessions
// ============================================================================

export interface ProductSession {
  id: string;
  user_id: string;
  product_slug: string;
  current_step: number;
  total_steps: number;
  placements: Record<string, any> | null;
  deliverable: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Conversations
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'step_insight' | 'followup' | 'final_briefing';
  timestamp?: string;
}

export interface Conversation {
  id: string;
  session_id: string;
  step_number: number;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Referral Hierarchy
// ============================================================================

export type AffiliateTrack = 'community_builder' | 'high_performer' | 'independent';

export interface ReferralHierarchy {
  id: string;
  user_id: string;
  referral_code: string;
  referral_link: string;
  referred_by_id: string | null;
  current_track: AffiliateTrack;

  // Stripe Connect
  stripe_connect_account_id: string | null;
  stripe_onboarding_completed_at: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Affiliate Transactions
// ============================================================================

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'failed';

export interface AffiliateTransaction {
  id: string;
  affiliate_user_id: string;
  purchase_id: string;
  product_slug: string;
  sale_amount_cents: number;

  // Commissions
  direct_commission_cents: number;
  override_commission_cents: number;
  total_commission_cents: number;
  commission_status: CommissionStatus;

  // Dinner party
  dinner_party_contribution_cents: number;
  dinner_party_pool_id: string | null;

  // Stripe
  stripe_transfer_id: string | null;

  // Timestamps
  created_at: string;
  paid_at: string | null;
}

// ============================================================================
// Uploaded Documents
// ============================================================================

export interface UploadedDocument {
  id: string;
  user_id: string;
  session_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  upload_purpose: string | null;
  created_at: string;
}

// ============================================================================
// Prompts
// ============================================================================

export type PromptScope = 'system' | 'step_insight' | 'followup' | 'final_briefing';

export interface Prompt {
  id: string;
  product_slug: string;
  scope: PromptScope;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Product Steps
// ============================================================================

export interface ProductStep {
  id: string;
  product_slug: string;
  step_number: number;
  step_title: string;
  question_text: string;
  input_type: string;
  is_required: boolean;
  created_at: string;
}

// ============================================================================
// Database Function Return Types
// ============================================================================

export interface AffiliateStats {
  total_referrals: number;
  total_earnings_cents: number;
  available_balance_cents: number;
  pending_earnings_cents: number;
  current_track: AffiliateTrack;
  referral_code: string;
  referral_link: string;
  stripe_onboarding_completed: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
}

export interface CommissionCalculation {
  direct_commission_cents: number;
  override_commission_cents: number;
  dinner_party_contribution_cents: number;
}
