import { notFound } from 'next/navigation';
import { DeckPresenter } from '@/components/admin/brain/DeckPresenter';
import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { parseSlideParam } from '@/components/admin/brain/deckNavigation';
import { deckContentHash } from '@/lib/brain/deck-hash';
import { deckReadStatus, resumeIndex } from '@/lib/brain/deck-reads';
import { getArchivedDeck, getBrainSnapshot, loadFeedback } from '@/lib/brain/load';
import { loadDeckList, loadDeckReads, readingQueue } from '@/lib/brain/reading';
import { PILLAR_ORDER, pillarTitles } from '@/lib/brain/viz';
import type { PillarSlug } from '@/lib/brain/snapshot';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string | string[]; from?: string }>;
}

/** Slug-derived titles when no snapshot is available to name the pillars. */
function fallbackPillarTitles(): Record<PillarSlug, string> {
  return Object.fromEntries(
    PILLAR_ORDER.map((slug) => [slug, slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())]),
  ) as Record<PillarSlug, string>;
}

export default async function BrainDeckPage({ params, searchParams }: PageProps) {
  const [{ id: rawId }, query, { snapshot, error }] = await Promise.all([params, searchParams, getBrainSnapshot()]);
  const id = decodeURIComponent(rawId);

  // Snapshot decks first (as before), then the retained archive in Storage.
  const fromSnapshot = snapshot?.decks.find((d) => d.id === id);
  const archived = fromSnapshot ? null : await getArchivedDeck(id);
  const deck = fromSnapshot ?? archived;
  if (!deck) {
    if (!snapshot) return <BrainEmptyState error={error} />;
    notFound();
  }

  const [feedback, { reads, error: readsError }, { decks }] = await Promise.all([loadFeedback('deck', deck.id), loadDeckReads(), loadDeckList()]);
  const contentHash = deckContentHash(deck);
  const myRead = reads[deck.id] ?? null;
  const status = deckReadStatus(myRead, contentHash);
  // ?s= wins; otherwise resume an unfinished read where it stopped.
  const hasSlideParam = query.s !== undefined && query.s !== '';
  const resumeAt = hasSlideParam ? null : resumeIndex(myRead, status, deck.slides.length);
  const initialIndex = hasSlideParam ? parseSlideParam(query.s, deck.slides.length) : resumeAt ?? 0;
  const sourceDates = snapshot ? Object.fromEntries(snapshot.sources.map((s) => [s.path, s.updatedAt])) : {};

  return (
    <DeckPresenter
      deck={deck}
      pillarTitles={snapshot ? pillarTitles(snapshot) : fallbackPillarTitles()}
      sourceDates={sourceDates}
      brainCommit={snapshot?.brainCommit}
      initialIndex={initialIndex}
      backHref={archived || query.from === 'decks' ? '/admin/brain/decks' : '/admin/brain'}
      externalUrl={archived?.externalUrl}
      feedback={feedback}
      reading={{
        contentHash,
        initial: myRead,
        error: readsError,
        queue: readingQueue(decks, reads),
        resumedAt: resumeAt,
      }}
    />
  );
}
