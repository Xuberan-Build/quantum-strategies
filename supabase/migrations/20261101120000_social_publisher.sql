-- Social publisher ("our Buffer"): connected accounts, posts, per-channel targets, OAuth state, media bucket.
-- Additive only. Service-role access only (RLS on, no policies): every read/write goes through admin API routes.

-- 1. Connected accounts. Tokens are AES-256-GCM encrypted in the app (src/lib/social/crypto.ts), never plaintext.
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'x', 'threads')),
  external_id TEXT NOT NULL,
  handle TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'error', 'disconnected')),
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

-- 2. A post: one piece of content (caption + media) that goes out to one or more channels.
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id UUID REFERENCES public.content_pieces(id) ON DELETE SET NULL,
  title TEXT,
  caption TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,       -- SocialMedia[] (see src/lib/social/types.ts)
  link TEXT,
  first_comment TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'partial', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_status_scheduled_idx ON public.social_posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS social_posts_piece_idx ON public.social_posts (piece_id);

-- 3. One row per (post, account): the format, per-channel overrides and the publish outcome.
CREATE TABLE IF NOT EXISTS public.social_post_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN (
    'image', 'carousel', 'reel', 'trial_reel', 'story',      -- instagram
    'video', 'short',                                        -- youtube
    'tiktok_video', 'tiktok_photo',                          -- tiktok
    'tweet', 'thread'                                        -- x / threads
  )),
  caption_override TEXT,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,                -- TargetOptions (see types.ts)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed', 'cancelled', 'needs_action')),
  external_id TEXT,
  external_url TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- adapter scratch (container ids, upload ids) between cron ticks
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, account_id)
);

CREATE INDEX IF NOT EXISTS social_post_targets_status_idx ON public.social_post_targets (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS social_post_targets_account_idx ON public.social_post_targets (account_id);

-- 4. Short-lived OAuth state (CSRF + PKCE verifier). Rows older than 15 minutes are ignored and pruned by the cron.
CREATE TABLE IF NOT EXISTS public.social_oauth_states (
  state TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  code_verifier TEXT,
  return_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_oauth_states ENABLE ROW LEVEL SECURITY;

-- 5. Public media bucket. Instagram and TikTok (PULL_FROM_URL) fetch media from a public URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('social-media', 'social-media', true, 1073741824)
ON CONFLICT (id) DO NOTHING;
