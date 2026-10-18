import type { Metadata } from 'next';
import { ReadFlow } from '@/components/read/ReadFlow';
import { ReadShell } from '@/components/read/ReadShell';
import { paramsFromRecord, parseUtm, resolveVariant } from '@/components/read/utm';

export const metadata: Metadata = {
  title: 'The Perception Read',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReadStartPage({ searchParams }: { searchParams: SearchParams }) {
  const params = paramsFromRecord(await searchParams);
  return (
    <ReadShell>
      <ReadFlow utm={parseUtm(params)} variant={resolveVariant(params)} />
    </ReadShell>
  );
}
