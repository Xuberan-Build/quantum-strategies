/** Test data for the Read UI (spec v3 §5 shapes). Test-only. */
import type { ReadPreview, ReadQuestion, ReadResult, Segment } from '@/lib/read/types';

export const QUESTIONS: ReadQuestion[] = [
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
      { value: 'seg:team_lead', label: "I lead a team inside someone else's company" },
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
    options: [
      { value: 'say:know_dont', label: '"I know what to do. I just don\'t do it."' },
      { value: 'say:no_guilt', label: '"I can\'t say no without feeling guilty."' },
      {
        value: 'say:undercharge',
        label: '"I undercharge, or asking for money feels awkward."',
        segments: ['operator', 'side_builder', 'multi_stream'],
      },
      { value: 'say:shoulds', label: '"I\'m doing what I\'m supposed to, and it feels like someone else\'s life."' },
      { value: 'say:other', label: 'Something else' },
    ],
  },
  {
    id: 'q7',
    order: 7,
    title: 'Your week',
    question: "Name one thing you keep telling yourself you'll get to.",
    kind: 'week_mirror',
    required: true,
  },
  {
    id: 'q9',
    order: 9,
    title: 'Your words',
    question: "What's one sentence you say about yourself most weeks, out loud or in your head?",
    kind: 'text',
    required: true,
  },
  {
    id: 'q10',
    order: 10,
    title: 'Baseline',
    question: "How much of last week went the way you'd have chosen?",
    kind: 'scale',
    required: true,
    scale: { min: 1, max: 10, minLabel: 'almost none of it', midLabel: 'about half', maxLabel: 'all of it' },
  },
  {
    id: 'q12',
    order: 12,
    title: "What you've spent",
    question: 'Roughly what have you spent on fixing this in the last year?',
    kind: 'single',
    required: false,
    options: [
      { value: 'spend:0', label: '$0' },
      { value: 'spend:under_50', label: 'under $50' },
    ],
  },
];

/** What the server would return for a segment: questions with hidden options removed. */
export function questionsFor(segment?: Segment): ReadQuestion[] {
  return QUESTIONS.map((q) => ({
    ...q,
    options: q.options?.filter((o) => !o.segments || (segment && o.segments.includes(segment))),
  }));
}

export const PREVIEW: ReadPreview = {
  sessionId: 'sess-1',
  safety: { tier: 'none', matchedLists: [] },
  mirror: {
    thing: 'writing again',
    hours: 0,
    instead: 'instead:shoulds',
    wantOrShould: 'should',
    showsGap: true,
    line:
      'You keep meaning to get to "writing again".\nLast week it got 0 hours. Things you thought you should do got most of the rest.\nYou called it something you think you\'re supposed to want.',
  },
  pattern: {
    id: 'SHOULDS',
    name: 'Running on shoulds',
    read: 'Most of your week goes to what you think you should do, and the thing you want gets what\'s left.',
  },
};

export const RESULT_FIXTURE: ReadResult = {
  sessionId: 'sess-1',
  pattern: 'SHOULDS',
  patternName: 'Running on shoulds',
  usedFallback: false,
  offer: { productSlug: 'perception-rite-bundle', priceUsd: 12, scanSlug: 'perception-rite-scan-2', scanName: 'the Value Pattern Decoder' },
  blocks: [
    { id: 'mirror', title: 'Your week', body: PREVIEW.mirror!.line },
    { id: 'pattern', title: 'Running on shoulds', body: PREVIEW.pattern!.read },
    { id: 'their_words', title: 'In your words', body: 'You wrote "writing again" and "I never finish anything".' },
    { id: 'not_alone', title: "You're not the only one", body: 'This pattern came up in about 1 in 5.' },
    { id: 'why_it_didnt_stick', title: "Why what you tried didn't stick", body: 'Apps and routines speed up a plan.' },
    {
      id: 'whats_going_on',
      title: "What's going on",
      body: 'When a plan comes from what you value, you keep at it.',
      source: { label: 'Sheldon & Elliot, 1999', tier: 'E1' },
    },
    { id: 'fix_fits', title: 'What kind of fix fits', body: 'Sort the wants from the shoulds.' },
    { id: 'permission', body: 'This pattern was learned, so it can be re-tuned. Nothing here is a flaw in you.' },
    { id: 'move', title: 'One move this week', body: 'Take "writing again". On paper, finish this line.' },
    { id: 'offer', title: 'The scan that does this', body: 'The Value Pattern Decoder compares what you say matters with where your week went.' },
    { id: 'accuracy', title: 'Did this land?', body: 'Be honest. A low score helps more than a polite one.' },
    { id: 'scope', body: "It's a reflection tool. It doesn't diagnose anything, and it isn't therapy." },
  ],
};

