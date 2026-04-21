import styles from '../admin-layout.module.css';

// Auth is handled by middleware.ts
export default async function PromptsPage() {
  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Prompts</h1>
        <p className={styles.pageDescription}>
          Manage AI prompts with version control
        </p>
      </header>

      <div className={styles.card}>
        <p style={{ color: 'var(--admin-text-muted)' }}>
          Prompt editor coming next...
        </p>
      </div>
    </div>
  );
}
