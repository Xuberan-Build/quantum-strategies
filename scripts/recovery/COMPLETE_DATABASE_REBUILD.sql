-- =====================================================
-- QUANTUM STRATEGIES - Complete Database Schema
-- Disaster Recovery Script
-- Generated for complete database rebuild
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function first
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CORE USERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_affiliate BOOLEAN DEFAULT FALSE,
  affiliate_enrolled_at TIMESTAMP WITH TIME ZONE,
  affiliate_opted_out BOOLEAN DEFAULT FALSE,
  first_affiliate_visit TIMESTAMP WITH TIME ZONE,
  total_earnings_cents INTEGER DEFAULT 0,
  available_balance_cents INTEGER DEFAULT 0,
  total_withdrawn_cents INTEGER DEFAULT 0,
  dinner_party_credits_cents INTEGER DEFAULT 0,
  placements JSONB,
  placements_confirmed BOOLEAN DEFAULT FALSE,
  placements_updated_at TIMESTAMP WITH TIME ZONE,
  role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin', 'super_admin'))
);

-- =====================================================
-- PRODUCT DEFINITIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS product_definitions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  steps JSONB NOT NULL,
  system_prompt TEXT NOT NULL,
  final_deliverable_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4',
  estimated_duration TEXT,
  total_steps INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  instructions JSONB,
  product_group TEXT,
  display_order INTEGER,
  is_purchasable BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- PRODUCT ACCESS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS product_access (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_session_id TEXT,
  amount_paid NUMERIC(10, 2),
  access_granted BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  free_attempts_used INTEGER DEFAULT 0,
  free_attempts_limit INTEGER DEFAULT 2,
  purchase_source TEXT,
  bundle_slug TEXT,
  UNIQUE(user_id, product_slug)
);

-- =====================================================
-- PRODUCT SESSIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS product_sessions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 5,
  is_complete BOOLEAN DEFAULT FALSE,
  step_data JSONB DEFAULT '{}',
  deliverable_content TEXT,
  deliverable_url TEXT,
  deliverable_generated_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  placements JSONB,
  placements_confirmed BOOLEAN DEFAULT FALSE NOT NULL,
  current_section INTEGER DEFAULT 1 NOT NULL,
  followup_counts JSONB DEFAULT '{}' NOT NULL,
  version INTEGER DEFAULT 1,
  parent_session_id UUID REFERENCES product_sessions(id) ON DELETE SET NULL,
  is_latest_version BOOLEAN DEFAULT TRUE,
  scan_number INTEGER,
  parent_product_slug TEXT
);

-- =====================================================
-- CONVERSATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES product_sessions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  follow_up_count INTEGER DEFAULT 0,
  max_follow_ups INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, step_number)
);

-- =====================================================
-- UPLOADED DOCUMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES product_sessions(id) ON DELETE CASCADE,
  step_number INTEGER,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AFFILIATE SYSTEM TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS referral_hierarchy (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  affiliate_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referral_link TEXT NOT NULL,
  current_track TEXT DEFAULT 'community_builder' NOT NULL CHECK (current_track IN ('community_builder', 'high_performer', 'independent')),
  stripe_connect_account_id TEXT,
  stripe_connect_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_connect_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_connect_payouts_enabled BOOLEAN DEFAULT FALSE,
  total_referrals INTEGER DEFAULT 0,
  active_referrals INTEGER DEFAULT 0,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_transactions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  purchaser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  direct_referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  override_referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  direct_commission_cents INTEGER DEFAULT 0,
  override_commission_cents INTEGER DEFAULT 0,
  direct_track TEXT,
  override_track TEXT,
  direct_transfer_id TEXT,
  override_transfer_id TEXT,
  dinner_party_contribution_cents INTEGER DEFAULT 0,
  commission_status TEXT DEFAULT 'pending' CHECK (commission_status IN ('pending', 'processing', 'paid', 'failed')),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_connect_onboarding (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  onboarding_url TEXT,
  onboarding_expires_at TIMESTAMP WITH TIME ZONE,
  details_submitted BOOLEAN DEFAULT FALSE,
  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,
  requirements JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS track_changes (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_track TEXT NOT NULL CHECK (previous_track IN ('community_builder', 'high_performer', 'independent')),
  new_track TEXT NOT NULL CHECK (new_track IN ('community_builder', 'high_performer', 'independent')),
  reason TEXT,
  changed_by_user_id UUID REFERENCES users(id),
  change_type TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence_type TEXT NOT NULL CHECK (sequence_type = 'affiliate_invitation'),
  trigger_event TEXT,
  trigger_timestamp TIMESTAMP WITH TIME ZONE,
  scheduled_send_at TIMESTAMP WITH TIME ZONE,
  delay_minutes INTEGER DEFAULT 30 NOT NULL CHECK (delay_minutes >= 0),
  email_status TEXT DEFAULT 'scheduled' CHECK (email_status IN ('scheduled', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  email_content JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =====================================================
-- DINNER PARTY TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS dinner_party_pools (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  pool_name TEXT NOT NULL,
  target_amount_cents INTEGER DEFAULT 50000 NOT NULL,
  current_amount_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'funded', 'completed', 'cancelled')),
  event_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dinner_party_contributions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  pool_id UUID NOT NULL REFERENCES dinner_party_pools(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES affiliate_transactions(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  is_credit BOOLEAN DEFAULT TRUE,
  redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUDIT LOGGING TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_action TEXT NOT NULL,
  event_status TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  request_method TEXT,
  request_path TEXT,
  request_body JSONB,
  response_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  error_stack TEXT,
  error_code TEXT,
  metadata JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_email_hash TEXT,
  trace_id UUID,
  log_level TEXT DEFAULT 'INFO',
  is_sampled BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'product_create', 'product_update', 'product_delete',
    'step_create', 'step_update', 'step_delete', 'step_reorder',
    'prompt_create', 'prompt_update', 'prompt_delete', 'prompt_rollback',
    'user_role_change', 'admin_login', 'admin_logout',
    'test_simulate'
  )),
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  previous_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- BETA PROGRAM TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS beta_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  cohort_name TEXT DEFAULT 'Beta Cohort' NOT NULL,
  enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  program_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  program_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '42 days') NOT NULL,
  application_why_participate TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'withdrawn')),
  current_rite TEXT DEFAULT 'perception' CHECK (current_rite IN ('perception', 'orientation', 'declaration', 'complete')),
  perception_completed_count INTEGER DEFAULT 0,
  orientation_completed_count INTEGER DEFAULT 0,
  declaration_completed_count INTEGER DEFAULT 0,
  total_completion_percentage NUMERIC(5,2) DEFAULT 0.00,
  micro_feedback_count INTEGER DEFAULT 0,
  consolidation_feedback_count INTEGER DEFAULT 0,
  complete_journey_submitted BOOLEAN DEFAULT FALSE,
  feedback_completion_rate NUMERIC(5,2) DEFAULT 0.00,
  total_amount_paid_before_offer NUMERIC(10,2) DEFAULT 0.00,
  summary_pdf_generated BOOLEAN DEFAULT FALSE,
  summary_pdf_url TEXT,
  conversion_offer_presented_at TIMESTAMP WITH TIME ZONE,
  discount_code_generated TEXT,
  remaining_balance_offered NUMERIC(10,2),
  conversion_decision TEXT CHECK (conversion_decision IN ('purchased', 'declined', 'pending')),
  conversion_decision_at TIMESTAMP WITH TIME ZONE,
  conversion_amount NUMERIC(10,2),
  conversion_stripe_session_id TEXT,
  welcome_email_sent_at TIMESTAMP WITH TIME ZONE,
  week_1_checkin_sent_at TIMESTAMP WITH TIME ZONE,
  week_2_checkin_sent_at TIMESTAMP WITH TIME ZONE,
  week_4_checkin_sent_at TIMESTAMP WITH TIME ZONE,
  rite_one_celebration_sent_at TIMESTAMP WITH TIME ZONE,
  rite_two_celebration_sent_at TIMESTAMP WITH TIME ZONE,
  rite_three_celebration_sent_at TIMESTAMP WITH TIME ZONE,
  completion_email_sent_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS beta_conversion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL UNIQUE REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_presented_at TIMESTAMP WITH TIME ZONE NOT NULL,
  offer_amount NUMERIC(10,2) NOT NULL,
  offer_type TEXT DEFAULT 'founding_member' NOT NULL,
  total_paid_before_offer NUMERIC(10,2) DEFAULT 0.00,
  discount_code_offered TEXT,
  discount_amount NUMERIC(10,2),
  purchased_at_stage TEXT CHECK (purchased_at_stage IN ('during_rite_one', 'during_rite_two', 'during_rite_three', 'after_completion', 'never')),
  decision TEXT NOT NULL CHECK (decision IN ('purchased', 'declined', 'pending')),
  decision_made_at TIMESTAMP WITH TIME ZONE,
  purchased_at TIMESTAMP WITH TIME ZONE,
  stripe_session_id TEXT,
  amount_paid NUMERIC(10,2),
  final_total_investment NUMERIC(10,2),
  payment_plan TEXT,
  decline_reason TEXT,
  decline_feedback TEXT,
  future_interest BOOLEAN,
  follow_up_scheduled BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =====================================================
-- FEEDBACK TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS scan_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  session_id UUID REFERENCES product_sessions(id) ON DELETE SET NULL,
  clarity_score INTEGER CHECK (clarity_score >= 1 AND clarity_score <= 5),
  relevance_score INTEGER CHECK (relevance_score >= 1 AND relevance_score <= 5),
  actionability_score INTEGER CHECK (actionability_score >= 1 AND actionability_score <= 5),
  surprise_level INTEGER CHECK (surprise_level >= 1 AND surprise_level <= 5),
  biggest_aha TEXT,
  implementation_plan TEXT,
  confusion_points TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  survey_duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS blueprint_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  session_id UUID REFERENCES product_sessions(id) ON DELETE SET NULL,
  insight_depth_score INTEGER CHECK (insight_depth_score >= 1 AND insight_depth_score <= 5),
  personalization_score INTEGER CHECK (personalization_score >= 1 AND personalization_score <= 5),
  actionability_score INTEGER CHECK (actionability_score >= 1 AND actionability_score <= 5),
  immediate_action TEXT,
  biggest_gap_revealed TEXT,
  integration_with_perception TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  survey_duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS declaration_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_slug TEXT NOT NULL,
  session_id UUID REFERENCES product_sessions(id) ON DELETE SET NULL,
  commitment_clarity_score INTEGER CHECK (commitment_clarity_score >= 1 AND commitment_clarity_score <= 5),
  execution_confidence_score INTEGER CHECK (execution_confidence_score >= 1 AND execution_confidence_score <= 5),
  alignment_score INTEGER CHECK (alignment_score >= 1 AND alignment_score <= 5),
  decision_made TEXT,
  commitment_level INTEGER CHECK (commitment_level >= 1 AND commitment_level <= 10),
  support_needed TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  survey_duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS rite_one_consolidation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_value_score INTEGER CHECK (overall_value_score >= 1 AND overall_value_score <= 10),
  completion_time_weeks NUMERIC(3,1),
  rite_one_nps INTEGER CHECK (rite_one_nps >= 0 AND rite_one_nps <= 10),
  most_valuable_scan TEXT,
  least_valuable_scan TEXT,
  key_transformation TEXT,
  integration_challenge TEXT,
  breakthrough_moment TEXT,
  perceived_value_vs_price TEXT CHECK (perceived_value_vs_price IN ('much_less', 'less', 'equal', 'more', 'much_more')),
  would_recommend BOOLEAN,
  testimonial_consent BOOLEAN DEFAULT FALSE,
  testimonial_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  survey_duration_seconds INTEGER,
  reminded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS rite_two_consolidation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  overall_value_score INTEGER CHECK (overall_value_score >= 1 AND overall_value_score <= 10),
  completion_time_weeks NUMERIC(3,1),
  rite_two_nps INTEGER CHECK (rite_two_nps >= 0 AND rite_two_nps <= 10),
  most_valuable_blueprint TEXT,
  least_valuable_blueprint TEXT,
  strategic_clarity_before INTEGER CHECK (strategic_clarity_before >= 1 AND strategic_clarity_before <= 10),
  strategic_clarity_after INTEGER CHECK (strategic_clarity_after >= 1 AND strategic_clarity_after <= 10),
  business_model_confidence TEXT,
  perceived_value_vs_price TEXT CHECK (perceived_value_vs_price IN ('much_less', 'less', 'equal', 'more', 'much_more')),
  would_recommend BOOLEAN,
  testimonial_consent BOOLEAN DEFAULT FALSE,
  testimonial_text TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  survey_duration_seconds INTEGER,
  reminded_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS complete_journey_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beta_participant_id UUID NOT NULL REFERENCES beta_participants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transformation_score INTEGER CHECK (transformation_score >= 1 AND transformation_score <= 10),
  clarity_gained INTEGER CHECK (clarity_gained >= 1 AND clarity_gained <= 10),
  confidence_gained INTEGER CHECK (confidence_gained >= 1 AND confidence_gained <= 10),
  direction_clarity INTEGER CHECK (direction_clarity >= 1 AND direction_clarity <= 10),
  journey_coherence_score INTEGER CHECK (journey_coherence_score >= 1 AND journey_coherence_score <= 10),
  rite_integration_score INTEGER CHECK (rite_integration_score >= 1 AND rite_integration_score <= 10),
  most_valuable_rite TEXT CHECK (most_valuable_rite IN ('perception', 'orientation', 'declaration')),
  most_valuable_product_overall TEXT,
  least_valuable_product_overall TEXT,
  before_journey_state TEXT,
  after_journey_state TEXT,
  biggest_breakthrough TEXT,
  unexpected_insight TEXT,
  perceived_total_value_vs_60 TEXT CHECK (perceived_total_value_vs_60 IN ('much_less', 'less', 'equal', 'more', 'much_more')),
  willingness_to_pay_amount NUMERIC(10,2),
  purchase_timeline TEXT CHECK (purchase_timeline IN ('immediate', '1_month', '3_months', 'no')),
  what_would_make_you_say_yes TEXT,
  nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
  would_refer_others BOOLEAN,
  referral_commitment_count INTEGER DEFAULT 0,
  founding_member_interest TEXT CHECK (founding_member_interest IN ('definitely', 'probably', 'maybe', 'probably_not', 'definitely_not')),
  founding_member_decision_factors TEXT,
  testimonial_consent BOOLEAN DEFAULT FALSE,
  testimonial_text TEXT,
  video_testimonial_interest BOOLEAN DEFAULT FALSE,
  what_worked_best TEXT,
  what_needs_improvement TEXT,
  missing_elements TEXT,
  additional_support_needed TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  survey_duration_seconds INTEGER
);

-- =====================================================
-- COURSE TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS course_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_slug TEXT NOT NULL REFERENCES course_definitions(slug) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_slug, module_id)
);

CREATE TABLE IF NOT EXISTS course_submodules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_slug TEXT NOT NULL,
  module_id TEXT NOT NULL,
  submodule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER DEFAULT 0 NOT NULL,
  start_coord TEXT NOT NULL,
  end_coord TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(course_slug, module_id, submodule_id)
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL REFERENCES course_definitions(slug) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL REFERENCES course_definitions(slug) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  submodule_id TEXT,
  current_coord TEXT,
  max_coord TEXT,
  max_coord_x INTEGER,
  max_coord_y INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS course_slide_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL REFERENCES course_definitions(slug) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  submodule_id TEXT,
  coord TEXT NOT NULL,
  coord_x INTEGER,
  coord_y INTEGER,
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CONTENT & PROMPTS TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS content_index (
  doc_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  path TEXT NOT NULL,
  parent_id TEXT,
  modified_time TIMESTAMP WITH TIME ZONE,
  depth INTEGER DEFAULT 0 NOT NULL,
  is_folder BOOLEAN DEFAULT FALSE NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug TEXT NOT NULL,
  scope TEXT NOT NULL,
  step_number INTEGER,
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUTH TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_product_access_user ON product_access(user_id);
CREATE INDEX IF NOT EXISTS idx_product_access_slug ON product_access(product_slug);
CREATE INDEX IF NOT EXISTS idx_product_sessions_user ON product_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_product_sessions_slug ON product_sessions(product_slug);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_participants_user ON beta_participants(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_definitions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_select_own ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_own ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_service ON users FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Product access policies
CREATE POLICY pa_select_own ON product_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pa_service ON product_access FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Product definitions - public read
CREATE POLICY pd_select ON product_definitions FOR SELECT USING (is_active = true);
CREATE POLICY pd_service ON product_definitions FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Sessions policies
CREATE POLICY ps_select_own ON product_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ps_insert_own ON product_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ps_update_own ON product_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ps_service ON product_sessions FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Conversations policies
CREATE POLICY conv_select ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM product_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY conv_insert ON conversations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM product_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY conv_update ON conversations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM product_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY conv_service ON conversations FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW error_logs AS
SELECT al.user_id, u.email, al.event_type, al.event_action, al.error_message,
       al.error_stack, al.error_code, al.request_path, al.metadata, al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.event_status = 'error'
ORDER BY al.created_at DESC;

CREATE OR REPLACE VIEW recent_user_activity AS
SELECT al.user_id, u.email, NULL::TEXT AS full_name, al.event_type, al.event_action,
       al.event_status, al.error_message, al.metadata, al.created_at
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.created_at > NOW() - INTERVAL '7 days'
ORDER BY al.created_at DESC;

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$ BEGIN RAISE NOTICE 'Database rebuild complete - 37 tables created'; END $$;
