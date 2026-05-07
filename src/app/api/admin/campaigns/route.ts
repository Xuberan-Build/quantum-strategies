import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET() {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select(`
        *,
        campaign_steps(count),
        campaign_enrollments(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (campaigns || []).map((c: any) => ({
      ...c,
      step_count: c.campaign_steps?.[0]?.count ?? 0,
      active_enrollment_count: 0,
      campaign_steps: undefined,
      campaign_enrollments: undefined,
    }));

    // Fetch active enrollment counts separately (can't filter nested count in supabase-js)
    const ids = result.map((c: any) => c.id);
    if (ids.length > 0) {
      const { data: active } = await supabaseAdmin
        .from('campaign_enrollments')
        .select('campaign_id')
        .in('campaign_id', ids)
        .eq('status', 'active');

      const activeCounts: Record<string, number> = {};
      for (const row of active || []) {
        activeCounts[row.campaign_id] = (activeCounts[row.campaign_id] ?? 0) + 1;
      }
      result.forEach((c: any) => { c.active_enrollment_count = activeCounts[c.id] ?? 0; });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });
  try {
    const body = await request.json();
    const { name, description, trigger_type, trigger_product_slug, from_name, from_email } = body;

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({ name, description, trigger_type, trigger_product_slug, from_name, from_email })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
