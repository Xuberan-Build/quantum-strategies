import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    const { id } = await params;

    const [campaignRes, stepsRes, enrollmentRes] = await Promise.all([
      supabaseAdmin.from('campaigns').select('*').eq('id', id).single(),
      supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('campaign_id', id)
        .order('step_number'),
      supabaseAdmin
        .from('campaign_enrollments')
        .select('status')
        .eq('campaign_id', id),
    ]);

    if (campaignRes.error) throw campaignRes.error;
    if (!campaignRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const enrollmentCounts: Record<string, number> = {};
    for (const row of enrollmentRes.data || []) {
      enrollmentCounts[row.status] = (enrollmentCounts[row.status] ?? 0) + 1;
    }

    return NextResponse.json({
      ...campaignRes.data,
      steps: stepsRes.data || [],
      enrollment_counts: enrollmentCounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
