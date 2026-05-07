'use client';

import type { Pillar, Section, Piece, CorpusLink } from './pillar-workspace/types';
import { DocumentWorkspace } from './pillar-workspace/DocumentWorkspace';

export default function PillarWorkspace({
  pillar,
  initialSections,
  initialPieces,
  initialCorpusLinks,
}: {
  pillar: Pillar;
  initialSections: Section[];
  initialPieces: Piece[];
  initialCorpusLinks: CorpusLink[];
}) {
  return (
    <DocumentWorkspace
      pillar={pillar}
      initialSections={initialSections}
      initialPieces={initialPieces}
      initialCorpusLinks={initialCorpusLinks}
    />
  );
}
