-- SECURITY FIX (2026-11-14): enroll_beta_participant was executable by anon and authenticated.
--
-- The function is SECURITY DEFINER and takes p_user_id, so anyone holding the public anon key
-- could call it over PostgREST (/rest/v1/rpc/enroll_beta_participant) for any user id and grant
-- that account all 11 Rite products. Verified live: has_function_privilege('anon', ...) = true.
--
-- Its only caller is /api/beta/enroll-auth, which uses the service-role client and checks the
-- signed-in user itself, so restricting EXECUTE to service_role changes nothing for real users.
-- Privileges only; the function body is untouched.

REVOKE ALL ON FUNCTION public.enroll_beta_participant(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enroll_beta_participant(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.enroll_beta_participant(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_beta_participant(uuid, text, text, text) TO service_role;
