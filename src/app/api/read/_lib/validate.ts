/**
 * Request validation for /api/read/* (zod shape checks + checks against the question definitions).
 * Error strings are codes, never echoes of the input.
 */
import { z } from 'zod';
import { READ_QUESTIONS } from '@/lib/read/questions';
import type { ReadAnswer, ReadAnswers, ReadQuestion, Segment } from '@/lib/read/types';

export const MAX_TEXT = 600;
const MAX_TAG = 64;

const tag = z.string().min(1).max(MAX_TAG);
const shortStr = z.string().max(120);

export const utmSchema = z
  .strictObject({
    source: shortStr.optional(),
    medium: shortStr.optional(),
    campaign: shortStr.optional(),
    content: shortStr.optional(),
    term: shortStr.optional(),
    variant: z.string().max(40).optional(),
  })
  .optional();

export const sessionIdSchema = z.uuid();

const partValue = z.union([
  z.string().max(MAX_TEXT),
  z.number().finite(),
  z.array(z.string().max(MAX_TEXT)).max(10),
  z.null(),
]);

export const readAnswerSchema = z.strictObject({
  questionId: z.string().regex(/^q\d{1,2}$/),
  choice: z.array(tag).max(20).optional(),
  text: z.string().max(MAX_TEXT).optional(),
  number: z.number().finite().optional(),
  parts: z
    .record(z.string().regex(/^[A-Za-z0-9_]{1,32}$/), partValue)
    .refine((p) => Object.keys(p).length <= 12, 'too_many_parts')
    .optional(),
});

export const startSchema = z.strictObject({ utm: utmSchema, variant: z.string().max(40).optional() }).optional();

export const answerBodySchema = z.strictObject({ sessionId: sessionIdSchema, answer: readAnswerSchema });

export const sessionBodySchema = z.strictObject({ sessionId: sessionIdSchema });

export const unlockBodySchema = z.strictObject({
  sessionId: sessionIdSchema,
  lead: z.strictObject({
    email: z.string().trim().max(254).pipe(z.email()),
    consentMarketing: z.boolean(),
    utm: utmSchema,
  }),
});

export const READ_EVENTS = [
  'read_view_landing',
  'read_start',
  'read_step_view',
  'read_step_submit',
  'read_complete',
  'read_safety_triggered',
  'read_preview_view',
  'read_email_submit',
  'read_result_view',
  'read_accuracy_rated',
  'read_move_committed',
  'read_offer_click',
  'read_checkout_started',
  'read_purchase',
] as const;

/**
 * Events the browser may send. Everything else in ReadEvent is recorded server-side by the
 * route that does the work (start, answer, complete, unlock, result, feedback, purchase webhook),
 * so clients can't forge funnel steps.
 */
export const CLIENT_READ_EVENTS = [
  'read_view_landing',
  'read_step_view',
  'read_preview_view',
  'read_offer_click',
  'read_checkout_started',
] as const satisfies readonly (typeof READ_EVENTS)[number][];

/** Client events that may be sent before a session exists. */
export const SESSIONLESS_READ_EVENTS: readonly string[] = ['read_view_landing'];

const propValue =z.union([z.string().max(200), z.number().finite(), z.boolean(), z.null()]);

export const eventBodySchema = z.strictObject({
  sessionId: sessionIdSchema.optional(),
  /** Signed result-link token, for events fired from a result page opened from the email. */
  t: z.string().max(200).optional(),
  event: z.enum(CLIENT_READ_EVENTS),
  step: z.union([z.string().max(32), z.number().int().min(0).max(100)]).optional(),
  props: z
    .record(z.string().max(40), z.union([propValue, z.array(z.union([z.string().max(64), z.number().finite()])).max(20)]))
    .refine((p) => Object.keys(p).length <= 20, 'too_many_props')
    .optional(),
});

export const feedbackBodySchema = z.strictObject({
  sessionId: sessionIdSchema,
  t: z.string().max(200).optional(),
  accuracy: z.number().int().min(1).max(5).optional(),
  hardestPart: z.string().max(MAX_TEXT).optional(),
  moveCommitted: z.boolean().optional(),
});

// ─── Answer vs question definition ───────────────────────────────────────────

interface PartDef {
  id: string;
  kind: 'text' | 'single';
  required: boolean;
  options?: { value: string }[];
  fromPicked?: boolean;
  showIfPicked?: string[];
  skipIfPicked?: string[];
}
type QuestionDef = ReadQuestion & { parts?: PartDef[] };

export function findQuestion(id: string): QuestionDef | undefined {
  return (READ_QUESTIONS as QuestionDef[]).find((q) => q.id === id);
}

const nonEmpty = (v: unknown) =>
  (typeof v === 'string' && v.trim().length > 0) ||
  typeof v === 'number' ||
  (Array.isArray(v) && v.some((x) => typeof x === 'string' && x.trim().length > 0));

function isEmptyAnswer(a: ReadAnswer): boolean {
  return (
    !(a.choice && a.choice.length) &&
    !(a.text && a.text.trim()) &&
    a.number === undefined &&
    !(a.parts && Object.values(a.parts).some(nonEmpty))
  );
}

function partVisible(p: PartDef, picked: string[]): boolean {
  if (p.showIfPicked && !p.showIfPicked.some((v) => picked.includes(v))) return false;
  if (p.skipIfPicked && p.skipIfPicked.some((v) => picked.includes(v))) return false;
  return true;
}

/**
 * Checks one answer against its question definition. Returns an error code or null.
 * Option checks use the full option list (not the segment-filtered one) so a stale client
 * never loses an answer; the scorer ignores tags it doesn't know.
 */
export function checkAnswer(answer: ReadAnswer): string | null {
  const q = findQuestion(answer.questionId);
  if (!q) return 'unknown_question';

  if (isEmptyAnswer(answer)) return q.required ? 'answer_required' : null;

  const optionValues = new Set((q.options ?? []).map((o) => o.value));
  // Lenient: the UI may also put a part's tag in `choice` (Q11 sends 'out:*' there as well as in parts).
  const allowedChoice = new Set([...optionValues, ...(q.parts ?? []).flatMap((p) => (p.options ?? []).map((o) => o.value))]);
  const mainPicked = (answer.choice ?? []).filter((v) => optionValues.has(v));
  const picked = answer.choice ?? [];
  if (new Set(picked).size !== picked.length) return 'duplicate_choice';

  switch (q.kind) {
    case 'single':
      if (picked.length !== 1) return 'choose_one';
      break;
    case 'multi':
    case 'multi_then_pick': {
      const max = q.maxPicks ?? optionValues.size;
      if (mainPicked.length < 1) return 'choose_at_least_one';
      if (mainPicked.length > max) return 'too_many_choices';
      break;
    }
    case 'scale': {
      if (answer.number === undefined || !Number.isInteger(answer.number)) return 'number_required';
      if (q.scale && (answer.number < q.scale.min || answer.number > q.scale.max)) return 'number_out_of_range';
      break;
    }
    case 'text':
      if (q.required && !(answer.text && answer.text.trim()) && !Object.values(answer.parts ?? {}).some(nonEmpty)) {
        return 'answer_required';
      }
      break;
    case 'week_mirror':
      if (!answer.parts) return 'parts_required';
      break;
  }

  if (picked.length && allowedChoice.size && picked.some((v) => !allowedChoice.has(v))) return 'unknown_option';
  if (picked.length && !allowedChoice.size) return 'unexpected_choice';

  if (q.parts && answer.parts) {
    const defs = new Map(q.parts.map((p) => [p.id, p]));
    for (const [key, value] of Object.entries(answer.parts)) {
      const def = defs.get(key);
      if (!def) continue; // unknown keys are kept (size-bounded by the schema) and ignored by the scorer
      if (value === null) continue;
      if (def.kind === 'single') {
        if (typeof value !== 'string') return 'invalid_part';
        if (def.fromPicked && !mainPicked.includes(value)) return 'part_not_picked';
        if (def.options && !def.options.some((o) => o.value === value)) return 'unknown_option';
      }
    }
  }

  if (q.parts && q.required) {
    for (const p of q.parts) {
      if (!p.required || p.id === 'text' || !partVisible(p, picked)) continue;
      if (p.kind === 'text' && answer.text && answer.text.trim()) continue; // e.g. Q8 sends the lines in `text` too
      if (p.fromPicked && mainPicked.length <= 1) continue; // the only pick is the loudest
      if (!nonEmpty(answer.parts?.[p.id])) return 'part_required';
    }
  }

  return null;
}

const SEGMENT_BY_TAG: Record<string, Segment> = {
  'seg:operator': 'operator',
  'seg:side_builder': 'side_builder',
  'seg:multi': 'multi_stream',
  'seg:multi_stream': 'multi_stream',
  'seg:team_lead': 'team_lead',
  'seg:between': 'between_things',
  'seg:between_things': 'between_things',
};

export function segmentOf(answers: ReadAnswers): Segment | null {
  const t = answers.q1?.choice?.[0];
  return t ? SEGMENT_BY_TAG[t] ?? null : null;
}

export const SEGMENTS: Segment[] = ['operator', 'side_builder', 'multi_stream', 'team_lead', 'between_things'];

export function zodIssues(e: z.ZodError): { path: string; code: string }[] {
  return e.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), code: i.code }));
}
