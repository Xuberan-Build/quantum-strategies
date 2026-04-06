import Link from 'next/link';
import ContentPostForm from '@/components/admin/ContentPostForm';
import styles from '../../admin-layout.module.css';

export default function NewContentPage() {
  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/content" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>New Post</h1>
        </div>
        <p className={styles.pageDescription}>Create a new blog post, whitepaper, or resource</p>
      </header>

      <ContentPostForm mode="create" />
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
