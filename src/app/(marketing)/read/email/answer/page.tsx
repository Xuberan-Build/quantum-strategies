/**
 * /read/email/answer?t=<signed token>: where the day-7 one-click links land.
 * The page records the answer with a POST on load, so mail scanners that prefetch
 * links don't cast votes. "Very" or "somewhat" disappointed opens the two PMF follow-ups.
 */

import type { Metadata } from 'next';
import AnswerClient from './AnswerClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Thanks',
  robots: { index: false, follow: false },
};

export default async function ReadEmailAnswerPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <AnswerClient token={typeof t === 'string' ? t : null} />;
}
