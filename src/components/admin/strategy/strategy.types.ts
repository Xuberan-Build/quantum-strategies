export const PLG_STAGES = ['awareness', 'interest', 'consideration', 'conversion', 'expansion'] as const;
export type Stage = typeof PLG_STAGES[number];

export const STAGE_META: Record<Stage, { label: string; desc: string; color: string }> = {
  awareness:     { label: 'Awareness',     desc: 'Free content',           color: '#10b981' },
  interest:      { label: 'Interest',      desc: 'Lead magnets',           color: '#3b82f6' },
  consideration: { label: 'Consideration', desc: 'Entry products $7–97',   color: '#f59e0b' },
  conversion:    { label: 'Conversion',    desc: 'Core offers $297–1997',  color: '#8b5cf6' },
  expansion:     { label: 'Expansion',     desc: 'High-ticket coaching',   color: '#ef4444' },
};

export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#f59e0b' },
  drafted:   { label: 'Drafted',   color: '#3b82f6' },
  accepted:  { label: 'Accepted',  color: '#10b981' },
  created:   { label: 'Created',   color: '#8b5cf6' },
  dismissed: { label: 'Dismissed', color: '#6b7280' },
};

export interface Post   { id: string; slug: string; title: string; pillar_id: string | null }
export interface Prod   { id: string; slug: string; name: string; price: number | null }

export interface StageCell {
  stage: string;
  hasContent: boolean;
  hasProduct: boolean;
  productNames: string[];
  hasPending: boolean;
  postCount: number;
  posts: Post[];
  products: Prod[];
}

export interface MatrixRow {
  pillar: { id: string; title: string; tradition_affinity: string[] };
  topics: unknown[];
  totalAngles: number;
  totalPieces: number;
  stages: StageCell[];
}

export interface Suggestion {
  id: string;
  pillar_id: string | null;
  funnel_stage: string;
  title: string;
  tagline: string | null;
  rationale: string | null;
  format: string | null;
  status: string;
  corpus_themes: string[];
  content_pillars?: { title: string } | null;
}

export interface Product {
  id: string;
  product_slug: string;
  name: string;
  price: number | null;
  plg_stage: string | null;
  pillar_id: string | null;
}

export interface SelectedCell {
  pillarTitle: string;
  stage: Stage;
  cell: StageCell;
  topicCount: number;
}
