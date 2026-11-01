import { Metadata } from 'next';
import BetaPage from '@/app/(content)/beta/page';

export const metadata: Metadata = {
  title: 'Beta Program - Quantum Strategies Three Rites',
  description:
    'Join the Three Rites beta. Get free access to all 11 products, shape the future of Quantum Strategies, and take your Initiation for $60 when you finish.',
  robots: { index: false, follow: false },
};

export default function ProductsBetaPage() {
  return <BetaPage />;
}
