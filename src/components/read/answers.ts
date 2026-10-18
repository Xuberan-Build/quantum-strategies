/**
 * Answer shapes and display rules for the Read questions.
 *
 * Answer shapes the UI sends (ReadAnswer, src/lib/read/types.ts):
 *   single            { choice: [value] }
 *   multi             { choice: [...values], text?: other/skill text }
 *                     options carrying a second tag prefix (Q11 `out:`) become a
 *                     follow-up group: parts[prefix] = picked value
 *   multi_then_pick   { choice: [...values], parts: { loudest: value }, text?: other text }
 *   text              { text }  (Q8: three lines, also in parts.line1..line3, text joined by "\n")
 *   scale             { number }
 *   week_mirror       { text: thing, number: hours lower bound,
 *                       parts: { thing, hours: 'hours:1_2', instead: 'instead:others' | null,
 *                                wantOrShould: 'want' | 'should' | 'unsure' } }
 */
import type { ReadAnswer, ReadAnswers, ReadQuestion, Segment } from '@/lib/read/types';
import { FLOW } from './copy';

type Option = NonNullable<ReadQuestion['options']>[number];

const SEGMENT_ALIASES: Record<string, Segment> = {
  operator: 'operator',
  side_builder: 'side_builder',
  multi: 'multi_stream',
  multi_stream: 'multi_stream',
  team_lead: 'team_lead',
  between: 'between_things',
  between_things: 'between_things',
};

const tagBody = (value: string) => (value.includes(':') ? value.slice(value.indexOf(':') + 1) : value);
export const tagPrefix = (value: string) => (value.includes(':') ? value.slice(0, value.indexOf(':')) : '');

/** Q1 decides the segment. "None of these" gives no segment. */
export function segmentFromAnswers(questions: ReadQuestion[], answers: ReadAnswers): Segment | undefined {
  const q1 = questions.find((q) => q.order === 1) ?? questions.find((q) => q.id === 'q1');
  const value = answers[q1?.id ?? 'q1']?.choice?.[0];
  if (!value) return undefined;
  return SEGMENT_ALIASES[tagBody(value)];
}

export function isQuestionVisible(q: ReadQuestion, segment?: Segment, variant?: string): boolean {
  const show = q.showFor;
  if (!show) return true;
  if (show.segments?.length && (!segment || !show.segments.includes(segment))) return false;
  if (show.variants?.length && (!variant || !show.variants.includes(variant))) return false;
  return true;
}

export function visibleOptions(q: ReadQuestion, segment?: Segment, variant?: string): Option[] {
  return (q.options ?? []).filter((o) => {
    if (o.segments?.length && (!segment || !o.segments.includes(segment))) return false;
    if (o.variants?.length && (!variant || !o.variants.includes(variant))) return false;
    return true;
  });
}

export function visibleQuestions(questions: ReadQuestion[], segment?: Segment, variant?: string): ReadQuestion[] {
  return [...questions].sort((a, b) => a.order - b.order).filter((q) => isQuestionVisible(q, segment, variant));
}

/** Options that open a short text box when picked (Q2 "Something else", Q6 "name the skill"). */
export const needsText = (value: string) => /:(other|skill)$/.test(value);

/** Options that mean "none of these" and close any follow-up group (Q11 "Nothing yet"). */
export const isNoneValue = (value: string) => /:none$/.test(value);

/**
 * Split options into the main group and follow-up groups by tag prefix.
 * The main group is the prefix of the first option.
 */
export function groupOptions(options: Option[]): { main: Option[]; followUps: { prefix: string; options: Option[] }[] } {
  if (!options.length) return { main: [], followUps: [] };
  const mainPrefix = tagPrefix(options[0].value);
  const main: Option[] = [];
  const rest = new Map<string, Option[]>();
  for (const o of options) {
    const p = tagPrefix(o.value);
    if (p === mainPrefix || !p) main.push(o);
    else rest.set(p, [...(rest.get(p) ?? []), o]);
  }
  return { main, followUps: [...rest.entries()].map(([prefix, opts]) => ({ prefix, options: opts })) };
}

/** Prompts for follow-up groups, keyed by tag prefix (spec v3 §5). */
export const FOLLOW_UP_PROMPTS: Record<string, string> = {
  out: 'What happened, mostly?',
};

/** Text questions that take several short lines (spec v3 Q8). */
export const MULTI_LINE_TEXT: Record<string, number> = { q8: 3 };

/** Q7 defaults, used when the question row doesn't carry its own options. */
export const WEEK_MIRROR_DEFAULTS = {
  thingPrompt: "Name one thing you keep telling yourself you'll get to.",
  hoursPrompt: 'Roughly how many hours did it get last week?',
  insteadPrompt: 'What got those hours instead?',
  ownPrompt: "If you're honest, is it something you want, or something you think you're supposed to want?",
  hours: [
    { value: 'hours:0', label: '0' },
    { value: 'hours:1_2', label: '1–2' },
    { value: 'hours:3_5', label: '3–5' },
    { value: 'hours:6_10', label: '6–10' },
    { value: 'hours:10_plus', label: 'More than 10' },
  ],
  instead: [
    { value: 'instead:work', label: 'Work for someone else' },
    { value: 'instead:others', label: "Other people's asks" },
    { value: 'instead:shoulds', label: 'Things I thought I should do' },
    { value: 'instead:projects', label: 'Other projects of mine' },
    { value: 'instead:scroll', label: 'Scrolling or switching off' },
    { value: 'instead:unsure', label: 'Not sure' },
  ],
  own: [
    { value: 'own:want', label: 'Want' },
    { value: 'own:should', label: 'Supposed to' },
    { value: 'own:unsure', label: 'Not sure' },
  ],
};

const HOURS_LOWER_BOUND: Record<string, number> = {
  '0': 0,
  '1_2': 1,
  '3_5': 3,
  '6_10': 6,
  '10_plus': 11,
};

export function hoursNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  return HOURS_LOWER_BOUND[tagBody(value)];
}

export function wantOrShouldFromTag(value: string | null | undefined): 'want' | 'should' | 'unsure' | null {
  if (!value) return null;
  const body = tagBody(value);
  return body === 'want' || body === 'should' || body === 'unsure' ? body : null;
}

export function weekMirrorOptions(q: ReadQuestion) {
  const opts = q.options ?? [];
  const byPrefix = (p: string) => opts.filter((o) => tagPrefix(o.value) === p);
  const pick = <T,>(own: T[], fallback: T[]) => (own.length ? own : fallback);
  return {
    hours: pick(byPrefix('hours'), WEEK_MIRROR_DEFAULTS.hours),
    instead: pick(byPrefix('instead'), WEEK_MIRROR_DEFAULTS.instead),
    own: pick(byPrefix('own'), WEEK_MIRROR_DEFAULTS.own),
  };
}

const hasText = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

/**
 * Returns the message to show when the answer can't be submitted yet, or null.
 * No minimum text lengths (spec v3 §4): any non-empty text passes.
 */
export function validateAnswer(q: ReadQuestion, a: ReadAnswer | undefined): string | null {
  if (!q.required) {
    if (q.kind === 'multi_then_pick' && (a?.choice?.length ?? 0) > 1 && !a?.parts?.loudest) return FLOW.pickLoudest;
    return null;
  }
  switch (q.kind) {
    case 'single':
    case 'multi':
      return a?.choice?.length ? null : FLOW.required;
    case 'multi_then_pick':
      if (!a?.choice?.length) return FLOW.required;
      if (a.choice.length > 1 && !a.parts?.loudest) return FLOW.pickLoudest;
      return null;
    case 'scale':
      return typeof a?.number === 'number' ? null : FLOW.required;
    case 'text':
      return hasText(a?.text) ? null : FLOW.requiredText;
    case 'week_mirror':
      if (!hasText(a?.parts?.thing)) return FLOW.requiredText;
      if (!a?.parts?.hours || !a?.parts?.wantOrShould) return FLOW.required;
      return null;
    default:
      return null;
  }
}

/** Before sending: drop empty fields, fill derived fields. */
export function normaliseAnswer(q: ReadQuestion, a: ReadAnswer): ReadAnswer {
  const out: ReadAnswer = { questionId: q.id };
  if (a.choice?.length) out.choice = a.choice;
  if (hasText(a.text)) out.text = a.text!.trim();
  if (typeof a.number === 'number') out.number = a.number;
  if (a.parts) {
    const parts = Object.fromEntries(
      Object.entries(a.parts).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    );
    if (q.kind === 'multi_then_pick' && out.choice?.length === 1) parts.loudest = out.choice[0];
    if (Object.keys(parts).length) out.parts = parts;
  } else if (q.kind === 'multi_then_pick' && out.choice?.length === 1) {
    out.parts = { loudest: out.choice[0] };
  }
  return out;
}

const labelFor = (q: ReadQuestion, value: string) =>
  [...(q.options ?? []), ...WEEK_MIRROR_DEFAULTS.hours, ...WEEK_MIRROR_DEFAULTS.instead, ...WEEK_MIRROR_DEFAULTS.own].find(
    (o) => o.value === value
  )?.label ?? tagBody(value).replace(/_/g, ' ');

/** The Q2 loudest pick as a quote, for "You said: ..." before the gate. */
export function loudestQuote(questions: ReadQuestion[], answers: ReadAnswers): string | null {
  const q = questions.find((x) => x.kind === 'multi_then_pick');
  if (!q) return null;
  const a = answers[q.id];
  const value = (a?.parts?.loudest as string | undefined) ?? (a?.choice?.length === 1 ? a.choice[0] : undefined);
  if (!value) return null;
  if (needsText(value)) return a?.text?.trim() || null;
  return labelFor(q, value).replace(/^["“]|["”]$/g, '');
}

/**
 * Plain lines for "Show me my answers anyway" on the support screen.
 * Spec v3 §6: the static gap table only, so by default just the week-mirror question.
 */
export function answerSummary(
  questions: ReadQuestion[],
  answers: ReadAnswers,
  kinds: ReadQuestion['kind'][] = ['week_mirror']
): { question: string; answer: string }[] {
  return visibleQuestions(questions)
    .filter((q) => answers[q.id] && kinds.includes(q.kind))
    .map((q) => {
      const a = answers[q.id];
      const bits: string[] = [];
      if (q.kind === 'week_mirror') {
        const p = a.parts ?? {};
        if (p.thing) bits.push(String(p.thing));
        if (p.hours) bits.push(`${labelFor(q, String(p.hours))} hours last week`);
        if (p.instead) bits.push(`Instead: ${labelFor(q, String(p.instead))}`);
        if (p.wantOrShould) bits.push(`You called it: ${labelFor(q, `own:${p.wantOrShould}`)}`);
      } else {
        for (const v of a.choice ?? []) if (!needsText(v)) bits.push(labelFor(q, v));
        if (a.text) bits.push(a.text);
        if (typeof a.number === 'number') bits.push(String(a.number));
        for (const [k, v] of Object.entries(a.parts ?? {})) {
          if (k.startsWith('line') || k === 'loudest' || typeof v !== 'string') continue;
          bits.push(labelFor(q, v));
        }
      }
      return { question: q.question, answer: bits.join(' · ') };
    })
    .filter((row) => row.answer);
}
