/**
 * Topical map shapes (brain/content/topical-map.json and the `topic` / `query` graph nodes).
 *
 * Client-safe and pure: types and small constants only. The builder (scripts/brain/build-topical-map.ts)
 * writes this shape; src/lib/brain/topical-map.ts reads it back from kg_nodes / kg_edges.
 */

export const TOPIC_LEVELS = ['pillar', 'section', 'topic', 'subtopic'] as const;
export type TopicLevel = (typeof TOPIC_LEVELS)[number];

export const TOPIC_INTENTS = ['informational', 'problem', 'comparison', 'commercial', 'navigational'] as const;
export type TopicIntent = (typeof TOPIC_INTENTS)[number];

export const TOPIC_STATUSES = ['LIVE', 'BUILT', 'TO BUILD', 'NONE'] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export const QUERY_SOURCES = ['google_ac', 'youtube_ac', 'audience', 'vidiq', 'keyword_planner'] as const;
export type QuerySource = (typeof QUERY_SOURCES)[number];

/** P1..P8 or SPINE */
export type PillarCode = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'SPINE';

/** Where a node came from: Austin's architecture, the problem map, or demand the architecture lacked. */
export type TopicOrigin = 'architecture' | 'problem' | 'demand';

/** Vocabulary stance from research/language/audience-vocabulary.md (tempers priority of demand topics). */
export type TopicStance = 'use' | 'reframe' | 'avoid' | 'guardrail';

export interface TopicQuery {
  text: string;
  sources: QuerySource[];
  /** Relative demand signal (unitless, log-scaled per source, summed across sources). */
  signal: number;
  /** Google Keyword Planner average monthly searches (US), when the phrasing was looked up. */
  volume?: number | null;
}

export interface TopicScores {
  demand: number;
  proof: number;
  coverage: number;
  competition: number;
  productFit: number;
  priority: number;
  /** Additive (Keyword Planner runs): search volume, log-scaled against the biggest node at the same level. */
  searchDemand?: number;
  /** Additive: audience signals only (coded comments and likes, autocomplete, vidIQ), the pre-KP demand score. */
  audienceDemand?: number;
}

/** Keyword Planner demand for a node (US, the export's 12 months). Near-identical phrasings are counted once. */
export interface TopicSearchTrend {
  /** volume-weighted year-over-year and three-month change, percent */
  yoy: number | null;
  threeMonth: number | null;
  /** summed monthly searches, oldest first */
  monthly?: { month: string; searches: number | null }[];
}

export interface TopicCommercial {
  /** volume-weighted top-of-page bids (USD) and paid competition index 0-100 */
  bidLow: number | null;
  bidHigh: number | null;
  competitionIndex: number | null;
  /** Σ volume × high bid: what the clicks would cost a month, a proxy for buyer intent */
  value: number;
}

export interface TopicAudienceSignals {
  /** coded audience items and likes/score behind the problems this node answers (share-weighted) */
  quotes: number;
  likes: number;
  /** phrasings seen in Google or YouTube autocomplete, and phrasings from coded audience items */
  autocomplete: number;
  audiencePhrases: number;
  /** biggest vidIQ monthly YouTube search anchor among the node's phrasings */
  vidiqMonthly: number | null;
}

/** How well the node suits each channel, 0-100 (formulas in scripts/brain/lib/topical-map/score.ts). */
export interface TopicChannelFit {
  search: number;
  youtube: number;
  quiz: number;
}

/** The phrasing to title a page or video with (highest-volume relevant search term) next to the audience's own. */
export interface TopicHeadTerm {
  text: string;
  volume: number;
  /** the audience-language phrasing for the hook */
  audience: string | null;
  /** where the pick came from: keyword_planner (highest volume) or seeds (manual override) */
  via: 'keyword_planner' | 'seeds';
}

export interface TopicSearchTerm {
  keyword: string;
  volume: number;
  yoy: number | null;
}

export interface TopicAsset {
  /** cornerstone | spoke | content_post | deck | doc */
  kind: string;
  /** Graph node id (cornerstone:..., spoke:..., deck:..., doc:...) or `content_post:<slug>` */
  ref: string;
  /** LIVE | BUILT | TO BUILD | REFRESH | MERGE | REWRITE | internal */
  status: string;
  label?: string;
}

export interface TopicMapsTo {
  cluster?: string;
  cornerstone?: string;
  spokes?: string[];
  problems?: string[];
  claims?: string[];
  products?: string[];
}

/** Evidence the proof score rests on (one row per claim or the topic's own corpus match). */
export interface TopicEvidence {
  claim: string | null;
  label: string;
  tier: string | null;
  strength: string | null;
  similarity: number | null;
  source: string | null;
}

/** Why each score is what it is, in plain words. */
export interface TopicReasons {
  demand?: string;
  proof?: string;
  coverage?: string;
  competition?: string;
  productFit?: string;
  priority?: string;
  placement?: string;
  searchDemand?: string;
  audienceDemand?: string;
  channelFit?: string;
  headTerm?: string;
}

export interface TopicNode {
  id: string; // topic:<slug>
  level: TopicLevel;
  label: string;
  parent: string | null;
  pillarCode: PillarCode;
  intent: TopicIntent;
  summary: string;
  mapsTo: TopicMapsTo;
  queries: TopicQuery[];
  scores: TopicScores;
  status: TopicStatus;
  assets: TopicAsset[];
  /** Landscape channel ids (YouTube UC... ids from research/creators/landscape.json). */
  competitors: string[];
  notes: string;
  /** Additive fields (not in the original contract; safe to ignore). */
  origin?: TopicOrigin;
  stance?: TopicStance;
  reasons?: TopicReasons;
  evidence?: TopicEvidence[];
  /** Audience phrasing for this topic (problem-map "their words" and coded quotes), short. */
  audienceWords?: string[];
  /** Rank among topics in the content queue (1 = next), when it qualifies. */
  queueRank?: number | null;
  /** Keyword Planner runs only: monthly searches (US) summed over the node's phrasings, near-duplicates once. */
  searchVolume?: number;
  searchTrend?: TopicSearchTrend;
  commercial?: TopicCommercial;
  /** strongest search terms behind searchVolume */
  searchTerms?: TopicSearchTerm[];
  audience?: TopicAudienceSignals;
  channelFit?: TopicChannelFit;
  headTerm?: TopicHeadTerm | null;
}

export interface TopicalMap {
  version: number;
  centralEntity: { label: string; definition: string };
  sourceContext: string;
  generatedAt: string;
  levels: TopicLevel[];
  nodes: TopicNode[];
  /** Additive: how the map was built (request counts, blocks, thresholds). */
  meta?: Record<string, unknown>;
}

/** Topics with coverage under this go to the content queue (also the SQL default in topical_map_queue()). */
export const QUEUE_MAX_COVERAGE = 40;

export const TOPIC_ID = /^topic:[a-z0-9][a-z0-9-]{0,119}$/;
export const isTopicId = (v: unknown): v is string => typeof v === 'string' && TOPIC_ID.test(v);
