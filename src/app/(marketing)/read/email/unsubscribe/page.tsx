/**
 * /read/email/unsubscribe?t=<signed token>: the unsubscribe link in every Read email.
 * Confirms with a POST on load (one click for a person, nothing for a link scanner).
 */

import type { Metadata } from 'next';
import UnsubscribeClient from './UnsubscribeClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

export default async function ReadUnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <UnsubscribeClient token={typeof t === 'string' ? t : null} />;
}
