/**
 * Social publisher: shared contract. Every adapter, the engine, the API routes and the UI build on these types.
 * Tables: supabase/migrations/20261101120000_social_publisher.sql
 */

export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'x' | 'threads';

export type Format =
  | 'image' | 'carousel' | 'reel' | 'trial_reel' | 'story'
  | 'video' | 'short'
  | 'tiktok_video' | 'tiktok_photo'
  | 'tweet' | 'thread';

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed' | 'cancelled';
export type TargetStatus = 'pending' | 'processing' | 'published' | 'failed' | 'cancelled' | 'needs_action';
export type AccountStatus = 'connected' | 'expired' | 'error' | 'disconnected';

export interface SocialMedia {
  url: string;              // public URL (social-media bucket)
  path?: string;            // storage path inside the bucket
  type: 'image' | 'video';
  mime?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  sizeBytes?: number;
  thumbnailUrl?: string;    // optional cover image
}

export interface TargetOptions {
  // Instagram
  trialGraduation?: 'MANUAL' | 'SS_PERFORMANCE'; // trial_reel only: graduate to followers manually or automatically on performance
  shareToFeed?: boolean;                          // reel
  coverUrl?: string;
  thumbOffsetMs?: number;
  // YouTube
  ytTitle?: string;
  ytDescription?: string;
  ytTags?: string[];
  ytCategoryId?: string;
  ytPrivacy?: 'public' | 'unlisted' | 'private';
  ytMadeForKids?: boolean;
  // TikTok
  ttPrivacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  ttMode?: 'direct' | 'draft';                    // draft = send to the TikTok inbox, Austin finishes in-app
  ttDisableComment?: boolean;
  ttDisableDuet?: boolean;
  ttDisableStitch?: boolean;
  ttBrandedContent?: boolean;
  // X / Threads
  threadParts?: string[];                         // thread format: each part is one post
  linkInReply?: boolean;                          // X: put the link in the first reply. Reach only: any post with a URL costs $0.20, the reply too
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  external_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  token_expires_at: string | null;
  scopes: string[];
  meta: Record<string, unknown>;
  status: AccountStatus;
  last_error: string | null;
  connected_at: string;
  updated_at: string;
}

/** Account with decrypted tokens. Server only, never sent to the browser. */
export interface AccountWithTokens extends SocialAccount {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface SocialPost {
  id: string;
  piece_id: string | null;
  title: string | null;
  caption: string;
  media: SocialMedia[];
  link: string | null;
  first_comment: string | null;
  tags: string[];
  status: PostStatus;
  scheduled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialPostTarget {
  id: string;
  post_id: string;
  account_id: string;
  platform: Platform;
  format: Format;
  caption_override: string | null;
  options: TargetOptions;
  status: TargetStatus;
  external_id: string | null;
  external_url: string | null;
  state: Record<string, unknown>;
  error: string | null;
  attempts: number;
  next_attempt_at: string | null;
  published_at: string | null;
  metrics: Record<string, number>;
  metrics_synced_at: string | null;
}

/** What an OAuth code exchange produces; the engine encrypts and upserts it into social_accounts. */
export interface ConnectedAccountInput {
  platform: Platform;
  external_id: string;
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes?: string[];
  meta?: Record<string, unknown>;
}

export interface TokenUpdate {
  accessToken: string;
  refreshToken?: string | null;   // undefined = keep the existing one
  expiresAt?: Date | null;
}

export interface PublishContext {
  account: AccountWithTokens;
  post: SocialPost;
  target: SocialPostTarget;
  /** caption_override ?? post.caption */
  caption: string;
}

/**
 * Outcome of one publish step. Async platforms (IG Reels, TikTok, YouTube resumable) return 'processing' with
 * `state` to persist; the engine calls checkStatus on a later cron tick until it resolves.
 */
export type PublishResult =
  | { kind: 'published'; externalId: string; url?: string | null; state?: Record<string, unknown> }
  | { kind: 'processing'; state: Record<string, unknown>; retryAfterSec?: number }
  | { kind: 'needs_action'; message: string; state?: Record<string, unknown> }  // e.g. TikTok draft waiting in the inbox
  | { kind: 'failed'; error: string; retryable: boolean; retryAfterSec?: number; state?: Record<string, unknown> }; // state kept so a retry resumes

export interface AuthUrlArgs {
  state: string;
  redirectUri: string;
  codeChallenge?: string; // PKCE S256 challenge (X, TikTok)
}

export interface ExchangeArgs {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface PlatformAdapter {
  platform: Platform;
  label: string;
  formats: Format[];
  usesPkce: boolean;
  /** Env vars this adapter needs; the UI shows "not configured" when any are missing. */
  requiredEnv: string[];
  getAuthUrl(args: AuthUrlArgs): string;
  exchangeCode(args: ExchangeArgs): Promise<ConnectedAccountInput[]>;   // array: one login can yield several accounts
  refreshToken?(account: AccountWithTokens): Promise<TokenUpdate>;
  /** Return human-readable problems; empty = OK to publish. Pure, no network. */
  validate(post: SocialPost, target: SocialPostTarget): string[];
  publish(ctx: PublishContext): Promise<PublishResult>;
  checkStatus?(ctx: PublishContext): Promise<PublishResult>;
  fetchMetrics?(ctx: PublishContext): Promise<Record<string, number>>;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  threads: 'Threads',
};

export const FORMAT_LABELS: Record<Format, string> = {
  image: 'Image post',
  carousel: 'Carousel',
  reel: 'Reel',
  trial_reel: 'Trial Reel (non-followers first)',
  story: 'Story',
  video: 'Video',
  short: 'Short',
  tiktok_video: 'Video',
  tiktok_photo: 'Photo carousel',
  tweet: 'Post',
  thread: 'Thread',
};
