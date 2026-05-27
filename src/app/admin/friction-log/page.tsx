import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../admin-layout.module.css';
import FrictionLogList, {
  type FrictionLogListRow,
  type FrictionStatus,
} from '@/components/admin/FrictionLogList';

// Auth handled by middleware.ts + admin layout
export default async function FrictionLogPage() {
  const [{ data: events, error }, { data: products }] = await Promise.all([
    supabaseAdmin
      .from('step_friction_log')
      .select(
        'id, user_id, product_session_id, product_slug, step_index, reason, note, response_excerpt, status, triaged_by, triaged_at, triage_note, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('product_definitions')
      .select('product_slug')
      .order('product_slug', { ascending: true }),
  ]);

  if (error) {
    console.error('[Admin] step_friction_log fetch error:', error);
  }

  const rows: FrictionLogListRow[] = (events ?? []) as FrictionLogListRow[];

  // Combine product slugs from product_definitions and any slugs that already exist in friction log
  const slugSet = new Set<string>();
  products?.forEach((p) => slugSet.add(p.product_slug));
  rows.forEach((r) => slugSet.add(r.product_slug));
  const productSlugs = Array.from(slugSet).sort();

  const total = rows.length;
  const byStatus: Record<FrictionStatus, number> = {
    new: 0,
    triaged: 0,
    resolved: 0,
    wont_fix: 0,
  };
  rows.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  });

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Friction Log</h1>
          <p className={styles.pageDescription}>
            User-flagged friction events from inside product flows. Triage to drive question-pool improvements.
          </p>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total events</div>
          <div className={styles.statValue}>{total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>New</div>
          <div
            className={styles.statValue}
            style={{ color: byStatus.new > 0 ? 'var(--admin-warning)' : undefined }}
          >
            {byStatus.new}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Triaged</div>
          <div className={styles.statValue}>{byStatus.triaged}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Resolved</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {byStatus.resolved}
          </div>
        </div>
      </div>

      <FrictionLogList initialRows={rows} productSlugs={productSlugs} />
    </div>
  );
}
