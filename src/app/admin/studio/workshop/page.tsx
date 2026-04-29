import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import WorkshopCreateForm from '@/components/admin/studio/workshop/WorkshopCreateForm';

export default async function WorkshopStudioPage() {
  const { data: workshops } = await supabaseAdmin
    .from('workshops')
    .select('id, title, slug, status, updated_at, workshop_modules(count)')
    .order('updated_at', { ascending: false });

  const all = workshops ?? [];

  const statusBadge: Record<string, string> = {
    draft: styles.badgeNeutral,
    published: styles.badgeSuccess,
    archived: styles.badgeDanger,
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
              ← Studio Hub
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
              <h1 className={styles.pageTitle} style={{ margin: 0 }}>Workshop Studio</h1>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ec4899' }}>
                {all.length} workshop{all.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total</div>
          <div className={styles.statValue}>{all.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {all.filter((w) => w.status === 'published').length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Drafts</div>
          <div className={styles.statValue}>
            {all.filter((w) => w.status === 'draft').length}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        <div className={styles.card}>
          {all.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No workshops yet</p>
              <p className={styles.emptyDescription}>Create your first workshop using the form.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Modules</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {all.map((w) => {
                  const moduleCount = Array.isArray(w.workshop_modules) ? w.workshop_modules[0]?.count ?? 0 : 0;
                  return (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 500 }}>{w.title}</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>{w.slug}</td>
                      <td style={{ fontSize: '0.875rem' }}>{moduleCount}</td>
                      <td>
                        <span className={`${styles.badge} ${statusBadge[w.status] ?? styles.badgeNeutral}`}>
                          {w.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                        {new Date(w.updated_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link href={`/admin/studio/workshop/${w.id}`} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>New Workshop</h2>
          </div>
          <WorkshopCreateForm />
        </div>
      </div>
    </div>
  );
}
