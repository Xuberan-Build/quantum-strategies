/**
 * /api/admin/brain/feedback/[id]
 *
 * PATCH { status?, reply?, resolved_note? } → { row }
 * DELETE → { ok: true }
 *
 * Admin only (validateAdminApiRequest); service role after the check.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { BRAIN_FEEDBACK_TABLE, FEEDBACK_COLUMNS, FeedbackUpdateSchema, feedbackPatch, type BrainFeedbackRow } from '@/lib/brain/feedback';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = FeedbackUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join('; ') }, { status: 400 });
  }

  const { data, error: updateError } = await supabaseAdmin
    .from(BRAIN_FEEDBACK_TABLE)
    .update(feedbackPatch(parsed.data))
    .eq('id', id)
    .select(FEEDBACK_COLUMNS)
    .maybeSingle<BrainFeedbackRow>();
  if (updateError) {
    console.error('[brain feedback] update failed:', updateError.message);
    return NextResponse.json({ error: 'Could not update feedback' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ row: data });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { error: deleteError } = await supabaseAdmin.from(BRAIN_FEEDBACK_TABLE).delete().eq('id', id);
  if (deleteError) {
    console.error('[brain feedback] delete failed:', deleteError.message);
    return NextResponse.json({ error: 'Could not delete feedback' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
