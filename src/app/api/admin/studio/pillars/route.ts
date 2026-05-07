import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET() {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('content_angles')
    .select(`
      id, title, format, audience, goal, angle, tone, tradition_filter,
      corpus_query, status, metadata, created_at, updated_at,
      content_sections(count),
      content_pieces(count)
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillars: data });
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const body = await req.json();
  const { title, format, audience, goal, angle, tone, tradition_filter, metadata } = body;

  if (!title?.trim() || !format) {
    return NextResponse.json({ error: 'title and format are required' }, { status: 400 });
  }

  if (!metadata?.pillar_id) {
    return NextResponse.json({ error: 'A strategic pillar is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('content_angles')
    .insert({ title: title.trim(), format, audience, goal, angle, tone, tradition_filter, metadata })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillar: data }, { status: 201 });
}
