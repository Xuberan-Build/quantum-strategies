// STUB: replaced on merge. The real file (scoring/content agent) holds the twelve questions from
// spec v3 §5 and answer readers. This stub only keeps the exported signatures from CONTRACT.md so the
// API routes compile and their tests run. Shapes match the real file (ReadQuestionDef with `parts`).
import type { ReadQuestion, Segment } from './types';

export interface ReadOption {
  value: string;
  label: string;
  segments?: Segment[];
  variants?: string[];
}

export interface ReadQuestionPart {
  id: string;
  question: string;
  kind: 'text' | 'single';
  required: boolean;
  options?: ReadOption[];
  placeholder?: string;
  fromPicked?: boolean;
  showIfPicked?: string[];
  skipIfPicked?: string[];
}

export interface ReadQuestionDef extends ReadQuestion {
  options?: ReadOption[];
  parts?: ReadQuestionPart[];
}

export const READ_QUESTIONS: ReadQuestionDef[] = [
  {
    id: 'q1',
    order: 1,
    title: 'Who is taking it',
    question: 'Which of these sounds most like your week right now?',
    kind: 'single',
    required: true,
    options: [
      { value: 'seg:operator', label: 'I run my own business full time' },
      { value: 'seg:side_builder', label: "I have a job and I'm building something on the side" },
      { value: 'seg:other', label: 'None of these' },
    ],
  },
  {
    id: 'q2',
    order: 2,
    title: 'What you have been saying',
    question: 'Which of these have you said, or thought, in the last month? Pick up to three.',
    kind: 'multi_then_pick',
    required: true,
    maxPicks: 3,
    options: [
      { value: 'say:stall', label: 'I start strong, then it stalls.' },
      { value: 'say:shoulds', label: "I'm doing what I'm supposed to, and it feels like someone else's life." },
      { value: 'say:undercharge', label: 'I undercharge.', segments: ['operator', 'side_builder', 'multi_stream'] },
      { value: 'say:other', label: 'Something else' },
    ],
    parts: [
      { id: 'text', question: 'Something else:', kind: 'text', required: false, showIfPicked: ['say:other'] },
      { id: 'loudest', question: 'Which one is loudest?', kind: 'single', required: true, fromPicked: true },
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
      { id: 'thing', question: 'One thing', kind: 'text', required: true },
      {
        id: 'hours',
        question: 'Hours last week',
        kind: 'single',
        required: true,
        options: [
          { value: 'hours:0', label: '0' },
          { value: 'hours:1_2', label: '1–2' },
          { value: 'hours:10_plus', label: 'More than 10' },
        ],
      },
      {
        id: 'instead',
        question: 'What got those hours instead?',
        kind: 'single',
        required: false,
        options: [
          { value: 'instead:others', label: "Other people's asks" },
          { value: 'instead:shoulds', label: 'Things I thought I should do' },
        ],
      },
      {
        id: 'wantOrShould',
        question: 'Want or supposed to?',
        kind: 'single',
        required: true,
        options: [
          { value: 'own:want', label: 'Want' },
          { value: 'own:should', label: 'Supposed to' },
          { value: 'own:unsure', label: 'Not sure' },
        ],
      },
    ],
  },
  {
    id: 'q8',
    order: 8,
    title: 'Your words, part one',
    question: 'Finish this three times, quickly.',
    kind: 'text',
    required: true,
    parts: [
      { id: 'line1', question: "I'm the kind of person who…", kind: 'text', required: true },
      { id: 'line2', question: "I'm the kind of person who…", kind: 'text', required: false },
      { id: 'line3', question: "I'm the kind of person who…", kind: 'text', required: false },
    ],
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
    id: 'q12',
    order: 12,
    title: "What you've spent",
    question: 'Roughly what have you spent on fixing this in the last year?',
    kind: 'single',
    required: false,
    options: [
      { value: 'spent:0', label: '$0' },
      { value: 'spent:no_say', label: "I'd rather not say" },
    ],
  },
];

export function visibleQuestions(segment?: Segment | null, variant?: string | null): ReadQuestionDef[] {
  const ok = (o: ReadOption) =>
    (!o.segments || (!!segment && o.segments.includes(segment))) &&
    (!o.variants || (!!variant && o.variants.includes(variant)));
  return READ_QUESTIONS.filter((q) => {
    const s = q.showFor?.segments;
    const v = q.showFor?.variants;
    if (s && (!segment || !s.includes(segment))) return false;
    if (v && (!variant || !v.includes(variant))) return false;
    return true;
  }).map((q) => ({ ...q, options: q.options?.filter(ok) }));
}
