/**
 * Any-to-any content system: shared contract (brain/content/social-master-plan.md).
 * Tables: supabase/migrations/20261101180000_content_insights_any_to_any.sql
 * Every agent building insights, "make from this" and the winners view codes against these types.
 */

export type InsightSourceKind = 'article' | 'vcap' | 'reddit' | 'x' | 'recording' | 'video' | 'interview' | 'other';
export type AssetKind = 'article' | 'piece' | 'social_post' | 'insight' | 'external';
export type Direction = 'down' | 'up' | 'across' | 'same';
export type PromotionStatus = 'proposed' | 'accepted' | 'dismissed' | 'done';

/** content_pieces.piece_type values (constraint in the migration). */
export type PieceType =
  | 'blog' | 'social_twitter' | 'social_ig' | 'email' | 'email_sequence'
  | 'youtube_long' | 'short' | 'ig_carousel' | 'ig_lettering' | 'reddit' | 'social_tiktok'
  | 'x_article' | 'reddit_post';
// 'social_linkedin' and 'gpt_product' exist for old rows only: never offered (no LinkedIn).

export interface Insight {
  id: string;
  line: string;
  source_kind: InsightSourceKind;
  source_ref: string | null;
  source_post_id: string | null;
  claim: string | null;
  evidence_tier: string | null;
  pillar: string | null;
  cluster: string | null;
  tags: string[];
  notes: string | null;
  status: 'active' | 'archived';
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetLink {
  id: string;
  from_kind: AssetKind;
  from_id: string;
  to_kind: AssetKind;
  to_id: string;
  direction: Direction;
  insight_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Promotion {
  id: string;
  source_kind: 'social_target' | 'social_post' | 'piece' | 'external' | 'insight';
  source_id: string;
  insight_id: string | null;
  platform: string | null;
  metric: string | null;
  value: number | null;
  channel_median: number | null;
  multiple: number | null;
  proposed_title: string | null;
  proposed_format: PieceType;
  status: PromotionStatus;
  piece_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A reference to any asset, used by "make from this" and the asset graph. */
export interface AssetRef {
  kind: AssetKind;
  id: string;
}

/**
 * Relative length of each form, longest first (master plan §2). Used to decide direction:
 * target longer than source = 'up', shorter = 'down', same rank = 'same', different platform same rank = 'across'.
 */
export const FORM_RANK: Record<PieceType | 'article', number> = {
  article: 100,      // pillar article (content_posts)
  youtube_long: 100, // same length as a pillar article: article <-> long video is 'across'
  blog: 80,          // spoke article
  reddit_post: 70,
  x_article: 70,
  email_sequence: 65,
  ig_carousel: 60,
  email: 55,
  short: 50,         // one vertical file for Shorts / Reels / TikTok
  social_tiktok: 50,
  reddit: 40,        // Reddit answer / comment
  social_ig: 35,     // Instagram caption
  social_twitter: 30,// X image post / line
  ig_lettering: 20,
};

/** Winner threshold: a target beats its channel median by this multiple on the number that matters there. */
export const PROMOTION_MULTIPLE = 3;

/** The number that matters per platform (master plan §3). Keys match social_post_targets.metrics. */
export const CHANNEL_METRIC: Record<string, string[]> = {
  x: ['replies', 'likes'],                 // first key present wins
  instagram: ['saves', 'shares', 'views', 'likes'],
  youtube: ['views'],
  tiktok: ['views'],
  threads: ['replies', 'likes'],
};
