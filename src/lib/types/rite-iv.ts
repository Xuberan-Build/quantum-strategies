// =====================================================
// RITE IV — EXECUTION
// TypeScript Type Definitions
// =====================================================

export type CommitmentStatus = 'OPEN' | 'DELIVERED' | 'BREACHED' | 'REPLACED';
export type RiteSource = 'RITE_I' | 'RITE_II' | 'RITE_III' | 'ONGOING';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled';

// =====================================================
// ALIGNMENT LEDGER
// =====================================================

export interface AlignmentLedgerEntry {
  id: string;
  user_id: string;
  week_start: string; // ISO date string (YYYY-MM-DD)
  decisions_made: string;
  actions_shipped: string;
  signal_logged: string;
  drift_detected: string;
  submitted_at: string; // ISO timestamp
}

export interface AlignmentLedgerFormData {
  decisions_made: string;
  actions_shipped: string;
  signal_logged: string;
  drift_detected: string;
}

// =====================================================
// COMMITMENTS
// =====================================================

export interface Commitment {
  id: string;
  user_id: string;
  source_rite: RiteSource;
  declared_text: string;
  declared_at: string; // ISO timestamp
  status: CommitmentStatus;
  delivered_at: string | null;
  breach_log: string | null;
  replaced_by: string | null;
}

export interface CommitmentFormData {
  declared_text: string;
  source_rite: RiteSource;
}

export interface CommitmentStatusUpdate {
  status: CommitmentStatus;
  delivered_at?: string;
  breach_log?: string;
  replaced_by?: string;
}

// =====================================================
// PROFILE
// =====================================================

export interface Profile {
  id: string;
  user_id: string;
  system_config: Record<string, any>; // JSONB from Rites I-III
  canonical_identity: string[];
  current_offer: string;
  current_price: number;
  current_channel: string;
  current_target: string;
  reconfig_log: ReconfigLogEntry[];
  locked_at: string; // ISO timestamp
  last_updated: string; // ISO timestamp
}

export interface ReconfigLogEntry {
  changed_at: string; // ISO timestamp
  reason: string;
  fields_changed: string[];
}

export interface ProfileReconfigFormData {
  reason: string;
  changes: {
    current_offer?: string;
    current_price?: number;
    current_channel?: string;
    current_target?: string;
    canonical_identity?: string[];
  };
}

// =====================================================
// SUBSCRIPTION
// =====================================================

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// =====================================================
// ONBOARDING
// =====================================================

export interface OnboardingData {
  // Rite I-III outputs to be imported
  system_config: Record<string, any>;
  canonical_identity: string[];
  current_offer: string;
  current_price: number;
  current_channel: string;
  current_target: string;
  initial_commitments: Array<{
    source_rite: RiteSource;
    declared_text: string;
  }>;
}

// =====================================================
// DASHBOARD
// =====================================================

export interface DashboardData {
  profile: Profile;
  subscription: Subscription;
  thisWeekSubmitted: boolean;
  openCommitmentCount: number;
  lastProfileUpdate: string | null;
}
