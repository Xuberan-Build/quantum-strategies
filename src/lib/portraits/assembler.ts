/**
 * User Portrait Context Assembler
 *
 * assembleUserContext(userId, productSlug) builds a compact text block
 * summarising the user's current portrait state and prior related briefings.
 * The returned contextBlock is prepended to the LLM prompt in the deliverable
 * endpoint so every generated briefing is personalised against the user's
 * evolving identity.
 *
 * Design notes:
 * - Reads are opt-out guarded: if users.portrait_opt_out is true, returns empty.
 * - Caps output at ~6 000 chars: drops briefing excerpts first, then
 *   low-confidence sections, to stay within that budget.
 * - Returns AuditField[] so the caller can write portrait_audit_log 'read' rows.
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import {
  StoredSectionsSchema,
  SECTION_NAMES,
  type PortraitFact,
  type PortraitSection,
  type StoredSections,
} from './schema';
import type { Database } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditField = {
  section: string;
  field_path: string;
  briefing_id?: string;
};

// ---------------------------------------------------------------------------
// Link map — which prior product briefings are relevant per product
// ---------------------------------------------------------------------------

const BRIEFING_LINKS: Record<string, string[]> = {
  'perception-rite-scan-1': [],
  'perception-rite-scan-2': ['perception-rite-scan-1'],
  'perception-rite-scan-3': ['perception-rite-scan-1', 'perception-rite-scan-2'],
  'perception-rite-scan-4': ['perception-rite-scan-1', 'perception-rite-scan-2'],
  'perception-rite-scan-5': ['perception-rite-scan-1', 'perception-rite-scan-2', 'perception-rite-scan-3'],
  'perception-rite-master': ['perception-rite-scan-1', 'perception-rite-scan-2', 'perception-rite-scan-3', 'perception-rite-scan-4', 'perception-rite-scan-5'],
  'personal-alignment': ['perception-rite-scan-2', 'perception-rite-scan-3', 'perception-rite-scan-5'],
  'business-alignment': ['personal-alignment', 'perception-rite-scan-4', 'perception-rite-scan-5'],
  'brand-alignment': ['personal-alignment', 'business-alignment', 'perception-rite-scan-1'],
  'declaration-rite-life-vision': ['personal-alignment', 'perception-rite-scan-2', 'perception-rite-scan-4'],
  'declaration-rite-business-model': ['business-alignment', 'declaration-rite-life-vision', 'perception-rite-scan-5'],
  'declaration-rite-strategic-path': ['declaration-rite-life-vision', 'declaration-rite-business-model', 'personal-alignment', 'business-alignment'],
};

// ---------------------------------------------------------------------------
// Internal DB row types — derived from the generated Database type so they
// stay in sync with the schema. Only the columns this file actually selects.
// ---------------------------------------------------------------------------

type PortraitRow = Pick<
  Database['public']['Tables']['user_portraits']['Row'],
  'sections'
>;

type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'portrait_opt_out'
>;

type BriefingRow = Pick<
  Database['public']['Tables']['briefings']['Row'],
  'id' | 'product_slug' | 'full_text' | 'generated_at'
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHAR_BUDGET = 6000;
const BRIEFING_SNIPPET_LEN = 300;

/**
 * Render a single section line.
 * Returns null when section has no current fact.
 */
function renderSectionLine(
  label: string,
  section: PortraitSection | undefined,
): string | null {
  const current = section?.current;
  if (!current?.summary) return null;

  const evidenceQuote = current.evidence?.[0];
  const quote = evidenceQuote ? ` ("${evidenceQuote}")` : '';
  return `${label}: ${current.summary}${quote}`;
}

/**
 * Render transition lines for a section if any transitions exist.
 */
function renderTransitionLines(
  sectionName: string,
  section: PortraitSection | undefined,
): string[] {
  if (!section?.transitions?.length) return [];

  return section.transitions.map((t) => {
    const date = t.detected_at
      ? new Date(t.detected_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : 'recently';
    return `Recent shift in ${sectionName}: from "${t.from.summary ?? '?'}" to "${t.to.summary ?? '?'}" (detected ${date})`;
  });
}

/**
 * Render a briefing excerpt block.
 */
function renderBriefingBlock(b: BriefingRow): string {
  const date = new Date(b.generated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const snippet = b.full_text.length > BRIEFING_SNIPPET_LEN
    ? b.full_text.slice(0, BRIEFING_SNIPPET_LEN) + '...'
    : b.full_text;

  return `From their ${b.product_slug} briefing (${date}):\n  ${snippet}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function assembleUserContext(
  userId: string,
  productSlug: string,
): Promise<{ contextBlock: string; auditFields: AuditField[] }> {
  const empty = { contextBlock: '', auditFields: [] };

  // ------------------------------------------------------------------
  // 1. Check opt-out
  // ------------------------------------------------------------------
  const { data: userRow, error: userError } = await supabaseAdmin
    .from('users')
    .select('portrait_opt_out')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    console.error('[assembler] Failed to read user opt-out:', userError);
    // Fail safe: don't inject context if we can't confirm consent
    return empty;
  }

  const typedUserRow: UserRow | null = userRow;
  if (typedUserRow?.portrait_opt_out === true) {
    return empty;
  }

  // ------------------------------------------------------------------
  // 2. Load portrait row
  // ------------------------------------------------------------------
  const { data: portraitRow, error: portraitError } = await supabaseAdmin
    .from('user_portraits')
    .select('sections')
    .eq('user_id', userId)
    .maybeSingle();

  if (portraitError) {
    console.error('[assembler] Failed to read user_portraits:', portraitError);
    return empty;
  }

  if (!portraitRow) return empty;

  // portraitRow.sections is Json from the generated types; Zod parses it
  // into the strongly-typed StoredSections shape below.
  const typedPortraitRow: PortraitRow = portraitRow;
  const parsedSections = StoredSectionsSchema.safeParse(typedPortraitRow.sections);

  if (!parsedSections.success) {
    console.warn('[assembler] Portrait sections failed Zod parse — skipping:', parsedSections.error.message);
    return empty;
  }

  const sections: StoredSections = parsedSections.data;

  // Bail early if no sections have any data
  const hasAnyCurrent = SECTION_NAMES.some((n) => sections[n]?.current != null);
  if (!hasAnyCurrent) return empty;

  // ------------------------------------------------------------------
  // 3. Load up to 3 related briefings
  // ------------------------------------------------------------------
  const linkedSlugs: string[] = BRIEFING_LINKS[productSlug] ?? [];
  let relatedBriefings: BriefingRow[] = [];

  if (linkedSlugs.length > 0) {
    const { data: briefingRows, error: briefingError } = await supabaseAdmin
      .from('briefings')
      .select('id, product_slug, full_text, generated_at')
      .eq('user_id', userId)
      .in('product_slug', linkedSlugs)
      .order('generated_at', { ascending: false })
      .limit(3);

    if (briefingError) {
      console.warn('[assembler] Failed to load related briefings:', briefingError);
      // Non-fatal — continue without briefings
    } else {
      relatedBriefings = briefingRows ?? [];
    }
  }

  // ------------------------------------------------------------------
  // 4. Build context block, respecting char budget
  // ------------------------------------------------------------------
  const auditFields: AuditField[] = [];

  // Section label display names in the format spec order
  const sectionDisplayMap: Array<[keyof StoredSections, string]> = [
    ['identity', 'Identity'],
    ['values', 'Values'],
    ['energy', 'Energy'],
    ['activity', 'Activity'],
    ['results', 'Results'],
    ['path', 'Path'],
  ];

  // Sort sections by confidence (desc) so we drop lowest-confidence ones first
  // when we need to trim under budget
  const sectionsByConfidence = sectionDisplayMap
    .map(([key, label]) => ({
      key,
      label,
      section: sections[key],
      confidence: sections[key]?.current?.confidence ?? 0,
    }))
    .filter((s) => s.section?.current != null)
    .sort((a, b) => b.confidence - a.confidence);

  // Build section body lines
  const sectionLines: string[] = [];
  const transitionLines: string[] = [];

  for (const { key, label, section } of sectionsByConfidence) {
    const line = renderSectionLine(label, section);
    if (line) {
      sectionLines.push(line);
      // Record audit field
      auditFields.push({ section: key, field_path: 'current.summary' });
    }
    const transitions = renderTransitionLines(key, section);
    transitionLines.push(...transitions);
  }

  // Render briefing blocks
  const briefingBlocks: string[] = relatedBriefings.map((b) => {
    relatedBriefings.forEach((rb) => {
      if (rb.id === b.id) {
        auditFields.push({ section: 'identity', field_path: 'briefing_excerpt', briefing_id: b.id });
      }
    });
    return renderBriefingBlock(b);
  });

  // Audit fields for briefings (deduplicate the above — rebuild cleanly)
  // We pushed duplicates above; reset briefing audit fields properly
  const briefingAuditFields: AuditField[] = relatedBriefings.map((b) => ({
    section: 'identity',
    field_path: 'briefing_excerpt',
    briefing_id: b.id,
  }));

  // Build draft output
  const compose = (includeBriefings: boolean, maxSections: number): string => {
    const usedSections = sectionsByConfidence.slice(0, maxSections);

    const bodyLines: string[] = [];

    for (const { key, label, section } of usedSections) {
      const line = renderSectionLine(label, section);
      if (line) bodyLines.push(line);
    }

    // Re-build transition lines for the used sections
    const usedTransitions: string[] = [];
    for (const { key, section } of usedSections) {
      usedTransitions.push(...renderTransitionLines(key, section));
    }

    const parts: string[] = [];
    if (bodyLines.length) parts.push(bodyLines.join('\n'));
    if (usedTransitions.length) parts.push(usedTransitions.join('\n'));

    if (includeBriefings && briefingBlocks.length) {
      parts.push(briefingBlocks.join('\n\n'));
    }

    const inner = parts.join('\n\n');
    return [
      '=== USER CONTEXT ===',
      '(From this user\'s prior products. Reference where relevant.)',
      '',
      inner,
      '',
      '=== END USER CONTEXT ===',
    ].join('\n');
  };

  // Try: all sections + briefings
  let result = compose(true, sectionsByConfidence.length);

  if (result.length <= CHAR_BUDGET) {
    return {
      contextBlock: result,
      auditFields: [...auditFields.filter((f) => f.field_path !== 'briefing_excerpt'), ...briefingAuditFields],
    };
  }

  // Drop briefings first
  result = compose(false, sectionsByConfidence.length);

  if (result.length <= CHAR_BUDGET) {
    return { contextBlock: result, auditFields: auditFields.filter((f) => f.field_path !== 'briefing_excerpt') };
  }

  // Drop sections from lowest-confidence end until under budget
  for (let maxSections = sectionsByConfidence.length - 1; maxSections >= 1; maxSections--) {
    result = compose(false, maxSections);
    if (result.length <= CHAR_BUDGET) break;
  }

  return {
    contextBlock: result,
    auditFields: auditFields.filter((f) => f.field_path !== 'briefing_excerpt'),
  };
}
