/**
 * The Perception Read: safety screen (spec v3 §6).
 *
 * Deterministic keyword and phrase lists. No model decides whether someone is in crisis.
 * Runs on every free-text answer before scoring, before the week mirror and before any AI call.
 * Worst tier wins: crisis > clinical > hardship > none. Results name the lists that matched
 * and never carry the user's text.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ Founder decision 2026-10-18: the lists and the support copy follow published │
 * │ safe-messaging guidance instead of a paid therapist review.                  │
 * │ Reviewed by: Austin, 2026-10-18 (approved). Terms, copy and rationale:       │
 * │ brain/content/safety-screen.md. Bump SAFETY_LIST_VERSION on every change.    │
 * │ Tier-1 false positives are acceptable. Misses are not (spec v3 §6).          │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * Sources (accessed 2026-10-18):
 *   - 988 Suicide & Crisis Lifeline, guidance for the press: https://988lifeline.org/professionals/for-the-press/
 *     (always include a referral number; no method or note detail; don't call an attempt
 *     "successful" or "failed"; avoid "epidemic"; treat suicide as a public health issue, not a crime)
 *   - National Action Alliance for Suicide Prevention, Framework for Successful Messaging:
 *     https://theactionalliance.org/messaging/public-messaging and
 *     https://suicidepreventionmessaging.org/safety/messaging-donts (no methods; don't present it as
 *     common or as a way of coping; don't suggest it's inevitable; don't oversimplify causes;
 *     don't reinforce stigma; a positive narrative promotes help-seeking and resources)
 *   - Reporting on Suicide recommendations (reportingonsuicide.org, via the 988 press page; the
 *     /recommendations page returned 404 on 2026-10-18, so wording is taken from copies that cite it):
 *     say "died by suicide" or "took their own life", never "committed suicide"
 *   - Crisis Text Line FAQ: https://www.crisistextline.org/about-us/faq/ ("listen, ask questions,
 *     and offer empathetic support, no judgment, no pressure"; for anyone, not only people who are
 *     suicidal). No public Crisis Text Line language style guide was found; its FAQ tone is used.
 *
 * How the guidance shapes this file: the screen errs toward catching (crisis phrases include
 * indirect wording people use, such as "better off without me" and "no reason to live"), the
 * copy it triggers is non-judgmental, names no method and points to a person to talk to now,
 * and nothing here labels the person.
 */
import type { ReadAnswers, SafetyResult, SafetyTier } from './types';

export const SAFETY_LIST_VERSION = 'read-safety-2026-10-18.2 (published guidance; Austin review approved 2026-10-18)';

const TIER_RANK: Record<SafetyTier, number> = { none: 0, hardship: 1, clinical: 2, crisis: 3 };

export function worstTier(...tiers: SafetyTier[]): SafetyTier {
  return tiers.reduce<SafetyTier>((w, t) => (TIER_RANK[t] > TIER_RANK[w] ? t : w), 'none');
}

export function tierAtLeast(tier: SafetyTier, min: SafetyTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}

// ── Normalisation ────────────────────────────────────────────────────────────

/**
 * Common misspellings and shorthand, applied to whole words after normalisation.
 */
const MISSPELLINGS: Record<string, string> = {
  suicde: 'suicide',
  sucide: 'suicide',
  suicid: 'suicide',
  suiside: 'suicide',
  suiced: 'suicide',
  sucidal: 'suicidal',
  suicdal: 'suicidal',
  suisidal: 'suicidal',
  suicidel: 'suicidal',
  kms: 'kill myself',
  kys: 'kill yourself',
  unalive: 'kill myself',
  unaliving: 'kill myself',
  selfharm: 'self harm',
  overdoes: 'overdose',
  overdosed: 'overdose',
  overdosing: 'overdose',
  depresed: 'depressed',
  depresssed: 'depressed',
  deppressed: 'depressed',
  depresion: 'depression',
  depresssion: 'depression',
  hopless: 'hopeless',
  traumatised: 'traumatized',
  truama: 'trauma',
  trama: 'trauma',
  cptsd: 'ptsd',
  bipoler: 'bipolar',
  diagnossed: 'diagnosed',
  myslef: 'myself',
  mysef: 'myself',
  layed: 'laid',
};

/**
 * Lowercase, straighten quotes, drop apostrophes ("don't" → "dont"), turn other punctuation
 * and digits-as-letters into spaces, collapse whitespace, then fix known misspellings.
 */
export function normaliseForScreen(text: string): string {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ`´']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base
    .split(' ')
    .map((w) => MISSPELLINGS[w] ?? w)
    .join(' ');
}

// ── Lists (Reviewed by: Austin, 2026-10-18, approved) ─────────────────────────────────────

/**
 * Each entry is either a phrase (matched on whole words in the normalised text) or a
 * RegExp run against the normalised text (no apostrophes, single spaces, lowercase).
 */
type Entry = string | RegExp;

interface SafetyList {
  id: string;
  tier: Exclude<SafetyTier, 'none'>;
  entries: Entry[];
}

/** A gap of up to n filler words between two parts of a phrase. */
const gap = (n: number) => `(?:\\w+ ){0,${n}}`;

export const SAFETY_LISTS: SafetyList[] = [
  // ── Tier 1: crisis. Direct and indirect wording (988 / Action Alliance: err toward help). ──
  {
    id: 'crisis:suicide',
    tier: 'crisis',
    entries: [
      'suicide',
      'suicidal',
      'kill myself',
      'killing myself', // accepted false positive ("killing myself at work"): tier-1 misses are worse
      'kill yourself',
      'end my life',
      'ending my life',
      'end it all',
      'ending it all',
      'take my own life',
      'take my life',
      'taking my own life',
      new RegExp(`\\b(?:dont|do not|no longer|dont really) ${gap(1)}want to (?:be alive|live|exist|be here anymore|wake up)\\b`),
      new RegExp(`\\bwant(?:s|ed)? to ${gap(2)}die\\b`),
      new RegExp(`\\bwish(?:ed)? (?:i|id) ${gap(1)}(?:was|were|could be|be) dead\\b`),
      new RegExp(`\\bwish (?:i|id) ${gap(1)}(?:never been born|wasnt born|wasnt here|didnt exist)\\b`),
      'better off dead',
      'better off without me',
      'would be better off if i',
      'no reason to live',
      'nothing to live for',
      'no point in living',
      'no point living',
      'not worth living',
      'cant go on',
      'can not go on',
      'cannot go on',
      'dont want to go on',
      'hope i dont wake up',
      'not wake up tomorrow',
      'kill me now', // accepted false positive (idiom)
      'goodbye forever',
      'died by suicide', // someone else's death still deserves the support screen
      'took their own life',
      'took his own life',
      'took her own life',
      'attempted suicide',
      'suicide attempt',
      'ready to die',
      'plan to end it',
      'disappear forever',
      new RegExp(`\\b(?:dont|do not) ${gap(1)}want to be here anymore\\b`),
      new RegExp(`\\bno (?:point|reason) ${gap(2)}(?:living|being alive|going on)\\b`),
    ],
  },
  {
    id: 'crisis:self_harm',
    tier: 'crisis',
    entries: [
      'self harm',
      'self harming',
      'hurt myself',
      'hurting myself',
      'harm myself',
      'harming myself',
      'cut myself',
      'cutting myself',
      'burn myself',
      'burning myself',
      'overdose',
      new RegExp('\\bod (?:on|again)\\b'),
      'starve myself',
      'starving myself',
    ],
  },

  // ── Tier 2: clinical words (spec v3 §6). Never named back to the reader. ──
  {
    id: 'clinical:depression',
    tier: 'clinical',
    entries: ['depressed', 'depression', 'depressive', 'hopeless', 'hopelessness', 'numb', 'numbness', 'antidepressant', 'antidepressants'],
  },
  {
    id: 'clinical:trauma',
    tier: 'clinical',
    entries: ['trauma', 'traumas', 'traumatic', 'traumatized', 'ptsd', 'abuse', 'abused', 'abusive', 'abuser'],
  },
  {
    id: 'clinical:adhd',
    tier: 'clinical',
    entries: ['adhd', 'attention deficit'],
  },
  {
    id: 'clinical:other',
    tier: 'clinical',
    entries: [
      'anxiety disorder',
      'anxiety',
      'panic attack',
      'panic attacks',
      'bipolar',
      'eating disorder',
      'anorexia',
      'anorexic',
      'bulimia',
      'bulimic',
      'binge eating',
      'diagnosed',
      'diagnosis',
      'ocd',
      'psychosis',
      'psychotic',
      'schizophrenia',
      'borderline personality',
      'mental illness',
      'nervous breakdown',
    ],
  },

  // ── Tier 3: hardship. A real limit, never a mindset problem. ──
  {
    id: 'hardship:money',
    tier: 'hardship',
    entries: [
      // "broke" as money, not "I broke my promise"
      /\bbroke\b(?! (?:my|the|a|an|it|up|down|his|her|their|our|that|this|through|into|out|even|free|away|off|in|ground|records?|news|character|me|them|him|everything|something))/,
      'cant pay rent',
      'can not pay rent',
      'cannot pay rent',
      'cant pay my rent',
      'cant afford rent',
      'cant afford food',
      'behind on rent',
      'evicted',
      'eviction',
      'homeless',
      'bankrupt',
      'bankruptcy',
      'foreclosure',
      'in debt',
      'drowning in debt',
      'out of money',
      'food bank',
    ],
  },
  {
    id: 'hardship:work',
    tier: 'hardship',
    entries: ['laid off', 'lost my job', 'got fired', 'been fired', 'was fired', 'unemployed', 'made redundant', 'redundancy', 'lost my business'],
  },
  {
    id: 'hardship:bereavement',
    tier: 'hardship',
    entries: [
      'passed away',
      'bereavement',
      'bereaved',
      'grieving',
      'grief',
      'funeral',
      'widow',
      'widowed',
      'widower',
      'miscarriage',
      new RegExp('\\b(?:lost|losing) my (?:mum|mom|mother|dad|father|husband|wife|partner|son|daughter|child|baby|brother|sister|best friend|grandma|grandmother|grandad|grandfather)\\b'),
      new RegExp('\\bmy (?:mum|mom|mother|dad|father|husband|wife|partner|son|daughter|child|baby|brother|sister|best friend) (?:died|passed)\\b'),
    ],
  },
];

function compile(entry: Entry): RegExp {
  if (entry instanceof RegExp) return entry;
  const phrase = normaliseForScreen(entry).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^| )${phrase}(?= |$)`);
}

/**
 * Known false-positive guards (each is a test in __tests__/safety.test.ts):
 * "kill it at work", "killing it", "this deadline is killing me", "dying to get this done",
 * "I'm dying to start", "I could die of embarrassment", "dead in the water", "I broke my promise",
 * "I want to diet", "I cut my hours", "I hurt my back", "killer workout", "done with excuses".
 * Accepted tier-1 false positives: "killing myself at work", "kill me now".
 */
const COMPILED = SAFETY_LISTS.map((l) => ({ ...l, regexes: l.entries.map(compile) }));

/** List sizes, for the report and the review checklist. */
export function safetyListSizes(): Record<string, number> {
  return Object.fromEntries(SAFETY_LISTS.map((l) => [l.id, l.entries.length]));
}

// ── Screening ───────────────────────────────────────────────────────────────

const NONE: SafetyResult = { tier: 'none', matchedLists: [] };

/** Screens one piece of text. Never returns the text. */
export function screenText(text: string | null | undefined): SafetyResult {
  if (!text || !text.trim()) return { ...NONE, matchedLists: [] };
  const norm = ` ${normaliseForScreen(text)} `.trim();
  const matched: string[] = [];
  let tier: SafetyTier = 'none';
  for (const list of COMPILED) {
    if (list.regexes.some((r) => r.test(norm))) {
      matched.push(list.id);
      tier = worstTier(tier, list.tier);
    }
  }
  return { tier, matchedLists: matched };
}

/** Option values look like 'say:stall'. Anything else in a string part is free text. */
const TAG = /^[a-z0-9_]+:[a-z0-9_]+$/;

/**
 * Every free-text field in the answers, keyed 'q7.thing', 'q9.text' and so on.
 * Covers Q2 other, Q6 skill, Q7 thing, Q8 lines, Q9 and any other text a client sends.
 */
export function textFields(answers: ReadAnswers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [qid, a] of Object.entries(answers ?? {})) {
    if (!a) continue;
    if (typeof a.text === 'string' && a.text.trim()) out[`${qid}.text`] = a.text;
    for (const [k, v] of Object.entries(a.parts ?? {})) {
      const vals = Array.isArray(v) ? v : [v];
      vals.forEach((x, i) => {
        if (typeof x === 'string' && x.trim() && !TAG.test(x.trim())) out[`${qid}.${k}${vals.length > 1 ? `.${i}` : ''}`] = x;
      });
    }
  }
  return out;
}

/** Per-field results (same keys as textFields). */
export function screenFields(answers: ReadAnswers): Record<string, SafetyResult> {
  return Object.fromEntries(Object.entries(textFields(answers)).map(([k, t]) => [k, screenText(t)]));
}

/** Screens every free-text answer. Worst tier wins; matchedLists is the union. */
export function screenAnswers(answers: ReadAnswers): SafetyResult {
  let tier: SafetyTier = 'none';
  const lists = new Set<string>();
  for (const r of Object.values(screenFields(answers))) {
    tier = worstTier(tier, r.tier);
    r.matchedLists.forEach((l) => lists.add(l));
  }
  return { tier, matchedLists: [...lists] };
}

/** True when the field's text may be quoted or used as a scoring input (below tier 2). */
export function isUsableText(r: SafetyResult | undefined): boolean {
  return !r || !tierAtLeast(r.tier, 'clinical');
}
