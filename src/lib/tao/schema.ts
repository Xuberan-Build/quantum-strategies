/**
 * Zod schemas for the Tao situation corpus.
 *
 * These schemas validate the JSON export produced by the studio repo
 * (inner-outer-alignment) Python generator and consumed by the portal
 * ingest script. They mirror the public.tao_situations table shape.
 *
 * The studio export is expected at data/exports/tao.json with the
 * envelope {version, generatedAt, count, situations[]}.
 */

import { z } from 'zod';

// --- Enumerations (kept in sync with the migration CHECK constraints) ---

export const TAO_TIERS = [1, 2, 3] as const;
export const TAO_FATES = ['Fear', 'Authority', 'Trust', 'Ego'] as const;
export const TAO_CORE_STATES = [
  'Being',
  'Inner Peace',
  'Love',
  'OKness',
  'Oneness',
] as const;

export type TaoTier = (typeof TAO_TIERS)[number];
export type TaoFate = (typeof TAO_FATES)[number];
export type TaoCoreState = (typeof TAO_CORE_STATES)[number];

// --- Layer payload schemas ---
//
// Each layer is JSONB in Postgres, so the schema is intentionally
// permissive. We accept any object shape but reject primitives and arrays
// at the top level to prevent accidental shape drift. The studio pipeline
// is the canonical source of layer structure; the portal does not
// prescribe an internal shape here.
//
// If/when the studio settles on a stable internal layer shape, this
// schema can be tightened without a migration.

const LayerSchema = z.record(z.string(), z.unknown()).nullable();

export type TaoLayerPayload = z.infer<typeof LayerSchema>;

// --- Situation row schema ---

export const TaoSituationSchema = z.object({
  // Dotted notation pk e.g. '01.01'. Allow any non-empty string so the
  // studio can extend the id format without a portal-side bump.
  id: z.string().min(1).max(64),

  domain_id: z.string().min(1).max(32),
  domain_name: z.string().min(1).max(200),
  name: z.string().min(1).max(200),

  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),

  fate: z.enum(TAO_FATES).nullable(),
  core_state: z.enum(TAO_CORE_STATES).nullable(),

  being_name: z.string().max(200).nullable(),
  re_entry_phrase: z.string().max(500).nullable(),

  variant_count: z.number().int().min(0).default(0),

  // 7 layers (all optional / nullable so partial generator output ingests
  // cleanly during the migration period from the v1 JS source).
  layer_identity: LayerSchema.optional(),
  layer_submodality: LayerSchema.optional(),
  layer_language: LayerSchema.optional(),
  layer_fate_bte: LayerSchema.optional(),
  layer_variance: LayerSchema.optional(),
  layer_personalization: LayerSchema.optional(),
  layer_protocol: LayerSchema.optional(),

  research_source: z.string().nullable().optional(),
  research_finding: z.string().nullable().optional(),

  // Active is optional on import — the table defaults to true.
  active: z.boolean().optional(),
});

export type TaoSituation = z.infer<typeof TaoSituationSchema>;

// --- Export envelope ---

export const TaoExportSchema = z.object({
  // Semver-ish version of the studio export, e.g. '2026.05.26' or 'v1.2.0'.
  version: z.string().min(1).max(64),

  // ISO8601 timestamp the export was produced.
  generatedAt: z.string().min(1),

  // Total count, used to spot-check the situations array.
  count: z.number().int().min(0),

  situations: z.array(TaoSituationSchema),
});

export type TaoExport = z.infer<typeof TaoExportSchema>;

// --- DB row shape (what's written to public.tao_situations) ---
//
// This is the columnar shape after the ingest mapping. It matches the
// table 1:1 so the script can call .upsert() with these objects.

export interface TaoSituationRow {
  id: string;
  domain_id: string;
  domain_name: string;
  name: string;
  tier: TaoTier;
  fate: TaoFate | null;
  core_state: TaoCoreState | null;
  being_name: string | null;
  re_entry_phrase: string | null;
  variant_count: number;
  layer_identity: Record<string, unknown> | null;
  layer_submodality: Record<string, unknown> | null;
  layer_language: Record<string, unknown> | null;
  layer_fate_bte: Record<string, unknown> | null;
  layer_variance: Record<string, unknown> | null;
  layer_personalization: Record<string, unknown> | null;
  layer_protocol: Record<string, unknown> | null;
  research_source: string | null;
  research_finding: string | null;
  source_version: string;
  active: boolean;
}
