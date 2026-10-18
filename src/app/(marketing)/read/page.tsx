import type { Metadata } from 'next';
import { ReadLanding } from '@/components/read/ReadLanding';
import { ReadShell } from '@/components/read/ReadShell';
import { carryQuery, paramsFromRecord, parseUtm, resolveVariant } from '@/components/read/utm';

export const metadata: Metadata = {
  title: 'The Perception Read',
  description:
    'Twelve questions about what you did and said this month. See where last week went, the pattern your answers repeat, and one thing to do this week. Free, about 5 minutes.',
  alternates: { canonical: 'https://quantumstrategies.online/read/' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReadLandingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = paramsFromRecord(await searchParams);
  return (
    <ReadShell>
      <ReadLanding utm={parseUtm(params)} variant={resolveVariant(params)} carry={carryQuery(params)} />
    </ReadShell>
  );
}
