/**
 * The Perception Read: the mirror paragraph, the only AI block (spec v3 §8 block 3, §9; v1 §6.3).
 *
 * SERVER-ONLY. Imports the OpenAI client (API key) and keeps the system prompt on the server.
 * Never import this from a client component; results.ts loads it lazily inside buildResult.
 *
 * Flow: pick the person's quotable phrases (free text below safety tier 2) → one model call
 * (12s budget, one retry if time allows) → verify in code → else a static per-pattern fallback.
 * Verification: at least two quotes, each verbatim from their answers; every quote is theirs;
 * 60-130 words; no "?"; no em-dash; no banned word (Read list + voice-pack banned terms and
 * AI-prose patterns). Tier-1 and tier-2 text is never sent to the model.
 */
import { openai } from '@/lib/openai/client';
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

export const MIRROR_SYSTEM_PROMPT = `You write one short paragraph for a free reflection tool called the Perception Read. You mirror a person's own answers back to them so they feel accurately read. You are not a coach and you don't give advice.

Rules, all required:
1. Quote at least two phrases from the person's own words exactly as written, in straight double quotes. Copy them character for character. Only quote text listed under "Their words". Never put anything else in double quotes.
2. Describe what they did and said. Never what they are. No labels, no types, no archetypes, no pattern names.
3. Write to them as "you". No questions. No advice, tips or next steps. No outcomes, promises or timelines.
4. Never mention a birth chart, astrology, Human Design or any sign or type. Never use these words: quantum, frequency, vibration, energy, universe, manifest, alignment, abundance.
5. Never name or hint at a health condition or a diagnosis. No clinical or therapy words.
6. Plain sentences of 8 to 20 words. No em-dashes. No "it's not X, it's Y". No lists of three for rhythm. No exclamation marks.
7. Between 70 and 110 words, one paragraph, plain text.
8. If there isn't enough in their words to quote two phrases, reply with exactly: INSUFFICIENT

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

/** The user message: their tapped answers as labels, their words as quotable text. No chart, ever. */
export function buildUserMessage(input: MirrorParagraphInput, quotable: Record<string, string>): string {
  const { answers, pattern } = input;
  const lines: string[] = [];
  const own = wantOrShouldOf(answers);
  const hours = q7HoursTag(answers);
  const tapped: [string, string[]][] = [
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
  lines.push('Their tapped answers (paraphrase these, never quote them):');
  for (const [k, v] of tapped) if (v.length) lines.push(`- ${k}: ${v.join('; ')}`);
  lines.push('', 'Their words (quote at least two of these exactly):');
  for (const [k, v] of Object.entries(quotable)) lines.push(`- ${FIELD_LABELS[k] ?? 'Their words'}: ${v}`);
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

export interface Verification {
  ok: boolean;
  failures: string[];
}

/** Every check in code; any failure means the static fallback is used. */
export function verifyMirrorParagraph(text: string, quotable: string[]): Verification {
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
  if (verified.size < 2) failures.push(`verified quotes ${verified.size} of 2`);

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
      openai.chat.completions.create(
        {
          model: model(),
          messages: [
            { role: 'system', content: MIRROR_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          max_completion_tokens: 400,
        },
        { signal: controller.signal, timeout: timeoutMs, maxRetries: 0 },
      ),
      timeout,
    ]);
    return completion.choices?.[0]?.message?.content?.trim() ?? '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The mirror paragraph. Never throws. Crisis tier, too little to quote, an API error, a timeout
 * or any failed check returns the static fallback with usedFallback true.
 */
export async function writeMirrorParagraph(
  input: MirrorParagraphInput,
  opts: { timeoutMs?: number } = {},
): Promise<MirrorParagraphResult> {
  const budget = opts.timeoutMs ?? PARAGRAPH_TIMEOUT_MS;
  const fallback = (): MirrorParagraphResult => ({ text: staticMirrorParagraph(input.pattern, input.answers), usedFallback: true });
  if (input.safety.tier === 'crisis') return { text: '', usedFallback: true };

  const quotable = quotablePhrases(input.answers);
  const quotableList = Object.values(quotable);
  if (quotableList.length < 2 && !quotableList.some((q) => q.split(/[.!?\n]/).filter((s) => s.trim()).length >= 2)) return fallback();

  const userMessage = buildUserMessage(input, quotable);
  const started = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = budget - (Date.now() - started);
    if (attempt > 0 && remaining < Math.min(RETRY_MIN_REMAINING_MS, budget / 3)) break;
    try {
      const text = await callModel(userMessage, remaining);
      const check = verifyMirrorParagraph(text, quotableList);
      if (check.ok) return { text, usedFallback: false };
      console.warn('[read/paragraph] verification failed:', check.failures.join('; '));
    } catch (err) {
      console.warn('[read/paragraph] model call failed:', err instanceof Error ? err.message : 'unknown error');
      break;
    }
  }
  return fallback();
}
