import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const [angleRes, sectionsRes, piecesRes, linksRes] = await Promise.all([
    supabaseAdmin
      .from('content_angles')
      .select('*')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('content_sections')
      .select('*')
      .eq('angle_id', id)
      .order('order_index'),
    supabaseAdmin
      .from('content_pieces')
      .select('*')
      .eq('angle_id', id)
      .order('created_at'),
    supabaseAdmin
      .from('content_corpus_links')
      .select(`
        id, similarity, curated, created_at,
        knowledge_chunks!inner(
          id, tradition, text_name, author, section, chapter,
          content, themes, source_url, priority
        )
      `)
      .eq('angle_id', id)
      .order('similarity', { ascending: false }),
  ]);

  if (angleRes.error) return NextResponse.json({ error: 'Angle not found' }, { status: 404 });

  return NextResponse.json({
    pillar: angleRes.data,
    sections: sectionsRes.data ?? [],
    pieces: piecesRes.data ?? [],
    corpusLinks: linksRes.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const allowed = ['title', 'format', 'audience', 'goal', 'angle', 'tone',
    'tradition_filter', 'corpus_query', 'status', 'topic_id', 'metadata'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabaseAdmin
    .from('content_angles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pillar: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from('content_angles').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
