import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaign_id } = await params;
    const body = await request.json();
    const { list_id, user_ids: explicitUserIds } = body;

    if (!list_id && (!explicitUserIds || explicitUserIds.length === 0)) {
      return NextResponse.json({ error: 'list_id or user_ids is required' }, { status: 400 });
    }

    let user_ids: string[] = explicitUserIds || [];

    if (list_id) {
      const { data: members, error } = await supabaseAdmin
        .from('list_members')
        .select('user_id')
        .eq('list_id', list_id);
      if (error) throw error;
      user_ids = [...new Set([...user_ids, ...(members || []).map((m: any) => m.user_id)])];
    }

    if (user_ids.length === 0) {
      return NextResponse.json({ enrolled: 0, message: 'No users to enroll' });
    }

    // Get first step delay to compute next_send_at
    const { data: firstStep } = await supabaseAdmin
      .from('campaign_steps')
      .select('delay_hours')
      .eq('campaign_id', campaign_id)
      .order('step_number')
      .limit(1)
      .single();

    const delay_hours = firstStep?.delay_hours ?? 0;
    const next_send_at = new Date(Date.now() + delay_hours * 3600 * 1000).toISOString();

    const rows = user_ids.map((user_id) => ({
      campaign_id,
      user_id,
      status: 'active',
      current_step: 1,
      next_send_at,
    }));

    // Insert, skip conflicts (already enrolled)
    const { data: inserted, error } = await supabaseAdmin
      .from('campaign_enrollments')
      .upsert(rows, { onConflict: 'campaign_id,user_id', ignoreDuplicates: true })
      .select('id');

    if (error) throw error;

    return NextResponse.json({ enrolled: inserted?.length ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
