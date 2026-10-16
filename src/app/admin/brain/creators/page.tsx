import { CreatorExplorer } from '@/components/admin/brain/CreatorExplorer';
import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { PageHead } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';

export default async function BrainCreatorsPage() {
  const { snapshot, error } = await getBrainSnapshot();
  if (!snapshot) return <BrainEmptyState error={error} />;

  const uploads = snapshot.creators.reduce((n, cr) => n + cr.outliers.length, 0);

  return (
    <div className={styles.content}>
      <PageHead
        eyebrow="Creator outliers"
        title="Where the breakouts are"
        lede={`${snapshot.creators.length} creators, ${uploads} recent uploads scored against each channel's own median. Multiples compare each video with its own channel, so small and large channels read on one scale.`}
      />
      {snapshot.creators.length === 0 ? (
        <p className={styles.muted}>No creators in this snapshot.</p>
      ) : (
        <CreatorExplorer creators={snapshot.creators} />
      )}
    </div>
  );
}
