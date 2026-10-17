import { notFound } from 'next/navigation';
import { DeckPresenter } from '@/components/admin/brain/DeckPresenter';
import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { parseSlideParam } from '@/components/admin/brain/deckNavigation';
import { getArchivedDeck, getBrainSnapshot, loadFeedback } from '@/lib/brain/load';
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

  const feedback = await loadFeedback('deck', deck.id);
  const sourceDates = snapshot ? Object.fromEntries(snapshot.sources.map((s) => [s.path, s.updatedAt])) : {};

  return (
    <DeckPresenter
      deck={deck}
      pillarTitles={snapshot ? pillarTitles(snapshot) : fallbackPillarTitles()}
      sourceDates={sourceDates}
      brainCommit={snapshot?.brainCommit}
      initialIndex={parseSlideParam(query.s, deck.slides.length)}
      backHref={archived || query.from === 'decks' ? '/admin/brain/decks' : '/admin/brain'}
      externalUrl={archived?.externalUrl}
      feedback={feedback}
    />
  );
}
