import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import ProductActiveToggle from '@/components/admin/ProductActiveToggle';
import styles from '../admin-layout.module.css';

interface ProductDefinition {
  id: string;
  product_slug: string;
  name: string;
  description: string | null;
  price: number | null;
  total_steps: number;
  is_active: boolean;
  is_purchasable: boolean;
  product_group: string | null;
  display_order: number | null;
  model: string;
  created_at: string;
  updated_at: string;
}

interface SessionStats {
  product_slug: string;
  total: number;
  completed: number;
}

// Auth is handled by middleware.ts
export default async function ProductsPage() {
  // Fetch all products
  const { data: products, error: productsError } = await supabaseAdmin
    .from('product_definitions')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (productsError) {
    console.error('Failed to fetch products:', productsError);
  }

  // Fetch aggregated session stats (view — no full table scan)
  const { data: sessionStats } = await supabaseAdmin
    .from('product_session_stats')
    .select('product_slug, total_sessions, completed_sessions');

  const statsMap: Record<string, SessionStats> = {};
  sessionStats?.forEach((row) => {
    statsMap[row.product_slug] = {
      product_slug: row.product_slug,
      total: row.total_sessions,
      completed: row.completed_sessions,
    };
  });

  // Group products by product_group
  const groupedProducts: Record<string, ProductDefinition[]> = {};
  const ungrouped: ProductDefinition[] = [];

  products?.forEach((product: ProductDefinition) => {
    if (product.product_group) {
      if (!groupedProducts[product.product_group]) {
        groupedProducts[product.product_group] = [];
      }
      groupedProducts[product.product_group].push(product);
    } else {
      ungrouped.push(product);
    }
  });

  // Sort groups for display
  const groupOrder = ['orientation', 'perception-rite', 'declaration-rite'];
  const sortedGroups = Object.keys(groupedProducts).sort((a, b) => {
    const aIndex = groupOrder.indexOf(a);
    const bIndex = groupOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const formatGroupName = (group: string) => {
    return group
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Products</h1>
        <p className={styles.pageDescription}>
          Manage GPT product configurations, steps, and prompts
        </p>
      </header>

      {/* Stats Summary */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Products</div>
          <div className={styles.statValue}>{products?.length || 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Products</div>
          <div className={styles.statValue}>
            {products?.filter((p: ProductDefinition) => p.is_active).length || 0}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Sessions</div>
          <div className={styles.statValue}>
            {sessionStats?.reduce((sum, r) => sum + r.total_sessions, 0) || 0}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed Sessions</div>
          <div className={styles.statValue}>
            {sessionStats?.reduce((sum, r) => sum + r.completed_sessions, 0) || 0}
          </div>
        </div>
      </div>

      {/* Grouped Products */}
      {sortedGroups.map((group) => (
        <div key={group} className={styles.card} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{formatGroupName(group)}</h2>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
              {groupedProducts[group].length} products
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Steps</th>
                <th>Model</th>
                <th>Sessions</th>
                <th>Completion</th>
                <th>Live</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedProducts[group].map((product) => {
                const stats = statsMap[product.product_slug];
                const completionRate = stats && stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0;

                return (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        {product.product_slug}
                      </div>
                    </td>
                    <td>{product.total_steps}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {product.model || 'gpt-4'}
                      </span>
                    </td>
                    <td>{stats?.total || 0}</td>
                    <td>
                      {stats?.total ? (
                        <span style={{ color: completionRate >= 50 ? 'var(--admin-success)' : 'var(--admin-warning)' }}>
                          {completionRate}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <ProductActiveToggle
                        productSlug={product.product_slug}
                        productName={product.name}
                        initialActive={product.is_active}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/admin/products/${product.product_slug}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        Configure
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Ungrouped Products */}
      {ungrouped.length > 0 && (
        <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Other Products</h2>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>
              {ungrouped.length} products
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Steps</th>
                <th>Model</th>
                <th>Sessions</th>
                <th>Completion</th>
                <th>Live</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ungrouped.map((product) => {
                const stats = statsMap[product.product_slug];
                const completionRate = stats && stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0;

                return (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        {product.product_slug}
                      </div>
                    </td>
                    <td>{product.total_steps}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {product.model || 'gpt-4'}
                      </span>
                    </td>
                    <td>{stats?.total || 0}</td>
                    <td>
                      {stats?.total ? (
                        <span style={{ color: completionRate >= 50 ? 'var(--admin-success)' : 'var(--admin-warning)' }}>
                          {completionRate}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <ProductActiveToggle
                        productSlug={product.product_slug}
                        productName={product.name}
                        initialActive={product.is_active}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/admin/products/${product.product_slug}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        Configure
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
