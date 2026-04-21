import { Metadata } from 'next';
import BetaPage from '@/app/(content)/beta/page';

export const metadata: Metadata = {
  title: 'Beta Program - Quantum Strategies Three Rites',
  description:
    'Join the Founding Circle for the Three Rites journey. Get free access to all 11 products, shape the future of Quantum Strategies, and become a Founding Member for just $60.',
  alternates: {
    canonical: 'https://quantumstrategies.online/products/beta/',
  },
};

export default function ProductsBetaPage() {
  return <BetaPage />;
}
