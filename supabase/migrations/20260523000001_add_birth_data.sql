-- Add birth_data column to store structured birth info for chart computation
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birth_data JSONB;
