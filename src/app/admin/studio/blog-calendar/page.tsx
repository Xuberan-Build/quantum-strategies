import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default function BlogCalendarPage() {
  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Studio Hub
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>Blog Calendar</h1>
          <p className={styles.pageDescription}>Editorial planning and scheduling for blog content.</p>
        </div>
      </header>

      <div className={styles.card}>
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Blog Calendar — Coming Soon</p>
          <p className={styles.emptyDescription}>
            Schedule and plan blog content across the 5 strategic pillars. Drag-and-drop calendar view,
            pillar coverage heatmap, and publish queue — planned for the next sprint.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link href="/admin/content" className={`${styles.btn} ${styles.btnPrimary}`}>
              Manage Articles Now
            </Link>
            <Link href="/admin/studio" className={`${styles.btn} ${styles.btnSecondary}`}>
              Back to Hub
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: '1rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Planned Features</h2>
        </div>
        <ul style={{ margin: '0 0 0 1.25rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.875rem', color: 'var(--admin-text-muted)', lineHeight: 1.6 }}>
          <li>Monthly/weekly calendar grid with drag-to-schedule</li>
          <li>Pillar coverage tracking — see which pillars are under/over represented</li>
          <li>Auto-suggest publish dates based on cadence gaps</li>
          <li>Pull in drafted articles from the Article Studio as scheduled items</li>
          <li>Export calendar to CSV or Google Calendar</li>
        </ul>
      </div>
    </div>
  );
}
