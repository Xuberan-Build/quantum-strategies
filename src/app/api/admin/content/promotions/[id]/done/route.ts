import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, requireAdmin, serverError } from '@/lib/social/api';
import { markDone } from '@/lib/content/any-to-any/winners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/content/promotions/[id]/done → { promotion } (accepted → done, once the longer piece went out) */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    return NextResponse.json({ promotion: await markDone(supabaseAdmin, id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/not found/i.test(msg)) return jsonError(msg, 404);
    if (/only accepted/i.test(msg)) return jsonError(msg, 409);
    return serverError('mark promotion done', err);
  }
}
