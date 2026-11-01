/**
 * Copy for the Perception Read placements on the public site: the site banner, the
 * article sidebar card, the end-of-article block, the homepage line and the footer link.
 *
 * Edit the words here. Nothing else needs to change.
 *
 * Source of the promise: brain/gtm/free-quiz-spec-v3.md §3.1 and §3.5.
 * Voice: brain/content/tonality.md (§0 rules, §6 kill list), naming-conventions.md N9/N11.
 * Rules for this file:
 *   - Call it "The Perception Read" (or "the Read" after the first mention).
 *   - Never "quiz", "test", "assessment", "archetype", "type", "quantum".
 *   - No outcome promises, no therapy claims, no em-dashes, no hype.
 *   - "values" and "misaligned" don't appear (N11: the gap goes in their words).
 */

/**
 * Banner line options. Option A is live. To switch, change ACTIVE_BANNER below.
 *
 * A: the name and the promise, using their own week (default).
 * B: the spec's default landing line (§3.5), then the name.
 * C: the 60-second demo hook from the spec (§3.5), as a prompt they can answer.
 */
export const BANNER_OPTIONS = {
  // A
  A: "The Perception Read is free. Twelve questions about your last week, and a short read of what's in the way.",
  // B
  B: "Doing what you're supposed to, and it feels like someone else's life? The Perception Read is free and takes about 5 minutes.",
  // C
  C: 'Name one thing you keep meaning to get to. The Perception Read shows where last week went instead. Free, about 5 minutes.',
} as const;

export type BannerOption = keyof typeof BANNER_OPTIONS;

export const ACTIVE_BANNER: BannerOption = 'A';

export const READ_CTA_COPY = {
  name: 'The Perception Read',

  banner: {
    line: BANNER_OPTIONS[ACTIVE_BANNER],
    button: 'Take the Read',
    dismissLabel: 'Hide this for two weeks',
  },

  sidebar: {
    kicker: 'Free, about 5 minutes',
    title: 'The Perception Read',
    line: 'Twelve questions about what you did last week. You see where the hours went and the pattern your answers keep repeating.',
    button: 'Take the Read',
    note: 'No birth chart. It asks for your email to send the full result.',
  },

  endOfArticle: {
    kicker: 'Free, about 5 minutes',
    title: "See what's in the way, using your own week",
    body:
      "The Perception Read asks twelve questions about what you did and said this month. You'll see where last week actually went, the pattern your answers keep repeating, why the things you've tried didn't stick, and one thing to do this week.",
    button: 'Take the Perception Read',
    scope: "It's a reflection tool. It doesn't diagnose anything, and it isn't therapy.",
  },

  home: {
    label: 'Free: The Perception Read',
    line: 'Twelve questions about your last week and one thing to do this week. About 5 minutes.',
  },

  footerLink: 'Free: The Perception Read',
} as const;
