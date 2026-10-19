import { DeckArchive } from '@/components/admin/brain/DeckArchive';
import { Banner } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { loadDeckList, loadDeckNoteStats, loadDeckReads } from '@/lib/brain/reading';

export const dynamic = 'force-dynamic';

export default async function BrainDecksPage() {
  const [{ decks, archiveSource, archiveError }, { reads, error: readsError }, { stats }] = await Promise.all([
    loadDeckList(),
    loadDeckReads(),
    loadDeckNoteStats(),
  ]);

  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <div className={styles.eyebrow}>Archive</div>
        <h1 className={styles.pageTitle}>Decks</h1>
        <p className={styles.pageLede}>
          Every deck the brain has published, kept even after newer ones replace it. Unread decks come first. Decks come from{' '}
          <span className={styles.mono}>brain/decks/</span>; the briefing decks in the latest snapshot are tagged “snapshot”.
        </p>
      </header>
      {archiveSource === 'local' && (
        <Banner label="Development fallback" tone="info">
          Listed from <span className={styles.mono}>brain/decks/</span> because Storage returned nothing.
        </Banner>
      )}
      {archiveError && archiveSource === 'none' && (
        <Banner label="Archive unavailable">
          {archiveError}. Run <span className={styles.mono}>scripts/brain/publish-decks.ts</span> to publish the archive.
        </Banner>
      )}
      {readsError && decks.length > 0 && (
        <Banner label="Read status unavailable" tone="info">
          {readsError}. Decks still open; read marks will not be saved until the{' '}
          <span className={styles.mono}>brain_deck_reads</span> migration is applied.
        </Banner>
      )}
      <DeckArchive decks={decks} reads={reads} noteStats={stats} />
    </div>
  );
}
