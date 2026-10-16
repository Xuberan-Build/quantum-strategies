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
