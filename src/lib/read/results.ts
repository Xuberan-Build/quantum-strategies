/**
 * The Perception Read: result content and assembly (spec v3 §7.1, §8, §9).
 *
 * Everything here is static and human-reviewed except the mirror paragraph, which comes from
 * paragraph.ts (server-only, loaded lazily so this module stays importable by the UI).
 * Receipts carry their claim ID and tier from strategy/thesis-evidence-map.md. Anything that
 * map marks VERIFY is marked `verify: true` here, so the UI can hide unverified receipts until
 * the verification queue (map §6) clears them.
 *
 * Copy rules: no "quantum", no chart, no score or percentage, no type, no condition named
 * about the reader, no em-dashes, one CTA (spec v3 §8.12).
 */
import { MANIFESTATION_VARIANT, PRICING_SEGMENTS, choiceOf, q11Outcome, triedTags, loudestTag, optionLabel, partString, segmentFromAnswers, HOURS_BANDS } from './questions';
import { q7HoursTag, wantOrShouldOf } from './mirror';
import { secondaryPattern } from './score';
import { isUsableText, screenText, tierAtLeast } from './safety';
import type {
  PatternId,
  PatternScores,
  ReadAnswers,
  ReadPreview,
  ReadResult,
  ReadUtm,
  ResultBlock,
  SafetyResult,
  Segment,
  WeekMirror,
} from './types';

export const READ_OFFER_PRODUCT_SLUG = 'perception-rite-bundle' as const;
export const READ_OFFER_PRICE_USD = 12 as const;

// ── Evidence ────────────────────────────────────────────────────────────────

export interface Receipt {
  /** Short citation as shown under a block. */
  label: string;
  /** Claim ID in thesis-evidence-map.md (P3, O6...). */
  claim: string;
  /** Evidence tier: E1 established · E2 supported, limited · E3 contested · M model · L lineage. */
  tier: string;
  /** True while the evidence map still marks the source VERIFY. */
  verify: boolean;
}

/** One entry per source the result cites. ✓ in the evidence map → verify false. */
export const RECEIPTS = {
  sheldonElliot: { label: 'Sheldon & Elliot, 1999 (self-concordant goals)', claim: 'P3/O2', tier: 'E1', verify: true },
  sheeran: { label: 'Sheeran, 2002 (intention-behaviour gap)', claim: 'P3', tier: 'E1', verify: true },
  swann: { label: 'Swann, self-verification research (1983 on)', claim: 'P1', tier: 'E1', verify: true },
  maltz: { label: 'Maltz, Psycho-Cybernetics, 1960', claim: 'P1', tier: 'M', verify: true },
  bem: { label: 'Bem, 1972 (self-perception)', claim: 'P1', tier: 'E1', verify: true },
  sonnentagFritz: { label: 'Sonnentag & Fritz, 2007 (recovery and detachment)', claim: 'P6', tier: 'E1', verify: true },
  ericsson: { label: 'Ericsson, Krampe & Tesch-Römer, 1993 (deliberate practice)', claim: 'P8', tier: 'E1', verify: true },
  macnamara: { label: 'Macnamara, Hambrick & Oswald, 2014', claim: 'P8', tier: 'E1', verify: true },
  sherWapnick: { label: 'Barbara Sher, Refuse to Choose · Emilie Wapnick, multipotentialite', claim: 'P8 lineage', tier: 'L', verify: false },
  hatzigeorgiadis: { label: 'Hatzigeorgiadis et al., 2011 (self-talk in sport)', claim: 'P4', tier: 'E1, within sport', verify: true },
  raoMonroe: { label: 'Rao & Monroe, 1989 (price as a quality cue)', claim: 'P7', tier: 'E2, narrow', verify: true },
  wood: { label: 'Wood, Perunovic & Lee, 2009 (affirmations)', claim: 'O6', tier: 'E2', verify: false },
  lally: { label: 'Lally et al., 2010 (habit formation)', claim: 'D4', tier: 'E2 + M', verify: false },
  egoDepletion: { label: 'Hagger et al., 2016 · Vohs et al., 2021 (ego depletion replications)', claim: 'M3', tier: 'E3', verify: false },
} satisfies Record<string, Receipt>;

/** Block 11 default (spec v3 §15 item 10): sources only, no claim about Austin's training. */
export const LINEAGE: Receipt[] = [RECEIPTS.maltz, RECEIPTS.bem, RECEIPTS.swann, RECEIPTS.sheldonElliot];

function sourceOf(r: Receipt): ResultBlock['source'] {
  return { label: r.label, tier: r.tier };
}

// ── Static copy shared by every pattern ─────────────────────────────────────

export const PERMISSION_LINE = 'This pattern was learned, so it can be re-tuned. Nothing here is a flaw in you.';
export const MOVE_CLOSE = "Don't add anything else this week. No new app, book or video. Just this.";
/** §15 item 4: on utm_source=youtube the line doesn't tell Austin's viewers to skip his videos. */
export const MOVE_CLOSE_YOUTUBE = "Don't add anything else this week. No new app, book or course. Just this.";
/** §8.8 [v3]: framing for people who've tried manifesting methods. */
export const MOVE_FRAMING_METHOD = "It gives the self-concept you're assuming something real to stand on.";
export const MOVE_FRAMING_METHOD_NIGHTLY = "It takes two minutes a night. It gives the self-concept you're assuming something real to stand on.";
export const MOVE_BUTTON = "I'll try this";
export const PREVIEW_TAIL = "Your full Read shows why the fixes you've tried didn't stick, what's going on underneath, and one thing to do this week.";

export const ACCURACY = {
  question: 'How well did this describe you?',
  scale: { min: 1, max: 5, minLabel: 'Not me at all', maxLabel: 'Uncomfortably accurate' },
  followUp: 'Which part was most accurate, or least?',
  honesty: "A five-minute Read can't see everything. If this didn't sound like you, tell us. That's useful too.",
};

export const SOLUTION_CHECK = {
  question: 'Before today, had you heard this explanation?',
  options: [
    { value: 'agree', label: 'Yes, and I agree' },
    { value: 'makes_sense', label: 'No, and it makes sense' },
    { value: 'dont_buy', label: "No, and I don't buy it" },
    { value: 'not_sure', label: 'Not sure' },
  ],
};

export const DECLINE_CAPTURE = {
  question: 'Not now? What would make it a yes?',
  options: [
    { value: 'price', label: 'Too expensive' },
    { value: 'timing', label: 'Not the right time' },
    { value: 'unsure_help', label: 'Not sure it would help me' },
    { value: 'move_first', label: 'I want to finish the move first' },
    { value: 'other', label: 'Something else' },
  ],
};

export const DELIVERY_NOTE = "We've emailed you this Read so you can come back to it. Start the move today. We'll check in on day 7.";

/** §8.10 + v1 §6.9 shared bridge. */
export const OFFER_BRIDGE =
  'Rite I is all five Perception scans, starting with the one your Read points to. The others cover your words, your values, your off switch, your money talk and your strengths. Each scan ends with one move. About 75 to 100 minutes in total, across as many sittings as you like, for $12.';

export const NOT_ALONE_TITLE = "You're not the only one";
export function notAloneLine(share: string): string {
  return `We read 621 public comments and posts from people describing problems like this. This pattern came up in about ${share}. That's a sample we chose, so it isn't a survey, but you're in a lot of company.`;
}

// ── Safety copy ─────────────────────────────────────────────────────────────

/** Date every crisis line below was checked on the line's own site. Re-check before launch and quarterly. */
export const VERIFIED_ON = '2026-10-18';

export interface CrisisLine {
  region: string;
  /** The sentence shown on the support screen. */
  line: string;
  /** Where it was checked. */
  source: string;
  verified: boolean;
}

/**
 * Crisis lines, each checked on its official site on VERIFIED_ON (founder decision 2026-10-18).
 * Copy follows 988 / Action Alliance guidance: always give a referral number, plain words,
 * no method detail, a clear next step (brain/content/safety-screen.md).
 */
export const CRISIS_LINES: Record<string, CrisisLine> = {
  us: {
    region: 'US',
    line: 'In the US, call or text 988, or chat at chat.988lifeline.org. You can also text HOME to 741741.',
    source: 'https://988lifeline.org/ · https://www.crisistextline.org/',
    verified: true,
  },
  ukIe: {
    region: 'UK and Ireland',
    line: "In the UK and Ireland, call Samaritans on 116 123. It's free, any time.",
    source: 'https://www.samaritans.org/how-we-can-help/contact-samaritan/',
    verified: true,
  },
  ca: { region: 'Canada', line: 'In Canada, call or text 9-8-8.', source: 'https://988.ca/', verified: true },
  au: { region: 'Australia', line: 'In Australia, call Lifeline on 13 11 14.', source: 'https://www.lifeline.org.au/', verified: true },
  intl: {
    region: 'Anywhere else',
    line: 'Anywhere else, findahelpline.com lists free helplines in your country.',
    source: 'https://findahelpline.com/',
    verified: true,
  },
};

export const SUPPORT_INTRO =
  "Some of what you wrote sounds really hard. Thank you for being honest in your answers. This Read isn't the right tool for this moment, and you don't have to sort this out on your own. If you're thinking about ending your life or hurting yourself, please talk to someone now. These lines are free and confidential, and the people there will listen without judging you.";
export const SUPPORT_CLOSE =
  "If you're in danger right now, call your local emergency number. Feeling like this can change, and reaching out to a person is a good first step.";

/** The support copy with one {{lines}} slot (for the email/UI agents). */
export const SUPPORT_TEMPLATE = `${SUPPORT_INTRO}\n\n{{lines}}\n\n${SUPPORT_CLOSE}`;

export function supportBody(): string {
  return SUPPORT_TEMPLATE.replace('{{lines}}', Object.values(CRISIS_LINES).map((l) => l.line).join('\n'));
}

export const SHOW_ANSWERS_ANYWAY = 'Show me my answers anyway';

/** Tier-2 scope lines, by matched list (problem-solution-map §4). Shown above the mirror paragraph. */
export const CLINICAL_SCOPE_LINES: Record<string, string> = {
  'clinical:depression':
    "This Read is a reflection tool. It can't assess or treat depression. If you've felt low or flat most days for two weeks or more, talk to a doctor or a therapist.",
  'clinical:trauma':
    'Where a pattern started can matter a lot. A trauma-informed therapist is the right person for that part. This Read looks at what keeps the pattern going now.',
  'clinical:adhd': "This Read doesn't diagnose anything. If you think ADHD is part of the picture, a clinician can assess it.",
  'clinical:other':
    "This Read is a reflection tool. It doesn't diagnose anything, and it isn't therapy. If something you mentioned is weighing on you, a doctor or a therapist is the right person to talk to.",
};

/** Tier-3 line, above the move (spec v3 §6). */
export const HARDSHIP_LINE = "Some of what you described is a real limit, like money or work. That isn't a mindset problem, and the move below works around it.";
export const HARDSHIP_LINE_LOSS = "Some of what you described is a real loss. That isn't a mindset problem, and the move below is small on purpose so it can sit next to it.";

// ── Why what you tried didn't stick (§8.4) ──────────────────────────────────

export interface TriedLine {
  body: string;
  claim: string;
  tier: string;
  receipt?: Receipt;
  /** True while the line leans on a VERIFY source or an un-spot-checked audience quote. */
  verify: boolean;
}

/** Highest first: the line shown is the first one the person picked in this order. */
export const TRIED_ORDER = [
  'tried:affirm',
  'tried:visualise',
  'tried:subliminal',
  'tried:manifest_other',
  'tried:willpower',
  'tried:systems',
  'tried:content',
  'tried:coach',
  'tried:journal',
  'tried:chart',
  'tried:therapy',
  'tried:meditation',
];

export const TRIED_LINES: Record<string, TriedLine> = {
  'tried:content': {
    body: 'You\'ve read and watched a lot about this, and so have most of the people we read. One of the most-liked comments we found says it: "Reading self-help books can be in itself a form of procrastination." Knowing more changes what you know. The picture you act from changes when you do something and see yourself do it. So this Read ends with one thing to do and nothing to watch.',
    claim: 'P1 qualifier',
    tier: 'E1',
    receipt: RECEIPTS.bem,
    verify: true,
  },
  'tried:affirm': {
    body: 'If repeating it felt like lying to yourself, there\'s a reason. In one study, people with low self-esteem who repeated "I\'m a lovable person" felt worse afterwards (Wood et al., 2009). And you didn\'t cause your problems by thinking the wrong thoughts.',
    claim: 'O6 · X12, X15',
    tier: 'E2',
    receipt: RECEIPTS.wood,
    verify: false,
  },
  'tried:systems': {
    body: 'Apps and routines speed up a plan. They don\'t change the picture the plan runs on, and the picture usually wins by week three. People put it plainly: "after 2 days I failed".',
    claim: 'D4',
    tier: 'E2 + M',
    verify: true, // audience quote to spot-check
  },
  'tried:willpower': {
    body: 'Pushing harder turns every slip into a verdict on you: "you just don\'t work hard enough. Eventually you start to question your worth" (3,000 likes). The research behind "willpower runs out" mostly didn\'t replicate, and effort was never the missing piece.',
    claim: 'M3',
    tier: 'E3, told as history',
    receipt: RECEIPTS.egoDepletion,
    verify: false,
  },
  'tried:therapy': {
    body: 'If therapy is helping, keep going. Some people leave sessions with understanding and no next step: "simply discussing and rehashing my concerns was just me spinning my wheels." This Read adds one small thing to try this week, alongside it.',
    claim: 'Scope line · X3',
    tier: 'none claimed',
    verify: false,
  },
  'tried:coach': {
    body: "A coach or a course usually gives you a sound plan. When it doesn't hold, it's often because the plan ran on top of an old picture of you that nobody looked at.",
    claim: 'P1',
    tier: 'M + E1',
    receipt: RECEIPTS.swann,
    verify: true,
  },
  'tried:journal': {
    body: 'Writing helps you notice. If it turned into a list of what\'s wrong with you ("from a place of criticism which produces guilt"), switch to facts only: what you did, and when.',
    claim: 'O6 adjacent',
    tier: 'E2',
    verify: false,
  },
  'tried:chart': {
    body: "A chart can give you words for yourself. It doesn't tell you what to do on Tuesday. This Read doesn't use one.",
    claim: 'X2',
    tier: 'none claimed',
    verify: false,
  },
  'tried:meditation': {
    body: 'Meditation can help you catch the pattern as it happens. The move below gives you something to do when you catch it.',
    claim: 'none',
    tier: 'none claimed',
    verify: false,
  },
  'tried:visualise': {
    body: 'If your body stayed tense while you pictured it, that\'s common. One top post put it as "We\'re not lazy. We\'re not broken." Start smaller: a fact from this week the picture can\'t argue with.',
    claim: 'O6 adjacent',
    tier: 'none claimed',
    verify: false,
  },
  'tried:subliminal': {
    body: 'Collecting more audios and methods resets the clock each time. One of the most-upvoted posts we read said it plainly: "STOP CONSUMING MORE CONTENT." This Read gives you one thing for seven days.',
    claim: 'Integration gap',
    tier: 'E1',
    receipt: RECEIPTS.bem,
    verify: true,
  },
};
TRIED_LINES['tried:manifest_other'] = TRIED_LINES['tried:subliminal'];

export const OUTCOME_LINES: Record<string, TriedLine> = {
  'out:slipped': {
    body: "Slipping back after a few weeks is the old picture pulling you home. One slip doesn't reset you. In a study of new habits, missing a single day made no real difference (Lally et al., 2010).",
    claim: 'D4',
    tier: 'E2 + M',
    receipt: RECEIPTS.lally,
    verify: false,
  },
  'out:understood': {
    body: 'Understanding more and changing nothing is the most common complaint from people who\'ve tried things. Insight needs an action that gives the picture new evidence.',
    claim: 'Integration gap',
    tier: 'E1',
    receipt: RECEIPTS.bem,
    verify: true,
  },
  'out:worse': {
    body: 'That\'s a known result for affirmations and for "try harder" advice. It says something about the method. It says nothing bad about you.',
    claim: 'O6 · X15',
    tier: 'E2',
    receipt: RECEIPTS.wood,
    verify: false,
  },
  'out:switched': {
    body: 'Switching methods resets the clock every time. The Read gives you one thing for seven days, and nothing else.',
    claim: 'D4',
    tier: 'E2 + M',
    verify: false,
  },
  'out:helps': {
    body: 'Keep it. Nothing here asks you to stop.',
    claim: 'none',
    tier: 'none claimed',
    verify: false,
  },
};

// ── The five patterns ───────────────────────────────────────────────────────

export interface PatternVariantCopy {
  name: string;
  read: string;
}

export interface PatternContent {
  id: PatternId;
  /** §7.1 name. */
  name: string;
  /** One-line read, shown before the gate (≤20 words). */
  read: string;
  /** SMALLER: read for team leads, people between things and "none of these" (§7.1). */
  readNonPricing?: string;
  /** The line Austin says on camera (≤15 words). */
  onCamera: string;
  /** N10 segment wordings, keyed by landing variant. */
  variants?: Record<string, PatternVariantCopy>;
  scanSlug: string;
  scanName: string;
  /** "About 1 in 5" in the research sample (§8.3). */
  share: string;
  mechanism: string;
  /** Operator path addition (NO_THREAD, SMALLER). */
  mechanismOperator?: string;
  receipts: Receipt[];
  receiptsOperator?: Receipt[];
  /** SHOULDS, shown if Q2 g. */
  behindLine?: string;
  fixFits: string;
  wontHelp: string;
  wontHelpOperator?: string;
  /** Q11 "Nothing yet": what usually gets tried here and why it doesn't stick. */
  usuallyTried: string;
  usuallyTriedReceipt?: Receipt;
  /** Move with slots: {{thing}} (Q7) and {{sentence}} (Q9). */
  move: string;
  watch: string;
  scopeLine?: string;
  scanLine: string;
  scanLineNonPricing?: string;
  button: string;
  /** Closing line of the static mirror-paragraph fallback (describes, never advises). */
  fallbackClose: string;
}

export const PATTERNS: Record<PatternId, PatternContent> = {
  SHOULDS: {
    id: 'SHOULDS',
    name: 'Running on shoulds',
    read: 'Most of your week goes to what you think you should do, and the thing you want gets what\'s left.',
    onCamera: 'Name the thing you keep meaning to do. How many hours did it get?',
    scanSlug: 'perception-rite-scan-2',
    scanName: 'Value Pattern Decoder',
    share: '1 in 5',
    mechanism:
      "When a plan comes from what you value, you keep at it. When it comes from guilt or other people's idea of success, part of you drags its feet. Research on goals finds that ones that come from your own values get more sustained effort (Sheldon & Elliot, 1999). And a gap between what you intend and what you do is normal (Sheeran, 2002). Stalling is often a vote from the part of you that doesn't agree with the plan yet.",
    receipts: [RECEIPTS.sheldonElliot, RECEIPTS.sheeran],
    behindLine: "'Behind' needs a schedule. It's worth asking whose schedule it is.",
    fixFits: 'Sort the wants from the shoulds, drop or shrink one should on purpose, and give one want a protected hour.',
    wontHelp: 'A better planner. A stricter routine. Starting fresh tomorrow.',
    usuallyTried:
      "What usually gets tried here is a better planner or a stricter routine. Those make a plan run faster. They don't check whose plan it is, so the part of you that never agreed with it keeps dragging its feet.",
    move: 'Take "{{thing}}". On paper, finish this line: "I should do this because…". If the reason is someone else\'s opinion, drop it on purpose for 7 days. If the reason is yours, put one hour for it in your calendar now.',
    watch: 'Which feels lighter by Sunday: the thing you dropped or the hour you kept.',
    scanLine:
      "Your Read found plans that may not be yours. The Value Pattern Decoder compares what you say matters with where last week's time, money and attention went.",
    button: 'Get Rite I · start with the Value Pattern Decoder',
    fallbackClose: 'Your answers describe a week that mostly goes to what you think you should do.',
  },
  NOT_CAUGHT_UP: {
    id: 'NOT_CAUGHT_UP',
    name: 'It never feels like enough',
    read: "You keep adding to your record, and the picture you run on doesn't count it, so nothing feels like enough.",
    onCamera: 'If nothing you do ever feels like enough, watch this.',
    variants: {
      [MANIFESTATION_VARIANT]: {
        name: 'The old self-concept keeps winning',
        read: "You've been saying the new version of you, and the old picture keeps winning. What moves it is evidence you collect this week.",
      },
    },
    scanSlug: 'perception-rite-scan-1',
    scanName: 'Signal Awareness',
    share: '1 in 5',
    mechanism:
      "You've got more evidence than you give yourself credit for. The picture you run on filters it out. People tend to act in ways that confirm how they already see themselves, even when the view is unkind (William Swann's self-verification research). Maxwell Maltz called the self-image a steering system in 1960 (a model). The picture updates the other way too: from what you do and notice yourself doing (Daryl Bem, 1972).",
    receipts: [RECEIPTS.swann, RECEIPTS.maltz, RECEIPTS.bem],
    fixFits: "Give the picture evidence it can't argue with. Small, written down, facts only.",
    wontHelp: "Repeating lines you don't believe. Another goal to prove yourself. Trying harder.",
    usuallyTried:
      'What usually gets tried here is repeating lines you don\'t believe, or another goal to prove yourself. In one study, people with low self-esteem who repeated "I\'m a lovable person" felt worse afterwards (Wood et al., 2009). More achievement doesn\'t land either, because the picture filters it out.',
    usuallyTriedReceipt: RECEIPTS.wood,
    move: 'For the next 7 days, write one line each night: one thing you did that the sentence {{sentence}} says you don\'t do. Facts only. No praise, no adjectives.',
    watch: 'The moments you think "that doesn\'t count". Write those down too.',
    scanLine:
      'Your Read found a gap between your record and your picture of yourself. Signal Awareness reads that picture in four places: what you say, what you notice, how you talk and what you do.',
    button: 'Get Rite I · start with Signal Awareness',
    fallbackClose: "Your answers describe someone who keeps adding to the record and doesn't count much of it.",
  },
  ON_EMPTY: {
    id: 'ON_EMPTY',
    name: 'Yes to everyone but you',
    read: "You say yes before you've checked the cost, and the cost lands on you.",
    onCamera: "If you can't say no without feeling guilty, watch this.",
    scanSlug: 'perception-rite-scan-3',
    scanName: 'Boundary & Burnout',
    share: '1 in 7',
    mechanism:
      "Somewhere you learned that being useful kept you safe or liked. That rule runs before you decide, so the yes comes out first and the cost comes later. Rest doesn't fix it on its own if you never switch off: research on recovery finds that mentally detaching from work goes with less exhaustion (Sonnentag & Fritz, 2007). Austin's rule for this one: anchor before you ascend.",
    receipts: [RECEIPTS.sonnentagFritz],
    fixFits: 'A pause between the ask and the answer, and rest that actually switches you off.',
    wontHelp: 'Cutting everyone off overnight ("that was the start of when I lost all my friends"). A self-care list. Pushing through to the weekend.',
    usuallyTried:
      "What usually gets tried here is cutting everyone off at once, or a self-care list. Cutting people off overnight can cost you the friends you meant to keep. A self-care list adds one more job, and rest that never switches you off doesn't recover you.",
    move: 'For the next 7 days, when someone asks you for something, say "Let me check and come back to you" before you answer. Make a tally mark each time you\'d have said yes on the spot.',
    watch: "How many marks you make, and what you felt when you didn't say yes straight away.",
    scopeLine: "If you're exhausted most days, see a doctor as well. This Read can't assess burnout.",
    scanLine:
      "Your Read points at a yes that comes before you've decided. Boundary & Burnout maps what stays on, what actually recovers you and where the yes comes from.",
    button: 'Get Rite I · start with Boundary & Burnout',
    fallbackClose: 'Your answers describe someone who says yes first and finds out the cost later.',
  },
  NO_THREAD: {
    id: 'NO_THREAD',
    name: 'Too many interests, no thread yet',
    read: "You have more interests than hours, and the thread that ties them together isn't named yet.",
    onCamera: "If you're interested in too many things to pick one, you might not have to.",
    scanSlug: 'perception-rite-scan-5',
    scanName: 'Competence Mapping',
    share: '1 in 7',
    mechanism:
      "Plenty of people are built for breadth. Barbara Sher called them Scanners. Emilie Wapnick says multipotentialite. What stalls the work is usually a missing thread: the skill or question that runs under all of it. Skill grows where you've practised with feedback for years (Ericsson et al., 1993; it explains part of the difference between people, Macnamara et al., 2014). The thread often shows up in what people already come to you for.",
    mechanismOperator:
      'The thread is also your positioning. One forum founder put the cost of skipping it: "as I got more and more general the rates I could demand got lower and lower".',
    receipts: [RECEIPTS.ericsson, RECEIPTS.macnamara, RECEIPTS.sherWapnick],
    fixFits: 'Find the thread you already have, then put the other ideas on a later list.',
    wontHelp: 'Choosing one thing forever. A new course for the next interest. A system that organises all ten at once.',
    usuallyTried:
      'What usually gets tried here is picking one thing forever, or a new course for the next interest. Picking one cuts off the breadth that\'s yours. A new course adds one more thing and leaves the thread unnamed.',
    move: 'Ask three people this week: "What do you come to me for that you don\'t go to anyone else for?" Write down their exact words. Put every new idea on a "later" list instead of starting it.',
    watch: 'Whether two of the three say the same thing.',
    scanLine: "People already come to you for something. Competence Mapping looks at what you've practised for years and how to build around it.",
    button: 'Get Rite I · start with Competence Mapping',
    fallbackClose: 'Your answers describe a lot of interests and no single thread named yet.',
  },
  SMALLER: {
    id: 'SMALLER',
    name: 'Selling yourself short',
    read: "You do the work, then shrink it when it's time to show it or charge for it.",
    readNonPricing: "You do the work, then shrink it when it's time to show it.",
    onCamera: "Say what you do in one sentence. Now count the 'justs'.",
    scanSlug: 'perception-rite-scan-4',
    scanName: 'Money Signal',
    share: '1 in 7',
    mechanism:
      "You shrink the work at the moment it would be seen or paid for. The words you use about your work show how you see it (our model), and they're also something you can practise: deliberate self-talk improves performance in sport (Hatzigeorgiadis et al., 2011, within sport).",
    mechanismOperator: 'Buyers use price as one cue to quality when they know little else (Rao & Monroe, 1989, a narrow finding). We make no income claims.',
    receipts: [RECEIPTS.hatzigeorgiadis],
    receiptsOperator: [RECEIPTS.raoMonroe],
    fixFits: 'Say the full-size version of what you do, out loud, to people who could use it.',
    wontHelp: "Waiting until it's perfect to post.",
    wontHelpOperator:
      'Another pricing worksheet ("It\'s not a self worth issue, I know I do good work. It\'s simply that helping is enough."). Waiting until it\'s perfect to post.',
    usuallyTried:
      "What usually gets tried here is waiting until the work is perfect before showing it. Waiting keeps the work out of sight, and the sentence you use about it stays the same size.",
    move: 'Write down the sentence you use to describe your work. Cross out every "just", "only", "a bit" and "hopefully". Use the shorter version for the next 7 days.',
    watch: 'The urge to put the words back, and when it shows up.',
    scanLine:
      'Your Read found you making your work smaller when it\'s time to show it or charge for it. Money Signal looks at how you describe and price your work. No income promises.',
    scanLineNonPricing:
      "Your Read found you making your work smaller when it's time to show it. Money Signal looks at how you describe and price your work. No income promises.",
    button: 'Get Rite I · start with Money Signal',
    fallbackClose: "Your answers describe someone who does the work and then makes it smaller when it's time to show it.",
  },
};

// ── Context helpers ─────────────────────────────────────────────────────────

export interface ReadContext {
  segment: Segment | null;
  variant: string | null;
  source: string | null;
}

export function contextOf(answers: ReadAnswers, utm?: ReadUtm): ReadContext {
  const variant = utm?.variant ?? (utm?.content === 'method' ? MANIFESTATION_VARIANT : null);
  return { segment: segmentFromAnswers(answers), variant: variant ?? null, source: utm?.source?.toLowerCase() ?? null };
}

function isPricingPath(ctx: ReadContext): boolean {
  return !!ctx.segment && PRICING_SEGMENTS.includes(ctx.segment);
}

/** Name and one-line read as this visitor sees them (segment and variant wordings applied). */
export function patternDisplay(id: PatternId, ctx: ReadContext): { id: PatternId; name: string; read: string } {
  const p = PATTERNS[id];
  const v = ctx.variant ? p.variants?.[ctx.variant] : undefined;
  if (v) return { id, name: v.name, read: v.read };
  if (id === 'SMALLER' && !isPricingPath(ctx)) return { id, name: p.name, read: p.readNonPricing ?? p.read };
  return { id, name: p.name, read: p.read };
}

/** NOT_CAUGHT_UP on manifestation traffic says "self-concept" for "picture" throughout (§8.9). */
function forVariant(id: PatternId, ctx: ReadContext, text: string): string {
  if (id === 'NOT_CAUGHT_UP' && ctx.variant === MANIFESTATION_VARIANT) {
    return text.replace(/\bpicture of yourself\b/g, 'self-concept').replace(/\bpicture\b/g, 'self-concept');
  }
  return text;
}

/** "You said: …" from the Q2 loudest pick, or null (say:other text that isn't safe to show). */
export function youSaid(answers: ReadAnswers, ctx: ReadContext): string | null {
  const tag = loudestTag(answers);
  if (!tag) return null;
  if (tag === 'say:other') {
    const t = answers.q2?.text?.trim();
    return t && isUsableText(screenText(t)) ? `"${t.replace(/^["“]|["”]$/g, '')}"` : null;
  }
  return optionLabel(tag, ctx.variant);
}

function usableText(text: string | null | undefined): string | null {
  const t = text?.trim();
  return t && isUsableText(screenText(t)) ? t : null;
}

function triedPicks(answers: ReadAnswers): string[] {
  return triedTags(answers);
}

function triedMethod(answers: ReadAnswers): boolean {
  const picks = triedPicks(answers);
  return ['tried:affirm', 'tried:visualise', 'tried:subliminal', 'tried:manifest_other'].some((t) => picks.includes(t));
}

/** The move with its slots filled. Unsafe or missing text never goes into a slot. */
export function fillMove(id: PatternId, answers: ReadAnswers): string {
  const thing = usableText(partString(answers, 'q7', 'thing'));
  const sentence = usableText(answers.q9?.text);
  const cleanThing = thing?.replace(/^["“']+|["”']+$/g, '').replace(/[.]+$/, '');
  const cleanSentence = sentence?.replace(/^["“']+|["”']+$/g, '');
  let move = PATTERNS[id].move;
  move = cleanThing ? move.replace('{{thing}}', cleanThing) : move.replace('"{{thing}}"', 'the thing you keep meaning to get to');
  move = cleanSentence ? move.replace('{{sentence}}', `"${cleanSentence}"`) : move.replace('the sentence {{sentence}}', 'the thing you said about your work this week');
  return move;
}

// ── Blocks ──────────────────────────────────────────────────────────────────

function whyItDidntStickBlock(id: PatternId, answers: ReadAnswers, ctx: ReadContext): ResultBlock {
  const picks = triedPicks(answers);
  const nothing = picks.length === 0 || (picks.length === 1 && picks[0] === 'tried:none');
  if (nothing) {
    const p = PATTERNS[id];
    return {
      id: 'why_it_didnt_stick',
      title: "What usually gets tried, and why it doesn't stick for this pattern",
      body: forVariant(id, ctx, p.usuallyTried),
      ...(p.usuallyTriedReceipt ? { source: sourceOf(p.usuallyTriedReceipt) } : {}),
      meta: { triedTag: null, outcomeTag: null, verify: p.usuallyTriedReceipt?.verify ?? false },
    };
  }
  const triedTag = TRIED_ORDER.find((t) => picks.includes(t)) ?? null;
  const outcomeTag = q11Outcome(answers);
  const lines = [triedTag ? TRIED_LINES[triedTag] : null, outcomeTag ? OUTCOME_LINES[outcomeTag] ?? null : null].filter(
    (x): x is TriedLine => !!x,
  );
  const receipt = lines.find((l) => l.receipt)?.receipt;
  return {
    id: 'why_it_didnt_stick',
    title: "Why what you tried didn't stick",
    body: forVariant(id, ctx, lines.map((l) => l.body).join('\n\n')),
    ...(receipt ? { source: sourceOf(receipt) } : {}),
    meta: {
      triedTag,
      outcomeTag,
      lines: lines.map((l) => ({ claim: l.claim, tier: l.tier, verify: l.verify })),
      verify: lines.some((l) => l.verify),
    },
  };
}

function whatsGoingOnBlock(id: PatternId, answers: ReadAnswers, ctx: ReadContext): ResultBlock {
  const p = PATTERNS[id];
  const operator = isPricingPath(ctx);
  const parts = [p.mechanism];
  if (operator && p.mechanismOperator) parts.push(p.mechanismOperator);
  if (id === 'SHOULDS' && choiceOf(answers, 'q2').includes('say:behind') && p.behindLine) parts.push(p.behindLine);
  const receipts = [...p.receipts, ...(operator && p.receiptsOperator ? p.receiptsOperator : [])];
  return {
    id: 'whats_going_on',
    title: "What's going on",
    body: forVariant(id, ctx, parts.join(' ')),
    source: sourceOf(receipts[0]),
    meta: {
      receipts,
      verify: receipts.some((r) => r.verify),
      solutionCheck: SOLUTION_CHECK,
      lineage: { title: 'Where this comes from', sources: LINEAGE, verify: LINEAGE.some((r) => r.verify) },
    },
  };
}

function moveBlock(id: PatternId, answers: ReadAnswers, ctx: ReadContext): ResultBlock {
  const p = PATTERNS[id];
  const framing = triedMethod(answers) ? (id === 'NOT_CAUGHT_UP' ? MOVE_FRAMING_METHOD_NIGHTLY : MOVE_FRAMING_METHOD) : null;
  const close = ctx.source === 'youtube' ? MOVE_CLOSE_YOUTUBE : MOVE_CLOSE;
  const body = [fillMove(id, answers), framing, `What to watch: ${forVariant(id, ctx, p.watch)}`, close].filter(Boolean).join('\n\n');
  return { id: 'move', title: 'One move this week', body, meta: { button: MOVE_BUTTON, day7Check: true, methodFraming: !!framing } };
}

function offerBlock(id: PatternId, ctx: ReadContext): ResultBlock {
  const p = PATTERNS[id];
  const scanLine = id === 'SMALLER' && !isPricingPath(ctx) && p.scanLineNonPricing ? p.scanLineNonPricing : p.scanLine;
  return {
    id: 'offer',
    title: 'The scan that does this',
    body: `${forVariant(id, ctx, scanLine)}\n\n${OFFER_BRIDGE}`,
    meta: {
      button: p.button,
      productSlug: READ_OFFER_PRODUCT_SLUG,
      priceUsd: READ_OFFER_PRICE_USD,
      scanSlug: p.scanSlug,
      scanName: p.scanName,
      decline: DECLINE_CAPTURE,
    },
  };
}

function clinicalScopeBlock(safety: SafetyResult): ResultBlock | null {
  const lists = ['clinical:depression', 'clinical:trauma', 'clinical:adhd', 'clinical:other'].filter((l) => safety.matchedLists.includes(l));
  if (!lists.length) return null;
  // One "other" line is enough next to a specific one.
  const use = lists.length > 1 ? lists.filter((l) => l !== 'clinical:other') : lists;
  return { id: 'scope', body: use.map((l) => CLINICAL_SCOPE_LINES[l]).join('\n\n'), meta: { kind: 'clinical', lists: use } };
}

function hardshipBlock(safety: SafetyResult): ResultBlock | null {
  const lists = safety.matchedLists.filter((l) => l.startsWith('hardship:'));
  if (!lists.length) return null;
  const lossOnly = lists.every((l) => l === 'hardship:bereavement');
  return { id: 'scope', body: lossOnly ? HARDSHIP_LINE_LOSS : HARDSHIP_LINE, meta: { kind: 'hardship', lists } };
}

/** The static gap table behind "Show me my answers anyway" (tier 1). No pattern, no sell. */
export function gapTable(answers: ReadAnswers): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const rawThing = partString(answers, 'q7', 'thing');
  if (rawThing) rows.push({ label: 'The thing you keep meaning to get to', value: usableText(rawThing) ?? 'The thing you named' });
  const h = q7HoursTag(answers);
  if (h) rows.push({ label: 'Hours it got last week', value: HOURS_BANDS[h].label });
  const ins = partString(answers, 'q7', 'instead');
  const insLabel = ins ? optionLabel(ins.startsWith('instead:') ? ins : `instead:${ins}`) : null;
  if (insLabel) rows.push({ label: 'What got the hours instead', value: insLabel });
  const own = wantOrShouldOf(answers);
  if (own) rows.push({ label: 'Want or supposed to', value: own === 'want' ? 'Want' : own === 'should' ? 'Supposed to' : 'Not sure' });
  const q10 = answers.q10?.number;
  if (typeof q10 === 'number') rows.push({ label: "How much of last week went the way you'd have chosen", value: `${q10} of 10` });
  return rows;
}

function supportResult(sessionId: string, answers: ReadAnswers): ReadResult {
  return {
    sessionId,
    pattern: null,
    patternName: null,
    blocks: [
      {
        id: 'support',
        body: supportBody(),
        meta: {
          linesVerified: Object.values(CRISIS_LINES).every((l) => l.verified),
          verifiedOn: VERIFIED_ON,
          lines: CRISIS_LINES,
          template: SUPPORT_TEMPLATE,
          showAnswersLabel: SHOW_ANSWERS_ANYWAY,
          gapTable: gapTable(answers),
        },
      },
    ],
    offer: null,
    usedFallback: false,
  };
}

// ── Assembly ────────────────────────────────────────────────────────────────

export interface BuildResultInput {
  sessionId: string;
  answers: ReadAnswers;
  scores: PatternScores;
  mirror: WeekMirror;
  safety: SafetyResult;
  utm?: ReadUtm;
}

export type ParagraphWriter = (input: {
  answers: ReadAnswers;
  pattern: PatternId;
  safety: SafetyResult;
  utm?: ReadUtm;
}) => Promise<{ text: string; usedFallback: boolean }>;

/** The pre-gate preview (blocks 0 and 1). Crisis: no mirror, no pattern. */
export function buildPreview(input: Omit<BuildResultInput, 'sessionId'> & { sessionId: string }): ReadPreview {
  const { sessionId, safety, mirror, scores, answers, utm } = input;
  if (safety.tier === 'crisis') return { sessionId, safety, mirror: null, pattern: null };
  return { sessionId, safety, mirror, pattern: patternDisplay(scores.pattern, contextOf(answers, utm)) };
}

/**
 * Assembles the full result in display order (spec v3 §8):
 * mirror · pattern · [scope: clinical] · their_words · not_alone · why_it_didnt_stick ·
 * whats_going_on · fix_fits · [scope: burnout] · permission · [scope: hardship] · move · offer · accuracy.
 * Crisis tier: one support block, no pattern, no offer, no AI call.
 */
export async function buildResult(input: BuildResultInput, deps: { writeParagraph?: ParagraphWriter } = {}): Promise<ReadResult> {
  const { sessionId, answers, scores, mirror, safety, utm } = input;
  if (safety.tier === 'crisis') return supportResult(sessionId, answers);

  const id = scores.pattern;
  const p = PATTERNS[id];
  const ctx = contextOf(answers, utm);
  const display = patternDisplay(id, ctx);
  const said = youSaid(answers, ctx);
  const secondary = secondaryPattern(scores);

  const writeParagraph: ParagraphWriter = deps.writeParagraph ?? (await import('./paragraph')).writeMirrorParagraph;
  const paragraph = await writeParagraph({ answers, pattern: id, safety, utm });

  const blocks: ResultBlock[] = [];
  blocks.push({ id: 'mirror', title: 'Your week', body: mirror.line, meta: { showsGap: mirror.showsGap, instead: mirror.instead, own: mirror.wantOrShould } });
  blocks.push({
    id: 'pattern',
    title: `Your pattern: ${display.name}`,
    body: [said ? `You said: ${said}` : null, display.read].filter(Boolean).join('\n\n'),
    meta: {
      youSaid: said,
      lowSignal: scores.lowSignal,
      secondary: secondary ? { id: secondary, name: patternDisplay(secondary, ctx).name, line: `Also showing up: ${patternDisplay(secondary, ctx).name}` } : null,
    },
  });
  const clinical = tierAtLeast(safety.tier, 'clinical') ? clinicalScopeBlock(safety) : null;
  if (clinical) blocks.push(clinical);
  blocks.push({ id: 'their_words', title: 'In your words', body: paragraph.text, meta: { usedFallback: paragraph.usedFallback } });
  blocks.push({ id: 'not_alone', title: NOT_ALONE_TITLE, body: notAloneLine(p.share), meta: { share: p.share } });
  blocks.push(whyItDidntStickBlock(id, answers, ctx));
  blocks.push(whatsGoingOnBlock(id, answers, ctx));
  const wontHelp = isPricingPath(ctx) && p.wontHelpOperator ? p.wontHelpOperator : p.wontHelp;
  blocks.push({
    id: 'fix_fits',
    title: 'What kind of fix fits, and what won\'t help',
    body: `${forVariant(id, ctx, p.fixFits)}\n\nWon't help: ${wontHelp}`,
    meta: { fixFits: forVariant(id, ctx, p.fixFits), wontHelp },
  });
  if (p.scopeLine) blocks.push({ id: 'scope', body: p.scopeLine, meta: { kind: 'pattern' } });
  blocks.push({ id: 'permission', body: PERMISSION_LINE });
  const hardship = hardshipBlock(safety);
  if (hardship) blocks.push(hardship);
  blocks.push(moveBlock(id, answers, ctx));
  blocks.push(offerBlock(id, ctx));
  blocks.push({
    id: 'accuracy',
    title: ACCURACY.question,
    body: ACCURACY.honesty,
    meta: { scale: ACCURACY.scale, followUp: ACCURACY.followUp, deliveryNote: DELIVERY_NOTE },
  });

  return {
    sessionId,
    pattern: id,
    patternName: display.name,
    blocks,
    offer: { productSlug: READ_OFFER_PRODUCT_SLUG, priceUsd: READ_OFFER_PRICE_USD, scanSlug: p.scanSlug, scanName: p.scanName },
    usedFallback: paragraph.usedFallback,
  };
}

