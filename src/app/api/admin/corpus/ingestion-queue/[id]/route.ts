import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = ['status', 'evaluator_output', 'quality_score', 'rejection_reason', 'tradition_tags', 'pillar_id', 'reviewed_at'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (updates.status === 'approved' || updates.status === 'rejected') {
    updates.reviewed_at = new Date().toISOString();
    if (updates.status === 'approved') updates.approved_by = admin.id;
  }

  const { data, error } = await supabaseAdmin
    .from('corpus_ingestion_queue')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('corpus_ingestion_queue')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
