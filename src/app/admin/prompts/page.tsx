import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

const SCOPES = ['system', 'step_insight', 'followup', 'final_briefing'] as const;
const SCOPE_LABELS: Record<string, string> = {
  system: 'System',
  step_insight: 'Step Insight',
  followup: 'Follow-up',
  final_briefing: 'Final Briefing',
};

export default async function PromptsPage() {
  const [productsRes, promptsRes] = await Promise.all([
    supabaseAdmin
      .from('product_definitions')
      .select('product_slug, name')
      .eq('is_active', true)
      .order('product_slug'),
    supabaseAdmin
      .from('prompts')
      .select('product_slug, scope, version, updated_at, is_active')
      .eq('is_active', true)
      .order('product_slug'),
  ]);

  const products = productsRes.data ?? [];
  const activePrompts = promptsRes.data ?? [];

  // Coverage map: slug → scope → { version, updated_at }
  const coverage = new Map<string, Map<string, { version: number; updated_at: string }>>();
  for (const p of activePrompts) {
    if (!coverage.has(p.product_slug)) coverage.set(p.product_slug, new Map());
    coverage.get(p.product_slug)!.set(p.scope, { version: p.version, updated_at: p.updated_at });
  }

  // All slugs: known products first, then any orphaned prompt-only slugs
  const knownSlugs = new Set(products.map((p) => p.product_slug));
  for (const slug of coverage.keys()) knownSlugs.add(slug);

  const allSlugs = [
    ...products.map((p) => p.product_slug),
    ...[...coverage.keys()].filter((s) => !products.some((p) => p.product_slug === s)),
  ];

  const productNameMap = new Map(products.map((p) => [p.product_slug, p.name]));

  // Stats
  const totalProducts = allSlugs.length;
  const fullyCustom = allSlugs.filter((s) => {
    const c = coverage.get(s);
    return c && SCOPES.every((scope) => c.has(scope));
  }).length;
  const usingDefaults = allSlugs.filter((s) => !coverage.has(s)).length;
  const totalCustom = activePrompts.length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Prompts</h1>
        <p className={styles.pageDescription}>
          AI prompt management across all products — custom overrides take precedence over built-in defaults.
        </p>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Products</div>
          <div className={styles.statValue}>{totalProducts}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Fully Customized</div>
          <div className={styles.statValue} style={{ color: fullyCustom === totalProducts ? 'var(--admin-success)' : undefined }}>
            {fullyCustom}/{totalProducts}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Using All Defaults</div>
          <div className={styles.statValue} style={{ color: usingDefaults > 0 ? 'var(--admin-warning)' : 'var(--admin-success)' }}>
            {usingDefaults}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Custom Prompts Saved</div>
          <div className={styles.statValue}>{totalCustom}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Coverage Matrix</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            Click any row to edit that product's prompts
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Product</th>
                {SCOPES.map((s) => (
                  <th key={s} style={{ textAlign: 'center', minWidth: 110 }}>
                    {SCOPE_LABELS[s]}
                  </th>
                ))}
                <th style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {allSlugs.map((slug) => {
                const scopeMap = coverage.get(slug);
                const name = productNameMap.get(slug) ?? formatSlug(slug);
                const isKnown = knownSlugs.has(slug);

                return (
                  <tr key={slug}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                        {slug}
                      </div>
                      {!isKnown && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--admin-warning)', marginTop: 2 }}>
                          orphaned — not in product_definitions
                        </div>
                      )}
                    </td>
                    {SCOPES.map((scope) => {
                      const entry = scopeMap?.get(scope);
                      return (
                        <td key={scope} style={{ textAlign: 'center' }}>
                          {entry ? (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.7rem' }}>
                              v{entry.version}
                            </span>
                          ) : (
                            <span
                              className={styles.badge}
                              style={{
                                fontSize: '0.7rem',
                                background: 'var(--admin-bg-subtle)',
                                color: 'var(--admin-text-muted)',
                                border: '1px solid var(--admin-border)',
                              }}
                            >
                              default
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <Link
                        href={`/admin/prompts/${slug}`}
                        className={`${styles.btn} ${styles.btnSmall} ${scopeMap ? styles.btnSecondary : styles.btnPrimary}`}
                      >
                        {scopeMap ? 'Edit' : 'Configure'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--admin-border)', display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
          <span><span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.65rem' }}>v2</span> Custom saved version</span>
          <span><span className={styles.badge} style={{ fontSize: '0.65rem', background: 'var(--admin-bg-subtle)', border: '1px solid var(--admin-border)' }}>default</span> Using built-in fallback</span>
        </div>
      </div>
    </div>
  );
}

function formatSlug(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
