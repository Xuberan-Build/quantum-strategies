import { BarChart, BarTable } from '@/components/admin/brain/BarChart';
import { ChartFrame } from '@/components/admin/brain/ChartFrame';
import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { Banner, PageHead, QuoteWall, StatTile } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot } from '@/lib/brain/load';
import { formatDate } from '@/lib/brain/viz';

/** Below this many total pain mentions the signal is treated as thin even without a caveat. */
const THIN_SIGNAL = 30;

export default async function BrainCustomersPage() {
  const { snapshot, error } = await getBrainSnapshot();
  if (!snapshot) return <BrainEmptyState error={error} />;
  const { customers } = snapshot;

  const counts = Object.entries(customers.counts);
  const pains = [...customers.topPains].sort((a, b) => b.count - a.count).map((p) => ({ label: p.label, value: p.count }));
  const mentions = pains.reduce((n, p) => n + p.value, 0);
  const thin = Boolean(customers.caveat) || mentions < THIN_SIGNAL;

  return (
    <div className={styles.content}>
      <PageHead
        eyebrow={`Customer signal · as of ${formatDate(customers.asOf)}`}
        title="What our own users tell us"
        lede="Aggregated and anonymised. Read it as direction, not proof, until the sample grows."
      />

      {thin && (
        <Banner label="Thin data">
          {customers.caveat ?? `Only ${mentions} coded pain mentions so far. Treat everything below as directional signal, not statistics.`}
        </Banner>
      )}

      {counts.length > 0 && (
        <section aria-label="Counts">
          <div className={styles.statGrid}>
            {counts.map(([label, value]) => (
              <StatTile key={label} label={label} value={value} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        {pains.length === 0 ? (
          <p className={styles.muted}>No pains coded yet.</p>
        ) : (
          <ChartFrame
            title="Top pains"
            caption={`Mentions per hand-coded pain cluster (${mentions} total). One person can carry several clusters.`}
            table={<BarTable data={pains} valueLabel="Mentions" />}
          >
            <BarChart data={pains} ariaLabel="Top pains by mentions" />
          </ChartFrame>
        )}
      </section>

      <section className={`${styles.section} ${styles.grid2}`}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>What lands</div>
          <h2 className={styles.cardTitle} style={{ margin: '0.35rem 0 0.9rem' }}>
            The ahas
          </h2>
          {customers.lands.length ? (
            <ul className={styles.plainList}>
              {customers.lands.map((l, i) => (
                <li key={`${i}-${l.slice(0, 12)}`}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className={`${styles.small} ${styles.muted}`}>Nothing recorded yet.</p>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Where people get stuck</div>
          <h2 className={styles.cardTitle} style={{ margin: '0.35rem 0 0.9rem' }}>
            The friction
          </h2>
          {customers.stuck.length ? (
            <ul className={styles.plainList}>
              {customers.stuck.map((l, i) => (
                <li key={`${i}-${l.slice(0, 12)}`}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className={`${styles.small} ${styles.muted}`}>Nothing recorded yet.</p>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>In their words</h2>
          <span className={styles.count}>{customers.quotes.length} quotes</span>
        </div>
        <QuoteWall quotes={customers.quotes} />
      </section>
    </div>
  );
}
