


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_dinner_party_contribution"("p_contributor_id" "uuid", "p_transaction_id" "uuid", "p_amount_cents" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pool_id UUID;
  v_new_total INTEGER;
  v_target_amount INTEGER;
BEGIN
  -- Get or create active pool
  SELECT id, current_amount_cents, target_amount_cents
  INTO v_pool_id, v_new_total, v_target_amount
  FROM dinner_party_pools
  WHERE status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no active pool exists, create one
  IF v_pool_id IS NULL THEN
    INSERT INTO dinner_party_pools (
      pool_name,
      target_amount_cents,
      status,
      description
    ) VALUES (
      'Dinner Party Pool ' || TO_CHAR(NOW(), 'YYYY-MM'),
      50000,
      'active',
      'Community dinner party fund'
    )
    RETURNING id INTO v_pool_id;

    v_new_total := 0;
    v_target_amount := 50000;
  END IF;

  -- Add contribution
  INSERT INTO dinner_party_contributions (
    pool_id,
    contributor_id,
    transaction_id,
    amount_cents,
    is_credit
  ) VALUES (
    v_pool_id,
    p_contributor_id,
    p_transaction_id,
    p_amount_cents,
    TRUE
  );

  -- Update pool total
  v_new_total := v_new_total + p_amount_cents;

  UPDATE dinner_party_pools
  SET
    current_amount_cents = v_new_total,
    updated_at = NOW()
  WHERE id = v_pool_id;

  -- Update user credits
  UPDATE users
  SET dinner_party_credits_cents = dinner_party_credits_cents + p_amount_cents
  WHERE id = p_contributor_id;

  -- Check if pool is now funded
  IF v_new_total >= v_target_amount THEN
    UPDATE dinner_party_pools
    SET
      status = 'funded',
      updated_at = NOW()
    WHERE id = v_pool_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."add_dinner_party_contribution"("p_contributor_id" "uuid", "p_transaction_id" "uuid", "p_amount_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_old_audit_logs"("days_old" integer DEFAULT 90) RETURNS TABLE("archived_count" integer, "archived_date" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  deleted_count INTEGER;
BEGIN
  cutoff_date := NOW() - (days_old || ' days')::INTERVAL;

  -- In production, you would export to S3 here before deleting
  -- For now, just delete old success logs
  DELETE FROM audit_logs
  WHERE created_at < cutoff_date
    AND event_status = 'success'
    AND log_level NOT IN ('ERROR', 'WARN');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN QUERY SELECT deleted_count, cutoff_date::DATE;
END;
$$;


ALTER FUNCTION "public"."archive_old_audit_logs"("days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_copy_placements_to_new_session"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  previous_placements jsonb;
BEGIN
  -- Only run for new sessions without placements
  IF NEW.placements IS NOT NULL OR NEW.placements_confirmed = true THEN
    RETURN NEW;
  END IF;

  -- Get the most recent confirmed placements from any other product for this user
  SELECT placements INTO previous_placements
  FROM product_sessions
  WHERE user_id = NEW.user_id
    AND placements_confirmed = true
    AND placements IS NOT NULL
    AND id != NEW.id  -- Don't copy from self
  ORDER BY created_at DESC
  LIMIT 1;

  -- If we found previous placements, copy them BUT DON'T auto-confirm
  IF previous_placements IS NOT NULL THEN
    NEW.placements := previous_placements;
    -- CHANGED: Set to false so user sees confirmation gate
    NEW.placements_confirmed := false;

    RAISE NOTICE 'Auto-copied placements from previous session to new % session for user % (requires confirmation)',
      NEW.product_slug, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_copy_placements_to_new_session"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_copy_placements_to_new_session"() IS 'Automatically copies placements from user''s previous sessions when creating a new product session';



CREATE OR REPLACE FUNCTION "public"."auto_enroll_affiliate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_referral_code TEXT;
  v_base_url TEXT;
  v_opted_out BOOLEAN;
BEGIN
  -- Check if user has opted out of affiliate program
  SELECT affiliate_opted_out INTO v_opted_out
  FROM users
  WHERE id = NEW.user_id;

  -- Only auto-enroll if:
  -- 1. User doesn't already have a referral_hierarchy record
  -- 2. User has not explicitly opted out
  IF NOT EXISTS(SELECT 1 FROM referral_hierarchy WHERE affiliate_id = NEW.user_id)
     AND (v_opted_out IS NULL OR v_opted_out = FALSE) THEN

    -- Generate unique referral code
    v_referral_code := generate_referral_code();
    v_base_url := 'https://quantumstrategies.online';

    -- Create referral_hierarchy record
    INSERT INTO referral_hierarchy (
      affiliate_id,
      referral_code,
      referral_link,
      current_track,
      enrolled_at
    ) VALUES (
      NEW.user_id,
      v_referral_code,
      v_base_url || '?ref=' || v_referral_code,
      'community_builder',
      NOW()
    );

    -- Update users table to mark as affiliate
    UPDATE users
    SET
      is_affiliate = TRUE,
      affiliate_enrolled_at = NOW()
    WHERE id = NEW.user_id;

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_enroll_affiliate"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_enroll_affiliate"() IS 'Auto-enrolls users as affiliates on first purchase, respecting opt-out preferences';



CREATE OR REPLACE FUNCTION "public"."auto_grant_test_access_on_new_product"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get test user ID
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'santos.93.aus@gmail';

  -- If test user exists, grant access to new product
  IF test_user_id IS NOT NULL THEN
    INSERT INTO product_access (
      user_id,
      product_slug,
      access_granted,
      purchase_date,
      stripe_session_id,
      amount_paid
    ) VALUES (
      test_user_id,
      NEW.product_slug,
      true,
      NOW(),
      'test_account',
      0
    )
    ON CONFLICT (user_id, product_slug)
    DO UPDATE SET
      access_granted = true,
      purchase_date = NOW();

    RAISE NOTICE 'Auto-granted test access to new product: %', NEW.name;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_grant_test_access_on_new_product"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_commission"("p_amount_cents" integer, "p_track" "text", "p_is_direct" boolean) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_percentage DECIMAL;
BEGIN
  -- Direct referrer commission
  IF p_is_direct THEN
    CASE p_track
      WHEN 'community_builder' THEN v_percentage := 0.30;
      WHEN 'high_performer' THEN v_percentage := 0.40;
      WHEN 'independent' THEN v_percentage := 0.60;
      ELSE v_percentage := 0;
    END CASE;
  ELSE
    -- Override commission (always 10% if eligible)
    v_percentage := 0.10;
  END IF;

  RETURN FLOOR(p_amount_cents * v_percentage);
END;
$$;


ALTER FUNCTION "public"."calculate_commission"("p_amount_cents" integer, "p_track" "text", "p_is_direct" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_dinner_party_contribution"("p_amount_cents" integer, "p_track" "text") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_percentage DECIMAL;
BEGIN
  CASE p_track
    WHEN 'community_builder' THEN v_percentage := 0.40;
    WHEN 'high_performer' THEN v_percentage := 0.30;
    WHEN 'independent' THEN v_percentage := 0.00;
    ELSE v_percentage := 0;
  END CASE;

  RETURN FLOOR(p_amount_cents * v_percentage);
END;
$$;


ALTER FUNCTION "public"."calculate_dinner_party_contribution"("p_amount_cents" integer, "p_track" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_create_new_version"("p_user_id" "uuid", "p_product_slug" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_free_attempts_used integer;
  v_free_attempts_limit integer;
  v_access_granted boolean;
  v_user_email text;
  v_is_admin boolean;
  v_result jsonb;
BEGIN
  -- Get user email to check if admin
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  -- Check if this is the admin user
  v_is_admin := (v_user_email = 'santos.93.aus@gmail.com');

  -- Get product access info
  SELECT
    access_granted,
    free_attempts_used,
    free_attempts_limit
  INTO
    v_access_granted,
    v_free_attempts_used,
    v_free_attempts_limit
  FROM product_access
  WHERE user_id = p_user_id AND product_slug = p_product_slug;

  -- Build result
  v_result := jsonb_build_object(
    'canCreate',
      CASE
        WHEN v_is_admin THEN true  -- Admin always can create
        ELSE (v_free_attempts_used < v_free_attempts_limit)
      END,
    'attemptsUsed', COALESCE(v_free_attempts_used, 0),
    'attemptsLimit',
      CASE
        WHEN v_is_admin THEN 999999  -- Show high limit for admin
        ELSE COALESCE(v_free_attempts_limit, 2)
      END,
    'attemptsRemaining',
      CASE
        WHEN v_is_admin THEN 999999  -- Always show unlimited
        ELSE COALESCE(v_free_attempts_limit, 2) - COALESCE(v_free_attempts_used, 0)
      END,
    'hasAccess', COALESCE(v_access_granted, false),
    'isAdmin', v_is_admin
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."can_create_new_version"("p_user_id" "uuid", "p_product_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_user_pending_emails"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cancelled_count INTEGER;
BEGIN
  -- Cancel all scheduled emails for user
  UPDATE email_sequences
  SET
    email_status = 'cancelled',
    updated_at = NOW()
  WHERE
    user_id = p_user_id
    AND email_status = 'scheduled';

  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

  RETURN v_cancelled_count;
END;
$$;


ALTER FUNCTION "public"."cancel_user_pending_emails"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_audit_logs"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND event_status = 'success'; -- Keep errors longer

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_audit_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_email_sequences"("days_to_keep" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete emails older than retention period
  DELETE FROM email_sequences
  WHERE
    created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND email_status IN ('sent', 'failed', 'cancelled');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_email_sequences"("days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."copy_placements_between_sessions"("source_session_id" "uuid", "target_session_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  source_placements jsonb;
  source_user_id uuid;
  target_user_id uuid;
BEGIN
  -- Get source session placements and user
  SELECT placements, user_id INTO source_placements, source_user_id
  FROM product_sessions
  WHERE id = source_session_id;

  -- Get target session user
  SELECT user_id INTO target_user_id
  FROM product_sessions
  WHERE id = target_session_id;

  -- Verify both sessions belong to same user
  IF source_user_id != target_user_id THEN
    RAISE EXCEPTION 'Cannot copy placements between different users';
  END IF;

  -- Verify source has placements
  IF source_placements IS NULL THEN
    RAISE EXCEPTION 'Source session has no placements to copy';
  END IF;

  -- Copy placements to target session
  UPDATE product_sessions
  SET
    placements = source_placements,
    placements_confirmed = true
  WHERE id = target_session_id;

  RAISE NOTICE 'Successfully copied placements from % to %', source_session_id, target_session_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."copy_placements_between_sessions"("source_session_id" "uuid", "target_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_session_version"("p_user_id" "uuid", "p_product_slug" "text", "p_parent_session_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_session_id uuid;
  v_next_version integer;
  v_parent_placements jsonb;
  v_total_steps integer;
  v_free_attempts_used integer;
  v_free_attempts_limit integer;
BEGIN
  -- Get free attempts info
  SELECT free_attempts_used, free_attempts_limit
  INTO v_free_attempts_used, v_free_attempts_limit
  FROM product_access
  WHERE user_id = p_user_id AND product_slug = p_product_slug;

  -- Check if user has exceeded free attempts
  IF v_free_attempts_used >= v_free_attempts_limit THEN
    RAISE EXCEPTION 'Free attempts limit reached. User must purchase additional sessions.';
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1
  INTO v_next_version
  FROM product_sessions
  WHERE user_id = p_user_id AND product_slug = p_product_slug;

  -- Get parent session placements (to copy)
  SELECT placements INTO v_parent_placements
  FROM product_sessions
  WHERE id = p_parent_session_id AND user_id = p_user_id;

  -- Get total steps from product definition
  SELECT jsonb_array_length(steps) INTO v_total_steps
  FROM product_definitions
  WHERE product_slug = p_product_slug;

  -- Mark all previous versions as not latest
  UPDATE product_sessions
  SET is_latest_version = false
  WHERE user_id = p_user_id
    AND product_slug = p_product_slug
    AND is_latest_version = true;

  -- Create new session version
  INSERT INTO product_sessions (
    user_id,
    product_slug,
    current_step,
    current_section,
    total_steps,
    is_complete,
    placements_confirmed,
    placements,
    version,
    parent_session_id,
    is_latest_version
  ) VALUES (
    p_user_id,
    p_product_slug,
    1,
    1,
    v_total_steps,
    false,
    CASE WHEN v_parent_placements IS NOT NULL THEN true ELSE false END,
    v_parent_placements, -- Copy placements from parent
    v_next_version,
    p_parent_session_id,
    true
  )
  RETURNING id INTO v_new_session_id;

  -- Increment free attempts counter
  UPDATE product_access
  SET free_attempts_used = free_attempts_used + 1
  WHERE user_id = p_user_id AND product_slug = p_product_slug;

  RETURN v_new_session_id;
END;
$$;


ALTER FUNCTION "public"."create_session_version"("p_user_id" "uuid", "p_product_slug" "text", "p_parent_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enroll_beta_participant"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_user_email" "text" DEFAULT NULL::"text", "p_why_participate" "text" DEFAULT NULL::"text", "p_cohort_name" "text" DEFAULT 'Beta Cohort'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_participant_id UUID;
  product_record RECORD;
  v_start_date TIMESTAMPTZ;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Ensure user row exists (auth user must exist first)
  SELECT email INTO v_user_email
  FROM users
  WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    v_user_email := COALESCE(
      p_user_email,
      current_setting('request.jwt.claim.email', true)
    );

    IF v_user_email IS NULL OR v_user_email = '' THEN
      RAISE EXCEPTION 'User email is required to create profile';
    END IF;

    INSERT INTO users (id, email, name)
    VALUES (v_user_id, v_user_email, split_part(v_user_email, '@', 1));
  END IF;

  -- Check if already enrolled
  SELECT id INTO v_participant_id
  FROM beta_participants
  WHERE user_id = v_user_id;

  IF v_participant_id IS NOT NULL THEN
    RETURN v_participant_id;
  END IF;

  v_start_date := NOW();

  -- Create beta participant record
  INSERT INTO beta_participants (
    user_id,
    cohort_name,
    program_start_date,
    program_end_date,
    application_why_participate
  ) VALUES (
    v_user_id,
    p_cohort_name,
    v_start_date,
    v_start_date + INTERVAL '6 weeks',
    p_why_participate
  )
  RETURNING id INTO v_participant_id;

  -- Grant access to all 11 products (do not overwrite paid purchases)
  FOR product_record IN
    SELECT product_slug, name
    FROM product_definitions
    WHERE product_slug IN (
      'perception-rite-scan-1',
      'perception-rite-scan-2',
      'perception-rite-scan-3',
      'perception-rite-scan-4',
      'perception-rite-scan-5',
      'personal-alignment',
      'business-alignment',
      'brand-alignment',
      'declaration-rite-life-vision',
      'declaration-rite-business-model',
      'declaration-rite-strategic-path'
    )
  LOOP
    INSERT INTO product_access (
      user_id,
      product_slug,
      access_granted,
      purchase_date,
      stripe_session_id,
      amount_paid,
      purchase_source
    ) VALUES (
      v_user_id,
      product_record.product_slug,
      true,
      NOW(),
      'beta_program',
      0,
      'beta_enrollment'
    )
    ON CONFLICT (user_id, product_slug)
    DO UPDATE SET
      access_granted = true;

    RAISE NOTICE 'Granted access to: %', product_record.name;
  END LOOP;

  RAISE NOTICE 'Beta participant enrolled: % (ID: %)', v_user_id, v_participant_id;

  RETURN v_participant_id;
END;
$$;


ALTER FUNCTION "public"."enroll_beta_participant"("p_user_id" "uuid", "p_user_email" "text", "p_why_participate" "text", "p_cohort_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_referral_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code (uppercase)
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM referral_hierarchy WHERE referral_code = code) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN code;
END;
$$;


ALTER FUNCTION "public"."generate_referral_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_affiliate_stats"("p_affiliate_id" "uuid") RETURNS TABLE("referral_code" "text", "referral_link" "text", "current_track" "text", "total_earnings_cents" integer, "available_balance_cents" integer, "total_referrals" integer, "active_referrals" integer, "dinner_party_credits_cents" integer, "stripe_connect_onboarding_complete" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    rh.referral_code,
    rh.referral_link,
    rh.current_track,
    u.total_earnings_cents,
    u.available_balance_cents,
    rh.total_referrals,
    rh.active_referrals,
    u.dinner_party_credits_cents,
    rh.stripe_connect_onboarding_complete
  FROM users u
  LEFT JOIN referral_hierarchy rh ON rh.affiliate_id = u.id
  WHERE u.id = p_affiliate_id;
END;
$$;


ALTER FUNCTION "public"."get_affiliate_stats"("p_affiliate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_session_versions"("p_user_id" "uuid", "p_product_slug" "text") RETURNS TABLE("session_id" "uuid", "version" integer, "is_complete" boolean, "completed_at" timestamp with time zone, "created_at" timestamp with time zone, "is_latest" boolean, "has_deliverable" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id as session_id,
    ps.version,
    ps.is_complete,
    ps.completed_at,
    ps.created_at,
    ps.is_latest_version as is_latest,
    (ps.deliverable_content IS NOT NULL) as has_deliverable
  FROM product_sessions ps
  WHERE ps.user_id = p_user_id
    AND ps.product_slug = p_product_slug
  ORDER BY ps.version DESC;
END;
$$;


ALTER FUNCTION "public"."get_session_versions"("p_user_id" "uuid", "p_product_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_slow_requests"("threshold_ms" integer DEFAULT 2000, "hours_ago" integer DEFAULT 24) RETURNS TABLE("user_email" "text", "event_action" "text", "duration_ms" integer, "request_path" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.user_email,
    al.event_action,
    al.duration_ms,
    al.request_path,
    al.created_at
  FROM audit_logs al
  WHERE al.duration_ms > threshold_ms
    AND al.created_at > NOW() - (hours_ago || ' hours')::INTERVAL
  ORDER BY al.duration_ms DESC
  LIMIT 100;
END;
$$;


ALTER FUNCTION "public"."get_slow_requests"("threshold_ms" integer, "hours_ago" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") RETURNS TABLE("event_type" "text", "total_events" bigint, "success_count" bigint, "error_count" bigint, "avg_duration_ms" numeric, "last_activity" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.event_type,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE al.event_status = 'success') as success_count,
    COUNT(*) FILTER (WHERE al.event_status = 'error') as error_count,
    AVG(al.duration_ms) as avg_duration_ms,
    MAX(al.created_at) as last_activity
  FROM audit_logs al
  WHERE al.user_id = p_user_id
  GROUP BY al.event_type
  ORDER BY total_events DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_product_access"("p_email" "text", "p_product_slug" "text", "p_stripe_session_id" "text", "p_amount_paid" numeric) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_access_id UUID;
BEGIN
  -- Get or create user
  SELECT id INTO v_user_id FROM users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    INSERT INTO users (email) VALUES (p_email) RETURNING id INTO v_user_id;
  END IF;

  -- Grant product access
  INSERT INTO product_access (
    user_id,
    product_slug,
    stripe_session_id,
    amount_paid
  ) VALUES (
    v_user_id,
    p_product_slug,
    p_stripe_session_id,
    p_amount_paid
  )
  ON CONFLICT (user_id, product_slug) DO UPDATE
    SET access_granted = TRUE,
        stripe_session_id = p_stripe_session_id,
        amount_paid = p_amount_paid
  RETURNING id INTO v_access_id;

  RETURN v_access_id;
END;
$$;


ALTER FUNCTION "public"."grant_product_access"("p_email" "text", "p_product_slug" "text", "p_stripe_session_id" "text", "p_amount_paid" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_test_account_access"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  test_user_id uuid;
  product_record RECORD;
BEGIN
  -- Get test user ID by email
  SELECT id INTO test_user_id
  FROM auth.users
  WHERE email = 'santos.93.aus@gmail.com';

  -- If test user doesn't exist, exit
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Test account not found: santos.93.aus@gmail.com';
    RETURN;
  END IF;

  -- Loop through all products and grant access
  FOR product_record IN
    SELECT product_slug, name, price
    FROM product_definitions
    ORDER BY created_at
  LOOP
    -- Insert or update product access
    INSERT INTO product_access (
      user_id,
      product_slug,
      access_granted,
      purchase_date,
      stripe_session_id,
      amount_paid
    ) VALUES (
      test_user_id,
      product_record.product_slug,
      true,
      NOW(),
      'test_account',
      0
    )
    ON CONFLICT (user_id, product_slug)
    DO UPDATE SET
      access_granted = true,
      purchase_date = NOW(),
      stripe_session_id = 'test_account';

    RAISE NOTICE 'Granted access to: %', product_record.name;
  END LOOP;

  RAISE NOTICE 'Test account access granted for all products';
END;
$$;


ALTER FUNCTION "public"."grant_test_account_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_affiliate_earnings"("p_affiliate_id" "uuid", "p_amount_cents" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE users
  SET
    total_earnings_cents = total_earnings_cents + p_amount_cents,
    available_balance_cents = available_balance_cents + p_amount_cents
  WHERE id = p_affiliate_id;
END;
$$;


ALTER FUNCTION "public"."increment_affiliate_earnings"("p_affiliate_id" "uuid", "p_amount_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_referral_count"("p_referrer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE referral_hierarchy
  SET
    total_referrals = total_referrals + 1,
    active_referrals = active_referrals + 1,
    updated_at = NOW()
  WHERE affiliate_id = p_referrer_id;
END;
$$;


ALTER FUNCTION "public"."increment_referral_count"("p_referrer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_affiliate_enrollment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM log_audit_event(
    NEW.affiliate_id,
    'affiliate',
    'enrolled',
    'success',
    jsonb_build_object(
      'referral_code', NEW.referral_code,
      'current_track', NEW.current_track,
      'referred_by_id', NEW.referred_by_id
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_affiliate_enrollment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_event_type" "text", "p_event_action" "text", "p_event_status" "text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_error_message" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    event_type,
    event_action,
    event_status,
    metadata,
    error_message
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_action,
    p_event_status,
    p_metadata,
    p_error_message
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;


ALTER FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_event_type" "text", "p_event_action" "text", "p_event_status" "text", "p_metadata" "jsonb", "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_product_access_grant"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM log_audit_event(
    NEW.user_id,
    'product',
    'access_granted',
    CASE WHEN NEW.access_granted THEN 'success' ELSE 'pending' END,
    jsonb_build_object(
      'product_slug', NEW.product_slug,
      'amount_paid', NEW.amount_paid,
      'stripe_session_id', NEW.stripe_session_id
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_product_access_grant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_session_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM log_audit_event(
    NEW.user_id,
    'product',
    'session_started',
    'success',
    jsonb_build_object(
      'session_id', NEW.id,
      'product_slug', NEW.product_slug,
      'parent_session_id', NEW.parent_session_id
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_session_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_user_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM log_audit_event(
    NEW.id,
    'auth',
    'user_created',
    'success',
    jsonb_build_object(
      'email', NEW.email,
      'name', NEW.name
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_user_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_user_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_critical_error"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only notify on critical errors
  IF NEW.event_status = 'error' AND (
    NEW.event_type = 'payment' OR
    NEW.event_action LIKE '%stripe%' OR
    NEW.log_level = 'ERROR'
  ) THEN
    PERFORM pg_notify(
      'critical_error',
      json_build_object(
        'user_email', NEW.user_email,
        'event_type', NEW.event_type,
        'event_action', NEW.event_action,
        'error_message', NEW.error_message,
        'created_at', NEW.created_at
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_critical_error"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_course_slide_event"("p_user_id" "uuid", "p_course_slug" "text", "p_module_id" "text", "p_submodule_id" "text", "p_coord" "text", "p_coord_x" integer, "p_coord_y" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  use_coord_x integer := COALESCE(p_coord_x, 0);
  use_coord_y integer := COALESCE(p_coord_y, 0);
  is_furthest boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO course_slide_events (
    user_id,
    course_slug,
    module_id,
    submodule_id,
    coord,
    coord_x,
    coord_y
  )
  VALUES (
    p_user_id,
    p_course_slug,
    p_module_id,
    p_submodule_id,
    p_coord,
    use_coord_x,
    use_coord_y
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO course_progress (
    user_id,
    course_slug,
    module_id,
    submodule_id,
    current_coord,
    max_coord,
    max_coord_x,
    max_coord_y,
    started_at,
    last_activity_at
  )
  VALUES (
    p_user_id,
    p_course_slug,
    p_module_id,
    p_submodule_id,
    p_coord,
    p_coord,
    use_coord_x,
    use_coord_y,
    now(),
    now()
  )
  ON CONFLICT (user_id, course_slug, module_id, submodule_id)
  DO UPDATE
  SET
    current_coord = EXCLUDED.current_coord,
    last_activity_at = now(),
    max_coord_x = CASE
      WHEN course_progress.max_coord_x IS NULL THEN use_coord_x
      WHEN use_coord_x > course_progress.max_coord_x THEN use_coord_x
      WHEN use_coord_x = course_progress.max_coord_x AND use_coord_y > course_progress.max_coord_y THEN use_coord_x
      ELSE course_progress.max_coord_x
    END,
    max_coord_y = CASE
      WHEN course_progress.max_coord_y IS NULL THEN use_coord_y
      WHEN use_coord_x > course_progress.max_coord_x THEN use_coord_y
      WHEN use_coord_x = course_progress.max_coord_x AND use_coord_y > course_progress.max_coord_y THEN use_coord_y
      ELSE course_progress.max_coord_y
    END,
    max_coord = CASE
      WHEN course_progress.max_coord_x IS NULL THEN p_coord
      WHEN use_coord_x > course_progress.max_coord_x THEN p_coord
      WHEN use_coord_x = course_progress.max_coord_x AND use_coord_y > course_progress.max_coord_y THEN p_coord
      ELSE course_progress.max_coord
    END;
END;
$$;


ALTER FUNCTION "public"."record_course_slide_event"("p_user_id" "uuid", "p_course_slug" "text", "p_module_id" "text", "p_submodule_id" "text", "p_coord" "text", "p_coord_x" integer, "p_coord_y" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redact_user_logs"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  redacted_count INTEGER;
BEGIN
  -- Instead of deleting, redact personal data
  UPDATE audit_logs
  SET
    user_email = NULL,
    user_email_hash = NULL,
    ip_address = NULL,
    user_agent = NULL,
    request_body = NULL,
    response_body = NULL,
    metadata = jsonb_build_object(
      'redacted', true,
      'redacted_at', NOW()
    )
  WHERE user_id = p_user_id
    AND event_status = 'success'; -- Keep error logs for debugging

  GET DIAGNOSTICS redacted_count = ROW_COUNT;
  RETURN redacted_count;
END;
$$;


ALTER FUNCTION "public"."redact_user_logs"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_audit_error_summary"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY audit_error_summary;
END;
$$;


ALTER FUNCTION "public"."refresh_audit_error_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_product_access_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When a product session is marked complete, update the corresponding product_access record
  UPDATE product_access
  SET
    completed_at = NEW.completed_at,
    completion_percentage = 100
  WHERE user_id = NEW.user_id
    AND product_slug = NEW.product_slug
    AND completed_at IS NULL; -- Only update if not already marked complete

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_product_access_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_beta_feedback_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  micro_count INTEGER;
  consolidation_count INTEGER;
  journey_submitted BOOLEAN;
  total_products INTEGER;
  total_feedback INTEGER;
  feedback_rate DECIMAL(5,2);
BEGIN
  -- Count all feedback types
  SELECT COUNT(*) INTO micro_count
  FROM (
    SELECT id FROM scan_feedback WHERE beta_participant_id = NEW.beta_participant_id
    UNION ALL
    SELECT id FROM blueprint_feedback WHERE beta_participant_id = NEW.beta_participant_id
    UNION ALL
    SELECT id FROM declaration_feedback WHERE beta_participant_id = NEW.beta_participant_id
  ) AS micro_feedback;

  SELECT COUNT(*) INTO consolidation_count
  FROM (
    SELECT id FROM rite_one_consolidation WHERE beta_participant_id = NEW.beta_participant_id
    UNION ALL
    SELECT id FROM rite_two_consolidation WHERE beta_participant_id = NEW.beta_participant_id
  ) AS consolidations;

  SELECT EXISTS(
    SELECT 1 FROM complete_journey_feedback WHERE beta_participant_id = NEW.beta_participant_id
  ) INTO journey_submitted;

  -- Get total products completed
  SELECT
    perception_completed_count + orientation_completed_count + declaration_completed_count
  INTO total_products
  FROM beta_participants
  WHERE id = NEW.beta_participant_id;

  total_feedback := micro_count + consolidation_count + (CASE WHEN journey_submitted THEN 1 ELSE 0 END);

  IF total_products > 0 THEN
    feedback_rate := (total_feedback::DECIMAL / total_products::DECIMAL) * 100;
  ELSE
    feedback_rate := 0;
  END IF;

  -- Update beta participant
  UPDATE beta_participants
  SET
    micro_feedback_count = micro_count,
    consolidation_feedback_count = consolidation_count,
    complete_journey_submitted = journey_submitted,
    feedback_completion_rate = feedback_rate,
    updated_at = NOW()
  WHERE id = NEW.beta_participant_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_beta_feedback_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_beta_participant_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  participant_record RECORD;
  perception_count INTEGER;
  orientation_count INTEGER;
  declaration_count INTEGER;
  total_products INTEGER;
  total_feedback INTEGER;
  feedback_rate DECIMAL(5,2);
BEGIN
  -- Check if user is a beta participant
  SELECT * INTO participant_record
  FROM beta_participants
  WHERE user_id = NEW.user_id;

  IF participant_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count completed products by rite
  SELECT COUNT(*) INTO perception_count
  FROM product_access
  WHERE user_id = NEW.user_id
    AND product_slug SIMILAR TO 'perception-rite-scan-[1-5]'
    AND completed_at IS NOT NULL;

  SELECT COUNT(*) INTO orientation_count
  FROM product_access
  WHERE user_id = NEW.user_id
    AND product_slug IN ('personal-alignment', 'business-alignment', 'brand-alignment')
    AND completed_at IS NOT NULL;

  SELECT COUNT(*) INTO declaration_count
  FROM product_access
  WHERE user_id = NEW.user_id
    AND product_slug SIMILAR TO 'declaration-rite-%'
    AND completed_at IS NOT NULL;

  total_products := perception_count + orientation_count + declaration_count;

  -- Calculate feedback completion rate
  SELECT COUNT(*) INTO total_feedback
  FROM (
    SELECT id FROM scan_feedback WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM blueprint_feedback WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM declaration_feedback WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM rite_one_consolidation WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM rite_two_consolidation WHERE beta_participant_id = participant_record.id
    UNION ALL
    SELECT id FROM complete_journey_feedback WHERE beta_participant_id = participant_record.id
  ) AS all_feedback;

  IF total_products > 0 THEN
    feedback_rate := (total_feedback::DECIMAL / total_products::DECIMAL) * 100;
  ELSE
    feedback_rate := 0;
  END IF;

  -- Update beta participant record
  UPDATE beta_participants
  SET
    perception_completed_count = perception_count,
    orientation_completed_count = orientation_count,
    declaration_completed_count = declaration_count,
    total_completion_percentage = ((perception_count + orientation_count + declaration_count) / 11.0) * 100,
    feedback_completion_rate = feedback_rate,
    current_rite = CASE
      WHEN perception_count < 5 THEN 'perception'
      WHEN orientation_count < 3 THEN 'orientation'
      WHEN declaration_count < 3 THEN 'declaration'
      ELSE 'complete'
    END,
    updated_at = NOW()
  WHERE id = participant_record.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_beta_participant_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_sequences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_sequences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_progress"("p_session_id" "uuid", "p_current_step" integer, "p_total_steps" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_percentage INTEGER;
BEGIN
  -- Calculate completion percentage
  v_percentage := ROUND((p_current_step::DECIMAL / p_total_steps) * 100);

  -- Update session
  UPDATE product_sessions
  SET
    current_step = p_current_step,
    completion_percentage = v_percentage,
    last_activity_at = NOW()
  WHERE id = p_session_id;

  -- Update product_access completion percentage
  UPDATE product_access
  SET completion_percentage = v_percentage
  WHERE user_id = (SELECT user_id FROM product_sessions WHERE id = p_session_id)
    AND product_slug = (SELECT product_slug FROM product_sessions WHERE id = p_session_id);
END;
$$;


ALTER FUNCTION "public"."update_session_progress"("p_session_id" "uuid", "p_current_step" integer, "p_total_steps" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."affiliate_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "purchaser_id" "uuid" NOT NULL,
    "product_slug" "text" NOT NULL,
    "stripe_session_id" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "amount_cents" integer NOT NULL,
    "direct_referrer_id" "uuid",
    "override_referrer_id" "uuid",
    "direct_commission_cents" integer DEFAULT 0,
    "override_commission_cents" integer DEFAULT 0,
    "direct_track" "text",
    "override_track" "text",
    "direct_transfer_id" "text",
    "override_transfer_id" "text",
    "dinner_party_contribution_cents" integer DEFAULT 0,
    "commission_status" "text" DEFAULT 'pending'::"text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_commission_status" CHECK (("commission_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'paid'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."affiliate_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "session_id" "text",
    "event_type" "text" NOT NULL,
    "event_action" "text" NOT NULL,
    "event_status" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "request_method" "text",
    "request_path" "text",
    "request_body" "jsonb",
    "response_status" integer,
    "response_body" "jsonb",
    "error_message" "text",
    "error_stack" "text",
    "error_code" "text",
    "metadata" "jsonb",
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_email_hash" "text",
    "trace_id" "uuid",
    "log_level" "text" DEFAULT 'INFO'::"text",
    "is_sampled" boolean DEFAULT false
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."audit_error_summary" AS
 SELECT "event_type",
    "event_action",
    "error_code",
    "count"(*) AS "error_count",
    "count"(DISTINCT "user_id") AS "affected_users",
    "max"("created_at") AS "last_occurrence"
   FROM "public"."audit_logs"
  WHERE (("event_status" = 'error'::"text") AND ("created_at" > ("now"() - '24:00:00'::interval)))
  GROUP BY "event_type", "event_action", "error_code"
  ORDER BY ("count"(*)) DESC
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."audit_error_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_conversion_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "offer_presented_at" timestamp with time zone NOT NULL,
    "offer_amount" numeric(10,2) NOT NULL,
    "offer_type" "text" DEFAULT 'founding_member'::"text" NOT NULL,
    "total_paid_before_offer" numeric(10,2) DEFAULT 0.00,
    "discount_code_offered" "text",
    "discount_amount" numeric(10,2),
    "purchased_at_stage" "text",
    "decision" "text" NOT NULL,
    "decision_made_at" timestamp with time zone,
    "purchased_at" timestamp with time zone,
    "stripe_session_id" "text",
    "amount_paid" numeric(10,2),
    "final_total_investment" numeric(10,2),
    "payment_plan" "text",
    "decline_reason" "text",
    "decline_feedback" "text",
    "future_interest" boolean,
    "follow_up_scheduled" boolean DEFAULT false,
    "follow_up_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "beta_conversion_results_decision_check" CHECK (("decision" = ANY (ARRAY['purchased'::"text", 'declined'::"text", 'pending'::"text"]))),
    CONSTRAINT "beta_conversion_results_purchased_at_stage_check" CHECK (("purchased_at_stage" = ANY (ARRAY['during_rite_one'::"text", 'during_rite_two'::"text", 'during_rite_three'::"text", 'after_completion'::"text", 'never'::"text"])))
);


ALTER TABLE "public"."beta_conversion_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beta_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cohort_name" "text" DEFAULT 'Beta Cohort'::"text" NOT NULL,
    "enrollment_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "program_start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "program_end_date" timestamp with time zone DEFAULT ("now"() + '42 days'::interval) NOT NULL,
    "application_why_participate" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "current_rite" "text" DEFAULT 'perception'::"text",
    "perception_completed_count" integer DEFAULT 0,
    "orientation_completed_count" integer DEFAULT 0,
    "declaration_completed_count" integer DEFAULT 0,
    "total_completion_percentage" numeric(5,2) DEFAULT 0.00,
    "micro_feedback_count" integer DEFAULT 0,
    "consolidation_feedback_count" integer DEFAULT 0,
    "complete_journey_submitted" boolean DEFAULT false,
    "feedback_completion_rate" numeric(5,2) DEFAULT 0.00,
    "total_amount_paid_before_offer" numeric(10,2) DEFAULT 0.00,
    "summary_pdf_generated" boolean DEFAULT false,
    "summary_pdf_url" "text",
    "conversion_offer_presented_at" timestamp with time zone,
    "discount_code_generated" "text",
    "remaining_balance_offered" numeric(10,2),
    "conversion_decision" "text",
    "conversion_decision_at" timestamp with time zone,
    "conversion_amount" numeric(10,2),
    "conversion_stripe_session_id" "text",
    "welcome_email_sent_at" timestamp with time zone,
    "week_1_checkin_sent_at" timestamp with time zone,
    "week_2_checkin_sent_at" timestamp with time zone,
    "week_4_checkin_sent_at" timestamp with time zone,
    "rite_one_celebration_sent_at" timestamp with time zone,
    "rite_two_celebration_sent_at" timestamp with time zone,
    "rite_three_celebration_sent_at" timestamp with time zone,
    "completion_email_sent_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_conversion" CHECK (("conversion_decision" = ANY (ARRAY['purchased'::"text", 'declined'::"text", 'pending'::"text"]))),
    CONSTRAINT "valid_rite" CHECK (("current_rite" = ANY (ARRAY['perception'::"text", 'orientation'::"text", 'declaration'::"text", 'complete'::"text"]))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."beta_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blueprint_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_slug" "text" NOT NULL,
    "session_id" "uuid",
    "insight_depth_score" integer,
    "personalization_score" integer,
    "actionability_score" integer,
    "immediate_action" "text",
    "biggest_gap_revealed" "text",
    "integration_with_perception" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "survey_duration_seconds" integer,
    CONSTRAINT "blueprint_feedback_actionability_score_check" CHECK ((("actionability_score" >= 1) AND ("actionability_score" <= 5))),
    CONSTRAINT "blueprint_feedback_insight_depth_score_check" CHECK ((("insight_depth_score" >= 1) AND ("insight_depth_score" <= 5))),
    CONSTRAINT "blueprint_feedback_personalization_score_check" CHECK ((("personalization_score" >= 1) AND ("personalization_score" <= 5)))
);


ALTER TABLE "public"."blueprint_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."complete_journey_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transformation_score" integer,
    "clarity_gained" integer,
    "confidence_gained" integer,
    "direction_clarity" integer,
    "journey_coherence_score" integer,
    "rite_integration_score" integer,
    "most_valuable_rite" "text",
    "most_valuable_product_overall" "text",
    "least_valuable_product_overall" "text",
    "before_journey_state" "text",
    "after_journey_state" "text",
    "biggest_breakthrough" "text",
    "unexpected_insight" "text",
    "perceived_total_value_vs_60" "text",
    "willingness_to_pay_amount" numeric(10,2),
    "purchase_timeline" "text",
    "what_would_make_you_say_yes" "text",
    "nps_score" integer,
    "would_refer_others" boolean,
    "referral_commitment_count" integer DEFAULT 0,
    "founding_member_interest" "text",
    "founding_member_decision_factors" "text",
    "testimonial_consent" boolean DEFAULT false,
    "testimonial_text" "text",
    "video_testimonial_interest" boolean DEFAULT false,
    "what_worked_best" "text",
    "what_needs_improvement" "text",
    "missing_elements" "text",
    "additional_support_needed" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "survey_duration_seconds" integer,
    CONSTRAINT "complete_journey_feedback_clarity_gained_check" CHECK ((("clarity_gained" >= 1) AND ("clarity_gained" <= 10))),
    CONSTRAINT "complete_journey_feedback_confidence_gained_check" CHECK ((("confidence_gained" >= 1) AND ("confidence_gained" <= 10))),
    CONSTRAINT "complete_journey_feedback_direction_clarity_check" CHECK ((("direction_clarity" >= 1) AND ("direction_clarity" <= 10))),
    CONSTRAINT "complete_journey_feedback_founding_member_interest_check" CHECK (("founding_member_interest" = ANY (ARRAY['definitely'::"text", 'probably'::"text", 'maybe'::"text", 'probably_not'::"text", 'definitely_not'::"text"]))),
    CONSTRAINT "complete_journey_feedback_journey_coherence_score_check" CHECK ((("journey_coherence_score" >= 1) AND ("journey_coherence_score" <= 10))),
    CONSTRAINT "complete_journey_feedback_most_valuable_rite_check" CHECK (("most_valuable_rite" = ANY (ARRAY['perception'::"text", 'orientation'::"text", 'declaration'::"text"]))),
    CONSTRAINT "complete_journey_feedback_nps_score_check" CHECK ((("nps_score" >= 0) AND ("nps_score" <= 10))),
    CONSTRAINT "complete_journey_feedback_perceived_total_value_vs_60_check" CHECK (("perceived_total_value_vs_60" = ANY (ARRAY['much_less'::"text", 'less'::"text", 'equal'::"text", 'more'::"text", 'much_more'::"text"]))),
    CONSTRAINT "complete_journey_feedback_purchase_timeline_check" CHECK (("purchase_timeline" = ANY (ARRAY['immediate'::"text", '1_month'::"text", '3_months'::"text", 'no'::"text"]))),
    CONSTRAINT "complete_journey_feedback_rite_integration_score_check" CHECK ((("rite_integration_score" >= 1) AND ("rite_integration_score" <= 10))),
    CONSTRAINT "complete_journey_feedback_transformation_score_check" CHECK ((("transformation_score" >= 1) AND ("transformation_score" <= 10)))
);


ALTER TABLE "public"."complete_journey_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_index" (
    "doc_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "path" "text" NOT NULL,
    "parent_id" "text",
    "modified_time" timestamp with time zone,
    "depth" integer DEFAULT 0 NOT NULL,
    "is_folder" boolean DEFAULT false NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_index" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "step_number" integer NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "follow_up_count" integer DEFAULT 0,
    "max_follow_ups" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'AI conversation history per step';



CREATE TABLE IF NOT EXISTS "public"."course_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_slug" "text" NOT NULL,
    "module_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_slug" "text" NOT NULL,
    "module_id" "text" NOT NULL,
    "submodule_id" "text",
    "current_coord" "text",
    "max_coord" "text",
    "max_coord_x" integer,
    "max_coord_y" integer,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."course_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_slide_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_slug" "text" NOT NULL,
    "module_id" "text" NOT NULL,
    "submodule_id" "text",
    "coord" "text" NOT NULL,
    "coord_x" integer,
    "coord_y" integer,
    "visited_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_slide_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_submodules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_slug" "text" NOT NULL,
    "module_id" "text" NOT NULL,
    "submodule_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "start_coord" "text" NOT NULL,
    "end_coord" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."course_submodules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."declaration_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_slug" "text" NOT NULL,
    "session_id" "uuid",
    "commitment_clarity_score" integer,
    "execution_confidence_score" integer,
    "alignment_score" integer,
    "decision_made" "text",
    "commitment_level" integer,
    "support_needed" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "survey_duration_seconds" integer,
    CONSTRAINT "declaration_feedback_alignment_score_check" CHECK ((("alignment_score" >= 1) AND ("alignment_score" <= 5))),
    CONSTRAINT "declaration_feedback_commitment_clarity_score_check" CHECK ((("commitment_clarity_score" >= 1) AND ("commitment_clarity_score" <= 5))),
    CONSTRAINT "declaration_feedback_commitment_level_check" CHECK ((("commitment_level" >= 1) AND ("commitment_level" <= 10))),
    CONSTRAINT "declaration_feedback_execution_confidence_score_check" CHECK ((("execution_confidence_score" >= 1) AND ("execution_confidence_score" <= 5)))
);


ALTER TABLE "public"."declaration_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dinner_party_contributions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pool_id" "uuid" NOT NULL,
    "contributor_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "amount_cents" integer NOT NULL,
    "is_credit" boolean DEFAULT true,
    "redeemed" boolean DEFAULT false,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dinner_party_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dinner_party_pools" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pool_name" "text" NOT NULL,
    "target_amount_cents" integer DEFAULT 50000 NOT NULL,
    "current_amount_cents" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "event_date" timestamp with time zone,
    "location" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_pool_status" CHECK (("status" = ANY (ARRAY['active'::"text", 'funded'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."dinner_party_pools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sequence_type" "text" NOT NULL,
    "trigger_event" "text" NOT NULL,
    "trigger_timestamp" timestamp with time zone NOT NULL,
    "scheduled_send_at" timestamp with time zone NOT NULL,
    "delay_minutes" integer DEFAULT 30 NOT NULL,
    "email_status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "failed_at" timestamp with time zone,
    "failure_reason" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "email_content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_delay" CHECK (("delay_minutes" >= 0)),
    CONSTRAINT "valid_email_status" CHECK (("email_status" = ANY (ARRAY['scheduled'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_sequence_type" CHECK (("sequence_type" = 'affiliate_invitation'::"text"))
);


ALTER TABLE "public"."email_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_affiliate" boolean DEFAULT false,
    "affiliate_enrolled_at" timestamp with time zone,
    "total_earnings_cents" integer DEFAULT 0,
    "available_balance_cents" integer DEFAULT 0,
    "total_withdrawn_cents" integer DEFAULT 0,
    "dinner_party_credits_cents" integer DEFAULT 0,
    "affiliate_opted_out" boolean DEFAULT false,
    "first_affiliate_visit" timestamp with time zone,
    "placements" "jsonb",
    "placements_confirmed" boolean DEFAULT false,
    "placements_updated_at" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'User accounts - linked to Supabase Auth';



COMMENT ON COLUMN "public"."users"."affiliate_opted_out" IS 'True if user explicitly declined to join affiliate program';



COMMENT ON COLUMN "public"."users"."first_affiliate_visit" IS 'Timestamp of first visit to affiliate section';



CREATE OR REPLACE VIEW "public"."error_logs" AS
 SELECT "al"."user_id",
    "u"."email",
    "al"."event_type",
    "al"."event_action",
    "al"."error_message",
    "al"."error_stack",
    "al"."error_code",
    "al"."request_path",
    "al"."metadata",
    "al"."created_at"
   FROM ("public"."audit_logs" "al"
     LEFT JOIN "public"."users" "u" ON (("al"."user_id" = "u"."id")))
  WHERE ("al"."event_status" = 'error'::"text")
  ORDER BY "al"."created_at" DESC;


ALTER VIEW "public"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_access" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_slug" "text" NOT NULL,
    "purchase_date" timestamp with time zone DEFAULT "now"(),
    "stripe_session_id" "text",
    "amount_paid" numeric(10,2),
    "access_granted" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "completion_percentage" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "free_attempts_used" integer DEFAULT 0,
    "free_attempts_limit" integer DEFAULT 2,
    "purchase_source" "text",
    "bundle_slug" "text"
);


ALTER TABLE "public"."product_access" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_access" IS 'Tracks which products each user has purchased';



COMMENT ON COLUMN "public"."product_access"."free_attempts_used" IS 'Number of free sessions user has created';



COMMENT ON COLUMN "public"."product_access"."free_attempts_limit" IS 'Maximum free sessions allowed (default 2)';



COMMENT ON COLUMN "public"."product_access"."purchase_source" IS 'Purchase origin: single or bundle';



COMMENT ON COLUMN "public"."product_access"."bundle_slug" IS 'Bundle slug granting access, when applicable';



CREATE TABLE IF NOT EXISTS "public"."product_definitions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "steps" "jsonb" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "final_deliverable_prompt" "text" NOT NULL,
    "model" "text" DEFAULT 'gpt-4'::"text",
    "estimated_duration" "text",
    "total_steps" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "instructions" "jsonb",
    "product_group" "text",
    "display_order" integer,
    "is_purchasable" boolean DEFAULT true
);


ALTER TABLE "public"."product_definitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_definitions" IS 'Product configurations and prompt engineering';



COMMENT ON COLUMN "public"."product_definitions"."instructions" IS 'Instructional experience configuration with welcome, processing, transitions, and deliverable messages';



COMMENT ON COLUMN "public"."product_definitions"."product_group" IS 'Logical grouping for product families (e.g., perception-rite)';



COMMENT ON COLUMN "public"."product_definitions"."display_order" IS 'Sort order within a product group';



COMMENT ON COLUMN "public"."product_definitions"."is_purchasable" IS 'Whether this product should appear as a purchasable item in UI';



CREATE TABLE IF NOT EXISTS "public"."product_definitions_backup_20260101" (
    "id" "uuid",
    "product_slug" "text",
    "name" "text",
    "description" "text",
    "price" numeric(10,2),
    "steps" "jsonb",
    "system_prompt" "text",
    "final_deliverable_prompt" "text",
    "model" "text",
    "estimated_duration" "text",
    "total_steps" integer,
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "instructions" "jsonb"
);


ALTER TABLE "public"."product_definitions_backup_20260101" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_slug" "text" NOT NULL,
    "current_step" integer DEFAULT 1,
    "total_steps" integer NOT NULL,
    "is_complete" boolean DEFAULT false,
    "step_data" "jsonb" DEFAULT '{}'::"jsonb",
    "deliverable_content" "text",
    "deliverable_url" "text",
    "deliverable_generated_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "placements" "jsonb",
    "placements_confirmed" boolean DEFAULT false NOT NULL,
    "current_section" integer DEFAULT 1 NOT NULL,
    "followup_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1,
    "parent_session_id" "uuid",
    "is_latest_version" boolean DEFAULT true,
    "scan_number" integer,
    "parent_product_slug" "text"
);


ALTER TABLE "public"."product_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_sessions" IS 'User progress through product experiences';



COMMENT ON COLUMN "public"."product_sessions"."version" IS 'Version number for this session (1, 2, 3, etc.)';



COMMENT ON COLUMN "public"."product_sessions"."parent_session_id" IS 'ID of the session this version was created from';



COMMENT ON COLUMN "public"."product_sessions"."is_latest_version" IS 'True if this is the current/active version';



COMMENT ON COLUMN "public"."product_sessions"."scan_number" IS 'Rite I scan index (1-5)';



COMMENT ON COLUMN "public"."product_sessions"."parent_product_slug" IS 'Parent product family slug for synthesized reports';



CREATE TABLE IF NOT EXISTS "public"."product_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "text" NOT NULL,
    "step_number" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_slug" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "step_number" integer,
    "prompt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."prompts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recent_user_activity" AS
 SELECT "al"."user_id",
    "u"."email",
    NULL::"text" AS "full_name",
    "al"."event_type",
    "al"."event_action",
    "al"."event_status",
    "al"."error_message",
    "al"."metadata",
    "al"."created_at"
   FROM ("public"."audit_logs" "al"
     LEFT JOIN "public"."users" "u" ON (("al"."user_id" = "u"."id")))
  WHERE ("al"."created_at" > ("now"() - '7 days'::interval))
  ORDER BY "al"."created_at" DESC;


ALTER VIEW "public"."recent_user_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_hierarchy" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "referred_by_id" "uuid",
    "referral_code" "text" NOT NULL,
    "referral_link" "text" NOT NULL,
    "current_track" "text" DEFAULT 'community_builder'::"text" NOT NULL,
    "stripe_connect_account_id" "text",
    "stripe_connect_onboarding_complete" boolean DEFAULT false,
    "stripe_connect_charges_enabled" boolean DEFAULT false,
    "stripe_connect_payouts_enabled" boolean DEFAULT false,
    "total_referrals" integer DEFAULT 0,
    "active_referrals" integer DEFAULT 0,
    "enrolled_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_track" CHECK (("current_track" = ANY (ARRAY['community_builder'::"text", 'high_performer'::"text", 'independent'::"text"])))
);


ALTER TABLE "public"."referral_hierarchy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rite_one_consolidation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall_value_score" integer,
    "completion_time_weeks" numeric(3,1),
    "rite_one_nps" integer,
    "most_valuable_scan" "text",
    "least_valuable_scan" "text",
    "key_transformation" "text",
    "integration_challenge" "text",
    "breakthrough_moment" "text",
    "perceived_value_vs_price" "text",
    "would_recommend" boolean,
    "testimonial_consent" boolean DEFAULT false,
    "testimonial_text" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "survey_duration_seconds" integer,
    "reminded_at" timestamp with time zone,
    CONSTRAINT "rite_one_consolidation_overall_value_score_check" CHECK ((("overall_value_score" >= 1) AND ("overall_value_score" <= 10))),
    CONSTRAINT "rite_one_consolidation_perceived_value_vs_price_check" CHECK (("perceived_value_vs_price" = ANY (ARRAY['much_less'::"text", 'less'::"text", 'equal'::"text", 'more'::"text", 'much_more'::"text"]))),
    CONSTRAINT "rite_one_consolidation_rite_one_nps_check" CHECK ((("rite_one_nps" >= 0) AND ("rite_one_nps" <= 10)))
);


ALTER TABLE "public"."rite_one_consolidation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rite_two_consolidation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "overall_value_score" integer,
    "completion_time_weeks" numeric(3,1),
    "rite_two_nps" integer,
    "most_valuable_blueprint" "text",
    "least_valuable_blueprint" "text",
    "strategic_clarity_before" integer,
    "strategic_clarity_after" integer,
    "business_model_confidence" "text",
    "perceived_value_vs_price" "text",
    "would_recommend" boolean,
    "testimonial_consent" boolean DEFAULT false,
    "testimonial_text" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "survey_duration_seconds" integer,
    "reminded_at" timestamp with time zone,
    CONSTRAINT "rite_two_consolidation_overall_value_score_check" CHECK ((("overall_value_score" >= 1) AND ("overall_value_score" <= 10))),
    CONSTRAINT "rite_two_consolidation_perceived_value_vs_price_check" CHECK (("perceived_value_vs_price" = ANY (ARRAY['much_less'::"text", 'less'::"text", 'equal'::"text", 'more'::"text", 'much_more'::"text"]))),
    CONSTRAINT "rite_two_consolidation_rite_two_nps_check" CHECK ((("rite_two_nps" >= 0) AND ("rite_two_nps" <= 10))),
    CONSTRAINT "rite_two_consolidation_strategic_clarity_after_check" CHECK ((("strategic_clarity_after" >= 1) AND ("strategic_clarity_after" <= 10))),
    CONSTRAINT "rite_two_consolidation_strategic_clarity_before_check" CHECK ((("strategic_clarity_before" >= 1) AND ("strategic_clarity_before" <= 10)))
);


ALTER TABLE "public"."rite_two_consolidation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scan_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beta_participant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_slug" "text" NOT NULL,
    "session_id" "uuid",
    "clarity_score" integer,
    "relevance_score" integer,
    "actionability_score" integer,
    "surprise_level" integer,
    "biggest_aha" "text",
    "implementation_plan" "text",
    "confusion_points" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "survey_duration_seconds" integer,
    CONSTRAINT "scan_feedback_actionability_score_check" CHECK ((("actionability_score" >= 1) AND ("actionability_score" <= 5))),
    CONSTRAINT "scan_feedback_clarity_score_check" CHECK ((("clarity_score" >= 1) AND ("clarity_score" <= 5))),
    CONSTRAINT "scan_feedback_relevance_score_check" CHECK ((("relevance_score" >= 1) AND ("relevance_score" <= 5))),
    CONSTRAINT "scan_feedback_surprise_level_check" CHECK ((("surprise_level" >= 1) AND ("surprise_level" <= 5)))
);


ALTER TABLE "public"."scan_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_connect_onboarding" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "stripe_account_id" "text" NOT NULL,
    "onboarding_url" "text",
    "onboarding_expires_at" timestamp with time zone,
    "details_submitted" boolean DEFAULT false,
    "charges_enabled" boolean DEFAULT false,
    "payouts_enabled" boolean DEFAULT false,
    "requirements" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_connect_onboarding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."track_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "affiliate_id" "uuid" NOT NULL,
    "previous_track" "text" NOT NULL,
    "new_track" "text" NOT NULL,
    "reason" "text",
    "changed_by_user_id" "uuid",
    "change_type" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_new_track" CHECK (("new_track" = ANY (ARRAY['community_builder'::"text", 'high_performer'::"text", 'independent'::"text"]))),
    CONSTRAINT "valid_previous_track" CHECK (("previous_track" = ANY (ARRAY['community_builder'::"text", 'high_performer'::"text", 'independent'::"text"])))
);


ALTER TABLE "public"."track_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uploaded_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "step_number" integer,
    "file_name" "text" NOT NULL,
    "file_type" "text",
    "file_size" integer,
    "storage_path" "text" NOT NULL,
    "processed" boolean DEFAULT false,
    "extracted_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."uploaded_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."uploaded_documents" IS 'Files uploaded during product experience';



ALTER TABLE ONLY "public"."affiliate_transactions"
    ADD CONSTRAINT "affiliate_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_conversion_results"
    ADD CONSTRAINT "beta_conversion_results_beta_participant_id_key" UNIQUE ("beta_participant_id");



ALTER TABLE ONLY "public"."beta_conversion_results"
    ADD CONSTRAINT "beta_conversion_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_participants"
    ADD CONSTRAINT "beta_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beta_participants"
    ADD CONSTRAINT "beta_participants_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."blueprint_feedback"
    ADD CONSTRAINT "blueprint_feedback_beta_participant_id_product_slug_key" UNIQUE ("beta_participant_id", "product_slug");



ALTER TABLE ONLY "public"."blueprint_feedback"
    ADD CONSTRAINT "blueprint_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."complete_journey_feedback"
    ADD CONSTRAINT "complete_journey_feedback_beta_participant_id_key" UNIQUE ("beta_participant_id");



ALTER TABLE ONLY "public"."complete_journey_feedback"
    ADD CONSTRAINT "complete_journey_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_index"
    ADD CONSTRAINT "content_index_pkey" PRIMARY KEY ("doc_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_session_id_step_number_key" UNIQUE ("session_id", "step_number");



ALTER TABLE ONLY "public"."course_definitions"
    ADD CONSTRAINT "course_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_definitions"
    ADD CONSTRAINT "course_definitions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_user_id_course_slug_key" UNIQUE ("user_id", "course_slug");



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_course_slug_module_id_key" UNIQUE ("course_slug", "module_id");



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_progress"
    ADD CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_progress"
    ADD CONSTRAINT "course_progress_user_id_course_slug_module_id_submodule_id_key" UNIQUE ("user_id", "course_slug", "module_id", "submodule_id");



ALTER TABLE ONLY "public"."course_slide_events"
    ADD CONSTRAINT "course_slide_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_slide_events"
    ADD CONSTRAINT "course_slide_events_user_id_course_slug_module_id_submodule_key" UNIQUE ("user_id", "course_slug", "module_id", "submodule_id", "coord");



ALTER TABLE ONLY "public"."course_submodules"
    ADD CONSTRAINT "course_submodules_course_slug_module_id_submodule_id_key" UNIQUE ("course_slug", "module_id", "submodule_id");



ALTER TABLE ONLY "public"."course_submodules"
    ADD CONSTRAINT "course_submodules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."declaration_feedback"
    ADD CONSTRAINT "declaration_feedback_beta_participant_id_product_slug_key" UNIQUE ("beta_participant_id", "product_slug");



ALTER TABLE ONLY "public"."declaration_feedback"
    ADD CONSTRAINT "declaration_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dinner_party_contributions"
    ADD CONSTRAINT "dinner_party_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dinner_party_pools"
    ADD CONSTRAINT "dinner_party_pools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_sequences"
    ADD CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_access"
    ADD CONSTRAINT "product_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_access"
    ADD CONSTRAINT "product_access_user_id_product_slug_key" UNIQUE ("user_id", "product_slug");



ALTER TABLE ONLY "public"."product_definitions"
    ADD CONSTRAINT "product_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_definitions"
    ADD CONSTRAINT "product_definitions_product_slug_key" UNIQUE ("product_slug");



ALTER TABLE ONLY "public"."product_sessions"
    ADD CONSTRAINT "product_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_steps"
    ADD CONSTRAINT "product_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_steps"
    ADD CONSTRAINT "product_steps_product_id_step_number_key" UNIQUE ("product_id", "step_number");



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompts"
    ADD CONSTRAINT "prompts_product_slug_scope_step_number_key" UNIQUE ("product_slug", "scope", "step_number");



ALTER TABLE ONLY "public"."referral_hierarchy"
    ADD CONSTRAINT "referral_hierarchy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_hierarchy"
    ADD CONSTRAINT "referral_hierarchy_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."rite_one_consolidation"
    ADD CONSTRAINT "rite_one_consolidation_beta_participant_id_key" UNIQUE ("beta_participant_id");



ALTER TABLE ONLY "public"."rite_one_consolidation"
    ADD CONSTRAINT "rite_one_consolidation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rite_two_consolidation"
    ADD CONSTRAINT "rite_two_consolidation_beta_participant_id_key" UNIQUE ("beta_participant_id");



ALTER TABLE ONLY "public"."rite_two_consolidation"
    ADD CONSTRAINT "rite_two_consolidation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scan_feedback"
    ADD CONSTRAINT "scan_feedback_beta_participant_id_product_slug_key" UNIQUE ("beta_participant_id", "product_slug");



ALTER TABLE ONLY "public"."scan_feedback"
    ADD CONSTRAINT "scan_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_connect_onboarding"
    ADD CONSTRAINT "stripe_connect_onboarding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."track_changes"
    ADD CONSTRAINT "track_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_hierarchy"
    ADD CONSTRAINT "unique_affiliate" UNIQUE ("affiliate_id");



ALTER TABLE ONLY "public"."stripe_connect_onboarding"
    ADD CONSTRAINT "unique_affiliate_onboarding" UNIQUE ("affiliate_id");



ALTER TABLE ONLY "public"."email_sequences"
    ADD CONSTRAINT "unique_user_sequence" UNIQUE ("user_id", "sequence_type");



ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "content_index_path_idx" ON "public"."content_index" USING "btree" ("path");



CREATE INDEX "course_enrollments_user_idx" ON "public"."course_enrollments" USING "btree" ("user_id", "course_slug");



CREATE INDEX "course_progress_user_idx" ON "public"."course_progress" USING "btree" ("user_id", "course_slug", "module_id", "submodule_id");



CREATE INDEX "course_slide_events_user_idx" ON "public"."course_slide_events" USING "btree" ("user_id", "course_slug", "module_id", "submodule_id");



CREATE INDEX "course_slide_events_visited_idx" ON "public"."course_slide_events" USING "btree" ("visited_at");



CREATE INDEX "idx_affiliate_transactions_created" ON "public"."affiliate_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_affiliate_transactions_direct_referrer" ON "public"."affiliate_transactions" USING "btree" ("direct_referrer_id");



CREATE INDEX "idx_affiliate_transactions_override_referrer" ON "public"."affiliate_transactions" USING "btree" ("override_referrer_id");



CREATE INDEX "idx_affiliate_transactions_purchaser" ON "public"."affiliate_transactions" USING "btree" ("purchaser_id");



CREATE INDEX "idx_affiliate_transactions_session" ON "public"."affiliate_transactions" USING "btree" ("stripe_session_id");



CREATE INDEX "idx_affiliate_transactions_status" ON "public"."affiliate_transactions" USING "btree" ("commission_status");



CREATE UNIQUE INDEX "idx_audit_error_summary_unique" ON "public"."audit_error_summary" USING "btree" ("event_type", "event_action", COALESCE("error_code", ''::"text"));



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_email_hash" ON "public"."audit_logs" USING "btree" ("user_email_hash");



CREATE INDEX "idx_audit_logs_event_action" ON "public"."audit_logs" USING "btree" ("event_action");



CREATE INDEX "idx_audit_logs_event_status" ON "public"."audit_logs" USING "btree" ("event_status");



CREATE INDEX "idx_audit_logs_event_type" ON "public"."audit_logs" USING "btree" ("event_type");



CREATE INDEX "idx_audit_logs_event_type_status" ON "public"."audit_logs" USING "btree" ("event_type", "event_status");



CREATE INDEX "idx_audit_logs_log_level" ON "public"."audit_logs" USING "btree" ("log_level");



CREATE INDEX "idx_audit_logs_trace_id" ON "public"."audit_logs" USING "btree" ("trace_id");



CREATE INDEX "idx_audit_logs_user_created" ON "public"."audit_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_audit_logs_user_email" ON "public"."audit_logs" USING "btree" ("user_email");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_audit_logs_user_timeline" ON "public"."audit_logs" USING "btree" ("user_id", "event_type", "created_at" DESC);



CREATE INDEX "idx_beta_conversion_date" ON "public"."beta_conversion_results" USING "btree" ("decision_made_at");



CREATE INDEX "idx_beta_conversion_decision" ON "public"."beta_conversion_results" USING "btree" ("decision");



CREATE INDEX "idx_beta_conversion_participant" ON "public"."beta_conversion_results" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_beta_conversion_stage" ON "public"."beta_conversion_results" USING "btree" ("purchased_at_stage");



CREATE INDEX "idx_beta_participants_cohort" ON "public"."beta_participants" USING "btree" ("cohort_name");



CREATE INDEX "idx_beta_participants_current_rite" ON "public"."beta_participants" USING "btree" ("current_rite");



CREATE INDEX "idx_beta_participants_enrollment_date" ON "public"."beta_participants" USING "btree" ("enrollment_date");



CREATE INDEX "idx_beta_participants_status" ON "public"."beta_participants" USING "btree" ("status");



CREATE INDEX "idx_beta_participants_user" ON "public"."beta_participants" USING "btree" ("user_id");



CREATE INDEX "idx_blueprint_feedback_participant" ON "public"."blueprint_feedback" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_blueprint_feedback_product" ON "public"."blueprint_feedback" USING "btree" ("product_slug");



CREATE INDEX "idx_complete_journey_founding" ON "public"."complete_journey_feedback" USING "btree" ("founding_member_interest");



CREATE INDEX "idx_complete_journey_nps" ON "public"."complete_journey_feedback" USING "btree" ("nps_score");



CREATE INDEX "idx_complete_journey_participant" ON "public"."complete_journey_feedback" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_complete_journey_timeline" ON "public"."complete_journey_feedback" USING "btree" ("purchase_timeline");



CREATE INDEX "idx_conversations_session_id" ON "public"."conversations" USING "btree" ("session_id");



CREATE INDEX "idx_conversations_step" ON "public"."conversations" USING "btree" ("session_id", "step_number");



CREATE INDEX "idx_declaration_feedback_participant" ON "public"."declaration_feedback" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_declaration_feedback_product" ON "public"."declaration_feedback" USING "btree" ("product_slug");



CREATE INDEX "idx_dinner_party_contributions_contributor" ON "public"."dinner_party_contributions" USING "btree" ("contributor_id");



CREATE INDEX "idx_dinner_party_contributions_pool" ON "public"."dinner_party_contributions" USING "btree" ("pool_id");



CREATE INDEX "idx_dinner_party_contributions_transaction" ON "public"."dinner_party_contributions" USING "btree" ("transaction_id");



CREATE INDEX "idx_dinner_party_pools_status" ON "public"."dinner_party_pools" USING "btree" ("status");



CREATE INDEX "idx_email_sequences_scheduled" ON "public"."email_sequences" USING "btree" ("scheduled_send_at", "email_status") WHERE ("email_status" = 'scheduled'::"text");



CREATE INDEX "idx_email_sequences_sent_at" ON "public"."email_sequences" USING "btree" ("sent_at") WHERE ("sent_at" IS NOT NULL);



CREATE INDEX "idx_email_sequences_user_id" ON "public"."email_sequences" USING "btree" ("user_id");



CREATE INDEX "idx_product_access_product_slug" ON "public"."product_access" USING "btree" ("product_slug");



CREATE INDEX "idx_product_access_purchase_source" ON "public"."product_access" USING "btree" ("user_id", "purchase_source");



CREATE INDEX "idx_product_access_stripe_session" ON "public"."product_access" USING "btree" ("stripe_session_id");



CREATE INDEX "idx_product_access_user_id" ON "public"."product_access" USING "btree" ("user_id");



CREATE INDEX "idx_product_definitions_active" ON "public"."product_definitions" USING "btree" ("is_active");



CREATE INDEX "idx_product_definitions_group_order" ON "public"."product_definitions" USING "btree" ("product_group", "display_order");



CREATE INDEX "idx_product_definitions_slug" ON "public"."product_definitions" USING "btree" ("product_slug");



CREATE INDEX "idx_product_sessions_complete" ON "public"."product_sessions" USING "btree" ("is_complete");



CREATE INDEX "idx_product_sessions_current_section" ON "public"."product_sessions" USING "btree" ("current_section");



CREATE INDEX "idx_product_sessions_placements_confirmed" ON "public"."product_sessions" USING "btree" ("placements_confirmed");



CREATE INDEX "idx_product_sessions_product_slug" ON "public"."product_sessions" USING "btree" ("product_slug");



CREATE INDEX "idx_product_sessions_scan_number" ON "public"."product_sessions" USING "btree" ("user_id", "scan_number");



CREATE INDEX "idx_product_sessions_user_id" ON "public"."product_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_prompts_lookup" ON "public"."prompts" USING "btree" ("product_slug", "scope", "step_number");



CREATE INDEX "idx_referral_hierarchy_affiliate" ON "public"."referral_hierarchy" USING "btree" ("affiliate_id");



CREATE INDEX "idx_referral_hierarchy_code" ON "public"."referral_hierarchy" USING "btree" ("referral_code");



CREATE INDEX "idx_referral_hierarchy_referred_by" ON "public"."referral_hierarchy" USING "btree" ("referred_by_id");



CREATE INDEX "idx_referral_hierarchy_stripe_account" ON "public"."referral_hierarchy" USING "btree" ("stripe_connect_account_id");



CREATE INDEX "idx_rite_one_consolidation_nps" ON "public"."rite_one_consolidation" USING "btree" ("rite_one_nps");



CREATE INDEX "idx_rite_one_consolidation_participant" ON "public"."rite_one_consolidation" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_rite_two_consolidation_nps" ON "public"."rite_two_consolidation" USING "btree" ("rite_two_nps");



CREATE INDEX "idx_rite_two_consolidation_participant" ON "public"."rite_two_consolidation" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_scan_feedback_participant" ON "public"."scan_feedback" USING "btree" ("beta_participant_id");



CREATE INDEX "idx_scan_feedback_product" ON "public"."scan_feedback" USING "btree" ("product_slug");



CREATE INDEX "idx_scan_feedback_submitted" ON "public"."scan_feedback" USING "btree" ("submitted_at");



CREATE INDEX "idx_sessions_parent" ON "public"."product_sessions" USING "btree" ("parent_session_id");



CREATE INDEX "idx_sessions_user_product_version" ON "public"."product_sessions" USING "btree" ("user_id", "product_slug", "version" DESC);



CREATE INDEX "idx_stripe_connect_onboarding_account" ON "public"."stripe_connect_onboarding" USING "btree" ("stripe_account_id");



CREATE INDEX "idx_stripe_connect_onboarding_affiliate" ON "public"."stripe_connect_onboarding" USING "btree" ("affiliate_id");



CREATE INDEX "idx_track_changes_affiliate" ON "public"."track_changes" USING "btree" ("affiliate_id");



CREATE INDEX "idx_track_changes_created" ON "public"."track_changes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_uploaded_documents_session_id" ON "public"."uploaded_documents" USING "btree" ("session_id");



CREATE INDEX "idx_uploaded_documents_user_id" ON "public"."uploaded_documents" USING "btree" ("user_id");



CREATE INDEX "idx_users_affiliate_opted_out" ON "public"."users" USING "btree" ("affiliate_opted_out") WHERE ("affiliate_opted_out" = true);



CREATE INDEX "idx_users_earnings" ON "public"."users" USING "btree" ("total_earnings_cents" DESC);



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_first_affiliate_visit" ON "public"."users" USING "btree" ("first_affiliate_visit");



CREATE INDEX "idx_users_is_affiliate" ON "public"."users" USING "btree" ("is_affiliate");



CREATE INDEX "idx_users_placements_confirmed" ON "public"."users" USING "btree" ("placements_confirmed") WHERE ("placements_confirmed" = true);



CREATE INDEX "idx_users_placements_updated" ON "public"."users" USING "btree" ("placements_updated_at" DESC NULLS LAST) WHERE ("placements_updated_at" IS NOT NULL);



CREATE INDEX "idx_users_stripe_customer_id" ON "public"."users" USING "btree" ("stripe_customer_id");



CREATE UNIQUE INDEX "users_email_normalized_unique" ON "public"."users" USING "btree" ("lower"(TRIM(BOTH FROM "email")));



CREATE OR REPLACE TRIGGER "auto_copy_placements_trigger" BEFORE INSERT ON "public"."product_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."auto_copy_placements_to_new_session"();



CREATE OR REPLACE TRIGGER "auto_grant_test_access_trigger" AFTER INSERT ON "public"."product_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."auto_grant_test_access_on_new_product"();



CREATE OR REPLACE TRIGGER "trigger_auto_enroll_affiliate" AFTER INSERT ON "public"."product_access" FOR EACH ROW EXECUTE FUNCTION "public"."auto_enroll_affiliate"();



CREATE OR REPLACE TRIGGER "trigger_log_affiliate_enrollment" AFTER INSERT ON "public"."referral_hierarchy" FOR EACH ROW EXECUTE FUNCTION "public"."log_affiliate_enrollment"();



CREATE OR REPLACE TRIGGER "trigger_log_product_access" AFTER INSERT ON "public"."product_access" FOR EACH ROW EXECUTE FUNCTION "public"."log_product_access_grant"();



CREATE OR REPLACE TRIGGER "trigger_log_user_creation" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."log_user_creation"();



CREATE OR REPLACE TRIGGER "trigger_normalize_user_email" BEFORE INSERT OR UPDATE OF "email" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_user_email"();



CREATE OR REPLACE TRIGGER "trigger_notify_critical_error" AFTER INSERT ON "public"."audit_logs" FOR EACH ROW EXECUTE FUNCTION "public"."notify_critical_error"();



CREATE OR REPLACE TRIGGER "trigger_sync_product_access_completion" AFTER UPDATE OF "completed_at" ON "public"."product_sessions" FOR EACH ROW WHEN ((("new"."completed_at" IS NOT NULL) AND ("old"."completed_at" IS NULL))) EXECUTE FUNCTION "public"."sync_product_access_completion"();



CREATE OR REPLACE TRIGGER "trigger_update_beta_progress" AFTER UPDATE OF "completed_at" ON "public"."product_access" FOR EACH ROW WHEN ((("new"."completed_at" IS NOT NULL) AND ("old"."completed_at" IS NULL))) EXECUTE FUNCTION "public"."update_beta_participant_progress"();



CREATE OR REPLACE TRIGGER "trigger_update_blueprint_feedback_count" AFTER INSERT ON "public"."blueprint_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_beta_feedback_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_declaration_feedback_count" AFTER INSERT ON "public"."declaration_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_beta_feedback_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_email_sequences_updated_at" BEFORE UPDATE ON "public"."email_sequences" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_sequences_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_journey_feedback_count" AFTER INSERT ON "public"."complete_journey_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_beta_feedback_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_rite_one_consolidation_count" AFTER INSERT ON "public"."rite_one_consolidation" FOR EACH ROW EXECUTE FUNCTION "public"."update_beta_feedback_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_rite_two_consolidation_count" AFTER INSERT ON "public"."rite_two_consolidation" FOR EACH ROW EXECUTE FUNCTION "public"."update_beta_feedback_counts"();



CREATE OR REPLACE TRIGGER "trigger_update_scan_feedback_count" AFTER INSERT ON "public"."scan_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_beta_feedback_counts"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_definitions_updated_at" BEFORE UPDATE ON "public"."product_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_sessions_updated_at" BEFORE UPDATE ON "public"."product_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."affiliate_transactions"
    ADD CONSTRAINT "affiliate_transactions_direct_referrer_id_fkey" FOREIGN KEY ("direct_referrer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_transactions"
    ADD CONSTRAINT "affiliate_transactions_override_referrer_id_fkey" FOREIGN KEY ("override_referrer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."affiliate_transactions"
    ADD CONSTRAINT "affiliate_transactions_purchaser_id_fkey" FOREIGN KEY ("purchaser_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."beta_conversion_results"
    ADD CONSTRAINT "beta_conversion_results_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beta_conversion_results"
    ADD CONSTRAINT "beta_conversion_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beta_participants"
    ADD CONSTRAINT "beta_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blueprint_feedback"
    ADD CONSTRAINT "blueprint_feedback_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blueprint_feedback"
    ADD CONSTRAINT "blueprint_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."product_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blueprint_feedback"
    ADD CONSTRAINT "blueprint_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."complete_journey_feedback"
    ADD CONSTRAINT "complete_journey_feedback_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."complete_journey_feedback"
    ADD CONSTRAINT "complete_journey_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."product_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_course_slug_fkey" FOREIGN KEY ("course_slug") REFERENCES "public"."course_definitions"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_enrollments"
    ADD CONSTRAINT "course_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_modules"
    ADD CONSTRAINT "course_modules_course_slug_fkey" FOREIGN KEY ("course_slug") REFERENCES "public"."course_definitions"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_progress"
    ADD CONSTRAINT "course_progress_course_slug_fkey" FOREIGN KEY ("course_slug") REFERENCES "public"."course_definitions"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_progress"
    ADD CONSTRAINT "course_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_slide_events"
    ADD CONSTRAINT "course_slide_events_course_slug_fkey" FOREIGN KEY ("course_slug") REFERENCES "public"."course_definitions"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_slide_events"
    ADD CONSTRAINT "course_slide_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_submodules"
    ADD CONSTRAINT "course_submodules_course_slug_fkey" FOREIGN KEY ("course_slug") REFERENCES "public"."course_definitions"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_submodules"
    ADD CONSTRAINT "course_submodules_module_fk" FOREIGN KEY ("course_slug", "module_id") REFERENCES "public"."course_modules"("course_slug", "module_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."declaration_feedback"
    ADD CONSTRAINT "declaration_feedback_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."declaration_feedback"
    ADD CONSTRAINT "declaration_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."product_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."declaration_feedback"
    ADD CONSTRAINT "declaration_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dinner_party_contributions"
    ADD CONSTRAINT "dinner_party_contributions_contributor_id_fkey" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dinner_party_contributions"
    ADD CONSTRAINT "dinner_party_contributions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."dinner_party_pools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dinner_party_contributions"
    ADD CONSTRAINT "dinner_party_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."affiliate_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_sequences"
    ADD CONSTRAINT "email_sequences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_access"
    ADD CONSTRAINT "product_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_sessions"
    ADD CONSTRAINT "product_sessions_parent_session_id_fkey" FOREIGN KEY ("parent_session_id") REFERENCES "public"."product_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_sessions"
    ADD CONSTRAINT "product_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_hierarchy"
    ADD CONSTRAINT "referral_hierarchy_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_hierarchy"
    ADD CONSTRAINT "referral_hierarchy_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."rite_one_consolidation"
    ADD CONSTRAINT "rite_one_consolidation_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rite_one_consolidation"
    ADD CONSTRAINT "rite_one_consolidation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rite_two_consolidation"
    ADD CONSTRAINT "rite_two_consolidation_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rite_two_consolidation"
    ADD CONSTRAINT "rite_two_consolidation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scan_feedback"
    ADD CONSTRAINT "scan_feedback_beta_participant_id_fkey" FOREIGN KEY ("beta_participant_id") REFERENCES "public"."beta_participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scan_feedback"
    ADD CONSTRAINT "scan_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."product_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scan_feedback"
    ADD CONSTRAINT "scan_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_connect_onboarding"
    ADD CONSTRAINT "stripe_connect_onboarding_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_changes"
    ADD CONSTRAINT "track_changes_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."track_changes"
    ADD CONSTRAINT "track_changes_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."product_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uploaded_documents"
    ADD CONSTRAINT "uploaded_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated insert" ON "public"."uploaded_documents" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated select" ON "public"."uploaded_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anonymous users can read product steps" ON "public"."product_steps" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anonymous users can read prompts" ON "public"."prompts" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anyone can read active products" ON "public"."product_definitions" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Authenticated users can read product steps" ON "public"."product_steps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read prompts" ON "public"."prompts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view pools" ON "public"."dinner_party_pools" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Public read course_definitions" ON "public"."course_definitions" FOR SELECT USING (true);



CREATE POLICY "Public read course_modules" ON "public"."course_modules" FOR SELECT USING (true);



CREATE POLICY "Public read course_submodules" ON "public"."course_submodules" FOR SELECT USING (true);



CREATE POLICY "Service role can manage affiliate transactions" ON "public"."affiliate_transactions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage contributions" ON "public"."dinner_party_contributions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage conversations" ON "public"."conversations" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage dinner party pools" ON "public"."dinner_party_pools" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage onboarding" ON "public"."stripe_connect_onboarding" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage product access" ON "public"."product_access" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage products" ON "public"."product_definitions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage referral hierarchy" ON "public"."referral_hierarchy" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage sessions" ON "public"."product_sessions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage track changes" ON "public"."track_changes" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role can manage uploads" ON "public"."uploaded_documents" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role full access beta participants" ON "public"."beta_participants" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access blueprint feedback" ON "public"."blueprint_feedback" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access conversion results" ON "public"."beta_conversion_results" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access declaration feedback" ON "public"."declaration_feedback" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access journey feedback" ON "public"."complete_journey_feedback" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access rite one consolidation" ON "public"."rite_one_consolidation" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access rite two consolidation" ON "public"."rite_two_consolidation" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access scan feedback" ON "public"."scan_feedback" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access to email sequences" ON "public"."email_sequences" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to product steps" ON "public"."product_steps" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role has full access to prompts" ON "public"."prompts" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role has full access to users" ON "public"."users" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can create conversations for own sessions" ON "public"."conversations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."product_sessions"
  WHERE (("product_sessions"."id" = "conversations"."session_id") AND (("product_sessions"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can create sessions for owned products" ON "public"."product_sessions" FOR INSERT WITH CHECK (((("auth"."uid"())::"text" = ("user_id")::"text") AND (EXISTS ( SELECT 1
   FROM "public"."product_access"
  WHERE (("product_access"."user_id" = "product_sessions"."user_id") AND ("product_access"."product_slug" = "product_sessions"."product_slug") AND ("product_access"."access_granted" = true))))));



CREATE POLICY "Users can delete own uploads" ON "public"."uploaded_documents" FOR DELETE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."product_sessions"
  WHERE (("product_sessions"."id" = "conversations"."session_id") AND (("product_sessions"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING ((("auth"."uid"())::"text" = ("id")::"text"));



CREATE POLICY "Users can update own sessions" ON "public"."product_sessions" FOR UPDATE USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can update own track" ON "public"."referral_hierarchy" FOR UPDATE USING (("auth"."uid"() = "affiliate_id")) WITH CHECK (("auth"."uid"() = "affiliate_id"));



CREATE POLICY "Users can upload for own sessions" ON "public"."uploaded_documents" FOR INSERT WITH CHECK (((("auth"."uid"())::"text" = ("user_id")::"text") AND (EXISTS ( SELECT 1
   FROM "public"."product_sessions"
  WHERE (("product_sessions"."id" = "uploaded_documents"."session_id") AND (("product_sessions"."user_id")::"text" = ("auth"."uid"())::"text"))))));



CREATE POLICY "Users can view own affiliate transactions" ON "public"."affiliate_transactions" FOR SELECT USING ((("auth"."uid"() = "purchaser_id") OR ("auth"."uid"() = "direct_referrer_id") OR ("auth"."uid"() = "override_referrer_id")));



CREATE POLICY "Users can view own contributions" ON "public"."dinner_party_contributions" FOR SELECT USING (("auth"."uid"() = "contributor_id"));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."product_sessions"
  WHERE (("product_sessions"."id" = "conversations"."session_id") AND (("product_sessions"."user_id")::"text" = ("auth"."uid"())::"text")))));



CREATE POLICY "Users can view own email sequences" ON "public"."email_sequences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own onboarding" ON "public"."stripe_connect_onboarding" FOR SELECT USING (("auth"."uid"() = "affiliate_id"));



CREATE POLICY "Users can view own product access" ON "public"."product_access" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT USING ((("auth"."uid"())::"text" = ("id")::"text"));



CREATE POLICY "Users can view own referral hierarchy" ON "public"."referral_hierarchy" FOR SELECT USING (("auth"."uid"() = "affiliate_id"));



CREATE POLICY "Users can view own sessions" ON "public"."product_sessions" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users can view own track changes" ON "public"."track_changes" FOR SELECT USING (("auth"."uid"() = "affiliate_id"));



CREATE POLICY "Users can view own uploads" ON "public"."uploaded_documents" FOR SELECT USING ((("auth"."uid"())::"text" = ("user_id")::"text"));



CREATE POLICY "Users insert own course_enrollments" ON "public"."course_enrollments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own course_enrollments" ON "public"."course_enrollments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own course_progress" ON "public"."course_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own course_slide_events" ON "public"."course_slide_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own course_enrollments" ON "public"."course_enrollments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own course_progress" ON "public"."course_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own beta participation" ON "public"."beta_participants" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own blueprint feedback" ON "public"."blueprint_feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own conversion results" ON "public"."beta_conversion_results" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own declaration feedback" ON "public"."declaration_feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own journey feedback" ON "public"."complete_journey_feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own rite one consolidation" ON "public"."rite_one_consolidation" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own rite two consolidation" ON "public"."rite_two_consolidation" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own scan feedback" ON "public"."scan_feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users write own course_progress" ON "public"."course_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users write own course_slide_events" ON "public"."course_slide_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."affiliate_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beta_conversion_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beta_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blueprint_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."complete_journey_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_slide_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_submodules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."declaration_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dinner_party_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dinner_party_pools" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_hierarchy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rite_one_consolidation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rite_two_consolidation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scan_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_connect_onboarding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."track_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."uploaded_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_dinner_party_contribution"("p_contributor_id" "uuid", "p_transaction_id" "uuid", "p_amount_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_dinner_party_contribution"("p_contributor_id" "uuid", "p_transaction_id" "uuid", "p_amount_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_dinner_party_contribution"("p_contributor_id" "uuid", "p_transaction_id" "uuid", "p_amount_cents" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_old_audit_logs"("days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_old_audit_logs"("days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_old_audit_logs"("days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_copy_placements_to_new_session"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_copy_placements_to_new_session"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_copy_placements_to_new_session"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_enroll_affiliate"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_enroll_affiliate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_enroll_affiliate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_grant_test_access_on_new_product"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_grant_test_access_on_new_product"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_grant_test_access_on_new_product"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_commission"("p_amount_cents" integer, "p_track" "text", "p_is_direct" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_commission"("p_amount_cents" integer, "p_track" "text", "p_is_direct" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_commission"("p_amount_cents" integer, "p_track" "text", "p_is_direct" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_dinner_party_contribution"("p_amount_cents" integer, "p_track" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_dinner_party_contribution"("p_amount_cents" integer, "p_track" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_dinner_party_contribution"("p_amount_cents" integer, "p_track" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_create_new_version"("p_user_id" "uuid", "p_product_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_create_new_version"("p_user_id" "uuid", "p_product_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_create_new_version"("p_user_id" "uuid", "p_product_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_user_pending_emails"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_user_pending_emails"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_user_pending_emails"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_email_sequences"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_email_sequences"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_email_sequences"("days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."copy_placements_between_sessions"("source_session_id" "uuid", "target_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."copy_placements_between_sessions"("source_session_id" "uuid", "target_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."copy_placements_between_sessions"("source_session_id" "uuid", "target_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_session_version"("p_user_id" "uuid", "p_product_slug" "text", "p_parent_session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_session_version"("p_user_id" "uuid", "p_product_slug" "text", "p_parent_session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_session_version"("p_user_id" "uuid", "p_product_slug" "text", "p_parent_session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enroll_beta_participant"("p_user_id" "uuid", "p_user_email" "text", "p_why_participate" "text", "p_cohort_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enroll_beta_participant"("p_user_id" "uuid", "p_user_email" "text", "p_why_participate" "text", "p_cohort_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enroll_beta_participant"("p_user_id" "uuid", "p_user_email" "text", "p_why_participate" "text", "p_cohort_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_affiliate_stats"("p_affiliate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_affiliate_stats"("p_affiliate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_affiliate_stats"("p_affiliate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_session_versions"("p_user_id" "uuid", "p_product_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_session_versions"("p_user_id" "uuid", "p_product_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_session_versions"("p_user_id" "uuid", "p_product_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_slow_requests"("threshold_ms" integer, "hours_ago" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_slow_requests"("threshold_ms" integer, "hours_ago" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_slow_requests"("threshold_ms" integer, "hours_ago" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_product_access"("p_email" "text", "p_product_slug" "text", "p_stripe_session_id" "text", "p_amount_paid" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."grant_product_access"("p_email" "text", "p_product_slug" "text", "p_stripe_session_id" "text", "p_amount_paid" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_product_access"("p_email" "text", "p_product_slug" "text", "p_stripe_session_id" "text", "p_amount_paid" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_test_account_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."grant_test_account_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_test_account_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_affiliate_earnings"("p_affiliate_id" "uuid", "p_amount_cents" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_affiliate_earnings"("p_affiliate_id" "uuid", "p_amount_cents" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_affiliate_earnings"("p_affiliate_id" "uuid", "p_amount_cents" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_referral_count"("p_referrer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_referral_count"("p_referrer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_referral_count"("p_referrer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_affiliate_enrollment"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_affiliate_enrollment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_affiliate_enrollment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_event_type" "text", "p_event_action" "text", "p_event_status" "text", "p_metadata" "jsonb", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_event_type" "text", "p_event_action" "text", "p_event_status" "text", "p_metadata" "jsonb", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_event"("p_user_id" "uuid", "p_event_type" "text", "p_event_action" "text", "p_event_status" "text", "p_metadata" "jsonb", "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_product_access_grant"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_product_access_grant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_product_access_grant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_session_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_session_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_session_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_user_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_user_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_user_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_user_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_user_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_user_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_critical_error"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_critical_error"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_critical_error"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_course_slide_event"("p_user_id" "uuid", "p_course_slug" "text", "p_module_id" "text", "p_submodule_id" "text", "p_coord" "text", "p_coord_x" integer, "p_coord_y" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_course_slide_event"("p_user_id" "uuid", "p_course_slug" "text", "p_module_id" "text", "p_submodule_id" "text", "p_coord" "text", "p_coord_x" integer, "p_coord_y" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_course_slide_event"("p_user_id" "uuid", "p_course_slug" "text", "p_module_id" "text", "p_submodule_id" "text", "p_coord" "text", "p_coord_x" integer, "p_coord_y" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."redact_user_logs"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."redact_user_logs"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redact_user_logs"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_audit_error_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_audit_error_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_audit_error_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_product_access_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_product_access_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_product_access_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_beta_feedback_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_beta_feedback_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_beta_feedback_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_beta_participant_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_beta_participant_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_beta_participant_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_sequences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_sequences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_sequences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_progress"("p_session_id" "uuid", "p_current_step" integer, "p_total_steps" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_progress"("p_session_id" "uuid", "p_current_step" integer, "p_total_steps" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_progress"("p_session_id" "uuid", "p_current_step" integer, "p_total_steps" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_transactions" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."audit_logs" TO PUBLIC;



GRANT ALL ON TABLE "public"."audit_error_summary" TO "anon";
GRANT ALL ON TABLE "public"."audit_error_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_error_summary" TO "service_role";



GRANT ALL ON TABLE "public"."beta_conversion_results" TO "anon";
GRANT ALL ON TABLE "public"."beta_conversion_results" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_conversion_results" TO "service_role";



GRANT ALL ON TABLE "public"."beta_participants" TO "anon";
GRANT ALL ON TABLE "public"."beta_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_participants" TO "service_role";



GRANT ALL ON TABLE "public"."blueprint_feedback" TO "anon";
GRANT ALL ON TABLE "public"."blueprint_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."blueprint_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."complete_journey_feedback" TO "anon";
GRANT ALL ON TABLE "public"."complete_journey_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."complete_journey_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."content_index" TO "anon";
GRANT ALL ON TABLE "public"."content_index" TO "authenticated";
GRANT ALL ON TABLE "public"."content_index" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."course_definitions" TO "anon";
GRANT ALL ON TABLE "public"."course_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."course_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."course_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."course_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."course_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."course_modules" TO "anon";
GRANT ALL ON TABLE "public"."course_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."course_modules" TO "service_role";



GRANT ALL ON TABLE "public"."course_progress" TO "anon";
GRANT ALL ON TABLE "public"."course_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."course_progress" TO "service_role";



GRANT ALL ON TABLE "public"."course_slide_events" TO "anon";
GRANT ALL ON TABLE "public"."course_slide_events" TO "authenticated";
GRANT ALL ON TABLE "public"."course_slide_events" TO "service_role";



GRANT ALL ON TABLE "public"."course_submodules" TO "anon";
GRANT ALL ON TABLE "public"."course_submodules" TO "authenticated";
GRANT ALL ON TABLE "public"."course_submodules" TO "service_role";



GRANT ALL ON TABLE "public"."declaration_feedback" TO "anon";
GRANT ALL ON TABLE "public"."declaration_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."declaration_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."dinner_party_contributions" TO "anon";
GRANT ALL ON TABLE "public"."dinner_party_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."dinner_party_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."dinner_party_pools" TO "anon";
GRANT ALL ON TABLE "public"."dinner_party_pools" TO "authenticated";
GRANT ALL ON TABLE "public"."dinner_party_pools" TO "service_role";



GRANT ALL ON TABLE "public"."email_sequences" TO "anon";
GRANT ALL ON TABLE "public"."email_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."email_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."error_logs" TO "anon";
GRANT ALL ON TABLE "public"."error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."product_access" TO "anon";
GRANT ALL ON TABLE "public"."product_access" TO "authenticated";
GRANT ALL ON TABLE "public"."product_access" TO "service_role";



GRANT ALL ON TABLE "public"."product_definitions" TO "anon";
GRANT ALL ON TABLE "public"."product_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."product_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."product_definitions_backup_20260101" TO "anon";
GRANT ALL ON TABLE "public"."product_definitions_backup_20260101" TO "authenticated";
GRANT ALL ON TABLE "public"."product_definitions_backup_20260101" TO "service_role";



GRANT ALL ON TABLE "public"."product_sessions" TO "anon";
GRANT ALL ON TABLE "public"."product_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."product_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."product_steps" TO "anon";
GRANT ALL ON TABLE "public"."product_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."product_steps" TO "service_role";



GRANT ALL ON TABLE "public"."prompts" TO "anon";
GRANT ALL ON TABLE "public"."prompts" TO "authenticated";
GRANT ALL ON TABLE "public"."prompts" TO "service_role";



GRANT ALL ON TABLE "public"."recent_user_activity" TO "anon";
GRANT ALL ON TABLE "public"."recent_user_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_user_activity" TO "service_role";



GRANT ALL ON TABLE "public"."referral_hierarchy" TO "anon";
GRANT ALL ON TABLE "public"."referral_hierarchy" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_hierarchy" TO "service_role";



GRANT ALL ON TABLE "public"."rite_one_consolidation" TO "anon";
GRANT ALL ON TABLE "public"."rite_one_consolidation" TO "authenticated";
GRANT ALL ON TABLE "public"."rite_one_consolidation" TO "service_role";



GRANT ALL ON TABLE "public"."rite_two_consolidation" TO "anon";
GRANT ALL ON TABLE "public"."rite_two_consolidation" TO "authenticated";
GRANT ALL ON TABLE "public"."rite_two_consolidation" TO "service_role";



GRANT ALL ON TABLE "public"."scan_feedback" TO "anon";
GRANT ALL ON TABLE "public"."scan_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."scan_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_connect_onboarding" TO "anon";
GRANT ALL ON TABLE "public"."stripe_connect_onboarding" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_connect_onboarding" TO "service_role";



GRANT ALL ON TABLE "public"."track_changes" TO "anon";
GRANT ALL ON TABLE "public"."track_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."track_changes" TO "service_role";



GRANT ALL ON TABLE "public"."uploaded_documents" TO "anon";
GRANT ALL ON TABLE "public"."uploaded_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."uploaded_documents" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







