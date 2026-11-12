import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { COUNTRY_HEADER, marketingPrecheckAllowed } from '@/lib/read/consent-region';
import { ReadResultView } from '@/components/read/ReadResultView';
import { ReadShell } from '@/components/read/ReadShell';

export const metadata: Metadata = {
  title: 'Your Perception Read',
  robots: { index: false, follow: false },
  // the email link carries a token in ?t=, so don't leak it to other sites
  referrer: 'no-referrer',
};

type Params = Promise<{ sessionId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReadResultPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === 'string' ? sp.t : undefined;
  // Marketing box starts ticked for US visitors only; everyone else (and unknown) opts in actively.
  const defaultConsent = marketingPrecheckAllowed((await headers()).get(COUNTRY_HEADER));
  return (
    <ReadShell>
      <ReadResultView sessionId={sessionId} token={token} defaultConsent={defaultConsent} />
    </ReadShell>
  );
}
