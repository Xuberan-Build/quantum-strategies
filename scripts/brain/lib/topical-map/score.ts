/**
 * Topical map scores. Pure. Every score is 0-100 and relative to this map, never an absolute market size.
 *
 * demand       raw = sum of the node's top 15 query signals + audience mass (problems the node answers:
 *              share × (2·log2(1 + coded quotes) + log10(1 + likes + forum score))).
 *              score = 100 · ln(1 + raw) / ln(1 + max raw at the same level).
 * proof        best corpus evidence similarity s for the node (its own text and its linked claims, scored
 *              exactly against the small evidence tiers, the graph builder's method) and the strongest linked
 *              claim's grade g (Strong 1, Myth-debunk 0.8, Moderate 0.7, Weak/Model 0.4):
 *              score = 100 · clamp(0.65 · clamp((s - 0.30) / 0.30) + 0.35 · g).
 * coverage     weights of what exists: LIVE cornerstone 1.0, REFRESH/MERGE/REWRITE cornerstone 0.6, BUILT
 *              cornerstone 0.5; LIVE spoke 0.4, needs-work spoke 0.25, BUILT spoke 0.2; a published article
 *              matched by title 0.5; an internal deck or doc 0.1 (at most 0.3 in total).
 *              score = 100 · (1 - e^(-sum)).
 * competition  each landscape channel covering the node adds w = overlap (high 1, medium 0.7, low 0.4) ·
 *              (0.4 + 0.6 · min(1, log10(1 + outlier) / log10(51))), outlier = the best matching video's
 *              views ÷ the channel median. score = 100 · (1 - e^(-sum / 2.5)).
 * productFit   where the node routes: a LIVE scan via the quiz route 1.0, a LIVE product it addresses 0.9,
 *              Rite I via the free quiz 0.8, Orientation / Declaration (TO BUILD) 0.6, B2B project 0.5,
 *              personal brand 0.35, VCAP 0.3, post-purchase only 0.1, nothing 0.15.
 * priority     weighted geometric mean, then tempered by competition and vocabulary stance:
 *              base = D^0.45 · (0.35 + 0.65·P)^0.20 · (1 - 0.85·C)^0.20 · (0.25 + 0.75·F)^0.15
 *              priority = 100 · base · (1 - 0.3·K) · stance (use 1, reframe 0.9, avoid 0.5, guardrail 0.3)
 *              with D, P, C, F, K the scores above divided by 100. High demand, strong proof, low coverage and a
 *              product to route to win; crowded topics lose up to 30%.
 */
import type { TopicScores, TopicStance } from '../../../../src/lib/brain/topical-map-types';

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number) => Math.round(x);

export const TOP_QUERIES_FOR_DEMAND = 15;

export function demandRaw(querySignals: number[], audienceMass: number): number {
  const top = [...querySignals].sort((a, b) => b - a).slice(0, TOP_QUERIES_FOR_DEMAND);
  return top.reduce((s, x) => s + x, 0) + Math.max(0, audienceMass);
}

export function audienceMass(problems: { share: number; quotes: number; likes: number; forumScore: number }[]): number {
  return problems.reduce((s, p) => s + p.share * (2 * Math.log2(1 + p.quotes) + Math.log10(1 + p.likes + p.forumScore)), 0);
}

export function demandScore(raw: number, maxRaw: number): number {
  if (maxRaw <= 0 || raw <= 0) return 0;
  return round((100 * Math.log1p(raw)) / Math.log1p(maxRaw));
}

export const STRENGTH: Record<string, number> = { strong: 1, myth: 0.8, moderate: 0.7, 'moderate (reframed)': 0.7, weak: 0.4, model: 0.4 };
export const strengthValue = (s: string | null | undefined) => (s ? (STRENGTH[s.toLowerCase()] ?? 0.4) : 0);

export function proofScore(bestSimilarity: number | null, bestStrength: number): number {
  const s = bestSimilarity === null ? 0 : clamp01((bestSimilarity - 0.3) / 0.3);
  return round(100 * clamp01(0.65 * s + 0.35 * clamp01(bestStrength)));
}

export const COVERAGE_WEIGHT = {
  cornerstone: { LIVE: 1, REFRESH: 0.6, MERGE: 0.6, REWRITE: 0.6, BUILT: 0.5 },
  spoke: { LIVE: 0.4, REFRESH: 0.25, MERGE: 0.25, REWRITE: 0.25, BUILT: 0.2 },
  content_post: { LIVE: 0.5 },
  internal: 0.1,
  internalCap: 0.3,
} as const;

export function assetWeight(kind: string, status: string): number {
  if (kind === 'deck' || kind === 'doc') return COVERAGE_WEIGHT.internal;
  const table = (COVERAGE_WEIGHT as unknown as Record<string, Record<string, number>>)[kind];
  return table?.[status] ?? 0;
}

export function coverageScore(assets: { kind: string; status: string }[]): number {
  let sum = 0;
  let internal = 0;
  for (const a of assets) {
    const w = assetWeight(a.kind, a.status);
    if (a.kind === 'deck' || a.kind === 'doc') internal += w;
    else sum += w;
  }
  sum += Math.min(COVERAGE_WEIGHT.internalCap, internal);
  return round(100 * (1 - Math.exp(-sum)));
}

export const OVERLAP: Record<string, number> = { high: 1, medium: 0.7, low: 0.4 };

export function competitorWeight(overlap: string | null | undefined, outlier: number): number {
  const o = OVERLAP[overlap ?? ''] ?? 0.6;
  const strength = Math.min(1, Math.log10(1 + Math.max(0, outlier)) / Math.log10(51));
  return o * (0.4 + 0.6 * strength);
}

export function competitionScore(weights: number[]): number {
  return round(100 * (1 - Math.exp(-weights.reduce((s, w) => s + w, 0) / 2.5)));
}

export const CTA_FIT: Record<string, number> = {
  'quiz>I': 0.8,
  'quiz>S2': 0.85,
  'quiz>S3': 0.85,
  'quiz>S4': 0.85,
  'quiz>S5': 0.85,
  riteI: 0.9,
  'quiz>II': 0.6,
  'quiz>III': 0.6,
  bundle: 0.6,
  project: 0.5,
  brand: 0.35,
  vcap: 0.3,
  post: 0.1,
};

export const CTA_PRODUCTS: Record<string, string[]> = {
  'quiz>I': ['product:perception-read', 'product:signal-awareness'],
  'quiz>S2': ['product:perception-read', 'product:value-pattern-decoder'],
  'quiz>S3': ['product:perception-read', 'product:boundary-burnout'],
  'quiz>S4': ['product:perception-read', 'product:money-signal'],
  'quiz>S5': ['product:perception-read', 'product:competence-mapping'],
  riteI: ['product:signal-awareness'],
  'quiz>II': ['product:perception-read', 'product:orientation'],
  'quiz>III': ['product:perception-read', 'product:declaration'],
  bundle: ['product:orientation', 'product:declaration'],
};

export const NO_ROUTE_FIT = 0.15;

export function productFitScore(routes: { fit: number }[]): number {
  const best = routes.reduce((m, r) => Math.max(m, r.fit), 0);
  return round(100 * (routes.length ? best : NO_ROUTE_FIT));
}

export const STANCE_FACTOR: Record<TopicStance, number> = { use: 1, reframe: 0.9, avoid: 0.5, guardrail: 0.3 };

export function priorityScore(s: Omit<TopicScores, 'priority'>, stance: TopicStance = 'use'): number {
  const D = clamp01(s.demand / 100);
  const P = clamp01(s.proof / 100);
  const C = clamp01(s.coverage / 100);
  const F = clamp01(s.productFit / 100);
  const K = clamp01(s.competition / 100);
  const base = D ** 0.45 * (0.35 + 0.65 * P) ** 0.2 * (1 - 0.85 * C) ** 0.2 * (0.25 + 0.75 * F) ** 0.15;
  return round(100 * base * (1 - 0.3 * K) * STANCE_FACTOR[stance]);
}

/** Demand-weighted mean (falls back to a plain mean when all weights are 0). */
export function weightedMean(values: { v: number; w: number }[]): number {
  if (!values.length) return 0;
  const W = values.reduce((s, x) => s + x.w, 0);
  if (W <= 0) return round(values.reduce((s, x) => s + x.v, 0) / values.length);
  return round(values.reduce((s, x) => s + x.v * x.w, 0) / W);
}
