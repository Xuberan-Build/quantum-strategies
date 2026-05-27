/**
 * Tao corpus ingest script.
 *
 * Usage:
 *   npx tsx scripts/tao-ingest/sync-from-studio.ts <path>
 *   npx tsx scripts/tao-ingest/sync-from-studio.ts <path> --validate-only
 *   npx tsx scripts/tao-ingest/sync-from-studio.ts <path-to-tao.js> --from-js
 *   npx tsx scripts/tao-ingest/sync-from-studio.ts <path-to-tao.js> --from-js --validate-only
 *
 * Behavior:
 *   - Reads <path> as either the canonical studio JSON export (default)
 *     or the legacy ES-module tao.js source (--from-js).
 *   - Validates against TaoExportSchema with helpful error output on
 *     schema drift.
 *   - When not --validate-only, upserts every situation into
 *     public.tao_situations via the service-role supabase client.
 *
 * Notes:
 *   - The script is INTENTIONALLY destructive only via the active=false
 *     soft-disable column. It never DELETEs rows.
 *   - The script is excluded from `tsc --noEmit` (scripts/** is in
 *     tsconfig.json's "exclude"), so dynamic-import code paths are fine.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import {
  TaoExportSchema,
  TaoSituationSchema,
  type TaoExport,
  type TaoSituation,
  type TaoSituationRow,
  type TaoCoreState,
} from '../../src/lib/tao/schema';
import type { Database } from '../../src/types/supabase';

// --- Dotenv (matches the pattern used by the backup script) ---
loadDotenv({ path: '.env.local' });
loadDotenv({ path: '.env' });

// --- CLI args ---

interface CliFlags {
  path: string;
  fromJs: boolean;
  validateOnly: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  const positional: string[] = [];
  let fromJs = false;
  let validateOnly = false;

  for (const a of argv.slice(2)) {
    if (a === '--from-js') fromJs = true;
    else if (a === '--validate-only') validateOnly = true;
    else if (a.startsWith('--')) {
      throw new Error(`Unknown flag: ${a}`);
    } else {
      positional.push(a);
    }
  }

  if (positional.length === 0) {
    throw new Error(
      'Missing required <path> argument.\n' +
        'Usage:\n' +
        '  npx tsx scripts/tao-ingest/sync-from-studio.ts <path-to-tao.json>\n' +
        '  npx tsx scripts/tao-ingest/sync-from-studio.ts <path-to-tao.js> --from-js\n' +
        '  Add --validate-only to skip database writes.'
    );
  }

  return { path: positional[0], fromJs, validateOnly };
}

// --- Core state heuristic (studio source doesn't expose core_state yet) ---
//
// The studio JS exports a separate CORE_STATES catalog whose situation
// lists are name-based. We mirror that mapping here so the existing v1
// source can ingest with core_state populated.

const CORE_STATE_BY_SITUATION_NAME: Record<string, TaoCoreState> = {
  // Being
  'Morning Wake': 'Being',
  'Deadline Pressure': 'Being',
  // Inner Peace
  'Difficult Conversations': 'Inner Peace',
  'Task Switching': 'Inner Peace',
  'Evening Wind Down': 'Inner Peace',
  // Love
  '1:1 Meetings': 'Love',
  'Intimate Partnership': 'Love',
  'Vulnerable Conversations': 'Love',
  // OKness
  Presentations: 'OKness',
  'Discovery Calls': 'OKness',
  Pitching: 'OKness',
  Closing: 'OKness',
  // Oneness
  'Deep Work': 'Oneness',
};

function inferCoreState(situationName: string): TaoCoreState | null {
  return CORE_STATE_BY_SITUATION_NAME[situationName] ?? null;
}

// --- Domain id → name lookup (built from the JS source when --from-js) ---

interface StudioDomain {
  id: string;
  name: string;
  color?: string;
}

interface StudioSituationJs {
  id: string;
  name: string;
  domain: string;
  domainId: string;
  tier: number;
  variantCount?: number;
  fate?: string | null;
  beingName?: string | null;
  reEntryPhrase?: string | null;
  bteElements?: string | null;
  bteConfirming?: unknown;
  bteConflicting?: unknown;
  bteLevers?: unknown;
  kinesthetic?: string | null;
  somaticBreathOn?: unknown;
  somaticBreathOff?: unknown;
  somaticArousalOn?: unknown;
  somaticArousalOff?: unknown;
  somaticFacialOn?: string | null;
  somaticFacialOff?: string | null;
  somaticLipsOn?: string | null;
  somaticLipsOff?: string | null;
  somaticJawOn?: string | null;
  somaticJawOff?: string | null;
  somaticBrowOn?: string | null;
  somaticBrowOff?: string | null;
  somaticSymmetryOn?: string | null;
  somaticSymmetryOff?: string | null;
  somaticTensionMap?: string | null;
  somaticBodyOn?: unknown;
  somaticBodyOff?: unknown;
  somaticVoiceOn?: string | null;
  somaticVoiceOff?: string | null;
  somaticGazeOn?: string | null;
  somaticGazeOff?: string | null;
  [k: string]: unknown;
}

// --- Loaders ---

async function loadFromJson(absPath: string): Promise<TaoExport> {
  const raw = readFileSync(absPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse ${absPath} as JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const result = TaoExportSchema.safeParse(parsed);
  if (!result.success) {
    console.error('\nSchema validation failed for studio JSON export.\n');
    for (const issue of result.error.issues) {
      console.error(`  - [${issue.path.join('.') || '(root)'}] ${issue.message}`);
    }
    console.error('');
    throw new Error('Aborting ingest — fix schema drift in the studio export.');
  }
  return result.data;
}

/**
 * Best-effort import of the legacy ES-module tao.js. We dynamically
 * import the file via file:// URL so Node's ESM loader picks it up
 * directly. We then map TAO_SITUATIONS into the canonical export shape.
 *
 * Mapping (current v1 → target 7-layer):
 *   - layer_identity:        { being_name, kinesthetic, bte_elements }
 *   - layer_submodality:     facial / lips / jaw / brow / symmetry /
 *                            arousal / breath / body / voice / gaze
 *                            on/off blocks + tension_map
 *   - layer_language:        { re_entry_phrase }
 *   - layer_fate_bte:        { fate, bte_confirming, bte_conflicting,
 *                              bte_levers }
 *   - layer_variance:        null (not in v1)
 *   - layer_personalization: null (not in v1)
 *   - layer_protocol:        null (not in v1)
 */
async function loadFromJs(absPath: string): Promise<TaoExport> {
  const moduleUrl = pathToFileURL(absPath).href;
  // Dynamic import — script is excluded from tsc so this is fine.
  const mod = (await import(moduleUrl)) as {
    TAO_SITUATIONS?: StudioSituationJs[];
    TAO_DOMAINS?: StudioDomain[];
  };

  if (!Array.isArray(mod.TAO_SITUATIONS)) {
    throw new Error(
      `${absPath} did not export TAO_SITUATIONS as an array. Are you pointing at the right file?`
    );
  }

  const domains: StudioDomain[] = Array.isArray(mod.TAO_DOMAINS) ? mod.TAO_DOMAINS : [];
  const domainNameById = new Map<string, string>();
  for (const d of domains) {
    if (d?.id && d?.name) domainNameById.set(d.id, d.name);
  }

  const situations: TaoSituation[] = [];
  let unmappableCount = 0;
  const unmappableReasons: string[] = [];

  for (const src of mod.TAO_SITUATIONS) {
    const id = String(src.id ?? '').trim();
    if (!id) {
      unmappableCount++;
      unmappableReasons.push('(missing id) — skipped');
      continue;
    }

    const tier = Number(src.tier);
    if (![1, 2, 3].includes(tier)) {
      unmappableCount++;
      unmappableReasons.push(`${id} — invalid tier ${String(src.tier)}`);
      continue;
    }

    const fateRaw = (src.fate ?? null) as string | null;
    const fate =
      fateRaw && (['Fear', 'Authority', 'Trust', 'Ego'] as const).includes(fateRaw as never)
        ? (fateRaw as TaoSituation['fate'])
        : null;

    const domainName = (src.domain ?? domainNameById.get(src.domainId)) || '(unknown)';

    const layer_identity = stripUndefined({
      being_name: src.beingName ?? null,
      kinesthetic: src.kinesthetic ?? null,
      bte_elements: src.bteElements ?? null,
    });

    const layer_submodality = stripUndefined({
      breath_on: src.somaticBreathOn ?? null,
      breath_off: src.somaticBreathOff ?? null,
      arousal_on: src.somaticArousalOn ?? null,
      arousal_off: src.somaticArousalOff ?? null,
      facial_on: src.somaticFacialOn ?? null,
      facial_off: src.somaticFacialOff ?? null,
      lips_on: src.somaticLipsOn ?? null,
      lips_off: src.somaticLipsOff ?? null,
      jaw_on: src.somaticJawOn ?? null,
      jaw_off: src.somaticJawOff ?? null,
      brow_on: src.somaticBrowOn ?? null,
      brow_off: src.somaticBrowOff ?? null,
      symmetry_on: src.somaticSymmetryOn ?? null,
      symmetry_off: src.somaticSymmetryOff ?? null,
      tension_map: src.somaticTensionMap ?? null,
      body_on: src.somaticBodyOn ?? null,
      body_off: src.somaticBodyOff ?? null,
      voice_on: src.somaticVoiceOn ?? null,
      voice_off: src.somaticVoiceOff ?? null,
      gaze_on: src.somaticGazeOn ?? null,
      gaze_off: src.somaticGazeOff ?? null,
    });

    const layer_language = stripUndefined({
      re_entry_phrase: src.reEntryPhrase ?? null,
    });

    const layer_fate_bte = stripUndefined({
      fate,
      bte_confirming: src.bteConfirming ?? null,
      bte_conflicting: src.bteConflicting ?? null,
      bte_levers: src.bteLevers ?? null,
    });

    const candidate: TaoSituation = {
      id,
      domain_id: String(src.domainId ?? '').padStart(2, '0'),
      domain_name: domainName,
      name: String(src.name ?? id),
      tier: tier as TaoSituation['tier'],
      fate,
      core_state: inferCoreState(String(src.name ?? '')),
      being_name: src.beingName ?? null,
      re_entry_phrase: src.reEntryPhrase ?? null,
      variant_count:
        typeof src.variantCount === 'number' && Number.isFinite(src.variantCount)
          ? Math.max(0, Math.floor(src.variantCount))
          : 0,
      layer_identity: emptyToNull(layer_identity),
      layer_submodality: emptyToNull(layer_submodality),
      layer_language: emptyToNull(layer_language),
      layer_fate_bte: emptyToNull(layer_fate_bte),
      layer_variance: null,
      layer_personalization: null,
      layer_protocol: null,
      research_source: null,
      research_finding: null,
      active: true,
    };

    const validated = TaoSituationSchema.safeParse(candidate);
    if (!validated.success) {
      unmappableCount++;
      unmappableReasons.push(
        `${id} — schema mismatch: ${validated.error.issues.map((i) => i.message).join('; ')}`
      );
      continue;
    }
    situations.push(validated.data);
  }

  if (unmappableCount > 0) {
    console.warn(`\n[warn] ${unmappableCount} situation(s) skipped during JS mapping:`);
    for (const r of unmappableReasons.slice(0, 20)) console.warn(`  - ${r}`);
    if (unmappableReasons.length > 20) {
      console.warn(`  …and ${unmappableReasons.length - 20} more`);
    }
    console.warn('');
  }

  return {
    version: `legacy-js-${new Date().toISOString().slice(0, 10)}`,
    generatedAt: new Date().toISOString(),
    count: situations.length,
    situations,
  };
}

// --- Mapping helpers ---

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function emptyToNull(obj: Record<string, unknown>): Record<string, unknown> | null {
  // If every value is null/empty array/empty string, treat the whole
  // layer as null. Otherwise keep it.
  const keys = Object.keys(obj);
  if (keys.length === 0) return null;
  const allEmpty = keys.every((k) => {
    const v = obj[k];
    if (v === null || v === undefined) return true;
    if (Array.isArray(v) && v.length === 0) return true;
    if (typeof v === 'string' && v.trim().length === 0) return true;
    return false;
  });
  return allEmpty ? null : obj;
}

function toRow(s: TaoSituation, sourceVersion: string): TaoSituationRow {
  return {
    id: s.id,
    domain_id: s.domain_id,
    domain_name: s.domain_name,
    name: s.name,
    tier: s.tier,
    fate: s.fate ?? null,
    core_state: s.core_state ?? null,
    being_name: s.being_name ?? null,
    re_entry_phrase: s.re_entry_phrase ?? null,
    variant_count: s.variant_count ?? 0,
    layer_identity: (s.layer_identity ?? null) as Record<string, unknown> | null,
    layer_submodality: (s.layer_submodality ?? null) as Record<string, unknown> | null,
    layer_language: (s.layer_language ?? null) as Record<string, unknown> | null,
    layer_fate_bte: (s.layer_fate_bte ?? null) as Record<string, unknown> | null,
    layer_variance: (s.layer_variance ?? null) as Record<string, unknown> | null,
    layer_personalization: (s.layer_personalization ?? null) as Record<string, unknown> | null,
    layer_protocol: (s.layer_protocol ?? null) as Record<string, unknown> | null,
    research_source: s.research_source ?? null,
    research_finding: s.research_finding ?? null,
    source_version: sourceVersion,
    active: s.active ?? true,
  };
}

// --- Upsert ---

interface IngestSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  skipReasons: string[];
}

async function upsertAll(exp: TaoExport): Promise<IngestSummary> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Ensure .env.local is present and contains both.'
    );
  }

  const client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Snapshot existing ids so we can report inserted vs updated.
  const { data: existing, error: existingError } = await client
    .from('tao_situations')
    .select('id');

  if (existingError) {
    throw new Error(`Failed to read existing tao_situations: ${existingError.message}`);
  }
  const existingIds = new Set<string>((existing ?? []).map((r) => r.id));

  const summary: IngestSummary = {
    total: exp.situations.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    skipReasons: [],
  };

  // Upsert in batches to avoid statement-size limits.
  const BATCH = 50;
  const rows = exp.situations.map((s) => toRow(s, exp.version));

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await client
      .from('tao_situations')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      // On batch error, fall back to per-row so we can report which
      // rows succeeded and which failed.
      for (const row of batch) {
        const { error: rowErr } = await client
          .from('tao_situations')
          .upsert(row, { onConflict: 'id' });
        if (rowErr) {
          summary.skipped++;
          summary.skipReasons.push(`${row.id} — ${rowErr.message}`);
        } else if (existingIds.has(row.id)) {
          summary.updated++;
        } else {
          summary.inserted++;
        }
      }
    } else {
      for (const row of batch) {
        if (existingIds.has(row.id)) summary.updated++;
        else summary.inserted++;
      }
    }
  }

  return summary;
}

// --- Field-coverage report (run in --validate-only mode) ---

function reportCoverage(exp: TaoExport): void {
  const layerKeys = [
    'layer_identity',
    'layer_submodality',
    'layer_language',
    'layer_fate_bte',
    'layer_variance',
    'layer_personalization',
    'layer_protocol',
  ] as const;

  const counts: Record<string, number> = {
    fate: 0,
    core_state: 0,
    being_name: 0,
    re_entry_phrase: 0,
  };
  for (const k of layerKeys) counts[k] = 0;

  for (const s of exp.situations) {
    if (s.fate) counts.fate++;
    if (s.core_state) counts.core_state++;
    if (s.being_name) counts.being_name++;
    if (s.re_entry_phrase) counts.re_entry_phrase++;
    for (const k of layerKeys) {
      const v = s[k];
      if (v && typeof v === 'object' && Object.keys(v as object).length > 0) {
        counts[k]++;
      }
    }
  }

  console.log(`\nField coverage across ${exp.situations.length} situation(s):`);
  for (const [k, v] of Object.entries(counts)) {
    const pct = exp.situations.length === 0 ? 0 : Math.round((v / exp.situations.length) * 100);
    console.log(`  ${k.padEnd(22)} ${v}/${exp.situations.length} (${pct}%)`);
  }
  console.log('');
}

// --- Entry ---

async function main(): Promise<void> {
  const flags = parseFlags(process.argv);
  const absPath = resolvePath(process.cwd(), flags.path);

  console.log(`[tao-ingest] source: ${absPath}`);
  console.log(`[tao-ingest] mode:   ${flags.fromJs ? 'legacy JS' : 'JSON export'}`);
  if (flags.validateOnly) console.log(`[tao-ingest] DRY RUN — no database writes`);

  const exp: TaoExport = flags.fromJs
    ? await loadFromJs(absPath)
    : await loadFromJson(absPath);

  console.log(
    `[tao-ingest] export version: ${exp.version} (${exp.situations.length} situations, generated ${exp.generatedAt})`
  );

  if (exp.situations.length !== exp.count) {
    console.warn(
      `[warn] envelope count (${exp.count}) does not match situations.length (${exp.situations.length})`
    );
  }

  reportCoverage(exp);

  if (flags.validateOnly) {
    console.log('[tao-ingest] validation passed — no rows written.');
    return;
  }

  const summary = await upsertAll(exp);
  console.log(`\n[tao-ingest] complete:`);
  console.log(`  total:    ${summary.total}`);
  console.log(`  inserted: ${summary.inserted}`);
  console.log(`  updated:  ${summary.updated}`);
  console.log(`  skipped:  ${summary.skipped}`);
  if (summary.skipReasons.length > 0) {
    console.log(`\nSkip reasons:`);
    for (const r of summary.skipReasons.slice(0, 30)) console.log(`  - ${r}`);
    if (summary.skipReasons.length > 30) {
      console.log(`  …and ${summary.skipReasons.length - 30} more`);
    }
  }
}

main().catch((err) => {
  console.error(`\n[tao-ingest] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
