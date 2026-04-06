-- =====================================================
-- RITE IV — EXECUTION
-- Database Schema Migration
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE commitment_status AS ENUM ('OPEN','DELIVERED','BREACHED','REPLACED');
CREATE TYPE rite_source AS ENUM ('RITE_I','RITE_II','RITE_III','ONGOING');
CREATE TYPE subscription_status AS ENUM ('active','past_due','cancelled');

-- =====================================================
-- ALIGNMENT LEDGER TABLE
-- Weekly self-reported accountability log
-- =====================================================

CREATE TABLE alignment_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  decisions_made  TEXT NOT NULL,
  actions_shipped TEXT NOT NULL,
  signal_logged   TEXT NOT NULL,
  drift_detected  TEXT NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (user_id, week_start)
);

CREATE INDEX idx_alignment_ledger_user_id ON alignment_ledger(user_id);
CREATE INDEX idx_alignment_ledger_week_start ON alignment_ledger(week_start);

ALTER TABLE alignment_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their ledger"
  ON alignment_ledger
  FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE alignment_ledger IS 'Weekly accountability check-ins for RITE IV clients';

-- =====================================================
-- COMMITMENTS TABLE
-- Permanent record of all commitments and their status
-- =====================================================

CREATE TABLE commitments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_rite    rite_source NOT NULL,
  declared_text  TEXT NOT NULL,
  declared_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         commitment_status NOT NULL DEFAULT 'OPEN',
  delivered_at   TIMESTAMPTZ,
  breach_log     TEXT,
  replaced_by    UUID REFERENCES commitments(id),
  
  CONSTRAINT breach_requires_log
    CHECK (status != 'BREACHED' OR breach_log IS NOT NULL),
  CONSTRAINT replaced_requires_ref
    CHECK (status != 'REPLACED' OR replaced_by IS NOT NULL)
);

CREATE INDEX idx_commitments_user_id ON commitments(user_id);
CREATE INDEX idx_commitments_status ON commitments(status);
CREATE INDEX idx_commitments_source_rite ON commitments(source_rite);

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their commitments"
  ON commitments
  FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE commitments IS 'Permanent integrity ledger of all commitments';

-- =====================================================
-- PROFILES TABLE
-- Canonical source of truth for client configuration
-- =====================================================

CREATE TABLE profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  system_config       JSONB NOT NULL DEFAULT '{}',
  canonical_identity  TEXT[] NOT NULL DEFAULT '{}',
  current_offer       TEXT NOT NULL,
  current_price       NUMERIC NOT NULL,
  current_channel     TEXT NOT NULL,
  current_target      TEXT NOT NULL,
  reconfig_log        JSONB[] NOT NULL DEFAULT '{}',
  locked_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their profile"
  ON profiles
  FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE profiles IS 'Locked configuration from Rites I-III';

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- Stripe subscription tracking for RITE IV access
-- =====================================================

CREATE TABLE subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id       TEXT NOT NULL,
  stripe_subscription_id   TEXT NOT NULL,
  status                   subscription_status NOT NULL DEFAULT 'active',
  current_period_end       TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE subscriptions IS 'RITE IV subscription status and billing';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to reconfigure profile (atomic update with logging)
CREATE OR REPLACE FUNCTION reconfig_profile(
  p_user_id UUID,
  p_changes JSONB,
  p_log_entry JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET
    current_offer = COALESCE((p_changes->>'current_offer')::TEXT, current_offer),
    current_price = COALESCE((p_changes->>'current_price')::NUMERIC, current_price),
    current_channel = COALESCE((p_changes->>'current_channel')::TEXT, current_channel),
    current_target = COALESCE((p_changes->>'current_target')::TEXT, current_target),
    canonical_identity = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_changes->'canonical_identity')),
      canonical_identity
    ),
    reconfig_log = reconfig_log || p_log_entry,
    last_updated = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ISO week Monday
CREATE OR REPLACE FUNCTION get_iso_week_monday(p_date DATE DEFAULT CURRENT_DATE)
RETURNS DATE AS $$
BEGIN
  RETURN p_date - (EXTRACT(ISODOW FROM p_date)::INTEGER - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- UPDATE TRIGGERS
-- =====================================================

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RITE IV schema created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - alignment_ledger (weekly check-ins)';
  RAISE NOTICE '  - commitments (integrity ledger)';
  RAISE NOTICE '  - profiles (canonical configuration)';
  RAISE NOTICE '  - subscriptions (billing & access)';
END $$;