-- Fix conversations table schema
-- Removes incorrect 'role' column that was added during database recreation

ALTER TABLE public.conversations DROP COLUMN IF EXISTS role;

-- Verify the table now has correct structure
COMMENT ON TABLE public.conversations IS 'AI conversation history per step - schema fixed 2026-02-03';
