import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { Banner, PageHead } from '@/components/admin/brain/primitives';
import { TaxonomyExplorer } from '@/components/admin/brain/TaxonomyExplorer';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';
import { pillarTitles } from '@/lib/brain/viz';

export default async function BrainTaxonomyPage() {
  const { snapshot, error } = await getBrainSnapshot();
  if (!snapshot) return <BrainEmptyState error={error} />;
  const { taxonomy } = snapshot;

  return (
    <div className={styles.content}>
      <PageHead
        eyebrow="Content taxonomy"
        title="Rite → Pillar → Topic"
        lede="Each topic sits under one pillar, and each pillar leads to one Rite. Domains tag where a topic's evidence comes from, so they work as a filter rather than a branch."
      />
      {taxonomy.status === 'proposal' && (
        <Banner label="Proposal">
          This taxonomy is a proposal for review. Nothing in the database has changed yet; placements and proposed topics may move
          before approval.
        </Banner>
      )}
      <TaxonomyExplorer taxonomy={taxonomy} titles={pillarTitles(snapshot)} />
    </div>
  );
}
