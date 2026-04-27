import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import PillarWorkspace from '@/components/admin/studio/PillarWorkspace';

type Params = { params: Promise<{ id: string }> };

export default async function PillarPage({ params }: Params) {
  const { id } = await params;

  const [pillarRes, sectionsRes, piecesRes, linksRes] = await Promise.all([
    supabaseAdmin.from('content_angles').select('*').eq('id', id).single(),
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

  if (pillarRes.error || !pillarRes.data) notFound();

  return (
    <PillarWorkspace
      pillar={pillarRes.data}
      initialSections={sectionsRes.data ?? []}
      initialPieces={piecesRes.data ?? []}
      initialCorpusLinks={(linksRes.data ?? []).map((l) => ({
        ...l,
        knowledge_chunks: Array.isArray(l.knowledge_chunks)
          ? l.knowledge_chunks[0]
          : l.knowledge_chunks,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any}
    />
  );
}
