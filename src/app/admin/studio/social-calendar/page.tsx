import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default function SocialCalendarPage() {
  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Studio Hub
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>Social Calendar</h1>
          <p className={styles.pageDescription}>Plan and schedule distributed social content across platforms.</p>
        </div>
      </header>

      <div className={styles.card}>
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Social Calendar — Coming Soon</p>
          <p className={styles.emptyDescription}>
            A unified view of all social content generated in the Distribute tab — Twitter threads,
            LinkedIn posts, and Instagram captions — organized into a scheduled publishing queue.
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link href="/admin/studio/ebook" className={`${styles.btn} ${styles.btnPrimary}`}>
              Generate Social from Ebooks
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
          <li>Unified queue: Twitter threads, LinkedIn posts, Instagram captions in one place</li>
          <li>Platform-specific scheduling columns (week view)</li>
          <li>Pull generated pieces from Distribute tab directly into the calendar</li>
          <li>Cadence rules — e.g. 3 Twitter posts/week, 1 LinkedIn/week</li>
          <li>One-click copy to clipboard for each platform</li>
          <li>Buffer / native API publishing integration (future)</li>
        </ul>
      </div>
    </div>
  );
}
