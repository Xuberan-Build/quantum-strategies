/**
 * The Perception Read: the mirror paragraph, the only AI block (spec v3 §8 block 3, §9; v1 §6.3).
 *
 * SERVER-ONLY. Calls the AI layer (Claude via workload identity) and keeps the system prompt on the server.
 * Never import this from a client component; results.ts loads it lazily inside buildResult.
 *
 * Flow: pick the person's quotable phrases (free text below safety tier 2) → one model call that
 * returns JSON (the paragraph plus the exact spans it quotes; 12s budget, one retry if time allows)
 * → verify in code → else a static per-pattern fallback. The model gets two separate inputs: the
 * person's own typed words (quotable) and their tapped option labels (paraphrase only).
 * Verification: the number of verbatim quotes the free text allows (two, or one when it is thin);
 * every quote is theirs; the quotes listed match the quoted spans; no option-label wording; 60-130
 * words; no "?"; no em-dash; no banned word (Read list + voice-pack banned terms and AI-prose patterns).
 * Tier-1 and tier-2 text is never sent to the model.
 */
import { generateText } from '@/lib/ai/generate';
import { FALLBACK_VOICE_PACK, findAiProse, findBannedTerms, normaliseQuotes } from '@/lib/content/voice-pack';
import { HOURS_BANDS, choiceOf, optionLabel, partString } from './questions';
import { q7HoursTag, wantOrShouldOf } from './mirror';
import { PATTERNS } from './results';
import { isUsableText, screenFields, screenText, textFields } from './safety';
import type { PatternId, ReadAnswers, ReadUtm, SafetyResult } from './types';

export const PARAGRAPH_TIMEOUT_MS = 12_000;
export const PARAGRAPH_MIN_WORDS = 60;
export const PARAGRAPH_MAX_WORDS = 130;
const RETRY_MIN_REMAINING_MS = 4_000;

/** Free-text fields the paragraph may quote (spec v1 §6.3 rule 1, widened to Q2 other and Q7 thing). */
const QUOTABLE_PREFIXES = ['q2.text', 'q6.text', 'q7.thing', 'q8.', 'q9.text'];

/**
 * Words the paragraph may not contain (spec v3 §8.2 validator + §3.6 + naming N5/N6 + "no type labels").
 * Clinical words are checked on the whole text, quotes included. The rest are checked outside quotes,
 * so a person's own "I have no energy" can still be quoted back.
 */
export const READ_PARAGRAPH_BANNED = {
  clinical: [
    '/\\btrauma/', 'adhd', '/\\bdepress/', 'anxiety', 'panic attack', 'ptsd', 'bipolar', 'disorder', '/\\bdiagnos/',
    'nervous system', 'burnout', 'syndrome', '/\\bcodependen/', 'mental illness', 'mental health', 'clinical',
  ],
  woo: [
    'quantum', '/\\bfrequenc/', '/\\bvibrat/', '/\\bvibes?\\b/', '/\\benerg(?:y|ies|etic)\\b/', 'universe', '/\\bmanifest/',
    'cosmic', '/\\b(?:mis)?align(?:ed|ment)?\\b/', 'abundance', 'law of attraction', 'the field',
  ],
  chart: [
    '/\\bcharts?\\b/', '/\\bastrolog/', 'human design', 'zodiac', 'star sign', 'horoscope', 'natal', 'sun sign', 'moon sign',
    'rising sign', '/\\bmanifestors?\\b/', '/\\bprojectors?\\b/', '/\\bgenerators?\\b/', '/\\breflectors?\\b/',
  ],
  typeLabels: [
    'archetype', 'personality type', 'your type', 'scanner', 'multipotentialite', 'people pleaser', 'people-pleaser',
    'perfectionist', 'procrastinator', 'empath', 'introvert', 'extrovert',
    ...Object.values(PATTERNS).map((p) => p.name.toLowerCase()),
  ],
};

export const MIRROR_SYSTEM_PROMPT = `You write one short paragraph for a free reflection tool called the Perception Read. You reflect a person's own answers back to them so they feel accurately read. You are not a coach, and you give no advice.

The user message has two separate inputs. Treat them differently.
- "Their own words": text the person typed. You may quote from these, and only these.
- "Their picks": labels for options the person tapped. These are our wording, not theirs. Never quote them and never copy their wording. Say what the pick means in your own words.

Rules, all required:
1. Quote exactly the number of phrases the user message asks for. Each quote is copied character for character from one item under "Their own words", in straight double quotes in the paragraph. A quote is at least two words, or the whole item.
2. Put nothing in double quotes except those quotes. Never quote a pick, and never reuse a pick's wording, quoted or not. Say the same idea in fresh words.
3. Describe what they did and said. Never what they are. No labels, types, archetypes or pattern names.
4. Write to them as "you". No questions. No advice, tips or next steps. No outcomes, promises or timelines.
5. Never mention a birth chart, astrology, Human Design or any sign or type. Never use these words: quantum, frequency, vibration, energy, universe, manifest, alignment, abundance.
6. Never name or hint at a health condition or a diagnosis. No clinical or therapy words.
7. Plain sentences of 8 to 20 words. No em-dashes. No "it's not X, it's Y". No lists of three for rhythm. No exclamation marks.
8. 70 to 110 words, one paragraph.
9. Reply with JSON only, in this shape: {"paragraph": "...", "quotes": ["...", "..."]}. "quotes" lists every phrase quoted in the paragraph, exactly as it appears between the quote marks.
10. If "Their own words" has nothing to quote, reply {"paragraph": "INSUFFICIENT", "quotes": []}.

Voice: an operator reporting what he saw in their answers. Direct, plain, kind. Concrete beats clever.`;

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface MirrorParagraphInput {
  answers: ReadAnswers;
  pattern: PatternId;
  safety: SafetyResult;
  utm?: ReadUtm;
}

export interface MirrorParagraphResult {
  text: string;
  usedFallback: boolean;
}

/** The person's free text that's safe to send and to quote (below tier 2), keyed by field. */
export function quotablePhrases(answers: ReadAnswers): Record<string, string> {
  const fields = textFields(answers);
  const screens = screenFields(answers);
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(fields)) {
    if (!QUOTABLE_PREFIXES.some((p) => key === p || key.startsWith(p))) continue;
    if (!isUsableText(screens[key])) continue;
    out[key] = text.trim();
  }
  return out;
}

const FIELD_LABELS: Record<string, string> = {
  'q2.text': 'Something they say',
  'q6.text': 'A skill people come to them for',
  'q7.thing': 'The thing they keep meaning to get to',
  'q8.line1': "I'm the one who… (about work and plans this month)",
  'q8.line2': "I'm the one who… (about work and plans this month)",
  'q8.line3': "I'm the one who… (about work and plans this month)",
  'q8.text': "I'm the one who… (one per line, about work and plans this month)",
  'q9.text': 'Something they said about their work or plans this week',
};

function labels(values: string[]): string[] {
  return values.map((v) => optionLabel(v)).filter((x): x is string => !!x);
}

/** The person's tapped answers as labels. Our wording: the model paraphrases these and never quotes them. */
function tappedLines(answers: ReadAnswers): [string, string[]][] {
  const own = wantOrShouldOf(answers);
  const hours = q7HoursTag(answers);
  return [
    ['Their week right now', labels(choiceOf(answers, 'q1'))],
    ['Things they have said in the last month', labels(choiceOf(answers, 'q2').filter((t) => t !== 'say:other'))],
    ['When asked a favour on a full day', labels(choiceOf(answers, 'q3'))],
    ['Why their last plan stalled', labels(choiceOf(answers, 'q4'))],
    ['How they described their work', labels(choiceOf(answers, 'q5'))],
    ['What people come to them for', labels(choiceOf(answers, 'q6').filter((t) => t !== 'come:skill'))],
    ['Hours the thing got last week', hours ? [HOURS_BANDS[hours].label] : []],
    ['What got the hours instead', labels([partString(answers, 'q7', 'instead') ?? ''].filter(Boolean))],
    ['Want or supposed to', own ? [own === 'should' ? 'supposed to want' : own === 'unsure' ? 'not sure' : 'want'] : []],
  ];
}

/** Every option label the person tapped, for the wording check in verification. */
export function tappedLabels(answers: ReadAnswers): string[] {
  return tappedLines(answers).flatMap(([, v]) => v);
}

/**
 * How many verbatim quotes the paragraph must carry. Two when the free text allows two quotes
 * (two usable answers, or one answer with two clauses); one when it is thin; zero means no usable text.
 */
export function requiredQuotes(quotable: Record<string, string>): number {
  const fields = Object.values(quotable).filter((t) => wordCount(t) >= 2);
  if (fields.length >= 2) return 2;
  if (fields.length === 1 && fields[0].split(/[.!?\n]/).filter((c) => wordCount(c) >= 2).length >= 2) return 2;
  return fields.length ? 1 : 0;
}

/**
 * The user message. Two separate inputs: their own words (quotable, copied exactly) and their picks
 * (labels to paraphrase). No chart, ever.
 */
export function buildUserMessage(input: MirrorParagraphInput, quotable: Record<string, string>, required = requiredQuotes(quotable)): string {
  const { answers, pattern } = input;
  const lines: string[] = [];
  lines.push(`Quotes required: exactly ${required}, taken from "Their own words" only.`, '');
  lines.push('Their own words (you may quote from these, copied exactly):');
  const words = Object.entries(quotable);
  if (!words.length) lines.push('- (nothing typed)');
  for (const [k, v] of words) lines.push(`- ${FIELD_LABELS[k] ?? 'Their words'}: ${v}`);
  lines.push(
    '',
    'Their picks (our labels for what they tapped. These are not their words: paraphrase the idea, never quote or copy the wording):',
  );
  for (const [k, v] of tappedLines(answers)) if (v.length) lines.push(`- ${k}: ${v.join('; ')}`);
  lines.push('', `What their answers point to, for your focus only (don't name it): ${PATTERNS[pattern].read}`);
  return lines.join('\n');
}

// ── Verification ────────────────────────────────────────────────────────────

function normForMatch(text: string): string {
  return normaliseQuotes(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function trimQuote(q: string): string {
  return q.trim().replace(/^[\s'"]+|[\s'".,!;:…]+$/g, '');
}

export function extractQuotes(text: string): string[] {
  const out: string[] = [];
  const re = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  const t = normaliseQuotes(text);
  while ((m = re.exec(t))) out.push(m[1]);
  return out;
}

function stripQuotes(text: string): string {
  return normaliseQuotes(text).replace(/"[^"]*"/g, ' ');
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Lower-case words: letters, digits and apostrophes. Used for the label-wording check. */
function tokens(text: string): string[] {
  return normaliseQuotes(text).toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim().split(' ').filter(Boolean);
}

/** Runs of six words from a label. Shorter runs are ordinary phrases that free text also uses. */
const RUN_WORDS = 6;
function wordRuns(words: string[]): string[] {
  return Array.from({ length: Math.max(0, words.length - RUN_WORDS + 1) }, (_, i) => words.slice(i, i + RUN_WORDS).join(' '));
}

/**
 * Option-label wording in the paragraph, quoted or not. A pick may be paraphrased, never copied:
 * any six-word run from a label fails, unless the person's own words contain that run too.
 * (Quoted label text is caught earlier, by the quote check.)
 */
export function labelWordingLeaks(text: string, labels: string[], freeText: string[]): string[] {
  const hay = ` ${tokens(text).join(' ')} `;
  const own = new Set(freeText.flatMap((f) => wordRuns(tokens(f))));
  const hits = new Set<string>();
  for (const label of labels) {
    for (const run of wordRuns(tokens(label))) {
      if (own.has(run)) continue;
      if (hay.includes(` ${run} `)) hits.add(run);
    }
  }
  return [...hits];
}

export interface Verification {
  ok: boolean;
  failures: string[];
}

export interface VerifyOptions {
  /** Verbatim quotes the paragraph must carry from the person's own words. Default 2. */
  required?: number;
  /** The person's option labels. Their wording may not appear in the paragraph. */
  labels?: string[];
  /** The quotes the model listed in its reply. Must match the quoted spans in the paragraph exactly. */
  listed?: string[];
}

export interface MirrorReply {
  paragraph: string;
  quotes: string[];
}

/** Parse the model's JSON reply. Null when it is not the expected shape. */
export function parseMirrorReply(raw: string): MirrorReply | null {
  const body = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const o = JSON.parse(body) as unknown;
    if (!o || typeof o !== 'object') return null;
    const { paragraph, quotes } = o as Record<string, unknown>;
    if (typeof paragraph !== 'string' || !Array.isArray(quotes) || !quotes.every((q) => typeof q === 'string')) return null;
    return { paragraph: paragraph.trim(), quotes: quotes as string[] };
  } catch {
    return null;
  }
}

/** Every check in code; any failure means the static fallback is used. */
export function verifyMirrorParagraph(text: string, quotable: string[], opts: VerifyOptions = {}): Verification {
  const required = opts.required ?? 2;
  const failures: string[] = [];
  const t = text.trim();
  if (!t || /^insufficient\b/i.test(t)) return { ok: false, failures: ['insufficient'] };

  const words = wordCount(t);
  if (words < PARAGRAPH_MIN_WORDS || words > PARAGRAPH_MAX_WORDS) failures.push(`length ${words} words`);
  if (t.includes('?')) failures.push('question mark');
  if (t.includes('—')) failures.push('em-dash');
  if (t.includes('!')) failures.push('exclamation mark');

  const sources = quotable.map(normForMatch);
  const quotes = extractQuotes(t).map(trimQuote).filter(Boolean);
  const verified = new Set<string>();
  for (const q of quotes) {
    const nq = normForMatch(q);
    const found = sources.find((s) => s.includes(nq));
    const wholeAnswer = sources.some((s) => trimQuote(s) === nq);
    if (!found) failures.push(`quote not in answers: ${q.slice(0, 40)}`);
    else if (nq.split(' ').length < 2 && !wholeAnswer) failures.push(`quote too short: ${q.slice(0, 40)}`);
    else verified.add(nq);
  }
  if (verified.size < required) failures.push(`verified quotes ${verified.size} of ${required}`);

  if (opts.listed) {
    const inline = new Set(quotes.map(normForMatch));
    const listed = new Set(opts.listed.map((q) => normForMatch(trimQuote(q))).filter(Boolean));
    for (const q of listed) if (!inline.has(q)) failures.push(`listed quote not in paragraph: ${q.slice(0, 40)}`);
    for (const q of inline) if (!listed.has(q)) failures.push(`unlisted quote: ${q.slice(0, 40)}`);
  }

  for (const leak of labelWordingLeaks(t, opts.labels ?? [], quotable)) failures.push(`option label wording: ${leak}`);

  const outside = stripQuotes(t);
  const hit = (patterns: string[], hay: string) => findBannedTerms(hay, { bannedTerms: patterns }).map((m) => m.pattern);
  const clinical = hit(READ_PARAGRAPH_BANNED.clinical, t);
  const rest = hit([...READ_PARAGRAPH_BANNED.woo, ...READ_PARAGRAPH_BANNED.chart, ...READ_PARAGRAPH_BANNED.typeLabels], outside);
  const voice = findBannedTerms(outside, FALLBACK_VOICE_PACK).map((m) => m.pattern);
  const prose = findAiProse(outside, FALLBACK_VOICE_PACK).map((m) => m.pattern);
  for (const b of [...clinical, ...rest, ...voice]) failures.push(`banned: ${b}`);
  if (prose.length) failures.push(`ai prose: ${prose.length}`);
  // A clinical answer must never reach the page, even if a quote check missed it.
  if (!isUsableText(screenText(t))) failures.push('safety screen on output');

  return { ok: failures.length === 0, failures };
}

// ── Static fallback ─────────────────────────────────────────────────────────

const COME_PHRASES: Record<string, string> = {
  'come:fix': 'fixing a problem',
  'come:ideas': 'ideas',
  'come:support': 'a listening ear',
  'come:execute': 'getting something done',
  'come:strategy': 'advice on what to do next',
  'come:connect': 'an introduction to someone',
};

function clean(text: string): string {
  return text.trim().replace(/^["“'‘]+|["”'’]+$/g, '').replace(/[.]+$/, '');
}

/** The per-pattern static paragraph with slots. Only text below tier 2 goes in a slot. */
export function staticMirrorParagraph(pattern: PatternId, answers: ReadAnswers): string {
  const quotable = quotablePhrases(answers);
  const sentences: string[] = [];

  const come = choiceOf(answers, 'q6')
    .map((t) => (t === 'come:skill' ? (quotable['q6.text'] ? clean(quotable['q6.text']) : 'a specific skill of yours') : COME_PHRASES[t]))
    .filter(Boolean);
  if (come.length) sentences.push(`You told us people come to you for ${come.join(' and ')}.`);

  const line1 = quotable['q8.line1'] ?? quotable['q8.text']?.split(/\r?\n/)[0];
  if (line1) sentences.push(`You said you're the one who "${clean(line1)}".`);

  const thing = quotable['q7.thing'];
  const hours = q7HoursTag(answers);
  if (thing && hours) sentences.push(`You keep meaning to get to "${clean(thing)}", and last week it got ${HOURS_BANDS[hours].label}.`);
  else if (thing) sentences.push(`You keep meaning to get to "${clean(thing)}".`);

  if (quotable['q9.text']) sentences.push(`This week you said "${clean(quotable['q9.text'])}".`);

  sentences.push(PATTERNS[pattern].fallbackClose);
  return sentences.join(' ');
}

// ── The call ────────────────────────────────────────────────────────────────

function model(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

/** The reply shape: the paragraph and the exact spans it quotes, so code can check them before render. */
/** Strict JSON schema: Claude structured outputs (OpenAI json_schema on the rollback path). */
const MIRROR_RESPONSE_FORMAT = {
  name: 'mirror_paragraph',
  schema: {
    type: 'object',
    properties: {
      paragraph: { type: 'string' },
      quotes: { type: 'array', items: { type: 'string' } },
    },
    required: ['paragraph', 'quotes'],
    additionalProperties: false,
  },
};

async function callModel(userMessage: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('mirror paragraph timed out'));
    }, timeoutMs);
  });
  try {
    const completion = await Promise.race([
      generateText({
        tier: 'standard',
        openaiModel: model(),
        system: MIRROR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        json: MIRROR_RESPONSE_FORMAT,
        maxTokens: 1000,
        signal: controller.signal,
        timeoutMs,
        maxRetries: 0,
      }),
      timeout,
    ]);
    return completion.text?.trim() ?? '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface MirrorOptions {
  timeoutMs?: number;
  /** Model attempts before the fallback. Production uses two; the measurement uses one. */
  attempts?: number;
}

/**
 * The mirror paragraph. Never throws. Crisis tier, no usable free text, an INSUFFICIENT reply, an
 * API error, a timeout or any failed check returns the static fallback with usedFallback true.
 */
export async function writeMirrorParagraph(input: MirrorParagraphInput, opts: MirrorOptions = {}): Promise<MirrorParagraphResult> {
  const budget = opts.timeoutMs ?? PARAGRAPH_TIMEOUT_MS;
  const attempts = opts.attempts ?? 2;
  const fallback = (): MirrorParagraphResult => ({ text: staticMirrorParagraph(input.pattern, input.answers), usedFallback: true });
  if (input.safety.tier === 'crisis') return { text: '', usedFallback: true };

  const quotable = quotablePhrases(input.answers);
  const sources = Object.values(quotable);
  const required = requiredQuotes(quotable);
  if (required === 0) return fallback();

  const userMessage = buildUserMessage(input, quotable, required);
  const labelsTapped = tappedLabels(input.answers);
  const started = Date.now();
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = budget - (Date.now() - started);
    if (attempt > 0 && remaining < Math.min(RETRY_MIN_REMAINING_MS, budget / 3)) break;
    try {
      const reply = parseMirrorReply(await callModel(userMessage, remaining));
      if (!reply) {
        console.warn('[read/paragraph] reply was not the expected JSON');
        continue;
      }
      if (/^insufficient\b/i.test(reply.paragraph)) break;
      const check = verifyMirrorParagraph(reply.paragraph, sources, { required, labels: labelsTapped, listed: reply.quotes });
      if (check.ok) return { text: reply.paragraph, usedFallback: false };
      console.warn('[read/paragraph] verification failed:', check.failures.join('; '));
    } catch (err) {
      console.warn('[read/paragraph] model call failed:', err instanceof Error ? err.message : 'unknown error');
      break;
    }
  }
  return fallback();
}
