import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workshop_id } = await params;
  const { data, error } = await supabaseAdmin
    .from('workshop_modules')
    .select('*, workshop_slides(count)')
    .eq('workshop_id', workshop_id)
    .order('position');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modules: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workshop_id } = await params;
  const { title, description, video_url } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from('workshop_modules')
    .select('position')
    .eq('workshop_id', workshop_id)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (existing?.position ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('workshop_modules')
    .insert({ workshop_id, title: title.trim(), description, video_url, position })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data }, { status: 201 });
}

export const dynamic = 'force-dynamic';
