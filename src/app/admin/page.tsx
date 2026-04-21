import { supabaseAdmin, createServerSupabaseClient } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from './admin-layout.module.css';

// Auth is handled by middleware.ts
export default async function AdminPanel() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const adminEmail = session?.user?.email || '';

  // Get admin name from users table
  const { data: userData } = await supabase
    .from('users')
    .select('name')
    .eq('id', session?.user?.id || '')
    .single();
  const adminName = userData?.name || '';

  // Fetch dashboard stats
  const [productsResult, sessionsResult, usersResult, recentActivityResult] = await Promise.all([
    supabaseAdmin.from('product_definitions').select('id, name, is_active', { count: 'exact' }),
    supabaseAdmin.from('product_sessions').select('id, is_complete', { count: 'exact' }),
    supabaseAdmin.from('users').select('id', { count: 'exact' }),
    supabaseAdmin
      .from('admin_audit_logs')
      .select('id, action_type, target_type, target_name, admin_email, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const totalProducts = productsResult.count || 0;
  const activeProducts = productsResult.data?.filter((p) => p.is_active).length || 0;
  const totalSessions = sessionsResult.count || 0;
  const completedSessions = sessionsResult.data?.filter((s) => s.is_complete).length || 0;
  const totalUsers = usersResult.count || 0;
  const recentActivity = recentActivityResult.data || [];

  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return (
    <div>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Admin Panel</h1>
        <p className={styles.pageDescription}>
          Welcome back, {adminName || adminEmail}
        </p>
      </header>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Products</div>
          <div className={styles.statValue}>{totalProducts}</div>
          <div className={styles.statChange}>
            {activeProducts} active
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Sessions</div>
          <div className={styles.statValue}>{totalSessions.toLocaleString()}</div>
          <div className={`${styles.statChange} ${styles.statChangePositive}`}>
            {completionRate}% completion rate
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed Sessions</div>
          <div className={styles.statValue}>{completedSessions.toLocaleString()}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{totalUsers.toLocaleString()}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Quick Actions</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/admin/products" className={`${styles.btn} ${styles.btnPrimary}`}>
            <ProductsIcon />
            Manage Products
          </Link>
          <Link href="/admin/prompts" className={`${styles.btn} ${styles.btnSecondary}`}>
            <PromptsIcon />
            Edit Prompts
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Recent Admin Activity</h2>
        </div>
        {recentActivity.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Admin</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((activity) => (
                <tr key={activity.id}>
                  <td>
                    <span className={`${styles.badge} ${getBadgeStyle(activity.action_type)}`}>
                      {formatActionType(activity.action_type)}
                    </span>
                  </td>
                  <td>{activity.target_name || activity.target_type}</td>
                  <td>{activity.admin_email}</td>
                  <td>{formatDate(activity.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No activity yet</div>
            <p className={styles.emptyDescription}>
              Admin actions will appear here as you make changes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getBadgeStyle(actionType: string): string {
  if (actionType.includes('create')) return styles.badgeSuccess;
  if (actionType.includes('delete')) return styles.badgeDanger;
  if (actionType.includes('update') || actionType.includes('reorder')) return styles.badgeWarning;
  return styles.badgeNeutral;
}

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Icons
function ProductsIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function PromptsIcon() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}
