import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaign_id } = await params;
    const body = await request.json();
    const { list_id, user_ids: directUserIds = [] } = body;

    // Resolve list members
    let listUserIds: string[] = [];
    if (list_id) {
      const { data: members, error } = await supabaseAdmin
        .from('list_members')
        .select('user_id')
        .eq('list_id', list_id);
      if (error) throw error;
      listUserIds = (members || []).map((m: any) => m.user_id);
    }

    const allUserIds = [...new Set([...listUserIds, ...directUserIds])];
    if (allUserIds.length === 0) {
      return NextResponse.json({ enrolled: 0 });
    }

    // Get first step delay
    const { data: firstStep } = await supabaseAdmin
      .from('campaign_steps')
      .select('delay_hours')
      .eq('campaign_id', campaign_id)
      .eq('step_number', 1)
      .single();

    const delayHours = firstStep?.delay_hours ?? 0;
    const next_send_at = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

    const rows = allUserIds.map((user_id: string) => ({
      campaign_id,
      user_id,
      status: 'active',
      current_step: 1,
      next_send_at,
      enrolled_at: new Date().toISOString(),
    }));

    const { data, error } = await supabaseAdmin
      .from('campaign_enrollments')
      .insert(rows)
      .select();

    // Ignore unique constraint violations (already enrolled)
    if (error && error.code !== '23505') throw error;

    return NextResponse.json({ enrolled: data?.length ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
