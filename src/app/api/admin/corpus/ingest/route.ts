import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { source_type, source_url, raw_text, tradition_tags, pillar_id } = body;

  if (!source_type || !['url', 'pdf', 'text', 'youtube'].includes(source_type)) {
    return NextResponse.json({ error: 'source_type must be one of: url, pdf, text, youtube' }, { status: 400 });
  }
  if (source_type === 'url' && !source_url?.trim()) {
    return NextResponse.json({ error: 'source_url is required for source_type=url' }, { status: 400 });
  }
  if (source_type === 'text' && !raw_text?.trim()) {
    return NextResponse.json({ error: 'raw_text is required for source_type=text' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('corpus_ingestion_queue')
    .insert({
      source_type,
      source_url: source_url?.trim() ?? null,
      raw_text: raw_text?.trim() ?? null,
      tradition_tags: Array.isArray(tradition_tags) ? tradition_tags : [],
      pillar_id: pillar_id ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[corpus/ingest] insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
