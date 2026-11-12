import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { disconnectAccount } from '@/lib/social/accounts';
import { jsonError, requireAdmin, serverError } from '@/lib/social/api';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const { data } = await supabaseAdmin.from('social_accounts').select('id').eq('id', id).maybeSingle();
    if (!data) return jsonError('Account not found', 404);
    await disconnectAccount(supabaseAdmin, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError('disconnect account', err);
  }
}
