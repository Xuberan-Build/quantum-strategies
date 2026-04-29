import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import CampaignActions from './CampaignActions';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [campaignResult, stepsResult, enrollmentsResult, listsResult] = await Promise.all([
    supabaseAdmin.from('campaigns').select('*').eq('id', id).single(),
    supabaseAdmin.from('campaign_steps').select('*').eq('campaign_id', id).order('step_number'),
    supabaseAdmin
      .from('campaign_enrollments')
      .select('id, user_id, status, current_step, next_send_at, enrolled_at, completed_at, users(name, email)')
      .eq('campaign_id', id)
      .order('enrolled_at', { ascending: false }),
    supabaseAdmin.from('contact_lists').select('id, name, list_type').order('name'),
  ]);

  if (campaignResult.error || !campaignResult.data) notFound();

  const campaign = campaignResult.data;
  const steps = stepsResult.data || [];
  const enrollments = enrollmentsResult.data || [];
  const lists = listsResult.data || [];

  const enrollmentsByStatus = {
    active: enrollments.filter((e) => e.status === 'active').length,
    completed: enrollments.filter((e) => e.status === 'completed').length,
    unsubscribed: enrollments.filter((e) => e.status === 'unsubscribed').length,
    failed: enrollments.filter((e) => e.status === 'failed').length,
  };

  const statusBadge: Record<string, string> = {
    draft: styles.badgeNeutral,
    active: styles.badgeSuccess,
    paused: styles.badgeWarning,
    archived: styles.badgeDanger,
  };

  const enrollmentStatusBadge: Record<string, string> = {
    active: styles.badgeSuccess,
    completed: styles.badgeNeutral,
    unsubscribed: styles.badgeWarning,
    failed: styles.badgeDanger,
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/campaigns" style={{ color: 'var(--admin-text-muted)', display: 'flex' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className={styles.pageTitle}>{campaign.name}</h1>
          <span className={`${styles.badge} ${statusBadge[campaign.status] ?? styles.badgeNeutral}`}>
            {campaign.status}
          </span>
        </div>
        {campaign.description && (
          <p className={styles.pageDescription}>{campaign.description}</p>
        )}
      </header>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Steps</div>
          <div className={styles.statValue}>{steps.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active</div>
          <div className={styles.statValue} style={{ color: enrollmentsByStatus.active > 0 ? 'var(--admin-success)' : undefined }}>
            {enrollmentsByStatus.active}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{enrollmentsByStatus.completed}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Enrolled</div>
          <div className={styles.statValue}>{enrollments.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Steps */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Email Steps</h2>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>{steps.length} steps</span>
            </div>

            {steps.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No steps yet</p>
                <p className={styles.emptyDescription}>Add your first email step below.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    style={{
                      border: '1px solid var(--admin-border)',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--admin-surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: 'var(--admin-primary)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {step.step_number}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{step.subject}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '1px' }}>
                            {idx === 0
                              ? step.delay_hours === 0 ? 'Sends immediately on enrollment' : `Sends ${step.delay_hours}h after enrollment`
                              : `Sends ${step.delay_hours}h after previous step`}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)', borderTop: '1px solid var(--admin-border)', lineHeight: 1.5 }}>
                      <div style={{ maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {step.text_body || step.html_body.replace(/<[^>]+>/g, ' ').slice(0, 200)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Step Form */}
            <CampaignActions campaignId={id} lists={lists} mode="step" />
          </div>

          {/* Enrollments */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Enrollments</h2>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>{enrollments.length} total</span>
            </div>

            {enrollments.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyDescription}>No enrollments yet. Use the enroll panel to add users.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Status</th>
                      <th>Step</th>
                      <th>Next Send</th>
                      <th>Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enr: any) => (
                      <tr key={enr.id}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{enr.users?.name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{enr.users?.email}</div>
                        </td>
                        <td>
                          <span className={`${styles.badge} ${enrollmentStatusBadge[enr.status] ?? styles.badgeNeutral}`}>
                            {enr.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>
                          {enr.status === 'completed' ? '✓' : `${enr.current_step} / ${steps.length}`}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                          {enr.next_send_at
                            ? new Date(enr.next_send_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                          {new Date(enr.enrolled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '2rem' }}>

          {/* Campaign Settings */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Settings</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Trigger', value: campaign.trigger_type.replace(/_/g, ' ') },
                { label: 'Product', value: campaign.trigger_product_slug || '—' },
                { label: 'From', value: `${campaign.from_name}` },
                { label: 'Reply-to', value: campaign.from_email },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--admin-text-muted)', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Status toggle */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--admin-border)' }}>
              <CampaignActions campaignId={id} lists={lists} mode="status" currentStatus={campaign.status} />
            </div>
          </div>

          {/* Enroll a List */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Enroll Users</h2>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
              Enroll an entire contact list into this campaign.
            </p>
            <CampaignActions campaignId={id} lists={lists} mode="enroll" />
          </div>
        </div>
      </div>
    </div>
  );
}
