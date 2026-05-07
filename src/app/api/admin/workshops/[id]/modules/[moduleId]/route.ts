import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { moduleId } = await params;
  const body = await request.json();
  const allowed = ['title', 'description', 'video_url', 'position'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));

  const { data, error } = await supabaseAdmin
    .from('workshop_modules')
    .update(updates)
    .eq('id', moduleId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  const { moduleId } = await params;
  const { error } = await supabaseAdmin.from('workshop_modules').delete().eq('id', moduleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

export const dynamic = 'force-dynamic';
