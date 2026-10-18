/**
 * Static copy for the Perception Read pages (spec v3 §3, Screen 0, §8).
 * Voice: brain/content/tonality.md. Plain, short, second person. No em-dashes.
 * Never in this file: "quantum", "quiz", "assessment", "archetype", "test", "type".
 */
import { MANIFESTATION_VARIANT } from './utm';

/**
 * Landing lines by `utm_content` (spec v3 §3.5). One line per traffic source, never
 * combined. The default leads with misalignment. Unknown values get the default.
 */
export const LANDING_LINES: Record<string, string> = {
  default: "Doing what you're supposed to, and it feels like someone else's life?",
  know: "Know what to do, and still don't do it?",
  stall: 'Start strong, then it stalls?',
  no_guilt: "Can't say no without feeling guilty?",
  behind: 'Behind for your age?',
  method: 'Tried every manifesting technique and ended up back at step 1?',
};

export function landingLine(utmContent: string | undefined, variant: string | undefined): string {
  if (variant === MANIFESTATION_VARIANT) return LANDING_LINES.method;
  if (utmContent && LANDING_LINES[utmContent]) return LANDING_LINES[utmContent];
  return LANDING_LINES.default;
}

export const LANDING = {
  name: 'The Perception Read',
  sub:
    "Twelve questions about what you did and said this month. You'll see where last week actually went, the pattern your answers keep repeating, why the things you've tried didn't stick, and one thing to do this week.",
  /** Extra line on manifestation traffic (N10). Names what they tried, nothing more. */
  manifestationNote:
    "Keep your practice. This looks at your week and gives you one small thing to do alongside it.",
  facts: ['12 questions', 'About 5 minutes', 'Free', 'No birth chart'],
  emailNote: 'It asks for your email at the end so it can send you the full result.',
  getTitle: 'What you get',
  get: [
    'Where last week actually went, in your own answers.',
    'The pattern your answers keep repeating, named in plain words.',
    "Why the things you've tried didn't stick for that pattern.",
    'One thing to do this week, and nothing to buy before you see it.',
  ],
  whatTitle: 'What it is',
  screen0:
    "These questions are about what you did and said recently. Short answers are fine. At the end you'll see where last week went, the pattern your answers keep repeating, why some fixes don't stick for it, and one thing to try this week.",
  scope: "It's a reflection tool. It doesn't diagnose anything, and it isn't therapy.",
  start: 'Start the Read',
};

export const FLOW = {
  next: 'Next',
  back: 'Back',
  finish: 'See my Read',
  skip: 'Skip',
  saving: 'Saving',
  starting: 'Getting your questions ready',
  completing: 'Reading your answers',
  saveError: "That didn't save. Check your connection and try again.",
  startError: "We couldn't start the Read just now. Try again in a minute.",
  required: 'Pick an answer to keep going.',
  requiredText: 'Write a few words to keep going. Short is fine.',
  pickLoudest: 'Pick the one that is loudest.',
  textHint: 'Short answers are fine.',
  retry: 'Try again',
};

export const PREVIEW = {
  weekTitle: 'Your week',
  youSaid: 'You said',
  patternLabel: 'Your pattern',
  fullReadLine:
    "Your full Read shows why the fixes you've tried didn't stick, what's going on underneath, and one thing to do this week.",
};

export const GATE = {
  title: 'Get your full Read',
  intro: "Enter your email and the rest of your Read opens on this page. We'll send you a copy too.",
  getTitle: "What you'll get",
  get: [
    "Why the things you've tried didn't stick.",
    "What's going on underneath, with where the idea comes from.",
    'One thing to do this week.',
  ],
  emailLabel: 'Your email',
  emailPlaceholder: 'you@example.com',
  consent:
    'Send me the occasional email from Austin about this work. You can unsubscribe in one click.',
  privacy:
    'We use your email to send your result. No password and no phone number. Marketing email only if you tick the box.',
  privacyLink: 'Privacy policy',
  submit: 'Show my full Read',
  submitting: 'Opening your Read',
  invalidEmail: 'That email looks incomplete. Check it and try again.',
  unlockError: "That didn't go through. Try again in a minute.",
};

export const RESULT = {
  loading: 'Loading your Read',
  notFound: "We couldn't find this Read. The link may have expired, or it was opened on another device.",
  startOver: 'Start a new Read',
  moveCommit: "I'll do this",
  moveCommitted: "Good. We'll ask how it went in a week.",
  offerPrice: '$12',
  offerButton: (scanName: string) => `Get Rite I and start with ${scanName}`,
  offerNote: 'All five Perception scans. You make an account at checkout.',
  accuracyQuestion: 'How accurate was this Read?',
  accuracyLow: 'Not me at all',
  accuracyHigh: 'Spot on',
  hardestQuestion: 'Which part hit hardest?',
  hardestOptions: [
    { value: 'week_mirror', label: 'The week mirror' },
    { value: 'pattern_name', label: 'The pattern name' },
    { value: 'why_it_didnt_stick', label: "Why what I tried didn't stick" },
    { value: 'move', label: 'The move' },
    { value: 'none', label: 'None of it' },
  ],
  feedbackSubmit: 'Send',
  feedbackThanks: 'Thanks. This is how the Read gets more accurate.',
  feedbackError: "That didn't send. Try again.",
  feedbackNeedsRating: 'Pick a number from 1 to 5 first.',
};

/**
 * Crisis support (spec v3 §6 tier 1). No mirror, no pattern, no offer.
 * VERIFY every number against the line's own site before launch (spec v3 §15 item 2).
 */
export const SUPPORT = {
  title: 'Please talk to someone today',
  body:
    "Something you wrote tells us this might be a hard time. This Read is a reflection tool, and it isn't the right thing for right now. These lines are free, and the people on them are there to listen.",
  lines: [
    { where: 'United States', how: 'Call or text 988', href: 'tel:988' },
    { where: 'United Kingdom and Ireland', how: 'Call Samaritans on 116 123', href: 'tel:116123' },
    { where: 'Australia', how: 'Call Lifeline on 13 11 14', href: 'tel:131114' },
    { where: 'Anywhere else', how: 'Find a free line near you at findahelpline.com', href: 'https://findahelpline.com' },
  ],
  emergency: "If you're in danger right now, call your local emergency number.",
  showAnswers: 'Show me my answers anyway',
  answersTitle: 'Where last week went, in your answers',
  noAnswers: "There's nothing to show from your answers yet.",
};
