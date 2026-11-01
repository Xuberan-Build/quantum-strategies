/**
 * /email/preferences?t=<signed token>: the opt-out link in progress emails.
 * Confirms with a POST on load (one click for a person, nothing for a link scanner).
 */
import type { Metadata } from 'next';
import OptOutClient from './OptOutClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email settings',
  robots: { index: false, follow: false },
};

export default async function EmailPreferencesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <OptOutClient token={typeof t === 'string' ? t : null} />;
}
