import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, readJson, requireAdmin, serverError } from '@/lib/social/api';
import { dismissPromotion } from '@/lib/content/any-to-any/winners';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/content/promotions/[id]/dismiss  body?: { notes? } → { promotion } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await readJson(req)) ?? {};
  try {
    const promotion = await dismissPromotion(supabaseAdmin, id, typeof body.notes === 'string' ? body.notes : null);
    return NextResponse.json({ promotion });
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) return jsonError(err.message, 404);
    return serverError('dismiss promotion', err);
  }
}
