import Link from 'next/link';
import styles from './FunnelMap.module.css';

const PLG_STAGES = ['awareness', 'interest', 'consideration', 'conversion', 'expansion'] as const;
type PlgStage = typeof PLG_STAGES[number];

// Heuristic: map content angle formats to a PLG stage
const FORMAT_STAGE_MAP: Record<string, PlgStage> = {
  blog:               'awareness',
  thread:             'awareness',
  social_twitter:     'awareness',
  social_linkedin:    'awareness',
  social_ig:          'awareness',
  'short-form':       'awareness',
  'long-form':        'interest',
  'deep-dive':        'interest',
  'research-review':  'interest',
  'framework-explainer': 'interest',
  'comparison':       'consideration',
  'case-study':       'consideration',
  'how-to':           'consideration',
  email:              'consideration',
  email_sequence:     'conversion',
  gpt_product:        'conversion',
  'lead-magnet':      'conversion',
};

interface Product {
  id: string;
  product_slug: string;
  name: string;
  price: number | null;
  plg_stage: string | null;
  pillar_id: string | null;
  stripe_price_id?: string | null;
  is_active: boolean;
}

interface FunnelMapProps {
  products: Product[];
  pillars: Array<{ id: string; name: string }>;
  angles: Array<{ id: string; topic_id: string | null; status: string; format: string | null }>;
  topics: Array<{ id: string; pillar_id: string }>;
}

export default function FunnelMap({ products, pillars, angles, topics }: FunnelMapProps) {
  const pillarById = Object.fromEntries(pillars.map((p) => [p.id, p]));

  // Group products by PLG stage
  const productsByStage: Record<string, Product[]> = {};
  for (const p of products) {
    const stage = p.plg_stage ?? 'unknown';
    productsByStage[stage] ??= [];
    productsByStage[stage].push(p);
  }

  // Count relevant angles per inferred PLG stage
  const coverageByStage: Record<PlgStage, number> = {
    awareness: 0, interest: 0, consideration: 0, conversion: 0, expansion: 0,
  };
  for (const angle of angles) {
    if (angle.status !== 'published' && angle.status !== 'draft') continue;
    if (!angle.format) continue;
    const stage = FORMAT_STAGE_MAP[angle.format];
    if (stage) coverageByStage[stage]++;
  }

  // Summary stats
  const stagesWithNoProduct = PLG_STAGES.filter((s) => !productsByStage[s]?.length).length;
  const stagesWithNoContent = PLG_STAGES.filter((s) => coverageByStage[s] === 0).length;
  const unlinkedProducts = products.filter((p) => !p.pillar_id).length;
  const stripeLinked = products.filter((p) => p.stripe_price_id).length;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Funnel Map</h2>
        <p className={styles.sectionSubtitle}>Product chain · coverage · conversion flow</p>
      </div>

      <div className={styles.grid}>
        {PLG_STAGES.map((stage, i) => {
          const stageProducts = productsByStage[stage] ?? [];
          const count = coverageByStage[stage];
          const pct = Math.min(100, Math.round((count / 5) * 100));
          const colorClass = count >= 3 ? styles.coverageGreen : count >= 1 ? styles.coverageAmber : styles.coverageRed;

          return (
            <div key={stage} className={styles.col}>
              {/* Stage header */}
              <div className={styles.stageHeader}>
                <span className={styles.stageLabel}>{stage}</span>
                {i < PLG_STAGES.length - 1 && (
                  <span className={styles.stageArrow}>›</span>
                )}
              </div>

              {/* Product cards */}
              <div className={styles.productSlot}>
                {stageProducts.length > 0 ? (
                  stageProducts.map((product) => {
                    const pillar = product.pillar_id ? pillarById[product.pillar_id] : null;
                    const priceLabel = product.price
                      ? `$${(product.price / 100).toFixed(0)}`
                      : 'Free';
                    const truncatedName = product.name.length > 24
                      ? product.name.slice(0, 22) + '…'
                      : product.name;

                    return (
                      <Link
                        key={product.id}
                        href={`/admin/products/${product.product_slug}`}
                        className={styles.productCard}
                      >
                        <div className={styles.productName} title={product.name}>
                          {truncatedName}
                        </div>
                        <div className={styles.productMeta}>
                          <span className={styles.productPrice}>{priceLabel}</span>
                          {pillar && (
                            <span className={styles.pillarChip} title={pillar.name}>
                              {pillar.name}
                            </span>
                          )}
                          <span
                            className={`${styles.stripeIndicator} ${product.stripe_price_id ? styles.stripeActive : styles.stripeInactive}`}
                            title={product.stripe_price_id ? 'Stripe linked' : 'No Stripe price'}
                          />
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className={styles.emptySlot}>
                    <Link href="/admin/products" className={styles.addLink}>
                      + Add Product
                    </Link>
                  </div>
                )}
              </div>

              {/* Coverage bar */}
              <div className={styles.coverageCol}>
                <div className={styles.coverageLabel}>
                  <span>Content</span>
                  <span className={styles.coverageCount}>{count}</span>
                </div>
                <div className={styles.coverageBar}>
                  <div
                    className={`${styles.coverageFill} ${colorClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary gaps line */}
      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span
            className={`${styles.summaryDot} ${stagesWithNoProduct > 0 ? styles.dotWarning : styles.dotSuccess}`}
          />
          <span>
            <span className={styles.summaryValue}>{stagesWithNoProduct}</span>{' '}
            stage{stagesWithNoProduct !== 1 ? 's' : ''} without a product
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span
            className={`${styles.summaryDot} ${stagesWithNoContent > 0 ? styles.dotDanger : styles.dotSuccess}`}
          />
          <span>
            <span className={styles.summaryValue}>{stagesWithNoContent}</span>{' '}
            stage{stagesWithNoContent !== 1 ? 's' : ''} without content
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span
            className={`${styles.summaryDot} ${unlinkedProducts > 0 ? styles.dotWarning : styles.dotSuccess}`}
          />
          <span>
            <span className={styles.summaryValue}>{unlinkedProducts}</span>{' '}
            product{unlinkedProducts !== 1 ? 's' : ''} not linked to a pillar
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span
            className={`${styles.summaryDot} ${stripeLinked === products.length && products.length > 0 ? styles.dotSuccess : styles.dotWarning}`}
          />
          <span>
            <span className={styles.summaryValue}>{stripeLinked}/{products.length}</span>{' '}
            Stripe-ready
          </span>
        </div>
      </div>
    </div>
  );
}
