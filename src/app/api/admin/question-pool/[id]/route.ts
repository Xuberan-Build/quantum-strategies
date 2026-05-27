import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest, logAdminAction } from '@/lib/admin/auth';

const AUDIENCE_TRACKS = ['operator', 'side_builder', 'inside_player', 'almost_builder', 'seeker', 'all'] as const;
const RITES = ['perception', 'orientation', 'declaration'] as const;
const QUESTION_ROLES = ['anchor', 'followup', 'variant'] as const;

const UpdateSchema = z.object({
  product_slug: z.string().min(1).max(200).optional(),
  step_index: z.number().int().min(1).optional(),
  domain: z.string().min(1).max(200).optional(),
  rite: z.enum(RITES).optional(),
  question_role: z.enum(QUESTION_ROLES).optional(),
  experience_level: z.number().int().min(1).max(3).optional(),
  audience_tracks: z.array(z.enum(AUDIENCE_TRACKS)).min(1).optional(),
  prompt_text: z.string().min(1).optional(),
  prompt_variants: z.record(z.string(), z.string()).nullable().optional(),
  followup_text: z.string().nullable().optional(),
  unlocks: z.array(z.string()).nullable().optional(),
  blocks: z.array(z.string()).nullable().optional(),
  signals_extracted: z.array(z.string()).nullable().optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/admin/question-pool/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  const { data: question, error: fetchError } = await supabaseAdmin
    .from('question_pool')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, question });
}

/**
 * PATCH /api/admin/question-pool/[id]
 * Update a pool entry
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  let body;
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

  const { data: current, error: fetchError } = await supabaseAdmin
    .from('question_pool')
    .select('id, active, product_slug, step_index')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const updates = parsed.data;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('question_pool')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('[Admin API] question_pool update error:', updateError);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'question_pool_update',
    targetType: 'question_pool',
    targetId: id,
    targetName: id,
    previousValue: { active: current.active, product_slug: current.product_slug, step_index: current.step_index },
    newValue: Object.fromEntries(Object.entries(updates).map(([k, v]) => [k, v as unknown])) as Record<string, unknown>,
  });

  return NextResponse.json({ success: true, question: updated });
}

/**
 * DELETE /api/admin/question-pool/[id]
 * Soft-delete: sets active=false (never hard delete)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;

  const { data: current, error: fetchError } = await supabaseAdmin
    .from('question_pool')
    .select('id, active')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('question_pool')
    .update({ active: false })
    .eq('id', id);

  if (updateError) {
    console.error('[Admin API] question_pool soft-delete error:', updateError);
    return NextResponse.json({ error: 'Failed to disable question' }, { status: 500 });
  }

  await logAdminAction({
    adminUserId: admin.id,
    adminEmail: admin.email,
    actionType: 'question_pool_disable',
    targetType: 'question_pool',
    targetId: id,
    targetName: id,
    previousValue: { active: current.active },
    newValue: { active: false },
  });

  return NextResponse.json({ success: true });
}
