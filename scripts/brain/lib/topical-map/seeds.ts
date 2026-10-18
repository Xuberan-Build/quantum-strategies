/**
 * Seed phrases and vidIQ anchors. Strategy lives in the brain (content/topical-map-seeds.json); this file only
 * defines the shape and parses research/language/audience-vocabulary.md §2 (vidIQ monthly YouTube searches).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { clean, col, findTable } from '../graph/md';

const Stance = z.enum(['use', 'reframe', 'avoid', 'guardrail']);
const Placement = z.object({ pillar: z.string(), stance: Stance.default('use') });

export const SeedsSchema = z.object({
  version: z.number().default(1),
  clusters: z.record(z.string(), z.array(z.string())).default({}),
  problems: z.record(z.string(), z.array(z.string())).default({}),
  probes: z.array(z.object({ text: z.string(), pillar: z.string(), stance: Stance.default('use') })).default([]),
  vidiq: z.record(z.string(), Placement).default({}),
  /** regex fragments (word-bounded, case-insensitive) for off-topic senses of a seed word, e.g. "lyrics" */
  exclude: z.array(z.string()).default([]),
  /** why each exclude pattern was added (pattern -> reason); documentation only */
  excludeNotes: z.record(z.string(), z.string()).default({}),
  /** manual head-term overrides: topic label or id -> the search phrasing to title it with */
  headTerms: z.record(z.string(), z.string()).default({}),
});
export type Seeds = z.infer<typeof SeedsSchema>;

export const SEEDS_PATH = 'content/topical-map-seeds.json';
export const VOCAB_PATH = 'research/language/audience-vocabulary.md';

export function loadSeeds(brainDir: string): { seeds: Seeds; found: boolean } {
  const p = path.join(brainDir, SEEDS_PATH);
  if (!existsSync(p)) return { seeds: SeedsSchema.parse({}), found: false };
  const parsed = SeedsSchema.safeParse(JSON.parse(readFileSync(p, 'utf8')));
  if (!parsed.success) throw new Error(`invalid ${SEEDS_PATH}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return { seeds: parsed.data, found: true };
}

export interface VidiqRow {
  phrase: string;
  monthly: number;
  change: string | null;
  read: string | null;
}

/** "~670K" -> 670000, "~3.3K" -> 3300, "~1.2M" -> 1200000 */
export function parseVolume(s: string): number | null {
  const m = clean(s).replace(/,/g, '').match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1;
  return Math.round(n * mult);
}

/** The vidIQ table (columns Phrase, Monthly searches, 30-day change, Read). Empty when the note is missing. */
export function parseVidiqTable(md: string | null): VidiqRow[] {
  if (!md) return [];
  const t = findTable(md, /^phrase$/i, /monthly/i);
  if (!t) return [];
  const cp = col(t, /^phrase$/i);
  const cm = col(t, /monthly/i);
  const cc = col(t, /change/i);
  const cr = col(t, /^read$/i);
  const out: VidiqRow[] = [];
  for (const r of t.rows) {
    const phrase = clean(r[cp] ?? '').toLowerCase();
    const monthly = parseVolume(r[cm] ?? '');
    if (!phrase || monthly === null) continue;
    out.push({ phrase, monthly, change: cc >= 0 ? clean(r[cc] ?? '') || null : null, read: cr >= 0 ? clean(r[cr] ?? '') || null : null });
  }
  return out;
}

export function loadVidiq(brainDir: string): VidiqRow[] {
  const p = path.join(brainDir, VOCAB_PATH);
  return parseVidiqTable(existsSync(p) ? readFileSync(p, 'utf8') : null);
}
