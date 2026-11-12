import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin, serverError } from '@/lib/social/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const q = (req.nextUrl.searchParams.get('q') ?? '').replace(/[%_,()*\\]/g, ' ').trim().slice(0, 100);
  const id = req.nextUrl.searchParams.get('id');
  try {
    if (id) {
      // Direct import from the calendar (?piece=<id>), any status.
      const { data, error } = await supabaseAdmin
        .from('content_pieces')
        .select('id, title, piece_type, status, scheduled_for, body')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return NextResponse.json({ pieces: data ? [data] : [] });
    }
    let query = supabaseAdmin
      .from('content_pieces')
      .select('id, title, piece_type, status, scheduled_for, body')
      .neq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (q) query = query.ilike('title', `%${q}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rank = (s: string) => (s === 'approved' ? 0 : s === 'review' ? 1 : 2);
    const pieces = (data ?? []).sort((a, b) => rank(a.status) - rank(b.status)).slice(0, 50);
    return NextResponse.json({ pieces });
  } catch (err) {
    return serverError('list pieces', err);
  }
}
