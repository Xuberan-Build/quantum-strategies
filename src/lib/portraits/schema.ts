/**
 * Zod schemas for portrait extraction output.
 *
 * These schemas validate the JSON returned by the OpenAI extraction call
 * before it is merged into user_portraits. They mirror the PortraitFact /
 * PortraitSection contract documented in
 * supabase/migrations/20260527010108_user_portraits.sql (lines 20-68).
 *
 * The full user_portraits.sections JSONB also carries current/prior/transitions
 * wrapping — that shape lives in PortraitSectionSchema below and is used
 * internally by the worker when it reads and writes the stored portrait.
 * The extraction model only returns a flat PortraitFact per section
 * (ExtractionResultSchema); the worker handles the current/prior promotion.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// PortraitFact — one "snapshot" of what we know about a section
// ---------------------------------------------------------------------------

export const PortraitFactSchema = z.object({
  stated: z.string().optional(),
  revealed: z.string().optional(),
  summary: z.string().optional(),
  // EVIDENCE REQUIRED: at least one verbatim quote from the briefing/responses
  evidence: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  source_product: z.string(),
  source_briefing_id: z.string().uuid(),
  set_at: z.string(), // ISO timestamp
});

export type PortraitFact = z.infer<typeof PortraitFactSchema>;

// ---------------------------------------------------------------------------
// PortraitTransition — recorded when current.revealed shifts meaningfully
// ---------------------------------------------------------------------------

export const PortraitTransitionSchema = z.object({
  from: PortraitFactSchema,
  to: PortraitFactSchema,
  detected_at: z.string(), // ISO timestamp
  source_product: z.string(),
});

export type PortraitTransition = z.infer<typeof PortraitTransitionSchema>;

// ---------------------------------------------------------------------------
// PortraitSection — the full stored shape per section in user_portraits.sections
// This is what the worker reads from and writes back to the DB.
// ---------------------------------------------------------------------------

export const PortraitSectionSchema = z.object({
  current: PortraitFactSchema.nullable(),
  prior: z.array(PortraitFactSchema),
  transitions: z.array(PortraitTransitionSchema),
});

export type PortraitSection = z.infer<typeof PortraitSectionSchema>;

// ---------------------------------------------------------------------------
// SectionName — the six portrait sections
// ---------------------------------------------------------------------------

export const SectionName = z.enum([
  'identity',
  'values',
  'energy',
  'activity',
  'results',
  'path',
]);

export type SectionNameType = z.infer<typeof SectionName>;

export const SECTION_NAMES = SectionName.options;

// ---------------------------------------------------------------------------
// ExtractionResultSchema — what the OpenAI model returns.
//
// Sections present = sections the extractor had enough signal to update.
// Sections absent  = no update for that section (omitting is correct).
// ---------------------------------------------------------------------------

export const ExtractionResultSchema = z.object({
  identity: PortraitFactSchema.optional(),
  values: PortraitFactSchema.optional(),
  energy: PortraitFactSchema.optional(),
  activity: PortraitFactSchema.optional(),
  results: PortraitFactSchema.optional(),
  path: PortraitFactSchema.optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ---------------------------------------------------------------------------
// StoredSections — the full sections JSONB as stored in user_portraits.sections
// ---------------------------------------------------------------------------

export const StoredSectionsSchema = z.object({
  identity: PortraitSectionSchema.optional(),
  values: PortraitSectionSchema.optional(),
  energy: PortraitSectionSchema.optional(),
  activity: PortraitSectionSchema.optional(),
  results: PortraitSectionSchema.optional(),
  path: PortraitSectionSchema.optional(),
});

export type StoredSections = z.infer<typeof StoredSectionsSchema>;
