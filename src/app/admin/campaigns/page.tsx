import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

export default async function CampaignsPage() {
  const { data: campaigns } = await supabaseAdmin
    .from('campaigns')
    .select('id, name, description, status, trigger_type, from_email, created_at')
    .order('created_at', { ascending: false });

  const campaignIds = (campaigns || []).map((c) => c.id);

  const [stepsResult, enrollmentsResult] = await Promise.all([
    campaignIds.length > 0
      ? supabaseAdmin.from('campaign_steps').select('campaign_id').in('campaign_id', campaignIds)
      : Promise.resolve({ data: [] }),
    campaignIds.length > 0
      ? supabaseAdmin.from('campaign_enrollments').select('campaign_id, status').in('campaign_id', campaignIds)
      : Promise.resolve({ data: [] }),
  ]);

  const stepCounts = new Map<string, number>();
  for (const s of stepsResult.data || []) {
    stepCounts.set(s.campaign_id, (stepCounts.get(s.campaign_id) ?? 0) + 1);
  }

  const enrollmentCounts = new Map<string, { active: number; total: number }>();
  for (const e of enrollmentsResult.data || []) {
    const cur = enrollmentCounts.get(e.campaign_id) ?? { active: 0, total: 0 };
    cur.total++;
    if (e.status === 'active') cur.active++;
    enrollmentCounts.set(e.campaign_id, cur);
  }

  const totalEnrolled = [...enrollmentCounts.values()].reduce((sum, v) => sum + v.total, 0);
  const totalActive = [...enrollmentCounts.values()].reduce((sum, v) => sum + v.active, 0);

  const statusBadge: Record<string, string> = {
    draft: styles.badgeNeutral,
    active: styles.badgeSuccess,
    paused: styles.badgeWarning,
    archived: styles.badgeDanger,
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className={styles.pageTitle}>Campaigns</h1>
            <p className={styles.pageDescription}>Email workflows and automated sequences</p>
          </div>
          <Link href="/admin/campaigns/new" className={`${styles.btn} ${styles.btnPrimary}`}>
            + New Campaign
          </Link>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Campaigns</div>
          <div className={styles.statValue}>{campaigns?.length ?? 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active</div>
          <div className={styles.statValue}>{campaigns?.filter((c) => c.status === 'active').length ?? 0}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Enrolled</div>
          <div className={styles.statValue}>{totalEnrolled}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>In Progress</div>
          <div className={styles.statValue}>{totalActive}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>All Campaigns</h2>
        </div>

        {!campaigns?.length ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No campaigns yet</p>
            <p className={styles.emptyDescription}>Create a campaign to start sending email sequences.</p>
            <Link href="/admin/campaigns/new" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: '1rem' }}>
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th>Steps</th>
                  <th>Enrolled</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const enr = enrollmentCounts.get(c.id) ?? { active: 0, total: 0 };
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        {c.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{c.description}</div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.badge} ${statusBadge[c.status] ?? styles.badgeNeutral}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                        {c.trigger_type.replace(/_/g, ' ')}
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{stepCounts.get(c.id) ?? 0}</td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>{enr.total}</div>
                        {enr.active > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-success)' }}>{enr.active} active</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        <Link href={`/admin/campaigns/${c.id}`} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                          View
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
    </div>
  );
}
