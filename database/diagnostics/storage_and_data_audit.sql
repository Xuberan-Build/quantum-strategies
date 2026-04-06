-- =====================================================
-- Storage Buckets & User Data Audit
-- Check file organization, user data privacy, and content
-- =====================================================

-- 1. STORAGE BUCKETS OVERVIEW
SELECT '=== STORAGE BUCKETS ===' as section;
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
ORDER BY created_at;

-- 2. FILES IN STORAGE (grouped by bucket)
SELECT '=== FILES BY BUCKET ===' as section;
SELECT
  bucket_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size,
  MIN(created_at) as oldest_file,
  MAX(created_at) as newest_file
FROM storage.objects
GROUP BY bucket_id
ORDER BY SUM((metadata->>'size')::bigint) DESC;

-- 3. FILES PER USER (user-uploads bucket)
SELECT '=== FILES PER USER ===' as section;
SELECT
  SPLIT_PART(name, '/', 1) as user_id,
  COUNT(*) as file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size,
  ARRAY_AGG(DISTINCT SPLIT_PART(name, '/', 2)) as session_ids
FROM storage.objects
WHERE bucket_id = 'user-uploads'
GROUP BY SPLIT_PART(name, '/', 1)
ORDER BY SUM((metadata->>'size')::bigint) DESC;

-- 4. ORPHANED FILES (files without corresponding uploaded_documents record)
SELECT '=== ORPHANED FILES IN STORAGE ===' as section;
SELECT
  so.name as storage_path,
  so.bucket_id,
  pg_size_pretty((so.metadata->>'size')::bigint) as size,
  so.created_at,
  'No database record' as issue
FROM storage.objects so
LEFT JOIN uploaded_documents ud ON so.name = ud.storage_path
WHERE so.bucket_id = 'user-uploads'
  AND ud.id IS NULL
ORDER BY so.created_at DESC
LIMIT 50;

-- 5. DATABASE RECORDS WITHOUT FILES (missing files in storage)
SELECT '=== MISSING FILES (database record but no file) ===' as section;
SELECT
  ud.id,
  ud.storage_path,
  ud.file_name,
  ud.session_id,
  ud.created_at,
  'File not in storage' as issue
FROM uploaded_documents ud
LEFT JOIN storage.objects so ON ud.storage_path = so.name AND so.bucket_id = 'user-uploads'
WHERE so.name IS NULL
ORDER BY ud.created_at DESC
LIMIT 50;

-- 6. USER DELIVERABLES (product outputs generated)
SELECT '=== USER DELIVERABLES ===' as section;
SELECT
  u.email,
  ps.product_slug,
  CASE
    WHEN ps.deliverable_content IS NOT NULL THEN 'Generated'
    ELSE 'Not Generated'
  END as deliverable_status,
  LENGTH(ps.deliverable_content) as deliverable_length,
  ps.deliverable_generated_at,
  ps.completed_at,
  ps.is_complete
FROM product_sessions ps
JOIN auth.users u ON ps.user_id = u.id
ORDER BY ps.created_at DESC
LIMIT 50;

-- 7. CONVERSATION DATA PER USER
SELECT '=== CONVERSATION DATA PER USER ===' as section;
SELECT
  u.email,
  COUNT(DISTINCT c.session_id) as sessions_with_conversations,
  COUNT(c.id) as total_conversation_steps,
  SUM(jsonb_array_length(c.messages)) as total_messages,
  pg_size_pretty(SUM(LENGTH(c.messages::text))::bigint) as total_conversation_size
FROM auth.users u
LEFT JOIN product_sessions ps ON u.id = ps.user_id
LEFT JOIN conversations c ON ps.id = c.session_id
GROUP BY u.email
ORDER BY SUM(LENGTH(c.messages::text)) DESC NULLS LAST;

-- 8. PLACEMENTS DATA (chart data stored)
SELECT '=== USER PLACEMENTS DATA ===' as section;
SELECT
  u.email,
  ps.product_slug,
  ps.placements_confirmed,
  CASE
    WHEN ps.placements IS NOT NULL THEN LENGTH(ps.placements::text)
    ELSE 0
  END as placements_size,
  ps.placements->'astrology'->>'sun' as sun_sign,
  ps.placements->'human_design'->>'type' as hd_type,
  ps.created_at
FROM product_sessions ps
JOIN auth.users u ON ps.user_id = u.id
WHERE ps.placements IS NOT NULL
ORDER BY ps.created_at DESC;

-- 9. DATA SIZE BY USER (total footprint)
SELECT '=== TOTAL DATA FOOTPRINT PER USER ===' as section;
WITH user_storage AS (
  SELECT
    SPLIT_PART(name, '/', 1) as user_id,
    SUM((metadata->>'size')::bigint) as storage_bytes
  FROM storage.objects
  WHERE bucket_id = 'user-uploads'
  GROUP BY SPLIT_PART(name, '/', 1)
),
user_db_data AS (
  SELECT
    ps.user_id,
    SUM(
      COALESCE(LENGTH(ps.placements::text), 0) +
      COALESCE(LENGTH(ps.deliverable_content), 0)
    ) as db_bytes
  FROM product_sessions ps
  GROUP BY ps.user_id
),
user_conversations AS (
  SELECT
    ps.user_id,
    SUM(LENGTH(c.messages::text)) as conversation_bytes
  FROM product_sessions ps
  LEFT JOIN conversations c ON ps.id = c.session_id
  GROUP BY ps.user_id
)
SELECT
  u.email,
  pg_size_pretty(COALESCE(us.storage_bytes, 0)) as files_size,
  pg_size_pretty(COALESCE(ud.db_bytes, 0)) as database_size,
  pg_size_pretty(COALESCE(uc.conversation_bytes, 0)) as conversations_size,
  pg_size_pretty(
    COALESCE(us.storage_bytes, 0) +
    COALESCE(ud.db_bytes, 0) +
    COALESCE(uc.conversation_bytes, 0)
  ) as total_size
FROM auth.users u
LEFT JOIN user_storage us ON u.id::text = us.user_id
LEFT JOIN user_db_data ud ON u.id = ud.user_id
LEFT JOIN user_conversations uc ON u.id = uc.user_id
ORDER BY (
  COALESCE(us.storage_bytes, 0) +
  COALESCE(ud.db_bytes, 0) +
  COALESCE(uc.conversation_bytes, 0)
) DESC;

-- 10. PRIVACY CHECK (ensure user data is isolated)
SELECT '=== PRIVACY CHECK: Cross-User Data Leaks ===' as section;
SELECT
  'All product_sessions have valid user_id' as check_name,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as sessions_with_user,
  CASE
    WHEN COUNT(*) = COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM product_sessions
UNION ALL
SELECT
  'All conversations linked to sessions' as check_name,
  COUNT(*) as total_conversations,
  COUNT(CASE WHEN session_id IS NOT NULL THEN 1 END) as conversations_with_session,
  CASE
    WHEN COUNT(*) = COUNT(CASE WHEN session_id IS NOT NULL THEN 1 END)
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM conversations
UNION ALL
SELECT
  'All uploaded_documents have user_id' as check_name,
  COUNT(*) as total_uploads,
  COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as uploads_with_user,
  CASE
    WHEN COUNT(*) = COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END)
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status
FROM uploaded_documents;

-- 11. STORAGE BUCKET POLICIES (security check)
SELECT '=== STORAGE BUCKET POLICIES ===' as section;
DO $$
BEGIN
  IF to_regclass('storage.policies') IS NOT NULL THEN
    RAISE NOTICE 'Storage policies found';
  ELSE
    RAISE NOTICE 'storage.policies not found (Supabase storage policies are managed in the dashboard for this project)';
  END IF;
END $$;

-- If storage.policies exists in your project, uncomment:
-- SELECT
--   name as policy_name,
--   definition,
--   bucket_id
-- FROM storage.policies
-- ORDER BY bucket_id, name;
