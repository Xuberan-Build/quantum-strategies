/**
 * The Perception Read: deterministic scorer (spec v3 §7.2-7.4).
 *
 * Never uses chart data, never uses AI, never reads Q11 or Q12, never uses tier-1 or
 * tier-2 text as an input. The weights are a starting guess and get re-weighted after the
 * concierge test and again at 100 completions, so every number lives in the tables below.
 */
import { choiceOf, firstChoice, loudestTag, q8Lines } from './questions';
import { q7HoursTag, instead as insteadTag, wantOrShouldOf } from './mirror';
import { isUsableText, screenText } from './safety';
import type { PatternId, PatternScores, ReadAnswers } from './types';

export const PATTERN_IDS: PatternId[] = ['SHOULDS', 'NOT_CAUGHT_UP', 'ON_EMPTY', 'NO_THREAD', 'SMALLER'];

type Points = Partial<Record<PatternId, number>>;

export const READ_SCORING_CONFIG = {
  /** Spec v3 §7.3 rule 3. SHOULDS leads (founder decision, misalignment first). */
  tieOrder: ['SHOULDS', 'NOT_CAUGHT_UP', 'ON_EMPTY', 'NO_THREAD', 'SMALLER'] as PatternId[],
  /** §7.3 rule 4: below this top score the result is the fallback. */
  lowSignalThreshold: 5,
  lowSignalFallback: 'SHOULDS' as PatternId,
  /** §7.3 rule 4 spread guard: SHOULDS share above this moves the fallback to NOT_CAUGHT_UP. */
  shouldsShareGuard: 0.4,
  guardFallback: 'NOT_CAUGHT_UP' as PatternId,
  /** §7.3 rule 5: "Also showing up" needs this much. */
  secondaryThreshold: 5,
  /** Points for the Q2 loudest pick: single-pattern options. Split options give +1 to each. */
  loudestBonus: 2,
  loudestSplitBonus: 1,
} as const;

/**
 * The low-signal fallback given the SHOULDS share of results over a population
 * (concierge test, then rolling). The guard is evaluated outside the scorer.
 */
export function fallbackPattern(shouldsShare: number): PatternId {
  return shouldsShare > READ_SCORING_CONFIG.shouldsShareGuard ? READ_SCORING_CONFIG.guardFallback : READ_SCORING_CONFIG.lowSignalFallback;
}

// ── Points table (§7.2) ──────────────────────────────────────────────────────

export const Q2_POINTS: Record<string, Points> = {
  'say:know_dont': { NOT_CAUGHT_UP: 1, SHOULDS: 2 },
  'say:stall': { NOT_CAUGHT_UP: 1, SHOULDS: 1, NO_THREAD: 1 },
  'say:no_guilt': { ON_EMPTY: 2 },
  'say:empty': { ON_EMPTY: 2 },
  'say:not_enough': { NOT_CAUGHT_UP: 2 },
  'say:faking': { NOT_CAUGHT_UP: 2 },
  'say:behind': { NOT_CAUGHT_UP: 1, SHOULDS: 1 },
  'say:many': { NO_THREAD: 2 },
  'say:hide': { SMALLER: 2 },
  'say:undercharge': { SMALLER: 2 },
  'say:shoulds': { SHOULDS: 2 },
  'say:method': { NOT_CAUGHT_UP: 2 },
  'say:other': {},
};

export const Q3_POINTS: Record<string, Points> = {
  'fav:yes_late': { ON_EMPTY: 2 },
  'fav:yes_resent': { ON_EMPTY: 2 },
  'fav:no_guilt': { ON_EMPTY: 1 },
  'fav:avoid': { NOT_CAUGHT_UP: 1, ON_EMPTY: 1 },
  'fav:no_clean': {},
};

export const Q4_POINTS: Record<string, Points> = {
  'stall:verdict': { NOT_CAUGHT_UP: 3 },
  'stall:others': { ON_EMPTY: 3 },
  'stall:should': { SHOULDS: 3 },
  'stall:novelty': { NO_THREAD: 3 },
  'stall:seen': { SMALLER: 3 },
  'stall:switch': { NOT_CAUGHT_UP: 2, NO_THREAD: 1 },
  'stall:none': {},
};

export const Q5_POINTS: Record<string, Points> = {
  'desc:just': { SMALLER: 2 },
  'desc:deflect': { NOT_CAUGHT_UP: 1, SMALLER: 1 },
  'desc:list': { NO_THREAD: 2 },
  'desc:joke': { NOT_CAUGHT_UP: 1, SMALLER: 1 },
  'desc:result': {},
  'desc:none': {},
};

export const Q7_OWN_POINTS: Record<string, Points> = {
  should: { SHOULDS: 2 },
  unsure: { SHOULDS: 1 },
  want: {},
};

/** Hours 0 or 1-2 score only with the want-or-should answer (§7.2 [v3], change 8). */
export const Q7_LOW_HOURS = ['hours:0', 'hours:1_2'];
export const Q7_LOW_HOURS_POINTS: Record<string, Points> = {
  should: { SHOULDS: 2 },
  unsure: { SHOULDS: 2 },
  want: { SHOULDS: 1 },
};

export const Q7_INSTEAD_POINTS: Record<string, Points> = {
  'instead:others': { ON_EMPTY: 1 },
  'instead:shoulds': { SHOULDS: 1 },
  'instead:projects': { NO_THREAD: 1 },
};

export const GAP_CHECK_POINTS: Points = { NOT_CAUGHT_UP: 2 };
export const SELF_VERDICT_POINTS: Points = { NOT_CAUGHT_UP: 2 };
export const HEDGE_POINTS: Points = { SMALLER: 2 };
export const Q10_LOW_POINTS: Points = { ON_EMPTY: 1, SHOULDS: 1 };
export const Q1_MULTI_POINTS: Points = { NO_THREAD: 1 };

/** §7.3 rule 1: Q6 pick → words that show the same thing in Q8. Stems match word starts. */
export const Q6_KEYWORDS: Record<string, string[]> = {
  'come:fix': ['fix'],
  'come:ideas': ['idea'],
  'come:support': ['listen', 'support'],
  'come:execute': ['done'],
  'come:strategy': ['advice', 'advis', 'plan'],
  'come:connect': ['connect', 'intro'],
  'come:skill': [], // the named skill's own words are added at runtime
};

/** §7.3 rule 2. Lower-cased Q8 + Q9. */
export const SELF_VERDICT_TERMS = ['never', 'always', "can't", 'cant', 'cannot', 'not good enough', 'lazy', 'loser', 'failure', 'useless', 'a mess', 'behind'];
/** §7.2 Q9 hedges. */
export const HEDGE_TERMS = ['just', 'only', 'a bit', 'kind of', 'hopefully', 'trying to', 'not really'];

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'my', 'of', 'a', 'an', 'to', 'in', 'on', 'at', 'is', 'it', 'its', 'or', 'i', 'me', 'that', 'this']);

// ── Helpers ─────────────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ');
}

function hasTerm(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z'])${esc}(?![a-z])`).test(text);
}

function hasStem(text: string, stem: string): boolean {
  const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z])${esc}`).test(text);
}

function zero(): Record<PatternId, number> {
  return { SHOULDS: 0, NOT_CAUGHT_UP: 0, ON_EMPTY: 0, NO_THREAD: 0, SMALLER: 0 };
}

function add(scores: Record<PatternId, number>, pts: Points | undefined, reasons: string[], why: string) {
  if (!pts) return;
  const entries = Object.entries(pts).filter(([, n]) => n);
  if (!entries.length) return;
  for (const [p, n] of entries) scores[p as PatternId] += n as number;
  reasons.push(`${why}: ${entries.map(([p, n]) => `${p}+${n}`).join(' ')}`);
}

/** Text that may be used as a scoring input (below safety tier 2). */
function usable(text: string | null | undefined): string | null {
  if (!text || !text.trim()) return null;
  return isUsableText(screenText(text)) ? text : null;
}

/** The single pattern a Q2 option points at, or null when it's split or 'say:other'. */
export function loudestPattern(tag: string | null): PatternId | null {
  if (!tag) return null;
  const pts = Object.entries(Q2_POINTS[tag] ?? {}).filter(([, n]) => n);
  return pts.length === 1 ? (pts[0][0] as PatternId) : null;
}

// ── Scorer ──────────────────────────────────────────────────────────────────

export interface ScoreOptions {
  /** Override the low-signal fallback (use fallbackPattern(shouldsShare) for the spread guard). */
  fallback?: PatternId;
}

export function scorePerceptionRead(answers: ReadAnswers, opts: ScoreOptions = {}): PatternScores {
  const scores = zero();
  const reasons: string[] = [];
  const cfg = READ_SCORING_CONFIG;

  // Q1: only seg:multi scores.
  if (firstChoice(answers, 'q1') === 'seg:multi') add(scores, Q1_MULTI_POINTS, reasons, 'q1 seg:multi');

  // Q2: every pick, then the loudest.
  const picks = [...new Set(choiceOf(answers, 'q2'))];
  for (const tag of picks) add(scores, Q2_POINTS[tag], reasons, `q2 ${tag}`);
  const loud = loudestTag(answers);
  if (loud && Q2_POINTS[loud]) {
    const targets = Object.entries(Q2_POINTS[loud]).filter(([, n]) => n).map(([p]) => p as PatternId);
    if (targets.length === 1) add(scores, { [targets[0]]: cfg.loudestBonus }, reasons, `q2 loudest ${loud}`);
    else if (targets.length > 1)
      add(scores, Object.fromEntries(targets.map((p) => [p, cfg.loudestSplitBonus])), reasons, `q2 loudest ${loud} (split)`);
  }

  // Q3, Q4, Q5: single picks.
  const q3 = firstChoice(answers, 'q3');
  if (q3) add(scores, Q3_POINTS[q3], reasons, `q3 ${q3}`);
  const q4 = firstChoice(answers, 'q4');
  if (q4) add(scores, Q4_POINTS[q4], reasons, `q4 ${q4}`);
  const q5 = firstChoice(answers, 'q5');
  if (q5) add(scores, Q5_POINTS[q5], reasons, `q5 ${q5}`);

  // Q8/Q9 text, screened: tier-2+ text never scores (§7.4).
  const q8 = q8Lines(answers).map(usable).filter((x): x is string => !!x);
  const q9 = usable(answers.q9?.text ?? null);
  if (q8Lines(answers).length !== q8.length || (answers.q9?.text && !q9)) reasons.push('text excluded by safety screen');

  // Q6 gap check (rule 1): none of the Q6 keywords appear in Q8's lines.
  const q6 = choiceOf(answers, 'q6');
  if (q6.length && q8.length) {
    const stems = q6.flatMap((t) => Q6_KEYWORDS[t] ?? []);
    const skill = q6.includes('come:skill') ? usable(answers.q6?.text ?? null) : null;
    if (skill) {
      stems.push(
        ...norm(skill)
          .split(/[^a-z']+/)
          .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
      );
    }
    const q8Text = norm(q8.join(' \n '));
    if (stems.length && !stems.some((s) => hasStem(q8Text, s))) add(scores, GAP_CHECK_POINTS, reasons, 'gap check: Q8 misses what people come to you for');
  }

  // Q7: want-or-should, the hours (only with the want-or-should answer), instead.
  const own = wantOrShouldOf(answers);
  if (own) add(scores, Q7_OWN_POINTS[own], reasons, `q7 own:${own}`);
  const hours = q7HoursTag(answers);
  if (hours && own && Q7_LOW_HOURS.includes(hours)) add(scores, Q7_LOW_HOURS_POINTS[own], reasons, `q7 ${hours} with own:${own}`);
  const ins = insteadTag(answers);
  if (ins) add(scores, Q7_INSTEAD_POINTS[ins], reasons, `q7 ${ins}`);

  // Rule 2: self-verdict words in Q8 + Q9 (once).
  const verdictText = norm([...q8, q9 ?? ''].join(' \n '));
  const verdict = SELF_VERDICT_TERMS.find((t) => hasTerm(verdictText, t));
  if (verdict) add(scores, SELF_VERDICT_POINTS, reasons, `self-verdict word "${verdict}"`);

  // Q9 hedges (once).
  if (q9) {
    const hedge = HEDGE_TERMS.find((t) => hasTerm(norm(q9), t));
    if (hedge) add(scores, HEDGE_POINTS, reasons, `q9 hedge "${hedge}"`);
  }

  // Q10 baseline 1-4.
  const q10 = answers.q10?.number ?? (typeof answers.q10?.parts?.value === 'number' ? (answers.q10.parts.value as number) : undefined);
  if (typeof q10 === 'number' && q10 >= 1 && q10 <= 4) add(scores, Q10_LOW_POINTS, reasons, `q10 ${q10}`);

  // Pick: top score, ties to the loudest pick's pattern, then the order.
  const top = Math.max(...PATTERN_IDS.map((p) => scores[p]));
  const fallback = opts.fallback ?? cfg.lowSignalFallback;
  let pattern: PatternId;
  let rule: string;
  let lowSignal = false;

  if (top < cfg.lowSignalThreshold) {
    pattern = fallback;
    rule = 'low_signal';
    lowSignal = true;
  } else {
    const tied = cfg.tieOrder.filter((p) => scores[p] === top);
    const loudP = loudestPattern(loud);
    if (tied.length === 1) {
      pattern = tied[0];
      rule = 'top_score';
    } else if (loudP && tied.includes(loudP)) {
      pattern = loudP;
      rule = 'tie_loudest';
    } else {
      pattern = tied[0];
      rule = 'tie_order';
    }
  }

  const secondary = secondaryOf(scores, pattern);
  reasons.unshift(`rule=${rule}`);
  if (secondary) reasons.push(`secondary=${secondary}`);
  // Never part of scoring, recorded so nobody wonders.
  reasons.push('q11/q12 not scored');

  return { scores, pattern, lowSignal, reasons };
}

function secondaryOf(scores: Record<PatternId, number>, winner: PatternId): PatternId | null {
  const rest = READ_SCORING_CONFIG.tieOrder.filter((p) => p !== winner);
  const best = rest.reduce<PatternId | null>((b, p) => (b === null || scores[p] > scores[b] ? p : b), null);
  return best && scores[best] >= READ_SCORING_CONFIG.secondaryThreshold ? best : null;
}

/** §7.3 rule 5: "Also showing up", or null. */
export function secondaryPattern(result: PatternScores): PatternId | null {
  return secondaryOf(result.scores, result.pattern);
}

/** The deciding rule ('top_score' | 'tie_loudest' | 'tie_order' | 'low_signal'), for storage (§7.3 rule 7). */
export function decidingRule(result: PatternScores): string {
  const r = result.reasons.find((x) => x.startsWith('rule='));
  return r ? r.slice(5) : 'unknown';
}
