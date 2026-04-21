import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';

export default async function UsersPage() {
  const [usersResult, sessionsResult] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id, name, email, is_affiliate, affiliate_opted_out, created_at, discord_id')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('product_sessions')
      .select('user_id, completed_at'),
  ]);

  const users = usersResult.data || [];
  const sessions = sessionsResult.data || [];

  // Aggregate session counts per user
  const sessionMap = new Map<string, { total: number; completed: number }>();
  for (const s of sessions) {
    const cur = sessionMap.get(s.user_id) ?? { total: 0, completed: 0 };
    cur.total++;
    if (s.completed_at) cur.completed++;
    sessionMap.set(s.user_id, cur);
  }

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => (sessionMap.get(u.id)?.total ?? 0) > 0).length;
  const affiliates = users.filter((u) => u.is_affiliate).length;
  const completedAtLeastOne = users.filter((u) => (sessionMap.get(u.id)?.completed ?? 0) > 0).length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Users</h1>
        <p className={styles.pageDescription}>All registered accounts and their session activity</p>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{totalUsers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Started a Session</div>
          <div className={styles.statValue}>{activeUsers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed a Rite</div>
          <div className={styles.statValue}>{completedAtLeastOne}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Affiliates</div>
          <div className={styles.statValue}>{affiliates}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>All Users</h2>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>{totalUsers} total</span>
        </div>

        {users.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No users yet</p>
            <p className={styles.emptyDescription}>Users appear here once they register.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Joined</th>
                  <th>Sessions</th>
                  <th>Completions</th>
                  <th>Flags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const stats = sessionMap.get(user.id) ?? { total: 0, completed: 0 };
                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{user.name || <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{user.email}</div>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{stats.total}</td>
                      <td>
                        <span style={{ fontSize: '0.875rem', fontWeight: stats.completed > 0 ? 600 : 400, color: stats.completed > 0 ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
                          {stats.completed}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {user.is_affiliate && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.7rem' }}>Affiliate</span>
                          )}
                          {user.discord_id && (
                            <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontSize: '0.7rem' }}>Discord</span>
                          )}
                          {user.affiliate_opted_out && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`} style={{ fontSize: '0.7rem' }}>Opted out</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Link
                          href={`/admin/users/${user.id}`}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                        >
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
