import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

// Auth handled by middleware.ts
export default async function DiscordPage() {
  const [membersResult, escalationsResult, activityResult] = await Promise.all([
    supabaseAdmin
      .from('member_sequences')
      .select('*')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('member_sequences')
      .select('discord_id')
      .eq('escalate_to_austin', true)
      .eq('sequence_complete', false),
    supabaseAdmin
      .from('discord_activity')
      .select('id, discord_id, event_type, sequence_stage, created_at, event_data')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const members = membersResult.data || [];
  const escalations = escalationsResult.data || [];
  const activity = activityResult.data || [];

  const inSequence = members.filter((m) => m.sequence_stage > 0 && !m.sequence_complete);
  const atl = members.filter((m) => m.atl_member);
  const purchased = members.filter((m) => m.rite_purchased);

  const stageLabels: Record<number, string> = {
    0: 'Not started',
    1: 'Introduced',
    2: 'Doctrine',
    3: 'Rite link',
    4: 'Day 10',
  };

  const hesitationColors: Record<string, string> = {
    confusion: '#f59e0b',
    overwhelm: '#ef4444',
    avoidance: '#8b5cf6',
    skepticism: '#6366f1',
    high_agency: '#10b981',
  };

  const memberTypeColors: Record<string, string> = {
    operator: '#6366f1',
    creator: '#10b981',
    seeker: '#f59e0b',
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Discord</h1>
        <p className={styles.pageDescription}>
          Member onboarding sequences, activity, and escalations
        </p>
      </header>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Members</div>
          <div className={styles.statValue}>{members.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>In Sequence</div>
          <div className={styles.statValue}>{inSequence.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Escalations Pending</div>
          <div className={styles.statValue} style={{ color: escalations.length > 0 ? 'var(--admin-danger)' : 'var(--admin-text)' }}>
            {escalations.length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Purchased Rite</div>
          <div className={styles.statValue}>{purchased.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>ATL Members</div>
          <div className={styles.statValue}>{atl.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sequence Complete</div>
          <div className={styles.statValue}>{members.filter((m) => m.sequence_complete).length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Member Table */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Members</h2>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>{members.length} total</span>
          </div>

          {members.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No members yet</p>
              <p className={styles.emptyDescription}>Members appear here once the Discord bot starts syncing.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Stage</th>
                    <th>Type</th>
                    <th>Hesitation</th>
                    <th>Flags</th>
                    <th>Last Message</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.discord_id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{member.name_detected || member.username || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                          {member.discord_id}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                          {member.role || 'Guest'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.8125rem' }}>
                            {stageLabels[member.sequence_stage] || `Stage ${member.sequence_stage}`}
                          </span>
                          {member.sequence_complete && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.7rem' }}>Complete</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {member.member_type ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: memberTypeColors[member.member_type] || 'var(--admin-text-muted)',
                          }}>
                            {member.member_type}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {member.hesitation_type ? (
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: hesitationColors[member.hesitation_type] || 'var(--admin-text-muted)',
                          }}>
                            {member.hesitation_type}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {member.escalate_to_austin && (
                            <span className={`${styles.badge} ${styles.badgeDanger}`} style={{ fontSize: '0.7rem' }}>Escalate</span>
                          )}
                          {member.atl_member && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`} style={{ fontSize: '0.7rem' }}>ATL</span>
                          )}
                          {member.rite_purchased && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.7rem' }}>Purchased</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        {member.last_message_sent
                          ? new Date(member.last_message_sent).toLocaleDateString()
                          : '—'}
                      </td>
                      <td>
                        <Link
                          href={`/admin/discord/${member.discord_id}`}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className={styles.card} style={{ position: 'sticky', top: '2rem' }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Recent Activity</h2>
          </div>

          {activity.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyDescription}>No activity logged yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
              {activity.map((event) => (
                <div key={event.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--admin-primary)',
                    marginTop: '5px',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                      {event.event_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                      {event.discord_id}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                      {new Date(event.created_at).toLocaleDateString()} · Stage {event.sequence_stage ?? '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
