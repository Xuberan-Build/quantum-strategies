import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [userResult, sessionsResult, accessResult, emailSeqResult] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('product_sessions')
      .select('id, product_slug, current_step, total_steps, completed_at, created_at, updated_at, deliverable_content, deliverable_model, deliverable_input_tokens, deliverable_output_tokens')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('product_access')
      .select('product_slug, access_granted_at, purchase_source')
      .eq('user_id', id)
      .order('access_granted_at', { ascending: false }),
    supabaseAdmin
      .from('email_sequences')
      .select('id, sequence_type, email_status, scheduled_send_at, sent_at, failed_at, failure_reason, email_content')
      .eq('user_id', id)
      .order('scheduled_send_at', { ascending: false }),
  ]);

  if (userResult.error || !userResult.data) notFound();

  const user = userResult.data;
  const sessions = sessionsResult.data || [];
  const access = accessResult.data || [];
  const emailSeqs = emailSeqResult.data || [];

  // Fetch discord member separately (depends on user.discord_id)
  let discordMember: any = null;
  if (user.discord_id) {
    const { data } = await supabaseAdmin
      .from('member_sequences')
      .select('discord_id, username, sequence_stage, sequence_complete, rite_purchased, hesitation_type, member_type, escalate_to_austin, atl_member')
      .eq('discord_id', user.discord_id)
      .maybeSingle();
    discordMember = data;
  }

  const completedSessions = sessions.filter((s) => s.completed_at);
  const totalInputTokens = sessions.reduce((sum, s) => sum + (s.deliverable_input_tokens ?? 0), 0);
  const totalOutputTokens = sessions.reduce((sum, s) => sum + (s.deliverable_output_tokens ?? 0), 0);

  // Rough cost estimate: gpt-4o pricing ~$2.50/1M input, $10/1M output
  const estimatedCostCents = Math.round(
    (totalInputTokens / 1_000_000) * 250 + (totalOutputTokens / 1_000_000) * 1000
  );

  const stageLabels: Record<number, string> = {
    0: 'Not started', 1: 'Introduced', 2: 'Doctrine', 3: 'Rite link', 4: 'Day 10',
  };

  const emailStatusColor: Record<string, string> = {
    scheduled: 'var(--admin-warning)',
    sent: 'var(--admin-success)',
    failed: 'var(--admin-danger)',
    cancelled: 'var(--admin-text-muted)',
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/users" className={styles.backLink} style={{ padding: 0 }}>
            <BackIcon />
          </Link>
          <h1 className={styles.pageTitle}>{user.name || user.email}</h1>
        </div>
        <p className={styles.pageDescription}>
          {user.email} · Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </header>

      {/* Top stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Sessions Started</div>
          <div className={styles.statValue}>{sessions.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{completedSessions.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Tokens Used</div>
          <div className={styles.statValue}>{(totalInputTokens + totalOutputTokens).toLocaleString()}</div>
          <div className={styles.statChange}>{totalInputTokens.toLocaleString()} in · {totalOutputTokens.toLocaleString()} out</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Est. AI Cost</div>
          <div className={styles.statValue}>${(estimatedCostCents / 100).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Account Info */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Account</h2>
              {user.is_affiliate && (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Affiliate</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { label: 'Name', value: user.name },
                { label: 'Email', value: user.email },
                { label: 'Stripe Customer', value: user.stripe_customer_id },
                { label: 'Discord ID', value: user.discord_id },
                { label: 'Affiliate Enrolled', value: user.affiliate_enrolled_at ? new Date(user.affiliate_enrolled_at).toLocaleDateString() : null },
                { label: 'Total Earnings', value: user.total_earnings_cents > 0 ? `$${(user.total_earnings_cents / 100).toFixed(2)}` : null },
                { label: 'Available Balance', value: user.available_balance_cents > 0 ? `$${(user.available_balance_cents / 100).toFixed(2)}` : null },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', wordBreak: 'break-all' }}>{value ?? <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Journey */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Product Journey</h2>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>{sessions.length} sessions</span>
            </div>

            {sessions.length === 0 ? (
              <div className={styles.emptyState}>
                <p className={styles.emptyDescription}>No sessions started yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sessions.map((session) => {
                  const pct = session.total_steps > 0
                    ? Math.round((session.current_step / session.total_steps) * 100)
                    : 0;
                  const isComplete = !!session.completed_at;

                  return (
                    <div key={session.id} style={{
                      border: '1px solid var(--admin-border)',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                    }}>
                      {/* Session header */}
                      <div style={{ padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isComplete ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {formatSlug(session.product_slug)}
                            {isComplete && (
                              <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.7rem' }}>Complete</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                            Started {new Date(session.created_at).toLocaleDateString()}
                            {isComplete && ` · Completed ${new Date(session.completed_at!).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                          Step {session.current_step} / {session.total_steps}
                          {session.deliverable_model && (
                            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>{session.deliverable_model}</div>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: '3px', background: 'var(--admin-border)' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isComplete ? 'var(--admin-success)' : 'var(--admin-primary)', transition: 'width 0.3s' }} />
                      </div>

                      {/* Token row */}
                      {(session.deliverable_input_tokens || session.deliverable_output_tokens) && (
                        <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', borderTop: '1px solid var(--admin-border)', display: 'flex', gap: '1rem' }}>
                          <span>{(session.deliverable_input_tokens ?? 0).toLocaleString()} in</span>
                          <span>{(session.deliverable_output_tokens ?? 0).toLocaleString()} out</span>
                        </div>
                      )}

                      {/* Deliverable preview */}
                      {session.deliverable_content && (
                        <details style={{ borderTop: '1px solid var(--admin-border)' }}>
                          <summary style={{ padding: '0.625rem 1rem', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--admin-primary)', fontWeight: 500, userSelect: 'none' }}>
                            View deliverable
                          </summary>
                          <div style={{ padding: '1rem', background: 'var(--admin-bg)', fontSize: '0.8125rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', borderTop: '1px solid var(--admin-border)' }}>
                            {session.deliverable_content}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Access */}
          {access.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Product Access</h2>
                <span className={`${styles.badge} ${styles.badgeNeutral}`}>{access.length}</span>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Source</th>
                    <th>Granted</th>
                  </tr>
                </thead>
                <tbody>
                  {access.map((a, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.875rem' }}>{formatSlug(a.product_slug)}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontSize: '0.7rem' }}>
                          {a.purchase_source || 'purchase'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                        {new Date(a.access_granted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '2rem' }}>

          {/* Email Sequences */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Email Sequences</h2>
              <span className={`${styles.badge} ${styles.badgeNeutral}`}>{emailSeqs.length}</span>
            </div>
            {emailSeqs.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>No emails scheduled.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {emailSeqs.map((seq, i) => (
                  <div key={seq.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                        {seq.sequence_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: emailStatusColor[seq.email_status] || 'var(--admin-text-muted)' }}>
                        {seq.email_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                      {seq.email_status === 'scheduled' && seq.scheduled_send_at
                        ? `Sends ${new Date(seq.scheduled_send_at).toLocaleString()}`
                        : seq.sent_at
                        ? `Sent ${new Date(seq.sent_at).toLocaleString()}`
                        : seq.failure_reason || '—'}
                    </div>
                    {i < emailSeqs.length - 1 && <div style={{ borderBottom: '1px solid var(--admin-border)', marginTop: '0.5rem' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discord Link */}
          {discordMember && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Discord</h2>
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>Linked</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {[
                  { label: 'Username', value: discordMember.username },
                  { label: 'Stage', value: `${discordMember.sequence_stage} — ${stageLabels[discordMember.sequence_stage] || 'Unknown'}` },
                  { label: 'Hesitation', value: discordMember.hesitation_type },
                  { label: 'Member Type', value: discordMember.member_type },
                  { label: 'Rite Purchased', value: discordMember.rite_purchased ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value ?? '—'}</span>
                  </div>
                ))}
                <div style={{ marginTop: '0.5rem' }}>
                  <Link
                    href={`/admin/discord/${discordMember.discord_id}`}
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    View Discord Profile
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function BackIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

const stageLabels: Record<number, string> = {
  0: 'Not started', 1: 'Introduced', 2: 'Doctrine', 3: 'Rite link', 4: 'Day 10',
};
