import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const body = await request.json();
    const { delay_hours, subject, html_body, text_body } = body;

    const { data, error } = await supabaseAdmin
      .from('campaign_steps')
      .update({ delay_hours, subject, html_body, text_body })
      .eq('id', stepId)
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
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const { error } = await supabaseAdmin.from('campaign_steps').delete().eq('id', stepId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
