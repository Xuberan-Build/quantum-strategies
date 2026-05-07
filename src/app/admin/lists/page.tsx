import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';
import { SmartListBuilder } from './SmartListBuilder';

export default async function ListsPage() {
  const [listsResult, membersResult] = await Promise.all([
    supabaseAdmin
      .from('contact_lists')
      .select('id, name, description, list_type, created_by, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('list_members')
      .select('list_id'),
  ]);

  const lists = listsResult.data || [];
  const allMembers = membersResult.data || [];

  const memberCountMap = new Map<string, number>();
  for (const m of allMembers) {
    memberCountMap.set(m.list_id, (memberCountMap.get(m.list_id) ?? 0) + 1);
  }

  const totalMembers = allMembers.length;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className={styles.pageTitle}>Contact Lists</h1>
            <p className={styles.pageDescription}>Manage email lists and audience segments</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <SmartListBuilder />
            <Link href="/admin/lists/new" className={`${styles.btn} ${styles.btnSecondary}`}>
              + Static List
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Lists</div>
          <div className={styles.statValue}>{lists.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Members</div>
          <div className={styles.statValue}>{totalMembers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Static Lists</div>
          <div className={styles.statValue}>{lists.filter((l) => l.list_type === 'static').length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Smart Lists</div>
          <div className={styles.statValue}>{lists.filter((l) => l.list_type === 'smart').length}</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>All Lists</h2>
          <span className={`${styles.badge} ${styles.badgeNeutral}`}>{lists.length} total</span>
        </div>

        {lists.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No lists yet</p>
            <p className={styles.emptyDescription}>
              Create your first contact list to start organizing your audience.
            </p>
            <Link href="/admin/lists/new" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: '1rem' }}>
              Create a list
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lists.map((list) => (
                  <tr key={list.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{list.name}</div>
                      {list.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                          {list.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${list.list_type === 'smart' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                        {list.list_type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem' }}>
                      {list.list_type === 'smart' ? (
                        <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>dynamic</span>
                      ) : (
                        memberCountMap.get(list.id) ?? 0
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                      {new Date(list.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <Link
                        href={`/admin/lists/${list.id}`}
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
    </div>
  );
}
