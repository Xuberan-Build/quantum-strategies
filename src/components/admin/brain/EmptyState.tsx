import { BRAIN_BUCKET, BRAIN_LATEST_PATH } from '@/lib/brain/snapshot';
import { MyceliumGlyph } from './primitives';
import styles from './brain.module.css';

/** Shown when no valid snapshot could be loaded. Explains how to produce one. */
export function BrainEmptyState({ error }: { error?: string }) {
  return (
    <div className={styles.content}>
      <section className={styles.empty}>
        <MyceliumGlyph className={styles.emptyGlyph} />
        <div className={styles.eyebrow}>No snapshot yet</div>
        <h1 className={styles.pageTitle}>The brain hasn&rsquo;t ticked</h1>
        <p className={styles.pageLede}>
          These dashboards render a distilled snapshot of the private brain. Nothing has been published to Storage yet, or the
          latest file failed validation.
        </p>
        <ol className={styles.steps}>
          <li>
            Run the brain tick locally (the orchestration in <code className={styles.mono}>scripts/brain/</code>). It reads the
            brain markdown, builds a snapshot that matches <code className={styles.mono}>BrainSnapshotSchema</code>, and uploads it:
            <span className={styles.code}>{`${BRAIN_BUCKET}/${BRAIN_LATEST_PATH}\n${BRAIN_BUCKET}/snapshots/<date>.json`}</span>
          </li>
          <li>
            In development you can also drop a file at <code className={styles.mono}>brain/.snapshots/latest.json</code>. It is
            read only when Storage has nothing and <code className={styles.mono}>NODE_ENV</code> is development.
          </li>
          <li>Reload this page. The overview shows when it was generated and from which brain commit.</li>
        </ol>
        {error && (
          <p className={`${styles.small} ${styles.muted}`} style={{ marginTop: '1.5rem' }}>
            Last attempt: <span className={styles.mono}>{error}</span>
          </p>
        )}
      </section>
    </div>
  );
}
