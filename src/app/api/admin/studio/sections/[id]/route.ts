import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const { data: current } = await supabaseAdmin
    .from('content_sections')
    .select('body, version_history')
    .eq('id', id)
    .single();

  const updates: Record<string, unknown> = {};
  const allowed = ['title', 'description', 'order_index', 'status'];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if ('body' in body && current) {
    const history = Array.isArray(current.version_history) ? current.version_history : [];
    if (current.body && current.body !== body.body) {
      updates.version_history = [...history, { body: current.body, updated_at: new Date().toISOString() }];
    }
    updates.body = body.body;
  }

  const { data, error } = await supabaseAdmin
    .from('content_sections')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ section: data });
}
