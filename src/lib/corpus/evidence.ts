/**
 * Evidence floor for corpus retrieval.
 *
 * 0.45 cosine similarity (text-embedding-3-small) is the app's bar for a passage to
 * count as evidence. Vector search runs at this floor; anything that reaches a
 * result list without clearing it (keyword hits, theme bridges, unscored rows) is
 * labelled "weak": resonance at best, never evidence.
 */
export const EVIDENCE_SIMILARITY_FLOOR = 0.45;

export type EvidenceStrength = 'evidence' | 'weak';

export function evidenceStrength(similarity: number | null | undefined): EvidenceStrength {
  return typeof similarity === 'number' && similarity >= EVIDENCE_SIMILARITY_FLOOR ? 'evidence' : 'weak';
}

/** Tag for prompt context blocks so models don't treat weak matches as support. */
export function evidenceTag(similarity: number | null | undefined): string {
  return evidenceStrength(similarity) === 'evidence'
    ? '[evidence]'
    : '[WEAK MATCH: below the evidence floor; resonance only, do not cite as support]';
}

/**
 * Epistemic tiers on knowledge_chunks.tier (see the corpus_evidence_tiers migration).
 * Similarity says how close a passage is; the tier says what kind of thing it is.
 */
export const CORPUS_TIERS = [
  'evidence',
  'model',
  'contested',
  'lineage',
  'market_signal',
  'internal',
  'enemy',
  'unclassified',
] as const;
export type CorpusTier = (typeof CORPUS_TIERS)[number];

/**
 * Tiers that may back a citation card or be labelled as a source in draft context.
 * Lineage is included because the studio shows it as resonance (and evidenceTag/the
 * prompts already forbid treating resonance as proof). market_signal, internal,
 * contested and enemy are never sources.
 */
export const EVIDENCE_TIERS: readonly CorpusTier[] = ['evidence', 'model', 'lineage'];

/** Market research (hooks, angle ideas, voice of market): the source tiers plus creator/audience research. */
export const MARKET_RESEARCH_TIERS: readonly CorpusTier[] = [...EVIDENCE_TIERS, 'market_signal'];

export function isCorpusTier(value: unknown): value is CorpusTier {
  return typeof value === 'string' && (CORPUS_TIERS as readonly string[]).includes(value);
}

/**
 * Parse an optional `tiers` request field (array or comma-separated string).
 * Unknown values are dropped. Returns null when nothing valid was given, so the
 * caller can apply its own default.
 */
export function parseTiers(input: unknown): CorpusTier[] | null {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  const tiers = [...new Set(raw.map((t) => (typeof t === 'string' ? t.trim() : t)).filter(isCorpusTier))];
  return tiers.length > 0 ? tiers : null;
}
