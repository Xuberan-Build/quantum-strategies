import Link from 'next/link';
import { BrainEmptyState } from '@/components/admin/brain/EmptyState';
import { Banner, MyceliumGlyph, StatTile } from '@/components/admin/brain/primitives';
import styles from '@/components/admin/brain/brain.module.css';
import { getBrainSnapshot, listSnapshots } from '@/lib/brain/load';
import { formatDate, formatDateTime, relativeAge } from '@/lib/brain/viz';

const STALE_AFTER_DAYS = 8;

export default async function BrainOverviewPage() {
  const [{ snapshot, source, error }, history] = await Promise.all([getBrainSnapshot(), listSnapshots()]);
  if (!snapshot) return <BrainEmptyState error={error} />;

  const deck = snapshot.decks[0];
  const age = relativeAge(snapshot.generatedAt);
  const stale = age.days > STALE_AFTER_DAYS;

  const marketQuotes = snapshot.marketVoice.pillars.reduce((n, p) => n + p.quotes.length, 0) + snapshot.marketVoice.enemy.quotes.length;
  const videos = snapshot.creators.reduce((n, c) => n + c.outliers.length, 0);
  const proposedTopics = snapshot.taxonomy.topics.filter((t) => t.proposed).length;
  const validatedHooks = snapshot.hooks.filter((h) => h.status === 'validated').length;
  const topOutlier = snapshot.creators
    .flatMap((c) => c.outliers.map((o) => ({ ...o, creator: c.name })))
    .sort((a, b) => b.outlier - a.outlier)[0];
  const customerCounts = Object.entries(snapshot.customers.counts);

  const sections = [
    {
      href: '/admin/brain/market',
      title: 'Market voice',
      body: 'Pains, desires and objections by pillar, a quote wall sorted by likes, and the enemy in their own words.',
      metric: `${marketQuotes} quotes · ${snapshot.marketVoice.pillars.length} pillars`,
    },
    {
      href: '/admin/brain/creators',
      title: 'Creator outliers',
      body: 'Every recent upload as views ÷ channel median, on a log scale, with the breakouts labelled.',
      metric: topOutlier ? `Top: ${topOutlier.outlier.toFixed(1)}× · ${topOutlier.creator}` : `${snapshot.creators.length} creators`,
    },
    {
      href: '/admin/brain/taxonomy',
      title: 'Content taxonomy',
      body: 'Rite → Pillar → Topic, and the pillar × domain gap grid where empty cells are opportunities.',
      metric: `${snapshot.taxonomy.topics.length} topics · ${snapshot.taxonomy.status}`,
    },
    {
      href: '/admin/brain/customers',
      title: 'Customer signal',
      body: 'What our own users report: top pains, what lands, where they get stuck.',
      metric: customerCounts[0] ? `${customerCounts[0][1]} ${customerCounts[0][0].toLowerCase()}` : `as of ${snapshot.customers.asOf}`,
    },
    {
      href: '/admin/brain/hooks',
      title: 'Hook board',
      body: 'Hooks grouped by pillar or Rite, with status and the evidence behind each one.',
      metric: `${snapshot.hooks.length} hooks · ${validatedHooks} validated`,
    },
    {
      href: '/admin/brain/journey',
      title: 'Build journey',
      body: 'Eras, incidents and the guardrails they produced, learnings by theme, open questions.',
      metric: `${snapshot.journey.eras.length} eras · ${snapshot.journey.incidents.length} incidents`,
    },
  ];

  return (
    <div className={styles.content}>
      {source === 'local' && (
        <Banner label="Development fallback" tone="info">
          Loaded from <span className={styles.mono}>brain/.snapshots/latest.json</span> because Storage returned nothing.
          {error && <span className={styles.muted}> ({error})</span>}
        </Banner>
      )}

      <section className={styles.hero} aria-labelledby="brain-hero-title">
        <MyceliumGlyph className={styles.heroGlyph} />
        <div className={styles.heroMain}>
          <div className={styles.eyebrow}>Current briefing · {deck.period}</div>
          <h1 id="brain-hero-title" className={styles.heroTitle}>
            {deck.title}
          </h1>
          <p className={styles.heroSummary}>{deck.summary}</p>
          <div className={styles.heroActions}>
            <Link href={`/admin/brain/deck/${encodeURIComponent(deck.id)}`} className={styles.button}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7 4.5v15l13-7.5z" />
              </svg>
              Present
            </Link>
            <span className={`${styles.small} ${styles.muted}`}>{deck.slides.length} slides · ← → to move · F for full screen</span>
          </div>
        </div>
        <ol className={styles.heroContents} aria-label="Slides in this deck">
          {deck.slides.map((s, i) => (
            <li key={s.id}>
              <Link href={`/admin/brain/deck/${encodeURIComponent(deck.id)}?s=${i + 1}`} className={styles.heroContentLink}>
                <span className={styles.heroContentNum}>{String(i + 1).padStart(2, '0')}</span>
                <span>{s.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-label="Snapshot figures">
        <div className={styles.statGrid}>
          <StatTile label="Market quotes" value={marketQuotes} note={`${snapshot.marketVoice.pillars.reduce((n, p) => n + p.evidence.items, 0)} evidence items`} />
          <StatTile label="Creators tracked" value={snapshot.creators.length} note={`${videos} uploads scored`} />
          <StatTile label="Topics in the tree" value={snapshot.taxonomy.topics.length} note={proposedTopics ? `${proposedTopics} proposed` : undefined} />
          <StatTile label="Hooks" value={snapshot.hooks.length} note={`${validatedHooks} validated`} />
          <StatTile label="Brain sources" value={snapshot.sources.length} note="markdown files distilled" />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="brain-sections-title">
        <div className={styles.sectionHead}>
          <h2 id="brain-sections-title" className={styles.sectionTitle}>
            Dashboards
          </h2>
        </div>
        <div className={styles.sectionCards}>
          {sections.map((s, i) => (
            <Link key={s.href} href={s.href} className={styles.sectionCard}>
              <span className={styles.sectionCardNum}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.cardTitle}>{s.title}</span>
              <span className={styles.sectionCardBody}>{s.body}</span>
              <span className={styles.sectionCardMetric}>{s.metric}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.grid2}`}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Freshness</div>
          <h2 className={styles.cardTitle} style={{ marginTop: '0.35rem' }}>
            Ticked {age.label}
          </h2>
          <dl className={styles.facts}>
            <dt>Generated</dt>
            <dd>{formatDateTime(snapshot.generatedAt)}</dd>
            <dt>Brain commit</dt>
            <dd className={styles.mono}>{snapshot.brainCommit ?? 'not recorded'}</dd>
            <dt>Loaded from</dt>
            <dd>{source === 'storage' ? 'Supabase Storage' : 'Local disk (development)'}</dd>
          </dl>
          {stale && (
            <Banner label="Stale">
              This snapshot is more than {STALE_AFTER_DAYS} days old. Run the brain tick to refresh it.
            </Banner>
          )}
        </div>
        <div className={styles.card}>
          <div className={styles.eyebrow}>History</div>
          <h2 className={styles.cardTitle} style={{ marginTop: '0.35rem' }}>
            Dated snapshots
          </h2>
          {history.snapshots.length === 0 ? (
            <p className={`${styles.small} ${styles.muted}`}>No dated snapshots found{history.error ? ` (${history.error})` : ''}.</p>
          ) : (
            <ul className={styles.historyList}>
              {history.snapshots.slice(0, 8).map((h) => (
                <li key={h.path}>
                  <span>{formatDate(h.date)}</span>
                  <span className={styles.mono}>{h.path}</span>
                </li>
              ))}
            </ul>
          )}
          {snapshot.decks.length > 1 && (
            <>
              <div className={styles.eyebrow} style={{ marginTop: '1.25rem' }}>
                Earlier decks
              </div>
              <ul className={styles.historyList}>
                {snapshot.decks.slice(1).map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/brain/deck/${encodeURIComponent(d.id)}`}>{d.title}</Link>
                    <span className={styles.mono}>{d.period}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
