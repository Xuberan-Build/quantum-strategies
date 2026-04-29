import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

const STATUS_META: Record<string, { label: string; badge: string }> = {
  brief:     { label: 'Brief',     badge: styles.badgeNeutral },
  research:  { label: 'Research',  badge: styles.badgeNeutral },
  outline:   { label: 'Outline',   badge: styles.badgeWarning },
  draft:     { label: 'Draft',     badge: styles.badgeWarning },
  review:    { label: 'Review',    badge: styles.badgeDanger },
  published: { label: 'Published', badge: styles.badgeSuccess },
};

interface Props {
  format: string;
  formatLabel: string;
  formatColor: string;
}

export async function StudioFormatList({ format, formatLabel, formatColor }: Props) {
  const { data: pieces } = await supabaseAdmin
    .from('content_angles')
    .select(`
      id, title, audience, status, metadata, created_at, updated_at,
      content_sections(count),
      content_pieces(count)
    `)
    .eq('format', format)
    .order('updated_at', { ascending: false });

  const all = pieces ?? [];
  const drafting   = all.filter((p) => ['draft', 'review'].includes(p.status)).length;
  const published  = all.filter((p) => p.status === 'published').length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
              ← Studio Hub
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
              <h1 className={styles.pageTitle} style={{ margin: 0 }}>{formatLabel} Studio</h1>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: formatColor }}>
                {all.length} piece{all.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <Link href={`/admin/studio/new?format=${format}`} className={`${styles.btn} ${styles.btnPrimary}`}>
            + New {formatLabel}
          </Link>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total</div>
          <div className={styles.statValue}>{all.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>In Progress</div>
          <div className={styles.statValue}>{all.length - drafting - published}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Drafting / Review</div>
          <div className={styles.statValue} style={{ color: drafting > 0 ? 'var(--admin-warning)' : undefined }}>
            {drafting}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>{published}</div>
        </div>
      </div>

      {all.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No {formatLabel.toLowerCase()}s yet</p>
            <p className={styles.emptyDescription}>
              Accept a strategy suggestion or create a new piece from scratch.
            </p>
            <Link href={`/admin/studio/new?format=${format}`} className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: '1rem' }}>
              Create First {formatLabel}
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>All {formatLabel}s</h2>
            {(drafting > 0 || published > 0) && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                {drafting > 0 && `${drafting} drafting`}
                {drafting > 0 && published > 0 && ' · '}
                {published > 0 && `${published} published`}
              </span>
            )}
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Pillar</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Sections</th>
                <th style={{ textAlign: 'right' }}>Derivatives</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {all.map((p) => {
                const st = STATUS_META[p.status] ?? { label: p.status, badge: styles.badgeNeutral };
                const sections    = Array.isArray(p.content_sections) ? p.content_sections[0]?.count ?? 0 : 0;
                const derivatives = Array.isArray(p.content_pieces)   ? p.content_pieces[0]?.count ?? 0   : 0;
                const meta        = (p.metadata ?? {}) as Record<string, string>;

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.title}</div>
                      {p.audience && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                          {p.audience}
                        </div>
                      )}
                    </td>
                    <td>
                      {meta.pillar_title
                        ? <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{meta.pillar_title}</span>
                        : <span style={{ fontSize: '0.8125rem', color: 'var(--admin-warning)' }}>⚠ unlinked</span>
                      }
                    </td>
                    <td><span className={`${styles.badge} ${st.badge}`}>{st.label}</span></td>
                    <td style={{ textAlign: 'right', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>{sections}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>{derivatives}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(p.updated_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link href={`/admin/studio/${p.id}`} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
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
