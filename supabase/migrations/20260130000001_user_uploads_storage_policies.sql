-- =====================================================
-- User Uploads Storage RLS Policies
-- Enables authenticated users to manage their own files
-- =====================================================

-- NOTE: This migration touches storage.objects, which is owned by a reserved role.
-- In Supabase, only superusers can grant supabase_storage_admin membership.
-- If this migration fails via CLI, run it in the SQL editor as postgres.

DO $$
BEGIN
  -- Drop existing policies if any (idempotent migration)
  DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

  -- Enable RLS on storage.objects (if not already enabled)
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  -- =====================================================
  -- UPLOAD POLICY (INSERT)
  -- Allows users to upload files only to their own user_id folder
  -- Path pattern: userId/sessionId/timestamp_filename.ext
  --               userId/profile/timestamp_filename.ext
  -- =====================================================
  CREATE POLICY "Users can upload to own folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'user-uploads'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- =====================================================
  -- SELECT POLICY (READ)
  -- Allows users to read/download their own files
  -- =====================================================
  CREATE POLICY "Users can view own files"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'user-uploads'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- =====================================================
  -- UPDATE POLICY
  -- Allows users to update metadata of their own files
  -- =====================================================
  CREATE POLICY "Users can update own files"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'user-uploads'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'user-uploads'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- =====================================================
  -- DELETE POLICY
  -- Allows users to delete their own files
  -- =====================================================
  CREATE POLICY "Users can delete own files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'user-uploads'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage.objects policies due to insufficient privilege. Apply via Supabase dashboard.';
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify the policies are working correctly
-- =====================================================

-- Check all policies for user-uploads bucket
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE tablename = 'objects'
--   AND schemaname = 'storage'
--   AND policyname LIKE '%own%';

-- Test with a specific user (replace with actual UUID)
-- SET LOCAL role TO authenticated;
-- SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid-here"}';
-- SELECT * FROM storage.objects WHERE bucket_id = 'user-uploads';
