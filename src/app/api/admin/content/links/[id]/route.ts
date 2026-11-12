import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { jsonError, requireAdmin, serverError } from '@/lib/social/api';
import { GraphValidationError, unlinkAssets } from '@/lib/content/any-to-any/graph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** DELETE → { ok: true } (404 when the link doesn't exist) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const deleted = await unlinkAssets(supabaseAdmin, id);
    if (!deleted) return jsonError('Link not found', 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GraphValidationError) return jsonError(err.message, 400);
    return serverError('unlink assets', err);
  }
}
