import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { HookBoard } from '@/components/admin/brain/HookBoard';
import { PageHead } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';
import { pillarTitles } from '@/lib/brain/viz';

export default async function BrainHooksPage() {
  const { snapshot, error } = await getBrainSnapshot();
  if (!snapshot) return <BrainEmptyState error={error} />;
  const validated = snapshot.hooks.filter((hk) => hk.status === 'validated').length;

  return (
    <div className={styles.content}>
      <PageHead
        eyebrow="Hook board"
        title="Hooks, with their evidence"
        lede={`${snapshot.hooks.length} hooks, ${validated} validated. Group them by pillar or Rite, filter by status, and check the evidence behind each one.`}
      />
      <HookBoard hooks={snapshot.hooks} titles={pillarTitles(snapshot)} />
    </div>
  );
}
