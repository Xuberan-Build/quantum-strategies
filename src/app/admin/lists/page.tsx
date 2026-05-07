import { supabaseAdmin } from '@/lib/supabase/server';
import Link from 'next/link';
import styles from '../admin-layout.module.css';
import { SmartListBuilder } from './SmartListBuilder';

type FilterCriteria = {
  source?: string;
  product_slug?: string;
  hd_type?: string;
  sun_sign?: string;
};

async function getSmartListCount(filterCriteria: FilterCriteria): Promise<number> {
  const source = filterCriteria?.source;

  if (source === 'completed_product') {
    const productSlug = filterCriteria?.product_slug;
    let q = supabaseAdmin.from('product_sessions').select('user_id').not('completed_at', 'is', null);
    if (productSlug) q = q.eq('product_slug', productSlug);
    const { data } = await q;
    return new Set((data || []).map((r) => r.user_id)).size;
  }

  if (source === 'beta_participants') {
    const { count } = await supabaseAdmin
      .from('beta_participants')
      .select('*', { count: 'exact', head: true });
    return count ?? 0;
  }

  if (source === 'hd_type') {
    const hdType = filterCriteria?.hd_type;
    if (!hdType) return 0;
    const { count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('email', 'is', null)
      .filter('placements->human_design->>type', 'ilike', `%${hdType}%`);
    return count ?? 0;
  }

  if (source === 'sun_sign') {
    const sunSign = filterCriteria?.sun_sign;
    if (!sunSign) return 0;
    const { count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .not('email', 'is', null)
      .filter('placements->astrology->>sun', 'ilike', `%${sunSign}%`);
    return count ?? 0;
  }

  // Simple column-based filters
  let query = supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).not('email', 'is', null);
  if (source === 'discord_linked') query = query.not('discord_id', 'is', null);
  else if (source === 'affiliates') query = query.eq('is_affiliate', true);
  else if (source === 'placements_confirmed') query = query.eq('placements_confirmed', true);
  else if (source === 'stripe_customers') query = query.not('stripe_customer_id', 'is', null);
  const { count } = await query;
  return count ?? 0;
}

export default async function ListsPage() {
  const [listsResult, membersResult] = await Promise.all([
    supabaseAdmin
      .from('contact_lists')
      .select('id, name, description, list_type, filter_criteria, created_by, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('list_members')
      .select('list_id'),
  ]);

  const lists = listsResult.data || [];
  const allMembers = membersResult.data || [];

  const staticCountMap = new Map<string, number>();
  for (const m of allMembers) {
    staticCountMap.set(m.list_id, (staticCountMap.get(m.list_id) ?? 0) + 1);
  }

  // Resolve smart list counts in parallel
  const smartLists = lists.filter((l) => l.list_type === 'smart');
  const smartCounts = await Promise.all(
    smartLists.map((l) => getSmartListCount(l.filter_criteria as FilterCriteria))
  );
  const smartCountMap = new Map<string, number>();
  smartLists.forEach((l, i) => smartCountMap.set(l.id, smartCounts[i]));

  const totalSmartMembers = smartCounts.reduce((sum, n) => sum + n, 0);
  const totalStaticMembers = allMembers.length;

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
          <div className={styles.statLabel}>Smart List Members</div>
          <div className={styles.statValue}>{totalSmartMembers}</div>
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
                {lists.map((list) => {
                  const count = list.list_type === 'smart'
                    ? smartCountMap.get(list.id) ?? 0
                    : staticCountMap.get(list.id) ?? 0;
                  return (
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
                      <td style={{ fontSize: '0.875rem' }}>{count}</td>
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
                  );
                })}
              </tbody>
            </table>
            {totalStaticMembers > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', padding: '0.75rem 1rem 0' }}>
                + {totalStaticMembers} static list member{totalStaticMembers !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
