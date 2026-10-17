import { DeckArchive } from '@/components/admin/brain/DeckArchive';
import { Banner } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot, listArchivedDecks } from '@/lib/brain/load';
import type { DeckIndexEntry } from '@/lib/brain/snapshot';

export const dynamic = 'force-dynamic';

export default async function BrainDecksPage() {
  const [archive, { snapshot }] = await Promise.all([listArchivedDecks(), getBrainSnapshot()]);

  // Snapshot decks that are not (yet) in the archive still show, tagged "snapshot".
  const archivedIds = new Set(archive.decks.map((d) => d.id));
  const fromSnapshot: DeckIndexEntry[] = (snapshot?.decks ?? [])
    .filter((d) => !archivedIds.has(d.id))
    .map((d, i) => ({
      id: d.id,
      title: d.title,
      period: d.period,
      summary: d.summary,
      createdAt: snapshot!.generatedAt,
      status: i === 0 ? 'current' : 'superseded',
      slideCount: d.slides.length,
      tags: ['snapshot'],
    }));
  const decks = [...archive.decks, ...fromSnapshot].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <div className={styles.eyebrow}>Archive</div>
        <h1 className={styles.pageTitle}>Decks</h1>
        <p className={styles.pageLede}>
          Every deck the brain has published, kept even after newer ones replace it. Newest first. Decks come from{' '}
          <span className={styles.mono}>brain/decks/</span>; the briefing decks in the latest snapshot are tagged “snapshot”.
        </p>
      </header>
      {archive.source === 'local' && (
        <Banner label="Development fallback" tone="info">
          Listed from <span className={styles.mono}>brain/decks/</span> because Storage returned nothing.
        </Banner>
      )}
      {archive.error && archive.source === 'none' && (
        <Banner label="Archive unavailable">
          {archive.error}. Run <span className={styles.mono}>scripts/brain/publish-decks.ts</span> to publish the archive.
        </Banner>
      )}
      <DeckArchive decks={decks} />
    </div>
  );
}
