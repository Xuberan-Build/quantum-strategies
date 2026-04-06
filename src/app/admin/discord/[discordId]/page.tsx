import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default async function DiscordMemberPage({
  params,
}: {
  params: Promise<{ discordId: string }>;
}) {
  const { discordId } = await params;

  const [memberResult, activityResult, linkedUserResult] = await Promise.all([
    supabaseAdmin
      .from('member_sequences')
      .select('*')
      .eq('discord_id', discordId)
      .single(),
    supabaseAdmin
      .from('discord_activity')
      .select('*')
      .eq('discord_id', discordId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('users')
      .select('id, name, email, created_at')
      .eq('discord_id', discordId)
      .maybeSingle(),
  ]);

  if (memberResult.error || !memberResult.data) {
    notFound();
  }

  const member = memberResult.data;
  const activity = activityResult.data || [];
  const linkedUser = linkedUserResult.data;

  const stageLabels: Record<number, string> = {
    0: 'Not started',
    1: 'Introduced',
    2: 'Doctrine engaged',
    3: 'Rite link sent',
    4: 'Day 10 follow-up',
  };

  const fieldGroups = [
    {
      title: 'Identity',
      fields: [
        { label: 'Discord ID', value: member.discord_id },
        { label: 'Username', value: member.username },
        { label: 'Name Detected', value: member.name_detected },
        { label: 'Role', value: member.role },
      ],
    },
    {
      title: 'Sequence State',
      fields: [
        { label: 'Stage', value: `${member.sequence_stage} — ${stageLabels[member.sequence_stage] || 'Unknown'}` },
        { label: 'Complete', value: member.sequence_complete ? 'Yes' : 'No' },
        { label: 'Engaged', value: member.engaged ? 'Yes' : 'No' },
        { label: 'Last Message', value: member.last_message_sent ? new Date(member.last_message_sent).toLocaleString() : '—' },
      ],
    },
    {
      title: 'Profile',
      fields: [
        { label: 'Member Type', value: member.member_type },
        { label: 'Hesitation Type', value: member.hesitation_type },
        { label: 'Keywords Detected', value: member.keywords_detected?.join(', ') },
      ],
    },
    {
      title: 'Gate',
      fields: [
        { label: 'Agreements Acknowledged', value: member.agreements_acknowledged ? 'Yes' : 'No' },
        { label: 'Agreements Timestamp', value: member.agreements_timestamp ? new Date(member.agreements_timestamp).toLocaleString() : '—' },
      ],
    },
    {
      title: 'Rite Progress',
      fields: [
        { label: 'Link Clicked', value: member.rite_link_clicked ? 'Yes' : 'No' },
        { label: 'Purchased', value: member.rite_purchased ? 'Yes' : 'No' },
        { label: 'Product', value: member.rite_purchased_product },
        { label: 'Purchase Date', value: member.rite_purchase_timestamp ? new Date(member.rite_purchase_timestamp).toLocaleString() : '—' },
        { label: 'Results Posted', value: member.rite_results_posted ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'Flags',
      fields: [
        { label: 'ATL Member', value: member.atl_member ? 'Yes' : 'No' },
        { label: 'Escalate to Austin', value: member.escalate_to_austin ? 'Yes' : 'No' },
        { label: 'Escalation Reason', value: member.escalation_reason },
      ],
    },
  ];

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/discord" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>
            {member.name_detected || member.username || member.discord_id}
          </h1>
        </div>
        <p className={styles.pageDescription}>
          Discord ID: {member.discord_id}
          {linkedUser && ` · Linked QS account: ${linkedUser.email}`}
        </p>
      </header>

      {/* Alert flags */}
      {(member.escalate_to_austin || member.atl_member) && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {member.escalate_to_austin && (
            <div style={{
              padding: '0.875rem 1.25rem',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              flex: 1,
            }}>
              <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.25rem' }}>Escalation Required</div>
              <div style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>{member.escalation_reason || 'No reason provided'}</div>
            </div>
          )}
          {member.atl_member && (
            <div style={{
              padding: '0.875rem 1.25rem',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '0.5rem',
              flex: 1,
            }}>
              <div style={{ fontWeight: 600, color: '#92400e' }}>ATL Member</div>
              <div style={{ fontSize: '0.875rem', color: '#78350f' }}>Above-the-line — priority engagement</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Field Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {fieldGroups.map((group) => (
            <div key={group.title} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{group.title}</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {group.fields.map((f) => (
                  <div key={f.label}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '2px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--admin-text)' }}>
                      {f.value ?? <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Inline text content */}
              {group.title === 'Sequence State' && member.intro_content && (
                <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--admin-bg)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem', fontWeight: 500, textTransform: 'uppercase' }}>
                    Intro Content
                  </div>
                  <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{member.intro_content}</div>
                </div>
              )}
              {group.title === 'Sequence State' && member.doctrine_response && (
                <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--admin-bg)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem', fontWeight: 500, textTransform: 'uppercase' }}>
                    Doctrine Response
                  </div>
                  <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{member.doctrine_response}</div>
                </div>
              )}
              {group.title === 'Sequence State' && member.day10_response && (
                <div style={{ marginTop: '1rem', padding: '0.875rem', background: 'var(--admin-bg)', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem', fontWeight: 500, textTransform: 'uppercase' }}>
                    Day 10 Response
                  </div>
                  <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{member.day10_response}</div>
                </div>
              )}
            </div>
          ))}

          {/* Linked QS Account */}
          {linkedUser && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Linked QS Account</h2>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Verified</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '2px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</div>
                  <div style={{ fontSize: '0.875rem' }}>{linkedUser.name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '2px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div>
                  <div style={{ fontSize: '0.875rem' }}>{linkedUser.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '2px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</div>
                  <div style={{ fontSize: '0.875rem' }}>{new Date(linkedUser.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className={styles.card} style={{ position: 'sticky', top: '2rem' }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Activity Log</h2>
            <span className={`${styles.badge} ${styles.badgeNeutral}`}>{activity.length}</span>
          </div>

          {activity.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyDescription}>No activity recorded yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '700px', overflowY: 'auto' }}>
              {activity.map((event, i) => (
                <div key={event.id} style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--admin-primary)',
                      flexShrink: 0,
                      marginTop: '3px',
                    }} />
                    {i < activity.length - 1 && (
                      <div style={{ width: '2px', flex: 1, background: 'var(--admin-border)', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, paddingBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {event.event_type.replace(/_/g, ' ')}
                    </div>
                    {event.sequence_stage != null && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        Stage {event.sequence_stage}
                      </div>
                    )}
                    {event.event_data && Object.keys(event.event_data).length > 0 && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--admin-text-muted)',
                        marginTop: '4px',
                        fontFamily: 'monospace',
                        background: 'var(--admin-bg)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                      }}>
                        {JSON.stringify(event.event_data).slice(0, 120)}
                        {JSON.stringify(event.event_data).length > 120 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                      {new Date(event.created_at).toLocaleString()}
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

function BackIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
