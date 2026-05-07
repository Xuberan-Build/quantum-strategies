import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { moduleId } = await params;
  const { data, error } = await supabaseAdmin
    .from('workshop_slides')
    .select('*')
    .eq('module_id', moduleId)
    .order('position');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slides: data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { moduleId } = await params;
  const { slide_type = 'content', content = {} } = await request.json();

  const { data: last } = await supabaseAdmin
    .from('workshop_slides')
    .select('position')
    .eq('module_id', moduleId)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from('workshop_slides')
    .insert({ module_id: moduleId, slide_type, content, position })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slide: data }, { status: 201 });
}

export const dynamic = 'force-dynamic';
