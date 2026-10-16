import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { MarketVoice } from '@/components/admin/brain/MarketVoice';
import { PageHead, QuoteWall } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import m from '@/components/admin/brain/market.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';
import type { PillarSlug } from '@/lib/brain/snapshot';
import { pillarTitles, riteTitle } from '@/lib/brain/viz';

export default async function BrainMarketPage() {
  const { snapshot, error } = await getBrainSnapshot();
  if (!snapshot) return <BrainEmptyState error={error} />;

  const { pillars, enemy } = snapshot.marketVoice;
  const titles = pillarTitles(snapshot);
  const rites: Partial<Record<PillarSlug, string>> = Object.fromEntries(
    snapshot.taxonomy.pillars.map((p) => [p.slug, riteTitle(p.rite)]),
  );
  const totalItems = pillars.reduce((n, p) => n + p.evidence.items, 0);
  const totalQuotes = pillars.reduce((n, p) => n + p.quotes.length, 0) + enemy.quotes.length;

  return (
    <div className={styles.content}>
      <PageHead
        eyebrow="Market voice"
        title="What the market says, by pillar"
        lede={`${totalItems} evidence items and ${totalQuotes} verbatim quotes, coded to the five pillars and the enemy. Pick a pillar to see its pains, desires and objections.`}
      />
      <MarketVoice pillars={pillars} titles={titles} rites={rites} />

      <section className={m.enemy} aria-labelledby="enemy-title">
        <div className={styles.eyebrow}>The enemy</div>
        <h2 id="enemy-title" className={m.enemyTitle}>
          In their words
        </h2>
        <p className={m.enemySummary}>{enemy.summary}</p>
        <QuoteWall quotes={enemy.quotes} />
      </section>
    </div>
  );
}
