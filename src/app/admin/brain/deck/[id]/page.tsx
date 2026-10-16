import { notFound } from 'next/navigation';
import { DeckPresenter } from '@/components/admin/brain/DeckPresenter';
import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { parseSlideParam } from '@/components/admin/brain/deckNavigation';
import { getBrainSnapshot } from '@/lib/brain/load';
import { pillarTitles } from '@/lib/brain/viz';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}

export default async function BrainDeckPage({ params, searchParams }: PageProps) {
  const [{ id }, query, { snapshot, error }] = await Promise.all([params, searchParams, getBrainSnapshot()]);
  if (!snapshot) return <BrainEmptyState error={error} />;

  const deck = snapshot.decks.find((d) => d.id === decodeURIComponent(id));
  if (!deck) notFound();

  const sourceDates = Object.fromEntries(snapshot.sources.map((s) => [s.path, s.updatedAt]));

  return (
    <DeckPresenter
      deck={deck}
      pillarTitles={pillarTitles(snapshot)}
      sourceDates={sourceDates}
      brainCommit={snapshot.brainCommit}
      initialIndex={parseSlideParam(query.s, deck.slides.length)}
    />
  );
}
