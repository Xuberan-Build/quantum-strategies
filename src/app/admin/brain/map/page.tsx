import { Suspense } from 'react';
import { TopicalMapView } from '@/components/admin/brain/map/TopicalMapView';

export const metadata = {
  title: 'Topical map - Brain - Quantum Strategies Admin',
};

export const dynamic = 'force-dynamic';

export default function BrainMapPage() {
  return (
    <Suspense fallback={null}>
      <TopicalMapView />
    </Suspense>
  );
}
