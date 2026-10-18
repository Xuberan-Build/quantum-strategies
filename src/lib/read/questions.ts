/**
 * The Perception Read: the twelve questions (spec v3 §5).
 *
 * Pure data plus a visibility helper. No DB, no AI. Option values are the scorer tags
 * from the spec (`say:stall`, `fav:yes_late`...), so the scorer reads answers directly.
 *
 * How answers are shaped (ReadAnswer in ./types):
 *   q1  single  choice: ['seg:operator']
 *   q2  multi_then_pick  choice: up to 3 'say:*' tags · parts.loudest: one of those tags ·
 *       text: the "Something else" text when 'say:other' is picked
 *   q3, q4, q5, q12  single  choice: [tag]
 *   q6  multi (max 2)  choice: 'come:*' tags · text: the named skill when 'come:skill' is picked
 *   q7  week_mirror  parts: { thing: string, hours: 'hours:*', instead: 'instead:*' | null, wantOrShould: 'own:*' }
 *   q8  text ×3  parts: { line1, line2, line3 } (or `text` with one line per row)
 *   q9  text  text
 *   q10 scale 1-10  number
 *   q11 multi  options carry both 'tried:*' and 'out:*' values. choice: 'tried:*' tags ·
 *       parts.out: one 'out:*' tag ("What happened, mostly?", skipped when 'tried:none').
 *       Readers also accept parts.outcome or an 'out:*' tag inside choice.
 *
 * Q7 also carries `text` = the thing and `number` = the lower bound of the hours band; Q8 also
 * carries `text` = the three lines joined by "\n". Readers prefer `parts`.
 *
 * Multi-part screens (q2 loudest, q6 skill, q7, q8) carry their sub-prompts in
 * `parts` (ReadQuestionDef below). That field is an additive extension of ReadQuestion that
 * lives here so types.ts stays as agreed; it's a candidate to fold into the contract.
 */
import type { ReadAnswers, ReadQuestion, Segment } from './types';

/** Landing variant for manifestation traffic (utm_content=method or utm variant 'manifestation'). */
export const MANIFESTATION_VARIANT = 'manifestation';

/** Q1 segments that see pricing wording (Q2 j, SMALLER pricing lines). Spec v3 §15 item 6. */
export const PRICING_SEGMENTS: Segment[] = ['operator', 'side_builder', 'multi_stream'];

/** Screen 0 (spec v3 §5). Doesn't mention Initiation (§15 item 9). */
export const READ_START_SCREEN = {
  title: 'The Perception Read',
  body: [
    "These questions are about what you did and said recently. Short answers are fine. At the end you'll see where last week went, the pattern your answers keep repeating, why some fixes don't stick for it, and one thing to try this week.",
    "It's a reflection tool. It doesn't diagnose anything, and it isn't therapy.",
  ],
  cta: 'Start',
} as const;

/** Landing sub-line (spec v3 §3.1). */
export const READ_LANDING_SUB =
  "Twelve questions about what you did and said this month. You'll see where last week actually went, the pattern your answers keep repeating, why the things you've tried didn't stick, and one thing to do this week. Free, about 5 minutes, no birth chart. It asks for your email so it can send you the full result.";

export interface ReadOption {
  value: string;
  label: string;
  segments?: Segment[];
  variants?: string[];
  /** Alternative label for a landing variant (naming rule N10). Same value, same tag. */
  variantLabels?: Record<string, string>;
}

/** A sub-prompt on a multi-part screen. */
export interface ReadQuestionPart {
  /** Key in ReadAnswer.parts ('thing', 'hours', 'loudest'...) or 'text' for ReadAnswer.text. */
  id: string;
  question: string;
  kind: 'text' | 'single';
  required: boolean;
  options?: ReadOption[];
  placeholder?: string;
  /** For 'loudest': choose among the options picked in the main question. */
  fromPicked?: boolean;
  /** Show this part only when the main choice includes one of these values. */
  showIfPicked?: string[];
  /** Skip this part when the main choice includes one of these values. */
  skipIfPicked?: string[];
}

export interface ReadQuestionDef extends ReadQuestion {
  options?: ReadOption[];
  parts?: ReadQuestionPart[];
}

// ── Option tables ────────────────────────────────────────────────────────────

export const SEGMENT_TAGS: Record<string, Segment | null> = {
  'seg:operator': 'operator',
  'seg:side_builder': 'side_builder',
  'seg:multi': 'multi_stream',
  'seg:team_lead': 'team_lead',
  'seg:between': 'between_things',
  'seg:other': null,
};

const Q2_OPTIONS: ReadOption[] = [
  { value: 'say:know_dont', label: '"I know what to do. I just don\'t do it."' },
  {
    value: 'say:stall',
    label: '"I start strong, then it stalls. I\'ll start fresh tomorrow."',
    variantLabels: { [MANIFESTATION_VARIANT]: '"It works for a bit, then I\'m back at step 1."' },
  },
  { value: 'say:no_guilt', label: '"I can\'t say no without feeling guilty."' },
  {
    value: 'say:empty',
    label: '"I\'m running on empty from looking after everyone."',
    variantLabels: { [MANIFESTATION_VARIANT]: '"I\'m pouring from an empty cup."' },
  },
  {
    value: 'say:not_enough',
    label: '"Whatever I do, it never feels like enough."',
    variantLabels: { [MANIFESTATION_VARIANT]: '"I keep affirming it, and nothing in my life backs it up."' },
  },
  { value: 'say:faking', label: '"When I\'m good at something, I feel like I\'m faking it."' },
  { value: 'say:behind', label: '"I\'m behind for my age."' },
  { value: 'say:many', label: '"I\'m interested in too many things to pick one."' },
  { value: 'say:hide', label: '"I hold back from posting or putting myself out there."' },
  {
    value: 'say:undercharge',
    label: '"I undercharge, or asking for money feels awkward."',
    segments: PRICING_SEGMENTS,
  },
  { value: 'say:shoulds', label: '"I\'m doing what I\'m supposed to, and it feels like someone else\'s life."' },
  {
    value: 'say:method',
    label: '"I\'ve tried every manifesting technique, and I keep ending up back at step 1."',
    variants: [MANIFESTATION_VARIANT],
  },
  { value: 'say:other', label: 'Something else' },
];

/** Q7 hours bands. `min` is what WeekMirror.hours stores; `label` is what the mirror prints. */
export const HOURS_BANDS: Record<string, { min: number; label: string }> = {
  'hours:0': { min: 0, label: '0 hours' },
  'hours:1_2': { min: 1, label: '1–2 hours' },
  'hours:3_5': { min: 3, label: '3–5 hours' },
  'hours:6_10': { min: 6, label: '6–10 hours' },
  'hours:10_plus': { min: 11, label: 'more than 10 hours' },
};

const Q7_HOURS_OPTIONS: ReadOption[] = [
  { value: 'hours:0', label: '0' },
  { value: 'hours:1_2', label: '1–2' },
  { value: 'hours:3_5', label: '3–5' },
  { value: 'hours:6_10', label: '6–10' },
  { value: 'hours:10_plus', label: 'More than 10' },
];

const Q7_INSTEAD_OPTIONS: ReadOption[] = [
  { value: 'instead:work', label: 'Work for someone else' },
  { value: 'instead:others', label: "Other people's asks" },
  { value: 'instead:shoulds', label: 'Things I thought I should do' },
  { value: 'instead:projects', label: 'Other projects of mine' },
  { value: 'instead:scroll', label: 'Scrolling or switching off' },
  { value: 'instead:unsure', label: 'Not sure' },
];

const Q7_OWN_OPTIONS: ReadOption[] = [
  { value: 'own:want', label: 'Want' },
  { value: 'own:should', label: 'Supposed to' },
  { value: 'own:unsure', label: 'Not sure' },
];

const Q11_OUTCOME_OPTIONS: ReadOption[] = [
  { value: 'out:slipped', label: 'It helped for a while, then I slipped back' },
  { value: 'out:understood', label: 'I understood more, and nothing changed' },
  { value: 'out:worse', label: 'It made me feel worse about myself' },
  { value: 'out:switched', label: 'Nothing stuck, so I kept switching' },
  { value: 'out:helps', label: 'It helps and I still use it' },
];

// ── The questions ────────────────────────────────────────────────────────────

export const READ_QUESTIONS: ReadQuestionDef[] = [
  {
    id: 'q1',
    order: 1,
    title: "Who's taking it",
    question: 'Which of these sounds most like your week right now?',
    kind: 'single',
    required: true,
    options: [
      { value: 'seg:operator', label: 'I run my own business full time' },
      { value: 'seg:side_builder', label: "I have a job and I'm building something on the side" },
      { value: 'seg:multi', label: 'I make money a few different ways' },
      { value: 'seg:team_lead', label: "I lead a team inside someone else's company" },
      { value: 'seg:between', label: "I'm between things right now" },
      { value: 'seg:other', label: 'None of these' },
    ],
  },
  {
    id: 'q2',
    order: 2,
    title: "What you've been saying",
    question: 'Which of these have you said, or thought, in the last month? Pick up to three.',
    kind: 'multi_then_pick',
    required: true,
    maxPicks: 3,
    options: Q2_OPTIONS,
    parts: [
      { id: 'text', question: 'Something else:', kind: 'text', required: false, placeholder: 'In your words', showIfPicked: ['say:other'] },
      { id: 'loudest', question: 'Which one is loudest?', kind: 'single', required: true, fromPicked: true },
    ],
  },
  {
    id: 'q3',
    order: 3,
    title: 'The favour',
    question: "Someone asks you for a favour on a day that's already full. What usually happens?",
    kind: 'single',
    required: true,
    options: [
      { value: 'fav:yes_late', label: 'I say yes, and do it late at night' },
      { value: 'fav:yes_resent', label: "I say yes, and I'm annoyed about it later" },
      { value: 'fav:no_guilt', label: 'I say no, and then feel guilty' },
      { value: 'fav:avoid', label: 'I say "maybe" and hope it goes away' },
      { value: 'fav:no_clean', label: "I say no and don't think about it again" },
    ],
  },
  {
    id: 'q4',
    order: 4,
    title: 'When something stalls',
    question: 'Think of the last thing you planned that stalled. What was going on, honestly?',
    kind: 'single',
    required: true,
    options: [
      { value: 'stall:verdict', label: '"If it\'s not going to be good, I\'d rather not start."' },
      { value: 'stall:novelty', label: '"I lost interest once it wasn\'t new anymore."' },
      { value: 'stall:should', label: '"It was something I was supposed to want."' },
      { value: 'stall:others', label: '"Other people\'s stuff took the time first."' },
      { value: 'stall:seen', label: '"The part where people would see it is the part I avoided."' },
      { value: 'stall:switch', label: '"I kept switching to a new method before the last one had a chance."' },
      { value: 'stall:none', label: '"Nothing much stalls for me."' },
    ],
  },
  {
    id: 'q5',
    order: 5,
    title: 'How you describe your work',
    question: 'The last time someone new asked what you do, what did you say? Pick the closest.',
    kind: 'single',
    required: true,
    options: [
      { value: 'desc:just', label: '"I just help people with…"' },
      { value: 'desc:list', label: 'I listed three or four different things' },
      { value: 'desc:result', label: 'I named the result people get from working with me' },
      { value: 'desc:deflect', label: 'I changed the subject, or played it down' },
      { value: 'desc:joke', label: 'I made a joke about myself' },
      { value: 'desc:none', label: "It hasn't come up" },
    ],
  },
  {
    id: 'q6',
    order: 6,
    title: 'What people come to you for',
    question: 'What do people keep coming to you for? Pick up to two.',
    kind: 'multi',
    required: true,
    maxPicks: 2,
    options: [
      { value: 'come:fix', label: 'Fixing a problem' },
      { value: 'come:ideas', label: 'Ideas' },
      { value: 'come:support', label: 'A listening ear' },
      { value: 'come:execute', label: 'Getting something done' },
      { value: 'come:strategy', label: 'Advice on what to do next' },
      { value: 'come:connect', label: 'An introduction to someone' },
      { value: 'come:skill', label: 'A specific skill of mine' },
    ],
    parts: [
      { id: 'text', question: 'Name it:', kind: 'text', required: false, placeholder: 'The skill', showIfPicked: ['come:skill'] },
    ],
  },
  {
    id: 'q7',
    order: 7,
    title: 'The thing you keep meaning to get to',
    question: "Name one thing you keep telling yourself you'll get to.",
    kind: 'week_mirror',
    required: true,
    parts: [
      { id: 'thing', question: "Name one thing you keep telling yourself you'll get to.", kind: 'text', required: true, placeholder: 'One thing' },
      { id: 'hours', question: 'Roughly how many hours did it get last week?', kind: 'single', required: true, options: Q7_HOURS_OPTIONS },
      { id: 'instead', question: 'What got those hours instead?', kind: 'single', required: false, options: Q7_INSTEAD_OPTIONS },
      {
        id: 'wantOrShould',
        question: "If you're honest, is it something you want, or something you think you're supposed to want?",
        kind: 'single',
        required: true,
        options: Q7_OWN_OPTIONS,
      },
    ],
  },
  {
    id: 'q8',
    order: 8,
    title: 'Your words, part one',
    // Founder decision 2026-10-18 (safety option 3): framed on work, plans and what you did, so the
    // open answers stay on behaviour this month. The safety screen stays as the backstop.
    question: 'Think about your work and your plans this month. Finish this three times, quickly: "I\'m the one who…"',
    helper: 'Short is fine. For example: "…stays late to finish other people\'s bits".',
    kind: 'text',
    required: true,
    parts: [
      { id: 'line1', question: "I'm the one who…", kind: 'text', required: true },
      { id: 'line2', question: "I'm the one who…", kind: 'text', required: false },
      { id: 'line3', question: "I'm the one who…", kind: 'text', required: false },
    ],
  },
  {
    id: 'q9',
    order: 9,
    title: 'Your words, part two',
    question: "What's one thing you said about your work or your plans this week, out loud or in your head?",
    kind: 'text',
    required: true,
    placeholder: "One sentence, e.g. I'll get to it after the launch",
  },
  {
    id: 'q10',
    order: 10,
    title: 'Last week',
    question: "How much of last week went the way you'd have chosen?",
    kind: 'scale',
    required: true,
    scale: { min: 1, max: 10, minLabel: 'Almost none of it', midLabel: 'About half', maxLabel: 'All of it' },
  },
  {
    id: 'q11',
    order: 11,
    title: "What you've tried",
    question: 'What have you already tried for this? Pick any.',
    kind: 'multi',
    required: true,
    options: [
      { value: 'tried:content', label: 'Books, podcasts or YouTube' },
      { value: 'tried:affirm', label: 'Affirmations or "I am" statements' },
      { value: 'tried:visualise', label: 'Visualising, scripting or living in the end' },
      { value: 'tried:subliminal', label: 'Subliminals or sleep tapes' },
      { value: 'tried:manifest_other', label: 'Vision boards or other manifesting' },
      { value: 'tried:systems', label: 'Habit apps, routines or planners' },
      { value: 'tried:willpower', label: 'Just pushing harder' },
      { value: 'tried:therapy', label: 'Therapy' },
      { value: 'tried:coach', label: 'A coach or a course' },
      { value: 'tried:journal', label: 'Journaling' },
      { value: 'tried:meditation', label: 'Meditation' },
      { value: 'tried:chart', label: 'Astrology or Human Design' },
      { value: 'tried:none', label: 'Nothing yet' },
      // The `out:` group renders as "What happened, mostly?" (one tap, saved in parts.out), closed by "Nothing yet".
      ...Q11_OUTCOME_OPTIONS,
    ],
    helper: 'What happened, mostly?',
  },
  {
    id: 'q12',
    order: 12,
    title: "What you've spent",
    question: 'Roughly what have you spent on fixing this in the last year? Books, courses, coaching, apps, all of it.',
    kind: 'single',
    required: false,
    options: [
      { value: 'spent:0', label: '$0' },
      { value: 'spent:under_50', label: 'Under $50' },
      { value: 'spent:50_500', label: '$50–$500' },
      { value: 'spent:500_2000', label: '$500–$2,000' },
      { value: 'spent:2000_plus', label: 'More than $2,000' },
      { value: 'spent:no_say', label: "I'd rather not say" },
    ],
  },
];

// ── Visibility ───────────────────────────────────────────────────────────────

function optionVisible(o: ReadOption, segment?: Segment | null, variant?: string | null): boolean {
  if (o.segments && (!segment || !o.segments.includes(segment))) return false;
  if (o.variants && (!variant || !o.variants.includes(variant))) return false;
  return true;
}

function resolveOptions(options: ReadOption[] | undefined, segment?: Segment | null, variant?: string | null) {
  if (!options) return undefined;
  return options
    .filter((o) => optionVisible(o, segment, variant))
    .map(({ variantLabels, ...o }) => ({ ...o, label: (variant && variantLabels?.[variant]) || o.label }));
}

/**
 * The questions as a given visitor sees them: options filtered by segment and landing
 * variant, and variant wordings applied (same values, so scoring is unchanged).
 * Unknown or missing segment hides segment-only options (Q2 j). Unknown variant shows defaults.
 */
export function visibleQuestions(segment?: Segment | null, variant?: string | null): ReadQuestionDef[] {
  return READ_QUESTIONS.filter((q) => {
    const s = q.showFor?.segments;
    const v = q.showFor?.variants;
    if (s && (!segment || !s.includes(segment))) return false;
    if (v && (!variant || !v.includes(variant))) return false;
    return true;
  }).map((q) => ({
    ...q,
    options: resolveOptions(q.options, segment, variant),
    parts: q.parts?.map((p) => ({ ...p, options: resolveOptions(p.options, segment, variant) })),
  }));
}

// ── Answer readers (shared by score, mirror, results, paragraph) ────────────

export function choiceOf(answers: ReadAnswers, qid: string): string[] {
  return answers[qid]?.choice ?? [];
}

export function firstChoice(answers: ReadAnswers, qid: string): string | null {
  return choiceOf(answers, qid)[0] ?? null;
}

export function partString(answers: ReadAnswers, qid: string, part: string): string | null {
  const v = answers[qid]?.parts?.[part];
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return v.find((x) => typeof x === 'string' && x.trim()) ?? null;
  return null;
}

export function segmentFromAnswers(answers: ReadAnswers): Segment | null {
  const tag = firstChoice(answers, 'q1');
  return tag ? SEGMENT_TAGS[tag] ?? null : null;
}

/** Q2 loudest pick: parts.loudest, or the only pick when one was made. */
export function loudestTag(answers: ReadAnswers): string | null {
  const explicit = partString(answers, 'q2', 'loudest');
  const picks = choiceOf(answers, 'q2');
  if (explicit) return explicit;
  return picks.length === 1 ? picks[0] : null;
}

/** Q8's three lines (parts line1..3, or `text` split by line). Empty lines dropped. */
export function q8Lines(answers: ReadAnswers): string[] {
  const a = answers.q8;
  if (!a) return [];
  const fromParts = ['line1', 'line2', 'line3'].map((k) => partString(answers, 'q8', k)).filter((x): x is string => !!x);
  if (fromParts.length) return fromParts;
  return (a.text ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/** Label for an option value, searching every question and part. */
export function optionLabel(value: string, variant?: string | null): string | null {
  for (const q of READ_QUESTIONS) {
    for (const o of [...(q.options ?? []), ...(q.parts ?? []).flatMap((p) => p.options ?? [])]) {
      if (o.value === value) return (variant && o.variantLabels?.[variant]) || o.label;
    }
  }
  return null;
}

/** Q11 tried picks ('tried:*' only). */
export function triedTags(answers: ReadAnswers): string[] {
  return choiceOf(answers, 'q11').filter((t) => t.startsWith('tried:'));
}

/** Q11 outcome: parts.out (UI), parts.outcome (alias) or an 'out:*' tag in choice. */
export function q11Outcome(answers: ReadAnswers): string | null {
  const raw = partString(answers, 'q11', 'out') ?? partString(answers, 'q11', 'outcome') ?? choiceOf(answers, 'q11').find((t) => t.startsWith('out:')) ?? null;
  if (!raw) return null;
  return raw.startsWith('out:') ? raw : `out:${raw}`;
}
