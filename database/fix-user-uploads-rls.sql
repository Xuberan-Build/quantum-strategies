-- =====================================================
-- IMMEDIATE FIX: User Uploads Storage RLS Policies
-- Run this directly in Supabase SQL Editor to fix upload issues
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 1. UPLOAD POLICY (INSERT)
-- Allows authenticated users to upload files to their own folder
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
-- 2. READ POLICY (SELECT)
-- Allows authenticated users to read their own files
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
-- 3. UPDATE POLICY
-- Allows authenticated users to update their own files
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
-- 4. DELETE POLICY
-- Allows authenticated users to delete their own files
-- =====================================================
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================
-- VERIFICATION: Check that policies were created
-- =====================================================
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%own%'
ORDER BY policyname;
