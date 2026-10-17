/**
 * claims: the thesis-evidence map -> `claim` nodes with their tier.
 *
 * - "Claims at a glance" table (columns ID, Claim, Tier, Strength, and the Rite/scan that sells it):
 *   one claim per row; supports edge claim -> product for the products named in the "sells it" cell.
 * - Ledger blocks (#### "P1 · …"): evidence, contested/qualifier, must-not-stretch, source card keys.
 *   Other claim ids named in a "Contested" bullet -> contradicts; named elsewhere in the block -> supports.
 * - "Claims we will NOT make" table (#, We will not say, Why, Say instead): claims with
 *   props.kind = 'will_not_say' (excluded from evidence gaps).
 */
import { readBrain, type ExtractContext } from './context';
import { claimIdsIn, productMatcher } from './extract-problem-map';
import { nodeId, noteId } from './ids';
import { clean, col, findTable, sections, truncate } from './md';
import type { ExtractResult, GraphEdge, GraphNode } from './types';

/** "- **Evidence:** text" bullets in a ledger block -> { evidence: text } (lowercased label, first word group). */
export function ledgerBullets(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*-\s+\*\*([^*]+?):?\*\*:?\s*([\s\S]*?)(?=^\s*-\s+\*\*|(?![\s\S]))/gm)) {
    const key = m[1].toLowerCase().replace(/[^a-z /]+/g, '').trim();
    if (!(key in out)) out[key] = m[2].trim();
  }
  return out;
}

/** Claim ids named in a text, skipping sentences that negate the link ("never cite as support for D1"). */
export function relatedClaimIds(text: string): string[] {
  const out = new Set<string>();
  for (const sentence of text.split(/(?<=[.;!?])\s+/)) {
    if (/\b(never|not|no)\b|n't\b/i.test(sentence)) continue;
    for (const c of claimIdsIn(sentence)) out.add(c);
  }
  return [...out];
}

export function extractClaims(ctx: ExtractContext): ExtractResult {
  const rel = ctx.config.claims;
  const md = readBrain(ctx, rel);
  if (!md) return { nodes: [], edges: [], warnings: [`${rel} not found`] };
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  const findProducts = productMatcher(ctx);

  const glance = findTable(md, /^id$/i, /^claim/i, /^tier$/i);
  if (!glance) warnings.push('claims: "at a glance" table (ID, Claim, Tier) not found');
  else {
    const ci = col(glance, /^id$/i);
    const cc = col(glance, /^claim/i);
    const ct = col(glance, /^tier$/i);
    const cs = col(glance, /strength/i);
    const cr = col(glance, /rite|scan|sell/i);
    for (const r of glance.rows) {
      const code = clean(r[ci] ?? '');
      if (!/^[A-Z]\d{1,2}$/.test(code)) continue;
      const label = clean(r[cc] ?? '');
      const strength = cs >= 0 ? clean(r[cs] ?? '') : null;
      const id = nodeId('claim', code);
      nodes.set(id, {
        id,
        type: 'claim',
        label,
        tier: ct >= 0 ? clean(r[ct] ?? '') || null : null,
        source_path: rel,
        weight: strength === 'Strong' ? 3 : strength === 'Moderate' ? 2 : 1,
        props: { code, strength, kind: code.startsWith('M') || strength === 'Myth' ? 'myth' : 'claim', sold_by: cr >= 0 ? clean(r[cr] ?? '') : null },
        embedText: label,
      });
      if (cr >= 0) for (const pid of findProducts(r[cr] ?? '')) edges.push({ src: id, dst: pid, type: 'supports', props: { via: 'sold_by' } });
    }
  }

  const known = new Set([...nodes.values()].map((n) => (n.props?.code as string) ?? ''));
  for (const s of sections(md, 4)) {
    const m = s.title.match(/^([A-Z]\d{1,2})\s*[·:.-]\s*(.+)$/);
    if (!m) continue;
    const code = m[1];
    const id = nodeId('claim', code);
    const n: GraphNode = nodes.get(id) ?? { id, type: 'claim', label: clean(m[2]), source_path: rel, props: { code, kind: code.startsWith('M') ? 'myth' : 'claim' } };
    nodes.set(id, n);
    known.add(code);
    const b = ledgerBullets(s.body);
    const evidence = b['evidence'] ?? b['bust'] ?? b['bust contested tell the history'] ?? null;
    const contested = b['contested / qualifier'] ?? b['contested'] ?? null;
    const mustNot = b['must not be stretched to'] ?? null;
    const sourcesText = b['sources'] ?? s.body;
    const cards = [...new Set([...sourcesText.matchAll(/`\[([a-z0-9_]+)\]`|\[([a-z0-9_]{6,})\]/g)].map((x) => x[1] ?? x[2]))];
    n.summary = evidence ? truncate(clean(evidence), 1200) : (n.summary ?? null);
    n.props = {
      ...n.props,
      heading: clean(s.title),
      contested: contested ? truncate(clean(contested), 800) : null,
      must_not: mustNot ? truncate(clean(mustNot), 600) : null,
      source_cards: cards,
      verify: /VERIFY/.test(s.body),
      audience_pain: b['audience pain'] ? truncate(clean(b['audience pain']), 800) : null,
    };
    n.embedText = [n.label, evidence ? clean(evidence) : ''].filter(Boolean).join('. ');
    // Relations to other claims named in the evidence (supports) or contested (contradicts) bullets.
    for (const [text, type] of [[evidence, 'supports'], [contested, 'contradicts']] as const) {
      for (const other of relatedClaimIds(text ?? '')) {
        if (other !== code) edges.push({ src: id, dst: nodeId('claim', other), type, props: { via: 'ledger block' } });
      }
    }
  }

  // Claims we will NOT make
  const not = findTable(md, /^#$/, /will not say/i);
  if (not) {
    const ci = col(not, /^#$/);
    const cw = col(not, /will not say/i);
    const cy = col(not, /^why$/i);
    const cs = col(not, /say instead/i);
    for (const r of not.rows) {
      const code = clean(r[ci] ?? '');
      if (!/^X\d{1,2}$/.test(code)) continue;
      const id = nodeId('claim', code);
      const text = clean(r[cw] ?? '');
      nodes.set(id, {
        id,
        type: 'claim',
        label: truncate(text, 160),
        summary: cy >= 0 ? clean(r[cy] ?? '') : null,
        source_path: rel,
        props: { code, kind: 'will_not_say', full: text, say_instead: cs >= 0 ? clean(r[cs] ?? '') : null },
      });
      known.add(code);
    }
  }

  // The ledger note mentions every claim it defines (keeps refused claims attached to their source).
  for (const n of nodes.values()) edges.push({ src: noteId(rel), dst: n.id, type: 'mentions', props: { via: 'defined in' } });
  // Keep only claim->claim edges whose target exists in this file.
  const kept = edges.filter((e) => !e.dst.startsWith('claim:') || nodes.has(e.dst));
  return { nodes: [...nodes.values()], edges: kept, warnings };
}
