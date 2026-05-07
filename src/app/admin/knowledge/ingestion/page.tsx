import { supabaseAdmin } from '@/lib/supabase/server';
import IngestionQueueTable from '@/components/admin/knowledge/IngestionQueueTable';
import styles from '../../admin-layout.module.css';

export default async function IngestionQueuePage() {
  const [queueRes, pillarsRes] = await Promise.all([
    supabaseAdmin
      .from('corpus_ingestion_queue')
      .select('id, source_type, source_url, source_name, tradition_tags, quality_score, status, submitted_at, evaluator_output, rejection_reason, ingested_chunk_ids')
      .order('submitted_at', { ascending: false }),
    supabaseAdmin
      .from('content_pillars')
      .select('id, title')
      .order('title'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (queueRes.data ?? []) as any[];
  const pillars = pillarsRes.data ?? [];

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Ingestion Queue</h1>
          <p className={styles.pageDescription}>
            Sources pending evaluation, review, and ingestion into the RAG corpus
          </p>
        </div>
      </header>

      <IngestionQueueTable initialItems={items} pillars={pillars} />
    </div>
  );
}
