/**
 * STUB, written by the topical-map UI agent so its routes and page compile.
 * The data agent owns the real implementation of this file (same exports, same
 * types); on merge, take theirs and drop this stub.
 *
 * Every loader throws, so in development the /api/admin/brain/map routes fall back
 * to the synthetic fixture and in production they return an error.
 */

export type TopicLevel = 'pillar' | 'section' | 'topic' | 'subtopic';
export type TopicIntent = 'informational' | 'problem' | 'comparison' | 'commercial' | 'navigational';
export type TopicStatus = 'LIVE' | 'BUILT' | 'TO BUILD' | 'NONE';

export interface TopicScores {
  demand: number;
  proof: number;
  coverage: number;
  competition: number;
  productFit: number;
  priority: number;
}

export interface TopicNode {
  /** topic:<slug>, also a kg_nodes id */
  id: string;
  level: TopicLevel;
  label: string;
  parent: string | null;
  /** P1..P8 or SPINE */
  pillarCode: string;
  intent: TopicIntent;
  summary?: string;
  /** each 0-100 */
  scores: TopicScores;
  status: TopicStatus;
  queryCount: number;
}

export interface TopicalMap {
  centralEntity: { label: string; definition: string };
  sourceContext: string;
  generatedAt: string;
  nodes: TopicNode[];
}

export type TopicScorecard = TopicNode & {
  queries: { text: string; sources: string[]; signal: number }[];
  problems: { id: string; label: string; quoteCount: number; topQuotes: { text: string; likes: number; source: string }[] }[];
  claims: { id: string; label: string; tier: string; bestSimilarity: number | null; excerpt?: string }[];
  assets: { kind: string; ref: string; status: string; href?: string }[];
  competitors: { id: string; label: string; outlier?: number; url?: string }[];
  products: { id: string; label: string }[];
  queuePosition: number | null;
  notes?: string;
};

export interface TopicalQueueItem {
  id: string;
  label: string;
  pillarCode: string;
  priority: number;
  demand: number;
  proof: number;
  coverage: number;
  status: TopicStatus;
  topQueries: string[];
}

const NOT_BUILT = 'topical-map data layer not merged yet (stub)';

export async function getTopicalMap(): Promise<TopicalMap> {
  throw new Error(NOT_BUILT);
}

export async function getTopic(_id: string): Promise<TopicScorecard | null> {
  throw new Error(NOT_BUILT);
}

export async function getTopicalQueue(_limit: number): Promise<TopicalQueueItem[]> {
  throw new Error(NOT_BUILT);
}
