/**
 * Voice pack: the single runtime voice source for every content generator.
 *
 * The brand's voice rules live in the private brain repo. The brain tick compiles
 * them into `voicePack` inside the brain snapshot (see src/lib/brain/snapshot.ts and
 * scripts/brain/prompts/snapshot.md) and uploads it to the private Storage bucket.
 * This module reads that field server-side, caches it in memory with a TTL, and
 * falls back to a minimal generic pack when the snapshot is missing or invalid.
 *
 * Nothing brand-confidential belongs in this file: the fallback only carries generic
 * writing rules plus the strings that were already hardcoded in the studio routes.
 *
 * Server-only (imports supabaseAdmin and node:fs).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabaseAdmin } from '@/lib/supabase/server';
import { BRAIN_BUCKET, BRAIN_LATEST_PATH, VoicePackSchema, type BrainVoicePack } from '@/lib/brain/snapshot';

export type VoicePack = BrainVoicePack;
export type VoicePackSource = 'snapshot' | 'local' | 'fallback';

export interface VoicePackResult {
  pack: VoicePack;
  source: VoicePackSource;
  /** Why the snapshot pack wasn't used, when source is 'fallback' (or 'local'). */
  error?: string;
}

/** The fields the format validators (src/lib/content/formats/*) need. */
export type FormatVoiceRules = Pick<VoicePack, 'bannedTerms' | 'handleWithCare' | 'ctaSpamPatterns' | 'outcomeTimeboxPatterns'>;

// ── Fallback ────────────────────────────────────────────────────────────────

export const FALLBACK_VOICE_PACK: VoicePack = {
  version: 'fallback-1',
  voiceRules: [
    "Write to one reader in the second person ('you', 'your'). Never 'one', and never talk about the reader in the third person.",
    'Lead with lived experience. When a claim needs backing, name the source plainly (who found it, and whether it is research or a practitioner model). Never stack citations to impress.',
    'Sincerity over cleverness: substance beats wordplay every time.',
    'Forward momentum: every sentence earns the next; nothing decorative, no summarising what was just said.',
    'State the cause-and-effect mechanism behind any claim. If you cannot name the chain, cut the claim.',
    'Urgency comes from real consequences, never from hype or fake scarcity.',
    'Promise how long a practice takes, never how fast an outcome arrives. No guaranteed results, no income or health claims.',
    'Prose, not bullet points, unless the section is explicitly a list.',
    'Use corpus passages as evidence to synthesise. Quote briefly and only with attribution.',
    "No rhetorical triads. No exclamation points as habit. No 'Here's the truth', 'Let's be honest' or 'The reality is'.",
    'End at one clear next step.',
  ],
  canon: [],
  bannedTerms: [
    "here's the truth",
    "let's be honest",
    'the reality is',
    'game-changer',
    'game changer',
    'unlock',
    'level up',
    'level-up',
    'consciousness to cash flow',
    'at the end of the day',
    "it's important to note",
    'hustle harder',
  ],
  handleWithCare: [],
  ctaSpamPatterns: [
    'changed my life',
    'this one quiz',
    'only today',
    '/\\b(limited|last) chance\\b/i',
  ],
  outcomeTimeboxPatterns: [
    'overnight',
    'instantly',
    'in seconds',
    '/\\b(rewire|transform|reinvent|change)\\b[^.]{0,40}\\b(in|within)\\s+\\d+\\s+(days?|weeks?|hours?)\\b/i',
  ],
  identity: {
    brand: 'Quantum Strategies',
    identityTerm: '',
    stages: [],
    audience: '',
    positioning: '',
  },
  chartPolicy:
    'Treat chart or personality-profile data as descriptive input for reflection only. Never present it as the cause of an outcome, a prediction, or a substitute for the mechanism.',
  systemPreamble: 'You write for Quantum Strategies. Write plainly and honestly, to one reader.',
};

// ── Parsing ─────────────────────────────────────────────────────────────────

export type VoicePackParse = { ok: true; pack: VoicePack } | { ok: false; error: string };

/** Validates a raw `voicePack` value (already JSON-parsed). */
export function parseVoicePack(raw: unknown): VoicePackParse {
  if (raw === undefined || raw === null) return { ok: false, error: 'Snapshot has no voicePack.' };
  const result = VoicePackSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, error: `voicePack failed validation (${issues}).` };
  }
  return { ok: true, pack: result.data };
}

/** Extracts and validates `voicePack` from raw snapshot JSON text. Doesn't require the rest of the snapshot to be valid. */
export function parseVoicePackFromSnapshotText(text: string): VoicePackParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Snapshot is not valid JSON.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Snapshot is not an object.' };
  return parseVoicePack((raw as Record<string, unknown>).voicePack);
}

// ── Loading + cache ─────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;

function ttlMs(): number {
  const fromEnv = Number(process.env.VOICE_PACK_TTL_MS);
  return Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : DEFAULT_TTL_MS;
}

let cached: { result: VoicePackResult; expiresAt: number } | null = null;
let inflight: Promise<VoicePackResult> | null = null;

/** Clears the in-memory cache (tests, or after publishing a new snapshot). */
export function resetVoicePackCache(): void {
  cached = null;
  inflight = null;
}

async function loadFromStorage(): Promise<VoicePackParse> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(BRAIN_BUCKET).download(BRAIN_LATEST_PATH);
    if (error || !data) return { ok: false, error: `Storage: ${error?.message ?? 'no data returned'}` };
    const parsed = parseVoicePackFromSnapshotText(await data.text());
    return parsed.ok ? parsed : { ok: false, error: `Storage: ${parsed.error}` };
  } catch (err) {
    return { ok: false, error: `Storage: ${err instanceof Error ? err.message : 'download failed'}` };
  }
}

async function loadFromDisk(): Promise<VoicePackParse> {
  try {
    const text = await readFile(path.join(process.cwd(), 'brain', '.snapshots', 'latest.json'), 'utf8');
    const parsed = parseVoicePackFromSnapshotText(text);
    return parsed.ok ? parsed : { ok: false, error: `Local: ${parsed.error}` };
  } catch {
    return { ok: false, error: 'Local: brain/.snapshots/latest.json not readable' };
  }
}

async function load(): Promise<VoicePackResult> {
  const remote = await loadFromStorage();
  if (remote.ok) return { pack: remote.pack, source: 'snapshot' };

  if (process.env.NODE_ENV === 'development') {
    const local = await loadFromDisk();
    if (local.ok) return { pack: local.pack, source: 'local', error: remote.error };
    return { pack: FALLBACK_VOICE_PACK, source: 'fallback', error: `${remote.error} · ${local.error}` };
  }
  return { pack: FALLBACK_VOICE_PACK, source: 'fallback', error: remote.error };
}

/** The voice pack plus where it came from. Never throws. */
export async function getVoicePackResult(): Promise<VoicePackResult> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.result;
  if (inflight) return inflight;

  inflight = load()
    .catch((err): VoicePackResult => ({
      pack: FALLBACK_VOICE_PACK,
      source: 'fallback',
      error: err instanceof Error ? err.message : 'voice pack load failed',
    }))
    .then((result) => {
      const ttl = result.source === 'fallback' ? Math.min(ERROR_TTL_MS, ttlMs()) : ttlMs();
      cached = { result, expiresAt: Date.now() + ttl };
      if (result.source === 'fallback') console.warn('[voice-pack] using built-in fallback:', result.error);
      return result;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The current voice pack (snapshot if available, else the built-in fallback). Never throws. */
export async function getVoicePack(): Promise<VoicePack> {
  return (await getVoicePackResult()).pack;
}

/** Just the rule lists the format validators need. */
export async function getFormatVoiceRules(): Promise<FormatVoiceRules> {
  const { bannedTerms, handleWithCare, ctaSpamPatterns, outcomeTimeboxPatterns } = await getVoicePack();
  return { bannedTerms, handleWithCare, ctaSpamPatterns, outcomeTimeboxPatterns };
}

// ── Matching helpers ────────────────────────────────────────────────────────

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Normalises curly quotes so "here’s" matches "here's". */
export function normaliseQuotes(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

/**
 * Compiles a pattern entry. `/source/flags` is a regular expression; anything else
 * is a literal phrase matched case-insensitively from a word start. Invalid regex
 * entries degrade to a literal match of the whole string.
 */
export function compilePattern(pattern: string): RegExp {
  const regexForm = /^\/([\s\S]+)\/([a-z]*)$/.exec(pattern);
  if (regexForm) {
    const flags = regexForm[2].includes('i') ? regexForm[2] : `${regexForm[2]}i`;
    try {
      return new RegExp(regexForm[1], flags.replace(/g/g, ''));
    } catch {
      /* fall through to literal */
    }
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normaliseQuotes(pattern))}`, 'iu');
}

export interface PatternMatch {
  pattern: string;
  match: string;
  excerpt: string;
}

/** Every pattern that matches `text`, with a short excerpt around the first hit. */
export function findPatternMatches(text: string, patterns: readonly string[]): PatternMatch[] {
  const haystack = normaliseQuotes(text);
  const out: PatternMatch[] = [];
  for (const pattern of patterns) {
    if (!pattern.trim()) continue;
    const m = compilePattern(pattern).exec(haystack);
    if (!m) continue;
    const start = Math.max(0, m.index - 30);
    const end = Math.min(haystack.length, m.index + m[0].length + 40);
    out.push({ pattern, match: m[0], excerpt: `...${haystack.slice(start, end)}...` });
  }
  return out;
}

/** Banned-term hits in `text` for the given pack. */
export function findBannedTerms(text: string, pack: Pick<VoicePack, 'bannedTerms'>): PatternMatch[] {
  return findPatternMatches(text, pack.bannedTerms);
}

// ── Prompt building ─────────────────────────────────────────────────────────

export interface VoicePromptOptions {
  /** One line describing the model's job, placed after the preamble. */
  role?: string;
  /** Include canon lines and owned terms (long-form writers want them; scorers don't). */
  includeCanon?: boolean;
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

/** Identity line from the pack, or '' when the pack carries none. */
export function describeIdentity(pack: VoicePack): string {
  const { identity } = pack;
  const parts: string[] = [];
  if (identity.positioning) parts.push(identity.positioning);
  if (identity.identityTerm) {
    const path = identity.stages.length ? `, reached through ${identity.stages.join(' → ')}` : '';
    parts.push(`The reader's identity is "${identity.identityTerm}"${path}. Use that vocabulary, and no competing identity labels.`);
  }
  if (identity.audience) parts.push(`Audience: ${identity.audience}`);
  return parts.join('\n');
}

/** The shared system prompt every content generator starts from. */
export function buildVoiceSystemPrompt(pack: VoicePack, options: VoicePromptOptions = {}): string {
  const { role, includeCanon = false } = options;
  const blocks: string[] = [pack.systemPreamble.trim()];
  if (role) blocks.push(role.trim());

  const identity = describeIdentity(pack);
  if (identity) blocks.push(`IDENTITY AND POSITIONING:\n${identity}`);

  blocks.push(`VOICE RULES (non-negotiable):\n${bulletList(pack.voiceRules)}`);

  if (pack.bannedTerms.length) {
    blocks.push(`BANNED (never write these, except when quoting or debunking them): ${pack.bannedTerms.map((t) => `"${t}"`).join(', ')}`);
  }
  if (pack.handleWithCare.length) {
    blocks.push(`HANDLE WITH CARE:\n${bulletList(pack.handleWithCare.map((h) => `${h.term}: ${h.rule}`))}`);
  }
  if (includeCanon && pack.canon.length) {
    blocks.push(
      `CANON LINES AND OWNED TERMS (use naturally, never in scare quotes):\n${bulletList(
        pack.canon.map((c) => `${c.term}: ${c.meaning} Use when: ${c.use} Avoid when: ${c.avoid}`),
      )}`,
    );
  }
  if (pack.chartPolicy) blocks.push(`CHARTS AND PROFILES: ${pack.chartPolicy}`);
  return blocks.join('\n\n');
}
