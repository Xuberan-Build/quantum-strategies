/**
 * The Perception Read: shared contract.
 *
 * The free front-door quiz runs on the same engine as the Three Rites: one row in
 * product_definitions (product_slug 'perception-read', steps = the questions) and one
 * row per attempt in product_sessions. What differs is captured by product flags
 * (free, no auth, no chart) and by the pieces below. Spec: brain/gtm/free-quiz-spec-v3.md.
 *
 * Owners (built in parallel, all import from here; change only by agreement):
 *   - src/lib/read/{questions,score,safety,mirror,results,paragraph}.ts  → scoring/content agent
 *   - supabase migration, src/lib/read/store.ts, /api/read/*               → engine/API agent
 *   - /read pages and components                                           → UI agent
 *   - emails, lead→account link, checkout bridge                           → email/checkout agent
 */

export const READ_PRODUCT_SLUG = 'perception-read';

/** The five result patterns (spec v3 §7.1). SHOULDS leads and wins ties. */
export type PatternId = 'SHOULDS' | 'NOT_CAUGHT_UP' | 'ON_EMPTY' | 'NO_THREAD' | 'SMALLER';

/** Q1 segment (spec v3 §5 Q1). */
export type Segment = 'operator' | 'side_builder' | 'multi_stream' | 'team_lead' | 'between_things';

/** Where the visitor came from; stored on the session and the lead. */
export interface ReadUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** e.g. 'manifestation' when the landing variant is keyed to LoA traffic (spec v3 §3.5, N10). */
  variant?: string;
}

/**
 * One answer. `questionId` matches ReadQuestion.id (e.g. 'q1', 'q2', 'q7').
 * - choice: option values (tags such as 'say:stall'), possibly several
 * - text:   free text (open questions); always passes the safety screen first
 * - number: e.g. Q7 hours, Q10 baseline
 * - parts:  multi-part questions (Q7: thing, hours, instead, wantOrShould)
 */
export interface ReadAnswer {
  questionId: string;
  choice?: string[];
  text?: string;
  number?: number;
  parts?: Record<string, string | number | string[] | null>;
}

export type ReadAnswers = Record<string, ReadAnswer>;

/** A question as stored in product_definitions.steps for 'perception-read'. */
export interface ReadQuestion {
  id: string; // 'q1'..'q12'
  order: number;
  title: string; // short screen title
  question: string; // the prompt, in Austin's voice
  helper?: string;
  kind: 'single' | 'multi' | 'text' | 'scale' | 'week_mirror' | 'multi_then_pick';
  required: boolean;
  maxPicks?: number;
  options?: { value: string; label: string; segments?: Segment[]; variants?: string[] }[];
  scale?: { min: number; max: number; minLabel: string; midLabel?: string; maxLabel: string };
  /** For text questions: placeholder and soft length hint. No minimum lengths (spec). */
  placeholder?: string;
  /** Show only for these segments / landing variants. */
  showFor?: { segments?: Segment[]; variants?: string[] };
}

export interface PatternScores {
  scores: Record<PatternId, number>;
  pattern: PatternId;
  /** True when no pattern cleared the threshold and the fallback was used. */
  lowSignal: boolean;
  /** Plain-language reasons for the pick (for logs and the builder, never shown raw). */
  reasons: string[];
}

/** Safety screen (spec v3 §6). Runs in code on every text answer before any result. */
export type SafetyTier = 'none' | 'clinical' | 'hardship' | 'crisis';
export interface SafetyResult {
  tier: SafetyTier;
  /** Which list matched; never the user's text. */
  matchedLists: string[];
}

/** The week mirror shown before the pattern name (spec v3 §3.2, block 0). */
export interface WeekMirror {
  thing: string | null; // what they keep meaning to get to (their words)
  hours: number | null; // last week
  instead: string | null; // what got the hours instead
  wantOrShould: 'want' | 'should' | 'unsure' | null;
  /** False when they gave it 6+ hours: the mirror does not invent a gap. */
  showsGap: boolean;
  line: string; // the rendered one-line mirror, plain text
}

/** What the visitor sees before the email gate. */
export interface ReadPreview {
  sessionId: string;
  safety: SafetyResult;
  /** null when safety.tier === 'crisis' (support screen instead; no pattern, no offer). */
  mirror: WeekMirror | null;
  pattern: { id: PatternId; name: string; read: string } | null;
}

/** One block of the full result page, in display order (spec v3 §8). */
export interface ResultBlock {
  id:
    | 'mirror'
    | 'pattern'
    | 'their_words'
    | 'not_alone'
    | 'why_it_didnt_stick'
    | 'whats_going_on'
    | 'fix_fits'
    | 'permission'
    | 'move'
    | 'offer'
    | 'accuracy'
    | 'scope'
    | 'support';
  title?: string;
  body: string; // plain text / light markdown
  /** Evidence or lineage line shown under the block. */
  source?: { label: string; url?: string; tier?: string };
  meta?: Record<string, unknown>;
}

/** The full result after the email gate. */
export interface ReadResult {
  sessionId: string;
  pattern: PatternId | null;
  patternName: string | null;
  blocks: ResultBlock[];
  /** Rite I offer: the Perception bundle at $12 (spec v3 decision), routed by pattern. */
  offer: { productSlug: 'perception-rite-bundle'; priceUsd: 12; scanSlug: string; scanName: string } | null;
  /** True when the AI mirror paragraph failed verification and a static fallback was used. */
  usedFallback: boolean;
}

/** Lead captured at the gate. No account until checkout. */
export interface ReadLeadInput {
  email: string;
  consentMarketing: boolean; // separate unticked box
  utm?: ReadUtm;
}

/** Funnel events (spec v3 §11), written to product_events. */
export type ReadEvent =
  | 'read_view_landing'
  | 'read_start'
  | 'read_step_view'
  | 'read_step_submit'
  | 'read_complete'
  | 'read_safety_triggered'
  | 'read_preview_view'
  | 'read_email_submit'
  | 'read_result_view'
  | 'read_accuracy_rated'
  | 'read_move_committed'
  | 'read_offer_click'
  | 'read_checkout_started'
  | 'read_purchase';
