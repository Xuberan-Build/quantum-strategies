import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';
import ContentPillarMapper from '@/components/admin/ContentPillarMapper';

// Auth handled by middleware.ts
export default async function ContentPage() {
  const [postsRes, pillarsRes] = await Promise.all([
    supabaseAdmin
      .from('content_posts')
      .select('id, slug, type, title, is_published, pillar_id')
      .order('type')
      .order('title'),
    supabaseAdmin
      .from('content_pillars')
      .select('id, title')
      .order('created_at'),
  ]);

  const posts   = postsRes.data   ?? [];
  const pillars = pillarsRes.data ?? [];

  const published   = posts.filter((p) => p.is_published).length;
  const linked      = posts.filter((p) => p.pillar_id).length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.pageTitle}>Content</h1>
            <p className={styles.pageDescription}>Blog posts, whitepapers, and resources</p>
          </div>
          <Link href="/admin/content/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            + New Post
          </Link>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total</div>
          <div className={styles.statValue}>{posts.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue}>{published}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pillar-Linked</div>
          <div className={styles.statValue} style={{ color: linked < posts.length ? 'var(--admin-warning)' : undefined }}>
            {linked}/{posts.length}
          </div>
        </div>
      </div>

      <ContentPillarMapper posts={posts} pillars={pillars} />
    </div>
  );
}
