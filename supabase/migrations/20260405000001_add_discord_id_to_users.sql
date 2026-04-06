-- Add Discord identity fields to users table
-- Allows linking QS accounts to Discord members
-- Purely additive — no NOT NULL, no defaults, zero risk to existing rows

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS discord_username TEXT;

CREATE INDEX IF NOT EXISTS idx_users_discord_id ON public.users (discord_id)
  WHERE discord_id IS NOT NULL;

COMMENT ON COLUMN public.users.discord_id IS 'Discord user snowflake ID — links QS account to Discord member';
COMMENT ON COLUMN public.users.discord_username IS 'Discord username at time of linking (e.g. austinsantos)';
