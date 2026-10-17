import { Suspense } from 'react';
import { GraphExplorer } from '@/components/admin/brain/graph/GraphExplorer';

export const metadata = {
  title: 'Graph - Brain - Quantum Strategies Admin',
};

export const dynamic = 'force-dynamic';

export default function BrainGraphPage() {
  return (
    <Suspense fallback={null}>
      <GraphExplorer />
    </Suspense>
  );
}
