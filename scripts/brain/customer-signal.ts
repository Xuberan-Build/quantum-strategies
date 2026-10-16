/**
 * Customer signal for the brain tick: a deterministic, READ-ONLY aggregate of what
 * our own users have told us. Output is anonymised JSON (no ids, names, emails, user
 * or session references) with short, scrubbed text excerpts only.
 *
 * Run from the repo root:
 *   NODE_PATH=$PWD/node_modules node --env-file=.env --import tsx scripts/brain/customer-signal.ts [--out FILE] [--summary]
 *
 * --summary prints only aggregate row counts (safe for logs).
 * Only SELECTs. Never writes to the database.
 */
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('customer-signal: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (run with --env-file=.env)');
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const args = process.argv.slice(2);
const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
const summaryOnly = args.includes('--summary');

const EXCERPT = 220;
const MAX_EXCERPTS = 25;

type Row = Record<string, unknown>;

/** Read every row of a table (paged), selecting only the named columns. Never ids. */
async function readAll(table: string, columns: string[]): Promise<{ rows: Row[]; error?: string }> {
  const rows: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await db.from(table).select(columns.join(',')).range(from, from + page - 1);
    if (error) return { rows, error: `${error.code ?? ''} ${error.message}`.trim() };
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < page) break;
  }
  return { rows };
}

/** Scrub anything identifying and clip to a short excerpt. */
function scrub(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  let s = v
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/https?:\/\/\S+/g, '[link]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < 3) return null;
  if (s.length > EXCERPT) s = s.slice(0, EXCERPT - 1).trimEnd() + '…';
  return s;
}

function excerpts(rows: Row[], field: string): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const s = scrub(r[field]);
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= MAX_EXCERPTS) break;
  }
  return out;
}

function countBy(rows: Row[], field: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const vals = Array.isArray(r[field]) ? (r[field] as unknown[]) : [r[field]];
    for (const v of vals) {
      const k = v === null || v === undefined || v === '' ? 'unknown' : String(v);
      out[k] = (out[k] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

function avg(rows: Row[], field: string): { mean: number | null; n: number } {
  const nums = rows.map((r) => r[field]).filter((v): v is number => typeof v === 'number');
  if (!nums.length) return { mean: null, n: 0 };
  return { mean: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100, n: nums.length };
}

function avgs(rows: Row[], fields: string[]) {
  return Object.fromEntries(fields.map((f) => [f, avg(rows, f)]));
}

function byProduct(rows: Row[], fields: string[]) {
  const groups: Record<string, Row[]> = {};
  for (const r of rows) (groups[String(r.product_slug ?? 'unknown')] ??= []).push(r);
  return Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, { n: g.length, ...avgs(g, fields) }]));
}

async function main() {
  const errors: Record<string, string> = {};
  const load = async (table: string, cols: string[]) => {
    const { rows, error } = await readAll(table, cols);
    if (error) errors[table] = error;
    // Drop synthetic QA rows (e.g. product_slug "trigger-test-…").
    return rows.filter((r) => !/^(trigger-)?test/i.test(String(r.product_slug ?? '')));
  };

  const insights = await load('session_insights', ['product_slug', 'business_model', 'hd_type', 'pain_points', 'themes', 'extracted_at']);
  const friction = await load('step_friction_log', ['product_slug', 'step_index', 'reason', 'status', 'note', 'created_at']);
  const scanCols = ['clarity_score', 'relevance_score', 'actionability_score', 'surprise_level'];
  const scan = await load('scan_feedback', ['product_slug', ...scanCols, 'biggest_aha', 'confusion_points', 'implementation_plan', 'submitted_at']);
  const bpCols = ['insight_depth_score', 'personalization_score', 'actionability_score'];
  const blueprint = await load('blueprint_feedback', ['product_slug', ...bpCols, 'biggest_gap_revealed', 'immediate_action', 'integration_with_perception', 'submitted_at']);
  const decCols = ['alignment_score', 'commitment_clarity_score', 'commitment_level', 'execution_confidence_score'];
  const declaration = await load('declaration_feedback', ['product_slug', ...decCols, 'decision_made', 'support_needed', 'submitted_at']);
  const cjCols = ['nps_score', 'transformation_score', 'journey_coherence_score', 'rite_integration_score', 'clarity_gained', 'confidence_gained', 'direction_clarity', 'willingness_to_pay_amount'];
  const journey = await load('complete_journey_feedback', [
    ...cjCols, 'most_valuable_rite', 'most_valuable_product_overall', 'least_valuable_product_overall', 'founding_member_interest',
    'purchase_timeline', 'would_refer_others', 'testimonial_consent', 'testimonial_text', 'biggest_breakthrough', 'what_worked_best',
    'what_needs_improvement', 'what_would_make_you_say_yes', 'missing_elements', 'submitted_at',
  ]);
  const conversion = await load('beta_conversion_results', ['decision', 'offer_type', 'decline_reason', 'decline_feedback', 'purchased_at_stage', 'future_interest', 'created_at']);
  const participants = await load('beta_participants', ['status', 'current_rite', 'cohort_name', 'conversion_decision', 'complete_journey_submitted', 'total_completion_percentage', 'perception_completed_count', 'orientation_completed_count', 'declaration_completed_count']);

  const counts: Record<string, number> = {
    session_insights: insights.length,
    session_insights_with_pain_points: insights.filter((r) => Array.isArray(r.pain_points) && r.pain_points.length).length,
    session_insights_with_themes: insights.filter((r) => Array.isArray(r.themes) && r.themes.length).length,
    step_friction_log: friction.length,
    scan_feedback: scan.length,
    blueprint_feedback: blueprint.length,
    declaration_feedback: declaration.length,
    complete_journey_feedback: journey.length,
    beta_conversion_results: conversion.length,
    beta_participants: participants.length,
  };

  if (summaryOnly) {
    console.log(JSON.stringify({ counts, errors }, null, 2));
    return;
  }

  // Pain points: raw answers, clipped. Testimonial text only where consent was given.
  const painExcerpts: string[] = [];
  for (const r of insights) {
    for (const p of (Array.isArray(r.pain_points) ? r.pain_points : []) as unknown[]) {
      const s = scrub(p);
      if (s && !painExcerpts.includes(s)) painExcerpts.push(s);
    }
  }

  const out = {
    asOf: new Date().toISOString(),
    note: 'Anonymised aggregate. No ids, names or emails. Excerpts are scrubbed and clipped; trim further and strip personal specifics before quoting.',
    counts,
    errors,
    sessionInsights: {
      byProduct: countBy(insights, 'product_slug'),
      businessModel: countBy(insights, 'business_model'),
      hdType: countBy(insights, 'hd_type'),
      themes: countBy(insights.filter((r) => Array.isArray(r.themes)), 'themes'),
      painPointExcerpts: painExcerpts.slice(0, 60),
    },
    friction: {
      byProduct: countBy(friction, 'product_slug'),
      byReason: countBy(friction, 'reason'),
      byStatus: countBy(friction, 'status'),
      byStep: countBy(friction.map((r) => ({ k: `${r.product_slug}#${r.step_index ?? '?'}` })), 'k'),
      notes: excerpts(friction, 'note'),
    },
    scanFeedback: {
      overall: avgs(scan, scanCols),
      byProduct: byProduct(scan, scanCols),
      biggestAha: excerpts(scan, 'biggest_aha'),
      confusion: excerpts(scan, 'confusion_points'),
      implementationPlans: excerpts(scan, 'implementation_plan'),
    },
    blueprintFeedback: {
      overall: avgs(blueprint, bpCols),
      byProduct: byProduct(blueprint, bpCols),
      biggestGap: excerpts(blueprint, 'biggest_gap_revealed'),
      immediateAction: excerpts(blueprint, 'immediate_action'),
      integration: excerpts(blueprint, 'integration_with_perception'),
    },
    declarationFeedback: {
      overall: avgs(declaration, decCols),
      byProduct: byProduct(declaration, decCols),
      decisions: excerpts(declaration, 'decision_made'),
      supportNeeded: excerpts(declaration, 'support_needed'),
    },
    completeJourney: {
      overall: avgs(journey, cjCols),
      mostValuableRite: countBy(journey, 'most_valuable_rite'),
      mostValuableProduct: countBy(journey, 'most_valuable_product_overall'),
      leastValuableProduct: countBy(journey, 'least_valuable_product_overall'),
      foundingMemberInterest: countBy(journey, 'founding_member_interest'),
      purchaseTimeline: countBy(journey, 'purchase_timeline'),
      wouldRefer: countBy(journey, 'would_refer_others'),
      breakthroughs: excerpts(journey, 'biggest_breakthrough'),
      workedBest: excerpts(journey, 'what_worked_best'),
      needsImprovement: excerpts(journey, 'what_needs_improvement'),
      wouldMakeYouSayYes: excerpts(journey, 'what_would_make_you_say_yes'),
      missing: excerpts(journey, 'missing_elements'),
      consentedTestimonials: excerpts(journey.filter((r) => r.testimonial_consent === true), 'testimonial_text'),
    },
    conversion: {
      decision: countBy(conversion, 'decision'),
      offerType: countBy(conversion, 'offer_type'),
      declineReason: countBy(conversion, 'decline_reason'),
      purchasedAtStage: countBy(conversion, 'purchased_at_stage'),
      declineFeedback: excerpts(conversion, 'decline_feedback'),
    },
    betaParticipants: {
      status: countBy(participants, 'status'),
      currentRite: countBy(participants, 'current_rite'),
      cohort: countBy(participants, 'cohort_name'),
      conversionDecision: countBy(participants, 'conversion_decision'),
      completeJourneySubmitted: countBy(participants, 'complete_journey_submitted'),
      avgCompletionPct: avg(participants, 'total_completion_percentage'),
      ritesCompleted: avgs(participants, ['perception_completed_count', 'orientation_completed_count', 'declaration_completed_count']),
    },
  };

  const json = JSON.stringify(out, null, 2);
  if (outPath) writeFileSync(outPath, json);
  else console.log(json);
}

main().catch((e) => {
  console.error('customer-signal failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
