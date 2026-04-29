import { supabaseAdmin } from '@/lib/supabase/server';
import NewContentPieceForm from './NewContentPieceForm';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

const FORMAT_LABELS: Record<string, string> = {
  ebook:      'Ebook',
  whitepaper: 'Whitepaper',
  ecourse:    'E-Course',
  webinar:    'Webinar',
};

type SearchParams = Promise<{ format?: string }>;

export default async function NewContentPiecePage({ searchParams }: { searchParams: SearchParams }) {
  const { format } = await searchParams;
  const validFormat = format && FORMAT_LABELS[format] ? format : undefined;
  const backHref = validFormat ? `/admin/studio/${validFormat}` : '/admin/studio';

  const { data: pillars } = await supabaseAdmin
    .from('content_pillars')
    .select('id, title')
    .order('title');

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href={backHref} style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← {validFormat ? `${FORMAT_LABELS[validFormat]} Studio` : 'Studio Hub'}
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>
            New {validFormat ? FORMAT_LABELS[validFormat] : 'Content Piece'}
          </h1>
          <p className={styles.pageDescription}>
            Create a new {validFormat ? FORMAT_LABELS[validFormat].toLowerCase() : 'long-form piece'} linked to a strategic pillar.
            It will open in the full Brief → Research → Outline → Draft → Distribute workspace.
          </p>
        </div>
      </header>
      <NewContentPieceForm pillars={pillars ?? []} defaultFormat={validFormat} />
    </div>
  );
}
