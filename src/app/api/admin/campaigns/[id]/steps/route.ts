import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', id)
      .order('step_number');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaign_id } = await params;
    const body = await request.json();
    const { delay_hours = 0, subject, html_body, text_body } = body;

    if (!subject) return NextResponse.json({ error: 'subject is required' }, { status: 400 });
    if (!html_body) return NextResponse.json({ error: 'html_body is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('campaign_steps')
      .select('step_number')
      .eq('campaign_id', campaign_id)
      .order('step_number', { ascending: false })
      .limit(1)
      .single();

    const step_number = (existing?.step_number ?? 0) + 1;

    const { data, error } = await supabaseAdmin
      .from('campaign_steps')
      .insert({ campaign_id, step_number, delay_hours, subject, html_body, text_body })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
