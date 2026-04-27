import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { supabaseAdmin } from '@/lib/supabase/server';

const EMBED_MODEL = 'text-embedding-3-small';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { query, tradition_filter, count = 20, threshold = 0.42 } = await req.json();

  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  // Embed the query
  const embeddingRes = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: query.trim(),
  });
  const queryEmbedding = embeddingRes.data[0].embedding;

  // Vector search
  const { data: vectorMatches, error: vecError } = await supabaseAdmin.rpc('match_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: count,
    filter_tradition: tradition_filter || null,
    filter_priority: null,
    filter_themes: null,
  });
  if (vecError) throw new Error(vecError.message);

  // Keyword search
  const { data: kwMatches } = await supabaseAdmin.rpc('search_knowledge_keyword', {
    query_text: query.trim(),
    match_count: 8,
    filter_tradition: tradition_filter || null,
  });

  // Merge and deduplicate
  type Hit = { id: string; similarity?: number; rank?: number; [key: string]: unknown };
  const seen = new Set<string>();
  const merged: Hit[] = [];
  for (const c of [...(vectorMatches ?? []), ...(kwMatches ?? [])] as Hit[]) {
    if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
  }

  if (merged.length === 0) {
    return NextResponse.json({ links: [], message: 'No matches found — try a broader query or lower threshold' });
  }

  // Save corpus links (upsert — preserve curated state)
  const rows = merged.map((c) => ({
    angle_id: id,
    chunk_id: c.id,
    similarity: typeof c.similarity === 'number' ? c.similarity : null,
    curated: false,
  }));

  const { error: insertError } = await supabaseAdmin
    .from('content_corpus_links')
    .upsert(rows, { onConflict: 'angle_id,chunk_id', ignoreDuplicates: true });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Update pillar: save query and advance status
  await supabaseAdmin
    .from('content_angles')
    .update({ corpus_query: query.trim(), status: 'research' })
    .eq('id', id);

  // Return fresh links with chunk data
  const { data: links } = await supabaseAdmin
    .from('content_corpus_links')
    .select(`
      id, similarity, curated, created_at,
      knowledge_chunks!inner(
        id, tradition, text_name, author, section, chapter,
        content, themes, source_url, priority
      )
    `)
    .eq('angle_id', id)
    .order('similarity', { ascending: false });

  return NextResponse.json({ links: links ?? [], count: merged.length });
}
