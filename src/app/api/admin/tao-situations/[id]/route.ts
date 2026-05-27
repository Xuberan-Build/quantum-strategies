import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

const FATES = ['Fear', 'Authority', 'Trust', 'Ego'] as const;
const CORE_STATES = ['Being', 'Inner Peace', 'Love', 'OKness', 'Oneness'] as const;
const TIERS = [1, 2, 3] as const;

// JSONB layer payload: object | null. Permissive shape, mirrors the
// schema in src/lib/tao/schema.ts.
const LayerSchema = z.record(z.string(), z.unknown()).nullable();

const UpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    fate: z.enum(FATES).nullable().optional(),
    core_state: z.enum(CORE_STATES).nullable().optional(),
    being_name: z.string().max(200).nullable().optional(),
    re_entry_phrase: z.string().max(500).nullable().optional(),
    variant_count: z.number().int().min(0).optional(),
    layer_identity: LayerSchema.optional(),
    layer_submodality: LayerSchema.optional(),
    layer_language: LayerSchema.optional(),
    layer_fate_bte: LayerSchema.optional(),
    layer_variance: LayerSchema.optional(),
    layer_personalization: LayerSchema.optional(),
    layer_protocol: LayerSchema.optional(),
    research_source: z.string().nullable().optional(),
    research_finding: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

// Intentionally no POST and no DELETE on tao_situations:
//   - rows are upserted by scripts/tao-ingest/sync-from-studio.ts
//   - soft-disable via PATCH { active: false }
//
// Surfacing these as 405 helps the form layer stay honest.
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Method Not Allowed. Tao situations are ingested via scripts/tao-ingest/sync-from-studio.ts, not created via the admin API.',
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error:
        'Method Not Allowed. Use PATCH { "active": false } to soft-disable a situation. Hard-delete is not permitted.',
    },
    { status: 405 }
  );
}

/**
 * GET /api/admin/tao-situations/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  const { data: situation, error: fetchError } = await supabaseAdmin
    .from('tao_situations')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !situation) {
    return NextResponse.json({ error: 'Situation not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, situation });
}

/**
 * PATCH /api/admin/tao-situations/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Verify the row exists, snapshot prior values for the audit log.
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('tao_situations')
    .select('id, active, name, tier')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Situation not found' }, { status: 404 });
  }

  const updates = parsed.data;

  // Suppress noisy "tier" type narrowing issue from Zod literal union:
  // explicit cast is safe because the schema only accepts 1|2|3.
  const updatePayload = updates as Record<string, unknown>;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('tao_situations')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('[Admin API] tao_situations update error:', updateError);
    return NextResponse.json({ error: 'Failed to update situation' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'tao_situation_update',
    targetType: 'tao_situation',
    targetId: id,
    targetName: current.name ?? id,
    previousValue: { active: current.active, name: current.name, tier: current.tier },
    newValue: updatePayload,
  });

  return NextResponse.json({ success: true, situation: updated });
}

// Note: TIERS is exported for symmetry with the form module if needed
// downstream; lint may flag this as unused without the explicit reference.
export const _TIERS_INTERNAL = TIERS;
