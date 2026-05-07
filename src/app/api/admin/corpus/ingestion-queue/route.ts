import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validateAdminApiRequest } from '@/lib/admin/auth';

export async function GET(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  let query = supabaseAdmin
    .from('corpus_ingestion_queue')
    .select('*, content_pillars(title)')
    .order('submitted_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { admin, error: authError } = await validateAdminApiRequest();
  if (!admin) return NextResponse.json({ error: authError }, { status: 401 });

  const body = await req.json();
  const { source_type, source_url, source_name, raw_text, tradition_tags, pillar_id, status, evaluator_output, quality_score } = body;

  if (!source_type) {
    return NextResponse.json({ error: 'source_type is required' }, { status: 400 });
  }
  if (!source_url && !raw_text) {
    return NextResponse.json({ error: 'source_url or raw_text is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('corpus_ingestion_queue')
    .insert({
      source_type,
      source_url: source_url || null,
      source_name: source_name || null,
      raw_text: raw_text || null,
      tradition_tags: tradition_tags || [],
      pillar_id: pillar_id || null,
      status: status || 'pending',
      evaluator_output: evaluator_output || null,
      quality_score: quality_score ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data }, { status: 201 });
}
