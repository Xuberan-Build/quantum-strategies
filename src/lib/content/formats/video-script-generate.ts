import {
  validateVideoScript,
  DEFAULT_TIMING,
  type VideoScriptRules,
  type VideoScriptValidation,
  type VideoVariant,
} from './video-script';

/**
 * Generate → validate → (one) repair loop for video scripts.
 *
 * Model-agnostic: the caller injects `complete(system, user) => text`. Brand voice comes
 * in through `voiceGuide` (from the voice pack); this file carries only the format spec.
 */

export interface VideoScriptBrief {
  title: string;
  angle?: string | null;
  audience?: string | null;
  goal?: string | null;
  /** Taxonomy hints for the tags block. */
  rite?: string | null;
  pillar?: string | null;
  domain?: string | null;
  /** Source material: section drafts, research notes. */
  material?: string;
  /** Retrieved passages with their citations. */
  sources?: string;
  /** CTA destination hint, e.g. "free quiz" or a product name. */
  ctaTarget?: string | null;
}

export type CompleteFn = (system: string, user: string) => Promise<string>;

export interface GenerateVideoScriptOptions {
  variant: VideoVariant;
  brief: VideoScriptBrief;
  rules: VideoScriptRules;
  complete: CompleteFn;
  /** Voice/brand system prompt from the voice pack. */
  voiceGuide?: string;
  /** Repair passes after the first attempt. Default 1. */
  maxRepairs?: number;
}

export interface GenerateVideoScriptResult {
  /** Parsed JSON of the last attempt (null if the model never returned JSON). */
  raw: unknown;
  validation: VideoScriptValidation;
  attempts: number;
  history: Array<{ attempt: number; pass: boolean; errorCodes: string[]; score: number }>;
}

/** Pull a JSON object out of model output (handles code fences and leading prose). */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function videoScriptFormatSpec(variant: VideoVariant, rules: VideoScriptRules): string {
  const t = { ...DEFAULT_TIMING[variant], ...(rules.timing?.[variant] ?? {}) };
  const runtime =
    variant === 'long'
      ? `${t.totalMin / 60}–${t.totalMax / 60} minutes at ${t.wordsPerMinute} words per minute (about ${Math.round((t.totalMin / 60) * t.wordsPerMinute)}–${Math.round((t.totalMax / 60) * t.wordsPerMinute)} spoken words including pauses)`
      : `at most ${t.totalMax} seconds at ${t.wordsPerMinute} words per minute (about ${Math.round((t.totalMax / 60) * t.wordsPerMinute) - 15} spoken words total)`;

  const lines = [
    `FORMAT: video script, ${variant === 'long' ? 'long-form' : 'short (vertical, ≤60s)'} variant. Runtime ${runtime}.`,
    '',
    'BEATS, in spoken order:',
    `1. hook: ≤${t.hookMax}s, second person, names the viewer's situation or the popular advice. No intro, no channel plug.`,
    `2. lazyVersion: name the popular version of the idea the viewer was sold ("name"), and say kindly why it keeps failing. Attack the idea, never a person or the viewer. Named by ~${t.lazyVersionStartMax}s.`,
    '3. credibility (optional): first-person lived experience, honest, no invented facts.',
    `4. mechanism: "name" (a short handle), "claim" (one sentence), "spoken" (the explanation as a cause→effect chain) and "source" { "citation": "Author (Year) · Work/Venue", "tier" }. Starts by ~${Math.round(t.mechanismStartMax / 60 * 10) / 10} min.`,
    `5. moves: EXACTLY 3, numbered and named. Each has "name", "explanation" (spoken) and "exercise" (spoken, concrete, doable now: include a number, a duration or "now"; at least 8 words). ${variant === 'long' ? `Each move ${t.moveMin / 60}–${t.moveMax / 60} min.` : `Each move ${t.moveMin}–${t.moveMax}s.`} Use "pauseSeconds" for honest do-it-now pauses.`,
    '6. caveat (optional): what this does not prove; a practice timebox, never an outcome promise.',
    '7. synthesis (optional): one landing line.',
    `8. cta: EXACTLY ONE call to action, ≤${t.ctaMax}s, "kind" "quiz" or "rite". Say what it measures, roughly how long it takes, what you get, that it is free (if it is) and that it asks only for an email. Never mention the CTA anywhere else in the script.`,
    '',
    'EVIDENCE: tiers are established | supported | contested | model | lineage | metaphor | internal.',
    '- Never cite the publisher\'s own material ("internal") as a source. A metaphor or contested finding cannot support the mechanism; a contested source may appear in receipts with "role": "debunks" or "qualifies".',
    '- Only cite sources given in SOURCES or ones you are certain exist. If unsure of any detail, append " — VERIFY" to the citation.',
    '- "receipts": at least one on-screen source card: { "claim", "citation", "tier", "role", "onScreen": "Receipt · Author (Year) · what it found · tier" }.',
    '',
    'PRODUCTION: give nearly every beat "onScreenText" (array of strings) and "bRoll" (array of strings). Optionally "estimatedSeconds".',
    '',
    'LANGUAGE: no promises about how fast an outcome arrives (timebox the practice, never the result). Label every metaphor as a metaphor.',
  ];
  if (rules.bannedTerms.length) {
    lines.push(`Never use these phrases: ${rules.bannedTerms.map((b) => `"${b}"`).join(', ')}.`);
  }
  if (rules.handleWithCare?.length) {
    lines.push(
      `Use with care (only under the stated condition): ${rules.handleWithCare
        .map((c) => (typeof c === 'string' ? `"${c}"` : `"${c.term}"${c.condition ? ` (${c.condition})` : ''}`))
        .join('; ')}.`,
    );
  }
  lines.push(
    '',
    'OUTPUT: one JSON object, no prose, with keys: variant, title, titleOptions (3), thumbnailText, hook, lazyVersion, credibility, mechanism, moves, receipts, caveat, synthesis, cta, tags { rite, pillar, domain }. Beats are objects with "spoken", "onScreenText", "bRoll".',
  );
  return lines.join('\n');
}

function briefBlock(brief: VideoScriptBrief, variant: VideoVariant): string {
  return [
    `ANGLE TITLE: ${brief.title}`,
    `VARIANT: ${variant}`,
    brief.angle ? `ANGLE: ${brief.angle}` : '',
    brief.audience ? `AUDIENCE: ${brief.audience}` : '',
    brief.goal ? `GOAL: ${brief.goal}` : '',
    `TAGS: rite=${brief.rite ?? 'unknown'} pillar=${brief.pillar ?? 'unknown'} domain=${brief.domain ?? 'unknown'}`,
    brief.ctaTarget ? `CTA DESTINATION: ${brief.ctaTarget}` : '',
    brief.material ? `\nMATERIAL:\n${brief.material}` : '',
    brief.sources ? `\nSOURCES:\n${brief.sources}` : '\nSOURCES: none linked. Cite only sources you are certain of, marked " — VERIFY".',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateValidatedVideoScript(opts: GenerateVideoScriptOptions): Promise<GenerateVideoScriptResult> {
  const { variant, brief, rules, complete, voiceGuide } = opts;
  const maxRepairs = opts.maxRepairs ?? 1;
  const system = [voiceGuide?.trim(), videoScriptFormatSpec(variant, rules)].filter(Boolean).join('\n\n---\n\n');
  const history: GenerateVideoScriptResult['history'] = [];

  let user = `Write the script.\n\n${briefBlock(brief, variant)}`;
  let raw: unknown = null;
  let validation: VideoScriptValidation | null = null;
  let attempts = 0;

  for (let i = 0; i <= maxRepairs; i++) {
    attempts++;
    const text = await complete(system, user);
    raw = extractJson(text);
    validation = raw
      ? validateVideoScript(raw, rules)
      : validateVideoScript({}, rules); // yields schema errors
    if (!raw) {
      validation.errors.unshift({ category: 'schema', code: 'not_json', path: '(root)', message: 'The output was not a JSON object.' });
    }
    history.push({ attempt: attempts, pass: validation.pass, errorCodes: validation.errors.map((e) => e.code), score: validation.score });
    if (validation.pass || i === maxRepairs) break;

    const problems = validation.errors.map((e) => `- [${e.code}] ${e.path}: ${e.message}`).join('\n');
    const warns = validation.warnings.slice(0, 15).map((w) => `- [${w.code}] ${w.path}: ${w.message}`).join('\n');
    user = [
      'Your previous script failed validation. Fix every error and return the full corrected JSON object only.',
      'Keep what already works; change only what the errors require.',
      `\nERRORS:\n${problems}`,
      warns ? `\nWARNINGS (fix if you can):\n${warns}` : '',
      `\nPREVIOUS JSON:\n${raw ? JSON.stringify(raw) : text.slice(0, 12000)}`,
      `\n${briefBlock(brief, variant)}`,
    ].join('\n');
  }

  return { raw, validation: validation!, attempts, history };
}
