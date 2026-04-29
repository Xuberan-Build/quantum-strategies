import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data: lists, error } = await supabaseAdmin
      .from('contact_lists')
      .select('*, list_members(count)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (lists || []).map((l: any) => ({
      ...l,
      member_count: l.list_members?.[0]?.count ?? 0,
      list_members: undefined,
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, list_type = 'static', filter_criteria, created_by } = body;

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('contact_lists')
      .insert({ name, description, list_type, filter_criteria, created_by })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
