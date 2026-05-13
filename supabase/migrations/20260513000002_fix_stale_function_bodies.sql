-- =====================================================
-- Fix stale function bodies referencing dropped columns
--
-- Columns dropped in 20260204190900_remote_schema.sql:
--   audit_logs.duration_ms
--   audit_logs.request_body
--   audit_logs.response_body
--   product_sessions.completion_percentage (not in ps, only product_access)
--
-- Functions fixed:
--   1. redact_user_logs          — remove request_body / response_body
--   2. get_user_activity_summary — remove avg_duration_ms (return type change → drop/recreate)
--   3. get_slow_requests         — entirely depends on duration_ms; dropped
--   4. update_session_progress   — remove completion_percentage from product_sessions UPDATE
--   5. record_course_slide_event — remove unused is_furthest variable (warning)
-- =====================================================


-- ─── 1. redact_user_logs ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.redact_user_logs(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  redacted_count integer;
BEGIN
  UPDATE audit_logs
  SET
    user_email      = NULL,
    user_email_hash = NULL,
    ip_address      = NULL,
    user_agent      = NULL,
    metadata        = jsonb_build_object('redacted', true, 'redacted_at', NOW())
  WHERE user_id     = p_user_id
    AND event_status = 'success';

  GET DIAGNOSTICS redacted_count = ROW_COUNT;
  RETURN redacted_count;
END;
$$;


-- ─── 2. get_user_activity_summary — return type changed, must drop first ─────

DROP FUNCTION IF EXISTS public.get_user_activity_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_user_activity_summary(p_user_id uuid)
RETURNS TABLE(
  event_type     text,
  total_events   bigint,
  success_count  bigint,
  error_count    bigint,
  last_activity  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.event_type,
    COUNT(*)                                              AS total_events,
    COUNT(*) FILTER (WHERE al.event_status = 'success')  AS success_count,
    COUNT(*) FILTER (WHERE al.event_status = 'error')    AS error_count,
    MAX(al.created_at)                                   AS last_activity
  FROM audit_logs al
  WHERE al.user_id = p_user_id
  GROUP BY al.event_type
  ORDER BY total_events DESC;
END;
$$;


-- ─── 3. get_slow_requests — drop (entirely depends on duration_ms) ───────────

DROP FUNCTION IF EXISTS public.get_slow_requests(integer, integer);


-- ─── 4. update_session_progress ──────────────────────────────────────────────
-- product_sessions no longer has completion_percentage; product_access still does.

CREATE OR REPLACE FUNCTION public.update_session_progress(
  p_session_id  uuid,
  p_current_step integer,
  p_total_steps  integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_percentage integer;
BEGIN
  v_percentage := ROUND((p_current_step::decimal / p_total_steps) * 100);

  UPDATE public.product_sessions
  SET
    current_step     = p_current_step,
    last_activity_at = NOW()
  WHERE id = p_session_id;

  UPDATE public.product_access
  SET completion_percentage = v_percentage
  WHERE user_id      = (SELECT user_id      FROM public.product_sessions WHERE id = p_session_id)
    AND product_slug = (SELECT product_slug FROM public.product_sessions WHERE id = p_session_id);
END;
$$;


-- ─── 5. record_course_slide_event — remove unused is_furthest variable ───────

CREATE OR REPLACE FUNCTION public.record_course_slide_event(
  p_user_id      uuid,
  p_course_slug  text,
  p_module_id    text,
  p_submodule_id text,
  p_coord        text,
  p_coord_x      integer,
  p_coord_y      integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  use_coord_x integer := COALESCE(p_coord_x, 0);
  use_coord_y integer := COALESCE(p_coord_y, 0);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO course_slide_events (
    user_id, course_slug, module_id, submodule_id, coord, coord_x, coord_y
  )
  VALUES (
    p_user_id, p_course_slug, p_module_id, p_submodule_id,
    p_coord, use_coord_x, use_coord_y
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO course_progress (
    user_id, course_slug, module_id, submodule_id,
    current_coord, max_coord, max_coord_x, max_coord_y,
    started_at, last_activity_at
  )
  VALUES (
    p_user_id, p_course_slug, p_module_id, p_submodule_id,
    p_coord, p_coord, use_coord_x, use_coord_y,
    now(), now()
  )
  ON CONFLICT (user_id, course_slug, module_id, submodule_id)
  DO UPDATE SET
    current_coord   = EXCLUDED.current_coord,
    last_activity_at = now(),
    max_coord_x = CASE
      WHEN course_progress.max_coord_x IS NULL                                                          THEN use_coord_x
      WHEN use_coord_x > course_progress.max_coord_x                                                   THEN use_coord_x
      WHEN use_coord_x = course_progress.max_coord_x AND use_coord_y > course_progress.max_coord_y     THEN use_coord_x
      ELSE course_progress.max_coord_x
    END,
    max_coord_y = CASE
      WHEN course_progress.max_coord_y IS NULL                                                          THEN use_coord_y
      WHEN use_coord_x > course_progress.max_coord_x                                                   THEN use_coord_y
      WHEN use_coord_x = course_progress.max_coord_x AND use_coord_y > course_progress.max_coord_y     THEN use_coord_y
      ELSE course_progress.max_coord_y
    END,
    max_coord = CASE
      WHEN course_progress.max_coord_x IS NULL                                                          THEN p_coord
      WHEN use_coord_x > course_progress.max_coord_x                                                   THEN p_coord
      WHEN use_coord_x = course_progress.max_coord_x AND use_coord_y > course_progress.max_coord_y     THEN p_coord
      ELSE course_progress.max_coord
    END;
END;
$$;
