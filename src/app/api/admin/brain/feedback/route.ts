/**
 * /api/admin/brain/feedback
 *
 * GET  ?target_type=deck|doc|node&target_id=<id>  → { rows }   (deck includes its slide notes)
 * POST { target_type, target_id, slide_id?, anchor?, kind, body } → { row }
 *
 * Admin only (validateAdminApiRequest). brain_feedback has RLS on and no policies,
 * so it is reached only here, with the service role, after the admin check.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';
import { FeedbackInputSchema, insertFeedback, isValidTargetId, listFeedbackFor } from '@/lib/brain/feedback';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get('target_type') ?? 'deck';
  const targetId = searchParams.get('target_id') ?? searchParams.get('deck_id') ?? '';
  if ((targetType !== 'deck' && targetType !== 'doc' && targetType !== 'node') || !isValidTargetId(targetType, targetId)) {
    return NextResponse.json({ error: 'target_type must be deck, doc or node, with a valid target_id' }, { status: 400 });
  }

  const { data, error: fetchError } = await listFeedbackFor(supabaseAdmin, targetType, targetId);
  if (fetchError) {
    console.error('[brain feedback] list failed:', fetchError.message);
    return NextResponse.json({ error: 'Could not load feedback' }, { status: 500 });
  }
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = FeedbackInputSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { data, error: insertError } = await insertFeedback(supabaseAdmin, parsed.data, admin.id);
  if (insertError || !data) {
    console.error('[brain feedback] insert failed:', insertError?.message);
    return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 });
  }
  return NextResponse.json({ row: data }, { status: 201 });
}
