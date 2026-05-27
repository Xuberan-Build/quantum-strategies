import { supabaseAdmin } from '@/lib/supabase/server';
import styles from '../admin-layout.module.css';
import TaoSituationList, { type TaoSituationListRow } from '@/components/admin/TaoSituationList';

// Auth handled by middleware.ts + admin layout
export default async function TaoSituationsPage() {
  const { data: situations, error } = await supabaseAdmin
    .from('tao_situations')
    .select(
      'id, domain_id, domain_name, name, tier, fate, core_state, being_name, variant_count, source_version, active'
    )
    .order('domain_id', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('[Admin] tao_situations fetch error:', error);
  }

  const rows: TaoSituationListRow[] = (situations ?? []) as TaoSituationListRow[];

  const domainIdSet = new Set<string>();
  rows.forEach((r) => domainIdSet.add(r.domain_id));
  const domainIds = Array.from(domainIdSet).sort();

  const domainNameById = new Map<string, string>();
  rows.forEach((r) => {
    if (!domainNameById.has(r.domain_id)) domainNameById.set(r.domain_id, r.domain_name);
  });

  const total = rows.length;
  const active = rows.filter((r) => r.active).length;
  const inactive = total - active;
  const uniqueDomains = domainIds.length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.pageTitle}>Tao Situations</h1>
            <p className={styles.pageDescription}>
              172-situation corpus ingested from the studio pipeline. Read-mostly; rows are
              upserted by <code>scripts/tao-ingest/sync-from-studio.ts</code>.
            </p>
          </div>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total situations</div>
          <div className={styles.statValue}>{total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {active}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Inactive</div>
          <div className={styles.statValue} style={{ color: inactive > 0 ? 'var(--admin-warning)' : undefined }}>
            {inactive}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Domains</div>
          <div className={styles.statValue}>{uniqueDomains}</div>
        </div>
      </div>

      <TaoSituationList
        initialRows={rows}
        domains={domainIds.map((id) => ({ id, name: domainNameById.get(id) ?? id }))}
      />
    </div>
  );
}
