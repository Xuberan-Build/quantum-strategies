import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const enrollments = enrollmentRes.data || [];
    const stats = {
      total: enrollments.length,
      active: enrollments.filter((e) => e.status === 'active').length,
      completed: enrollments.filter((e) => e.status === 'completed').length,
      unsubscribed: enrollments.filter((e) => e.status === 'unsubscribed').length,
      failed: enrollments.filter((e) => e.status === 'failed').length,
    };

    return NextResponse.json({
      ...campaignRes.data,
      steps: stepsRes.data || [],
      enrollment_stats: stats,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, status, from_name, from_email, trigger_type, trigger_product_slug } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (from_name !== undefined) updates.from_name = from_name;
    if (from_email !== undefined) updates.from_email = from_email;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (trigger_product_slug !== undefined) updates.trigger_product_slug = trigger_product_slug;

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
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
