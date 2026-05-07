import { supabaseAdmin } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';
import { ListMemberActions } from './ListMemberActions';

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listResult = await supabaseAdmin
    .from('contact_lists')
    .select('id, name, description, list_type, filter_criteria, created_by, created_at')
    .eq('id', id)
    .single();

  if (listResult.error || !listResult.data) notFound();

  const list = listResult.data;

  type MemberUser = { id: string; name: string | null; email: string };
  type Member = { id: string; user_id: string; added_at: string; added_by: string | null; users: MemberUser | null };

  let members: Member[] = [];
  let availableUsers: { id: string; name: string | null; email: string }[] = [];

  if (list.list_type === 'smart') {
    const source = (list.filter_criteria as any)?.source;
    let smartUsers: { id: string; name: string | null; email: string }[] = [];

    if (source === 'completed_product' || source === 'beta_participants') {
      // These require a subquery — fetch user_ids then join users
      let userIds: string[] = [];
      if (source === 'completed_product') {
        const { data } = await supabaseAdmin
          .from('product_sessions')
          .select('user_id')
          .not('completed_at', 'is', null);
        userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      } else {
        const { data } = await supabaseAdmin
          .from('beta_participants')
          .select('user_id');
        userIds = (data || []).map((r: any) => r.user_id);
      }
      if (userIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('id, name, email')
          .in('id', userIds)
          .order('name', { ascending: true });
        smartUsers = data || [];
      }
    } else {
      let query = supabaseAdmin
        .from('users')
        .select('id, name, email')
        .not('email', 'is', null)
        .order('name', { ascending: true });
      if (source === 'discord_linked') query = query.not('discord_id', 'is', null);
      else if (source === 'affiliates') query = query.eq('is_affiliate', true);
      else if (source === 'placements_confirmed') query = query.eq('placements_confirmed', true);
      else if (source === 'stripe_customers') query = query.not('stripe_customer_id', 'is', null);
      const { data } = await query;
      smartUsers = data || [];
    }

    members = smartUsers.map((u) => ({
      id: u.id,
      user_id: u.id,
      added_at: list.created_at,
      added_by: null,
      users: { id: u.id, name: u.name, email: u.email },
    }));
  } else {
    const [membersResult, allUsersResult] = await Promise.all([
      supabaseAdmin
        .from('list_members')
        .select('id, user_id, added_at, added_by, users(id, name, email)')
        .eq('list_id', id)
        .order('added_at', { ascending: false }),
      supabaseAdmin
        .from('users')
        .select('id, name, email')
        .order('name', { ascending: true }),
    ]);

    members = (membersResult.data || []).map((m) => ({
      id: m.id as string,
      user_id: m.user_id as string,
      added_at: m.added_at as string,
      added_by: m.added_by as string | null,
      users: (Array.isArray(m.users) ? m.users[0] : m.users) as MemberUser | null,
    }));

    const memberUserIds = new Set(members.map((m) => m.user_id));
    availableUsers = (allUsersResult.data || []).filter((u) => !memberUserIds.has(u.id));
  }

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/lists" className={styles.backLink} style={{ padding: 0 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className={styles.pageTitle}>{list.name}</h1>
          <span className={`${styles.badge} ${list.list_type === 'smart' ? styles.badgeSuccess : styles.badgeNeutral}`}>
            {list.list_type}
          </span>
        </div>
        {list.description && (
          <p className={styles.pageDescription}>{list.description}</p>
        )}
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Members</div>
          <div className={styles.statValue}>{members.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Created</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--admin-text)', marginTop: '0.25rem' }}>
            {new Date(list.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>
        {list.created_by && (
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Created By</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--admin-text)', marginTop: '0.25rem' }}>
              {list.created_by}
            </div>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Members</h2>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>{members.length}</span>
        </div>

        {list.list_type === 'smart' && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
            This list is resolved dynamically — members cannot be manually added or removed.
          </p>
        )}

        {members.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No members yet</p>
            <p className={styles.emptyDescription}>
              {list.list_type === 'smart'
                ? 'No users match this smart list criteria.'
                : 'Add users to this list using the form below.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Date Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {member.users?.name || (
                          <span style={{ color: 'var(--admin-text-muted)' }}>Unknown</span>
                        )}
                      </div>
                      {member.added_by && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          Added by {member.added_by}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                      {member.users?.email || '—'}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                      {new Date(member.added_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    {list.list_type !== 'smart' && (
                      <td>
                        <ListMemberActions
                          listId={id}
                          userId={member.user_id}
                          mode="remove"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {availableUsers.length > 0 && (
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--admin-border)',
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '0.75rem' }}>
              Add Member
            </h3>
            <ListMemberActions
              listId={id}
              availableUsers={availableUsers}
              mode="add"
            />
          </div>
        )}

        {availableUsers.length === 0 && members.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--admin-border)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
              All users are already in this list.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
