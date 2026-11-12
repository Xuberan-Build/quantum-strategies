import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, requireAdmin, serverError } from '@/lib/social/api';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const { data: target } = await supabaseAdmin.from('social_post_targets').select('id, post_id, status').eq('id', id).maybeSingle();
    if (!target) return jsonError('Target not found', 404);
    if (target.status !== 'failed' && target.status !== 'needs_action') return jsonError('Only failed or needs-action targets can be retried', 409);

    const { error } = await supabaseAdmin
      .from('social_post_targets')
      .update({ status: 'pending', attempts: 0, error: null, next_attempt_at: null, state: {}, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from('social_posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', target.post_id)
      .in('status', ['failed', 'partial']);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('retry target', err);
  }
}
