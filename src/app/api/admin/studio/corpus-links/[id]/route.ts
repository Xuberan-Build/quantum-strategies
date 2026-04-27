import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// Toggle curated state on a corpus link
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { curated } = await req.json();

  const { data, error } = await supabaseAdmin
    .from('content_corpus_links')
    .update({ curated })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from('content_corpus_links').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
