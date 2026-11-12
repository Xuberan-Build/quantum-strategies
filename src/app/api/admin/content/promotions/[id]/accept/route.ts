import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { acceptPromotion } from '@/lib/content/any-to-any/winners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** POST /api/admin/content/promotions/[id]/accept  body?: { scheduled_for? } → { promotion, piece, warnings } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await readJson(req)) ?? {};
  try {
    const result = await acceptPromotion(supabaseAdmin, id, {
      createdBy: auth.admin.id,
      scheduledFor: typeof body.scheduled_for === 'string' && body.scheduled_for ? body.scheduled_for : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/not found|no longer exists/i.test(msg)) return jsonError(msg, 404);
    if (/already/i.test(msg)) return jsonError(msg, 409);
    return serverError('accept promotion', err);
  }
}
