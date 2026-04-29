import { supabaseAdmin } from '@/lib/supabase/server';
import NewContentPieceForm from './NewContentPieceForm';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default async function NewContentPiecePage() {
  const { data: pillars } = await supabaseAdmin
    .from('content_pillars')
    .select('id, title')
    .order('title');

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Studio
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>New Content Piece</h1>
          <p className={styles.pageDescription}>
            Create a new long-form piece (ebook, whitepaper, ecourse, webinar) linked to a strategic pillar.
          </p>
        </div>
      </header>
      <NewContentPieceForm pillars={pillars ?? []} />
    </div>
  );
}
