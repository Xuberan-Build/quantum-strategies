import { z } from 'zod';

/**
 * Video script: a first-class content format.
 *
 * Generic schema + validator. This file holds NO brand strategy text and NO word lists:
 * banned terms, care terms, CTA spam patterns and outcome-timebox patterns are injected
 * at runtime through `VideoScriptRules` (normally built from the voice pack).
 *
 * Shape of a script (in spoken order):
 *   hook → lazyVersion → [credibility] → mechanism → moves[3] → [caveat] → [synthesis] → cta
 * plus receipts[] (on-screen source cards), tags and per-beat production cues.
 */

export const VIDEO_SCRIPT_SCHEMA_VERSION = 1;

// ─── Schema ────────────────────────────────────────────────────────────────

/**
 * Evidence tiers for sources. `internal` means the brand's own material: never valid as
 * evidence. `metaphor` and `contested` may appear (labelled) but can't carry causal weight.
 */
export const EvidenceTierSchema = z.enum([
  'established', // meta-analyses, large replications, textbook consensus
  'supported', // single studies, limited samples
  'contested', // failed or mixed replications, fringe theories
  'model', // practitioner frameworks
  'lineage', // historical / contemplative echo: resonance, never proof
  'metaphor', // figurative language, labelled
  'internal', // the publisher's own synthesis: never a source
]);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;

export const SourceSchema = z.object({
  citation: z.string(), // "Author (Year) · Work/Venue"
  tier: EvidenceTierSchema,
  locator: z.string().optional(), // page, chapter, DOI
  url: z.string().optional(),
});
export type VideoScriptSource = z.infer<typeof SourceSchema>;

/** Production cues shared by every beat. */
const CuesShape = {
  onScreenText: z.array(z.string()).default([]),
  bRoll: z.array(z.string()).default([]),
  /** Author's own estimate. The validator computes its own from word count. */
  estimatedSeconds: z.number().nonnegative().optional(),
  /** Silent time on top of the words (e.g. "do it with me now"). Counted in timing. */
  pauseSeconds: z.number().nonnegative().optional(),
};

export const BeatSchema = z.object({ spoken: z.string(), ...CuesShape });
export type VideoScriptBeat = z.infer<typeof BeatSchema>;

export const MoveSchema = z.object({
  name: z.string(),
  explanation: z.string(),
  /** Optional in the schema so the validator can report a missing exercise by move. */
  exercise: z.string().optional(),
  source: SourceSchema.optional(),
  ...CuesShape,
});
export type VideoScriptMove = z.infer<typeof MoveSchema>;

export const ReceiptSchema = z.object({
  claim: z.string(),
  citation: z.string(),
  tier: EvidenceTierSchema,
  /** How the source is used. A contested source may only debunk or qualify. */
  role: z.enum(['supports', 'qualifies', 'debunks']).default('supports'),
  onScreen: z.string().optional(),
});
export type VideoScriptReceipt = z.infer<typeof ReceiptSchema>;

export const CtaSchema = z.object({
  kind: z.enum(['quiz', 'rite']),
  spoken: z.string(),
  target: z.string().optional(), // product slug / URL
  ...CuesShape,
});

export const VideoScriptSchema = z.object({
  variant: z.enum(['long', 'short']),
  title: z.string().min(1),
  titleOptions: z.array(z.string()).optional(),
  thumbnailText: z.string().optional(),
  hook: BeatSchema,
  lazyVersion: BeatSchema.extend({ name: z.string() }),
  credibility: BeatSchema.optional(),
  mechanism: BeatSchema.extend({
    name: z.string(),
    claim: z.string(),
    source: SourceSchema.optional(),
  }),
  moves: z.array(MoveSchema),
  receipts: z.array(ReceiptSchema).default([]),
  caveat: BeatSchema.optional(),
  synthesis: BeatSchema.optional(),
  cta: CtaSchema,
  tags: z.object({
    rite: z.string(),
    pillar: z.string(),
    domain: z.string(),
  }),
  notes: z.string().optional(),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;
export type VideoScriptInput = z.input<typeof VideoScriptSchema>;

// ─── Rules (injected) ──────────────────────────────────────────────────────

export interface CareTerm {
  term: string;
  /** The condition under which the term is allowed. (`rule` is the voice pack's name for it.) */
  condition?: string;
  rule?: string;
}

/**
 * Minimal rule set the validator needs. Structurally compatible with the voice pack's
 * `FormatVoiceRules` (src/lib/content/voice-pack.ts), so a pack can be passed straight in.
 * Pattern convention (same as the voice pack): `/source/flags` is a case-insensitive regular
 * expression; anything else is a literal phrase matched on word boundaries.
 */
export interface VideoScriptRules {
  /** Exact phrases that fail the script (word-boundary, case-insensitive). */
  bannedTerms: string[];
  /** Allowed with a condition: produce warnings. */
  handleWithCare?: Array<string | CareTerm>;
  /** CTA copy that resembles spam / testimonial plants. Error anywhere in the script. */
  ctaSpamPatterns?: string[];
  /** Promises about how fast an outcome arrives. Error anywhere, including the title. */
  outcomeTimeboxPatterns?: string[];
  /** AI-prose tells (contrast reveals, stacked dashes, filler). Warning, one per pattern, outside the lazy-version beat. */
  aiProsePatterns?: string[];
  /** Phrases that signal a call to action; a match outside the CTA beat is a second CTA. */
  ctaMentionPatterns?: string[];
  /** Markers for citations still to be checked (warning). Default ["VERIFY"]. */
  unverifiedCitationMarkers?: string[];
  /** Timing overrides per variant. */
  timing?: Partial<Record<VideoVariant, Partial<TimingProfile>>>;
}

export type VideoVariant = VideoScript['variant'];

export interface TimingProfile {
  wordsPerMinute: number;
  totalMin: number; // seconds
  totalMax: number;
  hookMax: number;
  lazyVersionStartMax: number; // the lazy version must be named by this second
  mechanismStartMax: number; // the mechanism must start by this second
  moveMin: number;
  moveMax: number;
  ctaMax: number;
}

export const DEFAULT_TIMING: Record<VideoVariant, TimingProfile> = {
  long: {
    wordsPerMinute: 150,
    totalMin: 8 * 60,
    totalMax: 14 * 60,
    hookMax: 15,
    lazyVersionStartMax: 45,
    mechanismStartMax: 4 * 60,
    moveMin: 60,
    moveMax: 4 * 60,
    ctaMax: 45,
  },
  short: {
    wordsPerMinute: 165,
    totalMin: 20,
    totalMax: 60,
    hookMax: 5,
    lazyVersionStartMax: 8,
    mechanismStartMax: 25,
    moveMin: 4,
    moveMax: 15,
    ctaMax: 8,
  },
};

export const DEFAULT_CTA_MENTION_PATTERNS = ['/\\blink (is )?(below|in the description)/', "link's below", 'sign up'];

// ─── Result ────────────────────────────────────────────────────────────────

export type IssueCategory = 'schema' | 'structure' | 'evidence' | 'timing' | 'language' | 'cta';

export interface ValidationIssue {
  code: string;
  category: IssueCategory;
  path: string; // e.g. "moves[1].exercise"
  message: string;
}

export interface BeatTiming {
  beat: string;
  words: number;
  seconds: number;
  startsAt: number;
  declaredSeconds?: number;
}

export interface VideoScriptValidation {
  pass: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Quality 0–10 (structural pass is `pass`; see rubric in scoreBreakdown). */
  score: number;
  scoreBreakdown: Record<string, number>;
  timing: { totalSeconds: number; beats: BeatTiming[] };
  /** The parsed script, when it parsed. */
  script?: VideoScript;
  schemaVersion: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function countWords(text: string | undefined): number {
  if (!text) return 0;
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a pattern entry: `/source/flags` → case-insensitive RegExp; anything else → literal
 * phrase on word boundaries. An invalid regex degrades to a literal match of the whole string.
 */
export function toRegex(pattern: string): RegExp {
  const m = /^\/([\s\S]+)\/([a-z]*)$/.exec(pattern.trim());
  if (m) {
    const flags = m[2].replace(/g/g, '');
    try {
      return new RegExp(m[1], flags.includes('i') ? flags : `${flags}i`);
    } catch {
      /* literal fallback */
    }
  }
  return phraseRegex(pattern);
}

/** Word-boundary phrase match that tolerates apostrophe variants and punctuation edges. */
function phraseRegex(term: string): RegExp {
  const normalised = escapeRegex(term.trim().toLowerCase()).replace(/'/g, "['’]");
  const start = /^\w/.test(term.trim()) ? '\\b' : '';
  const end = /\w$/.test(term.trim()) ? '\\b' : '';
  return new RegExp(`${start}${normalised}${end}`, 'i');
}

interface TextField {
  path: string;
  beat: string; // logical beat name for exemptions
  text: string;
}

function collectText(s: VideoScript): TextField[] {
  const out: TextField[] = [];
  const push = (path: string, beat: string, text: string | undefined) => {
    if (text && text.trim()) out.push({ path, beat, text });
  };
  const cues = (path: string, beat: string, b: { onScreenText: string[] }) =>
    b.onScreenText.forEach((t, i) => push(`${path}.onScreenText[${i}]`, beat, t));

  push('title', 'title', s.title);
  s.titleOptions?.forEach((t, i) => push(`titleOptions[${i}]`, 'title', t));
  push('thumbnailText', 'title', s.thumbnailText);
  push('hook.spoken', 'hook', s.hook.spoken);
  cues('hook', 'hook', s.hook);
  push('lazyVersion.name', 'lazyVersion', s.lazyVersion.name);
  push('lazyVersion.spoken', 'lazyVersion', s.lazyVersion.spoken);
  cues('lazyVersion', 'lazyVersion', s.lazyVersion);
  if (s.credibility) {
    push('credibility.spoken', 'credibility', s.credibility.spoken);
    cues('credibility', 'credibility', s.credibility);
  }
  push('mechanism.name', 'mechanism', s.mechanism.name);
  push('mechanism.claim', 'mechanism', s.mechanism.claim);
  push('mechanism.spoken', 'mechanism', s.mechanism.spoken);
  cues('mechanism', 'mechanism', s.mechanism);
  s.moves.forEach((m, i) => {
    push(`moves[${i}].name`, `move${i + 1}`, m.name);
    push(`moves[${i}].explanation`, `move${i + 1}`, m.explanation);
    push(`moves[${i}].exercise`, `move${i + 1}`, m.exercise);
    cues(`moves[${i}]`, `move${i + 1}`, m);
  });
  s.receipts.forEach((r, i) => {
    push(`receipts[${i}].claim`, 'receipts', r.claim);
    push(`receipts[${i}].onScreen`, 'receipts', r.onScreen);
  });
  if (s.caveat) {
    push('caveat.spoken', 'caveat', s.caveat.spoken);
    cues('caveat', 'caveat', s.caveat);
  }
  if (s.synthesis) {
    push('synthesis.spoken', 'synthesis', s.synthesis.spoken);
    cues('synthesis', 'synthesis', s.synthesis);
  }
  push('cta.spoken', 'cta', s.cta.spoken);
  cues('cta', 'cta', s.cta);
  return out;
}

/** Spoken beats in order, for timing. */
function spokenBeats(s: VideoScript): Array<{ beat: string; text: string; pause: number; declared?: number }> {
  const beats: Array<{ beat: string; text: string; pause: number; declared?: number }> = [];
  const add = (beat: string, b: { spoken: string; pauseSeconds?: number; estimatedSeconds?: number }) =>
    beats.push({ beat, text: b.spoken, pause: b.pauseSeconds ?? 0, declared: b.estimatedSeconds });
  add('hook', s.hook);
  add('lazyVersion', s.lazyVersion);
  if (s.credibility) add('credibility', s.credibility);
  add('mechanism', s.mechanism);
  s.moves.forEach((m, i) =>
    beats.push({
      beat: `move${i + 1}`,
      text: `${m.explanation} ${m.exercise ?? ''}`,
      pause: m.pauseSeconds ?? 0,
      declared: m.estimatedSeconds,
    }),
  );
  if (s.caveat) add('caveat', s.caveat);
  if (s.synthesis) add('synthesis', s.synthesis);
  add('cta', s.cta);
  return beats;
}

export function estimateTiming(
  s: VideoScript,
  wordsPerMinute: number,
): { totalSeconds: number; beats: BeatTiming[] } {
  let t = 0;
  const beats: BeatTiming[] = spokenBeats(s).map((b) => {
    const words = countWords(b.text);
    const seconds = Math.round(((words / wordsPerMinute) * 60 + b.pause) * 10) / 10;
    const row: BeatTiming = { beat: b.beat, words, seconds, startsAt: Math.round(t * 10) / 10, declaredSeconds: b.declared };
    t += seconds;
    return row;
  });
  return { totalSeconds: Math.round(t * 10) / 10, beats };
}

function fmt(sec: number): string {
  // Floor, so a 59.6s beat never displays as "1:00" next to a "≥ 1:00" target.
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/** An exercise is concrete when it's long enough to follow and carries a quantity or time. */
export function isConcreteExercise(ex: string | undefined): boolean {
  if (!ex) return false;
  const quantity =
    /\d|\b(one|two|three|four|five|ten|once|twice|single|next|today|tonight|tomorrow|this week|right now|now)\b/i;
  return countWords(ex) >= 8 && quantity.test(ex);
}

// ─── Validator ─────────────────────────────────────────────────────────────

/**
 * Validate a video script.
 *
 * Errors fail the script (structure, evidence, hard timing limits, banned language, CTA).
 * Warnings lower the quality score but don't fail it.
 * Accepts unknown input (e.g. parsed model JSON); a `cta` array of length 1 is unwrapped.
 */
export function validateVideoScript(input: unknown, rules: VideoScriptRules): VideoScriptValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (category: IssueCategory, code: string, path: string, message: string) =>
    errors.push({ category, code, path, message });
  const warn = (category: IssueCategory, code: string, path: string, message: string) =>
    warnings.push({ category, code, path, message });

  const empty = (): VideoScriptValidation => ({
    pass: false,
    errors,
    warnings,
    score: 0,
    scoreBreakdown: {},
    timing: { totalSeconds: 0, beats: [] },
    schemaVersion: VIDEO_SCRIPT_SCHEMA_VERSION,
  });

  // CTA cardinality before schema parsing, so "two CTAs" reads as a CTA error, not a type error.
  let raw = input;
  if (raw && typeof raw === 'object' && 'cta' in raw) {
    const cta = (raw as { cta: unknown }).cta;
    if (Array.isArray(cta)) {
      if (cta.length === 0) {
        err('cta', 'cta_missing', 'cta', 'A CTA is required.');
        return empty();
      }
      if (cta.length > 1) {
        err('cta', 'cta_count', 'cta', `Exactly one CTA is required; found ${cta.length}.`);
      }
      // Keep validating the rest against the first CTA so every other problem is reported too.
      raw = { ...(raw as object), cta: cta[0] };
    }
  }
  if (raw && typeof raw === 'object' && !('cta' in raw)) {
    err('cta', 'cta_missing', 'cta', 'A CTA is required.');
  }

  const parsed = VideoScriptSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('').replace(/^\./, '');
      if (path === 'cta' && errors.some((e) => e.code === 'cta_missing')) continue;
      err('schema', 'schema', path || '(root)', issue.message);
    }
    return empty();
  }
  const s = parsed.data;
  const blank = (v: string | undefined) => !v || !v.trim();

  // ── Structure ──
  if (blank(s.hook.spoken)) err('structure', 'hook_missing', 'hook.spoken', 'The hook has no spoken line.');
  if (blank(s.lazyVersion.name)) err('structure', 'lazy_version_unnamed', 'lazyVersion.name', 'Name the popular version being attacked.');
  if (blank(s.lazyVersion.spoken)) err('structure', 'lazy_version_missing', 'lazyVersion.spoken', 'The lazy-version beat has no spoken line.');
  if (blank(s.mechanism.name)) err('structure', 'mechanism_unnamed', 'mechanism.name', 'Name the mechanism.');
  if (blank(s.mechanism.claim)) err('structure', 'mechanism_no_claim', 'mechanism.claim', 'State the mechanism as a one-sentence claim.');
  if (blank(s.mechanism.spoken)) err('structure', 'mechanism_missing', 'mechanism.spoken', 'The mechanism beat has no spoken line.');

  if (s.moves.length !== 3) {
    err('structure', 'move_count', 'moves', `Exactly 3 moves are required; found ${s.moves.length}.`);
  }
  s.moves.forEach((m, i) => {
    const p = `moves[${i}]`;
    if (blank(m.name)) err('structure', 'move_unnamed', `${p}.name`, `Move ${i + 1} needs a name.`);
    if (blank(m.explanation)) err('structure', 'move_no_explanation', `${p}.explanation`, `Move ${i + 1} needs an explanation.`);
    if (blank(m.exercise)) {
      err('structure', 'move_no_exercise', `${p}.exercise`, `Move ${i + 1} ("${m.name}") has no exercise.`);
    } else if (!isConcreteExercise(m.exercise)) {
      warn('structure', 'move_exercise_vague', `${p}.exercise`, `Move ${i + 1}'s exercise lacks a concrete quantity, time or "now" (or is under 8 words).`);
    }
  });
  const moveNames = s.moves.map((m) => m.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(moveNames).size !== moveNames.length) {
    warn('structure', 'move_names_duplicate', 'moves', 'Move names should be distinct.');
  }
  if (blank(s.cta.spoken)) err('cta', 'cta_empty', 'cta.spoken', 'The CTA has no spoken line.');

  // ── Evidence ──
  const markers = rules.unverifiedCitationMarkers ?? ['VERIFY'];
  const unverified = (c: string) => markers.some((mk) => c.includes(mk));
  const src = s.mechanism.source;
  if (!src || blank(src.citation)) {
    err('evidence', 'mechanism_unsourced', 'mechanism.source', 'The mechanism has no source.');
  } else {
    if (src.tier === 'internal') err('evidence', 'mechanism_internal_source', 'mechanism.source.tier', 'Internal material is never a source for the mechanism.');
    if (src.tier === 'metaphor') err('evidence', 'mechanism_metaphor_source', 'mechanism.source.tier', 'A metaphor cannot carry the mechanism.');
    if (src.tier === 'contested') err('evidence', 'mechanism_contested_source', 'mechanism.source.tier', 'A contested finding cannot be cited as support for the mechanism.');
    if (src.tier === 'lineage') warn('evidence', 'mechanism_lineage_source', 'mechanism.source.tier', 'A lineage/echo source shows resonance, not mechanism. Add a model or research source.');
    if (unverified(src.citation)) warn('evidence', 'citation_unverified', 'mechanism.source.citation', `Citation marked for verification: "${src.citation}".`);
  }
  s.moves.forEach((m, i) => {
    if (m.source?.tier === 'internal') err('evidence', 'move_internal_source', `moves[${i}].source.tier`, `Move ${i + 1} cites internal material as a source.`);
    if (m.source && unverified(m.source.citation)) warn('evidence', 'citation_unverified', `moves[${i}].source.citation`, `Citation marked for verification: "${m.source.citation}".`);
  });
  if (s.receipts.length === 0) {
    err('evidence', 'receipts_missing', 'receipts', 'At least one receipt (source card / lineage credit) is required.');
  }
  s.receipts.forEach((r, i) => {
    const p = `receipts[${i}]`;
    if (blank(r.citation)) err('evidence', 'receipt_no_citation', `${p}.citation`, `Receipt ${i + 1} has no citation.`);
    if (r.tier === 'internal') err('evidence', 'receipt_internal', `${p}.tier`, `Receipt ${i + 1} cites internal material.`);
    if (r.tier === 'contested' && r.role === 'supports') err('evidence', 'receipt_contested_support', `${p}.role`, `Receipt ${i + 1} uses a contested source as support; it may only debunk or qualify.`);
    if (r.tier === 'metaphor' && r.role === 'supports') err('evidence', 'receipt_metaphor_support', `${p}.role`, `Receipt ${i + 1} uses a metaphor as support.`);
    if (unverified(r.citation)) warn('evidence', 'citation_unverified', `${p}.citation`, `Citation marked for verification: "${r.citation}".`);
    if (blank(r.onScreen)) warn('evidence', 'receipt_no_onscreen', `${p}.onScreen`, `Receipt ${i + 1} has no on-screen card text.`);
  });

  // ── Timing ──
  const profile: TimingProfile = { ...DEFAULT_TIMING[s.variant], ...(rules.timing?.[s.variant] ?? {}) };
  const timing = estimateTiming(s, profile.wordsPerMinute);
  const byBeat = new Map(timing.beats.map((b) => [b.beat, b]));
  const total = timing.totalSeconds;
  const variantLabel = s.variant === 'short' ? 'Short' : 'Long-form';
  if (total > profile.totalMax) {
    err('timing', 'total_too_long', 'timing.total', `${variantLabel} runs ~${fmt(total)}; the maximum is ${fmt(profile.totalMax)} (${profile.wordsPerMinute} wpm).`);
  } else if (total < profile.totalMin) {
    err('timing', 'total_too_short', 'timing.total', `${variantLabel} runs ~${fmt(total)}; the minimum is ${fmt(profile.totalMin)} (${profile.wordsPerMinute} wpm).`);
  }
  const hook = byBeat.get('hook');
  if (hook && hook.seconds > profile.hookMax) {
    err('timing', 'hook_too_long', 'hook.spoken', `Hook runs ~${hook.seconds}s; the limit is ${profile.hookMax}s.`);
  }
  const lazy = byBeat.get('lazyVersion');
  if (lazy && lazy.startsAt > profile.lazyVersionStartMax) {
    warn('timing', 'lazy_version_late', 'lazyVersion', `The lazy version is named at ~${fmt(lazy.startsAt)}; aim for ≤ ${fmt(profile.lazyVersionStartMax)}.`);
  }
  const mech = byBeat.get('mechanism');
  if (mech && mech.startsAt > profile.mechanismStartMax) {
    warn('timing', 'mechanism_late', 'mechanism', `The mechanism starts at ~${fmt(mech.startsAt)}; aim for ≤ ${fmt(profile.mechanismStartMax)}.`);
  }
  s.moves.forEach((_, i) => {
    const b = byBeat.get(`move${i + 1}`);
    if (!b) return;
    if (b.seconds > profile.moveMax) warn('timing', 'move_too_long', `moves[${i}]`, `Move ${i + 1} runs ~${fmt(b.seconds)}; aim for ≤ ${fmt(profile.moveMax)}.`);
    if (b.seconds < profile.moveMin) warn('timing', 'move_too_short', `moves[${i}]`, `Move ${i + 1} runs ~${fmt(b.seconds)}; aim for ≥ ${fmt(profile.moveMin)}.`);
  });
  const cta = byBeat.get('cta');
  if (cta && cta.seconds > profile.ctaMax) {
    warn('timing', 'cta_too_long', 'cta', `CTA runs ~${cta.seconds}s; aim for ≤ ${profile.ctaMax}s.`);
  }
  for (const b of timing.beats) {
    if (b.declaredSeconds && b.seconds > 3 && Math.abs(b.declaredSeconds - b.seconds) / b.seconds > 0.5) {
      warn('timing', 'declared_mismatch', b.beat, `Declared ${b.declaredSeconds}s vs ~${b.seconds}s estimated from word count.`);
    }
  }

  // ── Language (rules injected) ──
  const fields = collectText(s);
  for (const term of rules.bannedTerms ?? []) {
    if (!term.trim()) continue;
    const re = phraseRegex(term);
    for (const f of fields) {
      if (!re.test(f.text)) continue;
      if (f.beat === 'lazyVersion') {
        warn('language', 'banned_term_debunk_target', f.path, `"${term}" appears as the debunk target (allowed in the lazy-version beat).`);
      } else {
        err('language', 'banned_term', f.path, `Banned term "${term}".`);
      }
    }
  }
  for (const entry of rules.handleWithCare ?? []) {
    const term = typeof entry === 'string' ? entry : entry.term;
    const condition = typeof entry === 'string' ? undefined : entry.condition ?? entry.rule;
    if (!term.trim()) continue;
    const re = phraseRegex(term);
    const hits = fields.filter((f) => re.test(f.text));
    if (hits.length) {
      warn('language', 'handle_with_care', hits[0].path, `"${term}" (${hits.length}×)${condition ? `: ${condition}` : ' needs care.'}`);
    }
  }
  for (const pattern of rules.outcomeTimeboxPatterns ?? []) {
    const re = toRegex(pattern);
    for (const f of fields) {
      const m = f.text.match(re);
      if (!m) continue;
      if (f.beat === 'lazyVersion') {
        warn('language', 'outcome_timebox_debunk_target', f.path, `Outcome-speed promise "${m[0]}" named as the debunk target (allowed in the lazy-version beat).`);
      } else {
        err('language', 'outcome_timebox', f.path, `Outcome-speed promise: "${m[0]}". Timebox the practice, never the outcome.`);
      }
    }
  }
  for (const pattern of rules.aiProsePatterns ?? []) {
    if (!pattern.trim()) continue;
    const re = toRegex(pattern);
    const straight = (text: string) => text.replace(/[‘’ʼ]/g, "'");
    const hits = fields.filter((f) => f.beat !== 'lazyVersion' && re.test(straight(f.text)));
    if (hits.length) {
      const m = straight(hits[0].text).match(re);
      warn('language', 'ai_prose', hits[0].path, `Reads as AI prose: "${m?.[0] ?? pattern}" (${hits.length}×). Say it plainly.`);
    }
  }
  for (const pattern of rules.ctaSpamPatterns ?? []) {
    const re = toRegex(pattern);
    for (const f of fields) {
      const m = f.text.match(re);
      if (m) err('cta', 'cta_spam_pattern', f.path, `Reads like spam/testimonial CTA: "${m[0]}".`);
    }
  }
  const mentionPatterns = rules.ctaMentionPatterns ?? DEFAULT_CTA_MENTION_PATTERNS;
  for (const pattern of mentionPatterns) {
    const re = toRegex(pattern);
    for (const f of fields) {
      if (f.beat === 'cta' || f.beat === 'title') continue;
      const m = f.text.match(re);
      if (m) err('cta', 'cta_second', f.path, `A second call to action outside the CTA beat: "${m[0]}". One CTA per script.`);
    }
  }

  // ── Score ──
  const scoreBreakdown = scoreScript(s, timing, profile, errors, warnings);
  const raw10 = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);
  const penalty = Math.min(2, warnings.length * 0.25);
  const score = Math.max(0, Math.min(10, Math.round((raw10 - penalty) * 10) / 10));

  return {
    pass: errors.length === 0,
    errors,
    warnings,
    score,
    scoreBreakdown,
    timing,
    script: s,
    schemaVersion: VIDEO_SCRIPT_SCHEMA_VERSION,
  };
}

/**
 * Automatic quality rubric (0–10). Mirrors the human rubric's dimensions:
 * hook 1 · lazy version 1 · mechanism 2 · moves 3 · receipts 1 · CTA 1 · production 1.
 * Warnings subtract 0.25 each (max 2) in the caller.
 */
function scoreScript(
  s: VideoScript,
  timing: { beats: BeatTiming[] },
  profile: TimingProfile,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): Record<string, number> {
  const has = (code: string) => errors.some((e) => e.code === code) || warnings.some((w) => w.code === code);
  const hookBeat = timing.beats.find((b) => b.beat === 'hook');
  const hook =
    hookBeat && hookBeat.seconds <= profile.hookMax && /\byou(r|'re|’re)?\b/i.test(s.hook.spoken) ? 1 : hookBeat && hookBeat.seconds <= profile.hookMax ? 0.5 : 0;
  const lazy = s.lazyVersion.name.trim() && s.lazyVersion.spoken.trim() ? (has('lazy_version_late') ? 0.5 : 1) : 0;

  const tierPoints: Record<EvidenceTier, number> = {
    established: 2,
    supported: 2,
    model: 2,
    lineage: 1,
    contested: 0,
    metaphor: 0,
    internal: 0,
  };
  let mechanism = s.mechanism.source && s.mechanism.source.citation.trim() ? tierPoints[s.mechanism.source.tier] : 0;
  if (!s.mechanism.name.trim() || !s.mechanism.claim.trim()) mechanism = Math.min(mechanism, 1);

  const moves = Math.min(3, s.moves.slice(0, 3).filter((m) => isConcreteExercise(m.exercise) && m.name.trim()).length) - (s.moves.length !== 3 ? 1 : 0);

  const receipts = s.receipts.some((r) => r.citation.trim() && r.onScreen?.trim() && r.tier !== 'internal') ? 1 : s.receipts.length ? 0.5 : 0;

  const ctaErr = errors.some((e) => e.category === 'cta');
  const cta = ctaErr ? 0 : has('cta_too_long') ? 0.5 : 1;

  const beatsWithCues = [s.hook, s.lazyVersion, s.mechanism, ...s.moves, s.cta];
  const cued = beatsWithCues.filter((b) => b.onScreenText.length > 0 || b.bRoll.length > 0).length;
  const production = cued / beatsWithCues.length >= 0.7 ? 1 : cued / beatsWithCues.length >= 0.4 ? 0.5 : 0;

  return { hook, lazyVersion: lazy, mechanism, moves: Math.max(0, moves), receipts, cta, production };
}

// ─── Rendering ─────────────────────────────────────────────────────────────

/** Human-readable shooting script (markdown) for storage / review. */
export function renderVideoScript(s: VideoScript, validation?: Pick<VideoScriptValidation, 'timing'>): string {
  const t = validation?.timing.beats ?? [];
  const at = (beat: string) => {
    const b = t.find((x) => x.beat === beat);
    return b ? ` (${fmt(b.startsAt)}, ~${fmt(b.seconds)})` : '';
  };
  const cues = (b: { onScreenText: string[]; bRoll: string[] }) =>
    [
      ...b.onScreenText.map((x) => `> ON SCREEN: ${x}`),
      ...b.bRoll.map((x) => `> B-ROLL: ${x}`),
    ].join('\n');
  const block = (heading: string, beat: string, spoken: string, b: { onScreenText: string[]; bRoll: string[] }) =>
    [`## ${heading}${at(beat)}`, spoken.trim(), cues(b)].filter(Boolean).join('\n\n');

  const parts: string[] = [
    `# ${s.title}`,
    `_${s.variant === 'short' ? 'Short (≤60s)' : 'Long-form'} · ${s.tags.rite} / ${s.tags.pillar} / ${s.tags.domain}_`,
  ];
  if (s.titleOptions?.length) parts.push(`Title options:\n${s.titleOptions.map((x) => `- ${x}`).join('\n')}`);
  if (s.thumbnailText) parts.push(`Thumbnail: ${s.thumbnailText}`);
  parts.push(block('Hook', 'hook', s.hook.spoken, s.hook));
  parts.push(block(`Popular version: ${s.lazyVersion.name}`, 'lazyVersion', s.lazyVersion.spoken, s.lazyVersion));
  if (s.credibility) parts.push(block('Credibility', 'credibility', s.credibility.spoken, s.credibility));
  parts.push(
    block(`Mechanism: ${s.mechanism.name}`, 'mechanism', s.mechanism.spoken, s.mechanism) +
      (s.mechanism.source ? `\n\n> RECEIPT: ${s.mechanism.source.citation} · ${s.mechanism.source.tier}` : ''),
  );
  s.moves.forEach((m, i) => {
    parts.push(
      [
        `## Move ${i + 1}: ${m.name.replace(/^\s*\d+[.):]\s*/, '')}${at(`move${i + 1}`)}`,
        m.explanation.trim(),
        m.exercise ? `**Exercise:** ${m.exercise.trim()}` : '',
        cues(m),
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  });
  if (s.caveat) parts.push(block('Caveat', 'caveat', s.caveat.spoken, s.caveat));
  if (s.synthesis) parts.push(block('Synthesis', 'synthesis', s.synthesis.spoken, s.synthesis));
  parts.push(block(`CTA (${s.cta.kind})`, 'cta', s.cta.spoken, s.cta));
  if (s.receipts.length) {
    parts.push(
      `## Sources\n${s.receipts.map((r) => `- ${r.citation} · ${r.tier}${r.role !== 'supports' ? ` · ${r.role}` : ''}: ${r.claim}`).join('\n')}`,
    );
  }
  return parts.join('\n\n');
}
