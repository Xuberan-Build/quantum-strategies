/**
 * Gap report formatting for graph-gaps.ts. Pure: rows in, markdown out.
 */

export interface GapRow {
  kind: string;
  node_id: string;
  label: string;
  detail: Record<string, unknown> | null;
}

export interface StagedCard {
  card_key: string;
  text_name: string;
  tradition: string;
  source_url: string | null;
  citation: string | null;
  claims: string[];
  tier: string | null;
  ingested: boolean;
  /** brain-relative staging file the card lives in */
  file?: string;
}

export interface IngestionProposal {
  claim: string;
  claim_label: string;
  source_type: 'url' | 'text';
  source_url: string | null;
  source_filename: string | null;
  tradition_tags: string[];
  reason: string;
}

export const GAP_TITLES: Record<string, string> = {
  claim_weak_evidence: 'Claims with weak corpus evidence (nothing at or above 0.45)',
  mechanism_weak_evidence: 'Mechanisms with weak corpus evidence',
  problem_no_product: 'Problems with no product',
  problem_no_content: 'Problems with no content (no deck, doc, spoke or cornerstone)',
  pillar_no_demand: 'Pillars with no audience demand (no quote voices any of their problems)',
};

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : null);
const fmt = (v: unknown) => {
  const n = num(v);
  return n === null || Number.isNaN(n) ? 'none' : n.toFixed(3);
};
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function groupGaps(rows: GapRow[]): Map<string, GapRow[]> {
  const out = new Map<string, GapRow[]>();
  for (const k of Object.keys(GAP_TITLES)) out.set(k, []);
  for (const r of rows) out.set(r.kind, [...(out.get(r.kind) ?? []), r]);
  return out;
}

export function gapHeadline(rows: GapRow[]): string {
  const g = groupGaps(rows);
  const n = (k: string) => g.get(k)?.length ?? 0;
  return `${n('claim_weak_evidence')} claims and ${n('mechanism_weak_evidence')} mechanisms below the evidence floor · ${n('problem_no_product')} problems with no product · ${n('problem_no_content')} with no content · ${n('pillar_no_demand')} pillars with no demand`;
}

export function gapsMarkdown(rows: GapRow[], builtAt: string | null, generatedAt: string): string {
  const g = groupGaps(rows);
  const lines: string[] = [
    '# Knowledge graph gaps',
    '',
    `Generated ${generatedAt.slice(0, 16).replace('T', ' ')} UTC by \`scripts/brain/graph-gaps.ts\` from \`kg_gaps()\`${builtAt ? ` (graph built ${builtAt.slice(0, 16).replace('T', ' ')} UTC)` : ''}. Regenerated on every run; edit the sources, not this file.`,
    '',
    `**Headline:** ${gapHeadline(rows)}.`,
    '',
    'How to read it: evidence gaps use the app\'s 0.45 similarity floor against the evidence, model and lineage tiers (QS\'s own material never counts). Product and content gaps skip the guardrail clusters (trauma, depression, ADHD) and the unclustered research codes. Proposed corpus additions are in `graph/ingestion-proposals.md` and need Austin\'s approval before anything enters `corpus_ingestion_queue`.',
    '',
  ];
  for (const [type, items] of g) {
    lines.push(`## ${GAP_TITLES[type] ?? type} (${items.length})`, '');
    if (!items.length) {
      lines.push('None.', '');
      continue;
    }
    if (type.endsWith('weak_evidence')) {
      lines.push('| Node | Tier | Best match | Evidence edges |', '|---|---|---|---|');
      for (const r of [...items].sort((a, b) => (num(a.detail?.best_below_floor) ?? 0) - (num(b.detail?.best_below_floor) ?? 0))) {
        lines.push(`| \`${r.node_id}\` ${esc(r.label)} | ${esc(String(r.detail?.tier ?? ''))} | ${fmt(r.detail?.best_below_floor)} | ${r.detail?.evidence_edges ?? 0} |`);
      }
    } else if (type.startsWith('problem_')) {
      lines.push('| Problem | Merged n |', '|---|---|');
      for (const r of [...items].sort((a, b) => (num(b.detail?.merged_n) ?? 0) - (num(a.detail?.merged_n) ?? 0))) lines.push(`| \`${r.node_id}\` ${esc(r.label)} | ${r.detail?.merged_n ?? 'n/a'} |`);
    } else {
      lines.push('| Pillar | Problems linked |', '|---|---|');
      for (const r of items) lines.push(`| \`${r.node_id}\` ${esc(r.label)} | ${r.detail?.problems ?? 0} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * For each evidence-gap claim, propose corpus_ingestion_queue rows from the staged source cards that name it
 * (metadata.claims_supported or the claim's own source card keys). Cards already in the corpus are skipped:
 * those claims need a better primary source, which is listed as a research task instead.
 */
export function proposeIngestion(gaps: GapRow[], claimCards: Map<string, string[]>, cards: StagedCard[]): { proposals: IngestionProposal[]; research: { claim: string; label: string; note: string }[] } {
  const proposals: IngestionProposal[] = [];
  const research: { claim: string; label: string; note: string }[] = [];
  const byKey = new Map(cards.map((c) => [c.card_key, c]));
  for (const g of gaps.filter((r) => r.kind === 'claim_weak_evidence')) {
    const code = g.node_id.replace(/^claim:/, '').toUpperCase();
    const keys = new Set<string>([...(claimCards.get(g.node_id) ?? []), ...cards.filter((c) => c.claims.includes(code)).map((c) => c.card_key)]);
    // Only cards that could count as evidence: market signal and lineage never prove a claim.
    const candidates = [...keys].map((k) => byKey.get(k)).filter((c): c is StagedCard => !!c && (c.tier === 'evidence' || c.tier === 'model'));
    const pending = candidates.filter((c) => !c.ingested);
    for (const c of pending) {
      proposals.push({
        claim: g.node_id,
        claim_label: g.label,
        source_type: c.source_url ? 'url' : 'text',
        source_url: c.source_url,
        source_filename: `${c.file ?? 'corpus-staging/evidence.jsonl'}#${c.card_key}`,
        tradition_tags: [c.tradition],
        reason: `staged card ${c.card_key} (${c.tier ?? 'untiered'}) names ${code} and isn't in the corpus yet${c.citation ? `; cites ${c.citation}` : ''}`,
      });
    }
    if (!pending.length) {
      research.push({
        claim: g.node_id,
        label: g.label,
        note: candidates.length
          ? `its ${candidates.length} staged card(s) are already ingested and still score below 0.45 (best ${fmt(g.detail?.best_below_floor)}): find a primary source that states the claim as worded, or re-word the claim`
          : `no staged source card names it: research a primary source`,
      });
    }
  }
  return { proposals, research };
}

export function proposalsMarkdown(p: ReturnType<typeof proposeIngestion>, generatedAt: string): string {
  const lines = [
    '# Proposed corpus additions (not queued)',
    '',
    `Generated ${generatedAt.slice(0, 16).replace('T', ' ')} UTC by \`scripts/brain/graph-gaps.ts\` from the evidence gaps in \`graph/gaps.md\`.`,
    '',
    '**Nothing here has been inserted into `corpus_ingestion_queue`.** Austin approves first; then each approved row goes into the queue (or through `ingest-staged-corpus.ts` for staged cards) after a backup.',
    '',
    `## Rows for corpus_ingestion_queue (${p.proposals.length})`,
    '',
  ];
  if (!p.proposals.length) lines.push('None: every claim below the floor either has no staged card or its cards are already ingested.', '');
  else {
    lines.push('| Claim | source_type | source_url | source_filename | tradition_tags | Why |', '|---|---|---|---|---|---|');
    for (const r of p.proposals) lines.push(`| \`${r.claim}\` ${esc(r.claim_label)} | ${r.source_type} | ${r.source_url ?? ''} | ${r.source_filename ?? ''} | ${r.tradition_tags.join(', ')} | ${esc(r.reason)} |`);
    lines.push('');
  }
  lines.push(`## Research tasks (${p.research.length})`, '');
  if (!p.research.length) lines.push('None.', '');
  for (const r of p.research) lines.push(`- \`${r.claim}\` ${r.label}: ${r.note}.`);
  lines.push('');
  return lines.join('\n');
}
