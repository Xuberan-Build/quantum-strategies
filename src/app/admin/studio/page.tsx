import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

const FORMAT_META: Record<string, { label: string; color: string }> = {
  ebook:      { label: 'Ebook',      color: '#8b5cf6' },
  webinar:    { label: 'Webinar',    color: '#3b82f6' },
  ecourse:    { label: 'E-Course',   color: '#10b981' },
  whitepaper: { label: 'Whitepaper', color: '#f59e0b' },
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  brief:     { label: 'Brief',     badge: styles.badgeNeutral },
  research:  { label: 'Research',  badge: styles.badgeNeutral },
  outline:   { label: 'Outline',   badge: styles.badgeWarning },
  draft:     { label: 'Draft',     badge: styles.badgeWarning },
  review:    { label: 'Review',    badge: styles.badgeDanger },
  published: { label: 'Published', badge: styles.badgeSuccess },
};

export default async function StudioPage() {
  const { data: pillars } = await supabaseAdmin
    .from('content_angles')
    .select(`
      id, title, format, audience, status, created_at, updated_at,
      content_sections(count),
      content_pieces(count)
    `)
    .order('updated_at', { ascending: false });

  const all = pillars ?? [];
  const byStatus = {
    draft:     all.filter((p) => ['brief', 'research', 'outline', 'draft'].includes(p.status)),
    review:    all.filter((p) => p.status === 'review'),
    published: all.filter((p) => p.status === 'published'),
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.pageTitle}>Content Studio</h1>
            <p className={styles.pageDescription}>
              Build long-form pillars · distribute to blog, social, email, and GPT products
            </p>
          </div>
          <Link href="/admin/studio/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            + New Pillar
          </Link>
        </div>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Pillars</div>
          <div className={styles.statValue}>{all.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>In Progress</div>
          <div className={styles.statValue}>{byStatus.draft.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>In Review</div>
          <div className={styles.statValue} style={{ color: byStatus.review.length > 0 ? 'var(--admin-warning)' : undefined }}>
            {byStatus.review.length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {byStatus.published.length}
          </div>
        </div>
      </div>

      {all.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No pillars yet</p>
            <p className={styles.emptyDescription}>
              Create your first long-form content pillar and let the studio distribute it everywhere.
            </p>
            <Link href="/admin/studio/new" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: '1rem' }}>
              Create First Pillar
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>All Pillars</h2>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Pillar</th>
                <th>Format</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Sections</th>
                <th style={{ textAlign: 'right' }}>Pieces</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {all.map((p) => {
                const fmt = FORMAT_META[p.format] ?? { label: p.format, color: '#6b7280' };
                const st = STATUS_META[p.status] ?? { label: p.status, badge: styles.badgeNeutral };
                const sections = Array.isArray(p.content_sections) ? p.content_sections[0]?.count ?? 0 : 0;
                const pieces   = Array.isArray(p.content_pieces)   ? p.content_pieces[0]?.count   ?? 0 : 0;
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{p.title}</div>
                      {p.audience && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                          {p.audience}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: fmt.color }}>
                        {fmt.label}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${st.badge}`}>{st.label}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                      {sections}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                      {pieces}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.updated_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        href={`/admin/studio/${p.id}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
