import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, campaign_steps(count), campaign_enrollments(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (campaigns || []).map((c: any) => ({
      ...c,
      step_count: c.campaign_steps?.[0]?.count ?? 0,
      enrollment_count: c.campaign_enrollments?.[0]?.count ?? 0,
      campaign_steps: undefined,
      campaign_enrollments: undefined,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, trigger_type = 'manual', trigger_product_slug, from_name, from_email } = body;

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
