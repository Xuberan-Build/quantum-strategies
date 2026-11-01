import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../../../admin-layout.module.css';
import PieceEditor from '@/components/admin/studio/calendar/PieceEditor';
import { pieceTypeColor, pieceTypeLabel } from '@/lib/content/calendar';

export const dynamic = 'force-dynamic';

export default async function PieceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: piece, error } = await supabaseAdmin
    .from('content_pieces')
    .select('*, source:content_posts!content_pieces_source_post_id_fkey(id, slug, title, body)')
    .eq('id', id)
    .single();
  if (error || !piece) notFound();

  const source = (piece as any).source as { id: string; slug: string; title: string; body: string } | null;

  // Sibling pieces from the same source, for quick hopping
  const { data: siblings } = source
    ? await supabaseAdmin
        .from('content_pieces')
        .select('id, title, piece_type, scheduled_for, status')
        .eq('source_post_id', source.id)
        .order('scheduled_for')
    : { data: [] };

  const month = piece.scheduled_for ? String(piece.scheduled_for).slice(0, 7) : undefined;

  return (
    <div>
      <header className={styles.pageHeader} style={{ marginBottom: '1rem' }}>
        <div>
          <Link href={`/admin/studio/social-calendar${month ? `?month=${month}` : ''}`} style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Calendar
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: pieceTypeColor(piece.piece_type) }}>{pieceTypeLabel(piece.piece_type)}</span>
            {piece.title ?? '(untitled)'}
          </h1>
          {source && (
            <p className={styles.pageDescription}>
              From{' '}
              <a href={`https://quantumstrategies.online/articles/${source.slug}`} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            </p>
          )}
        </div>
      </header>

      <PieceEditor
        piece={piece as any}
        sourceBody={source?.body ?? ''}
        siblings={(siblings ?? []) as any}
      />
    </div>
  );
}
