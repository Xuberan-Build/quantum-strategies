import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

const SCOPE_LABELS: Record<string, string> = {
  system: 'System',
  step_insight: 'Step Insight',
  followup: 'Follow-up',
  final_briefing: 'Final Briefing',
};

export default async function PromptsPage() {
  const { data: prompts } = await supabaseAdmin
    .from('prompts')
    .select('id, product_slug, scope, step_number, version, is_active, updated_at, content')
    .order('product_slug')
    .order('scope')
    .order('version', { ascending: false });

  const allPrompts = prompts || [];

  // Group by product_slug, keep only the active (latest) version per scope
  const byProduct = new Map<string, typeof allPrompts>();
  for (const p of allPrompts) {
    if (!byProduct.has(p.product_slug)) byProduct.set(p.product_slug, []);
    byProduct.get(p.product_slug)!.push(p);
  }

  // Dedupe: keep latest active per product+scope
  const activeByProduct = new Map<string, Map<string, (typeof allPrompts)[0]>>();
  for (const [slug, rows] of byProduct) {
    const scopeMap = new Map<string, (typeof allPrompts)[0]>();
    for (const row of rows) {
      const key = `${row.scope}:${row.step_number ?? ''}`;
      if (!scopeMap.has(key)) scopeMap.set(key, row); // already ordered version DESC
    }
    activeByProduct.set(slug, scopeMap);
  }

  const productSlugs = Array.from(activeByProduct.keys()).sort();
  const totalActive = Array.from(activeByProduct.values()).reduce((sum, m) => sum + m.size, 0);
  const totalVersions = allPrompts.length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Prompts</h1>
        <p className={styles.pageDescription}>AI prompt management with version history</p>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Products with Prompts</div>
          <div className={styles.statValue}>{productSlugs.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Prompts</div>
          <div className={styles.statValue}>{totalActive}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Versions</div>
          <div className={styles.statValue}>{totalVersions}</div>
        </div>
      </div>

      {productSlugs.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No prompts yet</p>
            <p className={styles.emptyDescription}>
              Prompts are loaded from the database. Add your first prompt below.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {productSlugs.map((slug) => {
            const scopeMap = activeByProduct.get(slug)!;
            const rows = Array.from(scopeMap.values());

            return (
              <div key={slug} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>{formatSlug(slug)}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                      {rows.length} prompt{rows.length !== 1 ? 's' : ''}
                    </span>
                    <Link
                      href={`/admin/prompts/${slug}`}
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                    >
                      Edit
                    </Link>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {rows.map((row) => {
                    const preview = row.content?.slice(0, 120).replace(/\n/g, ' ') ?? '';
                    return (
                      <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', background: 'var(--admin-bg)', borderRadius: '0.375rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                              {SCOPE_LABELS[row.scope] ?? row.scope}
                            </span>
                            {row.step_number != null && (
                              <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontSize: '0.7rem' }}>
                                Step {row.step_number}
                              </span>
                            )}
                            <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.7rem' }}>
                              v{row.version}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {preview}{row.content?.length > 120 ? '…' : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(row.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatSlug(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
