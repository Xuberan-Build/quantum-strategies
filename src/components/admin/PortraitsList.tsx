'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

export interface PortraitsListRow {
  user_id: string;
  email: string;
  created_at: string;
  has_portrait: boolean;
  opt_out: boolean;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  sections_with_current: number;
  products_completed_count: number;
}

interface PortraitsListProps {
  initialRows: PortraitsListRow[];
}

type OptOutFilter = 'all' | 'yes' | 'no';
type HasPortraitFilter = 'all' | 'yes' | 'no';
type RecentFilter = 'all' | '7' | '30' | '90';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default function PortraitsList({ initialRows }: PortraitsListProps) {
  const [emailFilter, setEmailFilter] = useState<string>('');
  const [optOutFilter, setOptOutFilter] = useState<OptOutFilter>('all');
  const [hasPortraitFilter, setHasPortraitFilter] = useState<HasPortraitFilter>('yes');
  const [recentFilter, setRecentFilter] = useState<RecentFilter>('all');

  const filteredRows = useMemo(() => {
    const now = Date.now();
    return initialRows.filter((row) => {
      if (emailFilter && !row.email.toLowerCase().includes(emailFilter.toLowerCase())) return false;
      if (optOutFilter === 'yes' && !row.opt_out) return false;
      if (optOutFilter === 'no' && row.opt_out) return false;
      if (hasPortraitFilter === 'yes' && !row.has_portrait) return false;
      if (hasPortraitFilter === 'no' && row.has_portrait) return false;
      if (recentFilter !== 'all') {
        if (!row.last_extracted_at) return false;
        const days = Number(recentFilter);
        const age = now - new Date(row.last_extracted_at).getTime();
        if (age > days * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [initialRows, emailFilter, optOutFilter, hasPortraitFilter, recentFilter]);

  const resetFilters = () => {
    setEmailFilter('');
    setOptOutFilter('all');
    setHasPortraitFilter('yes');
    setRecentFilter('all');
  };

  const hasFilters =
    emailFilter !== '' ||
    optOutFilter !== 'all' ||
    hasPortraitFilter !== 'yes' ||
    recentFilter !== 'all';

  return (
    <>
      {/* Filters */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 140px 160px auto',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Email contains</label>
            <input
              type="text"
              className={styles.formInput}
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="filter by email"
            />
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Opted out</label>
            <select
              className={styles.formInput}
              value={optOutFilter}
              onChange={(e) => setOptOutFilter(e.target.value as OptOutFilter)}
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Has portrait</label>
            <select
              className={styles.formInput}
              value={hasPortraitFilter}
              onChange={(e) => setHasPortraitFilter(e.target.value as HasPortraitFilter)}
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Extracted in last</label>
            <select
              className={styles.formInput}
              value={recentFilter}
              onChange={(e) => setRecentFilter(e.target.value as RecentFilter)}
            >
              <option value="all">Any time</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ opacity: hasFilters ? 1 : 0.5 }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Users
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.8125rem',
                color: 'var(--admin-text-muted)',
                fontWeight: 400,
              }}
            >
              {filteredRows.length} of {initialRows.length}
            </span>
          </h2>
        </div>

        {filteredRows.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No users match the current filters</div>
            <div className={styles.emptyDescription}>
              {initialRows.length === 0
                ? 'No users found in the recent fetch window.'
                : 'Try clearing the filters or expanding your selection.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Portrait</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Opt-out</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Sections</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Products</th>
                  <th>Last extracted</th>
                  <th>Last reviewed</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.user_id}>
                    <td style={{ fontSize: '0.8125rem' }}>{row.email}</td>
                    <td style={{ textAlign: 'center' }}>
                      {row.has_portrait ? (
                        <span
                          className={`${styles.badge} ${styles.badgeSuccess}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          yes
                        </span>
                      ) : (
                        <span
                          className={`${styles.badge} ${styles.badgeNeutral}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          no
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.opt_out ? (
                        <span
                          className={`${styles.badge} ${styles.badgeDanger}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          yes
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          no
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {row.sections_with_current}/6
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {row.products_completed_count}
                    </td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {formatDate(row.last_extracted_at)}
                    </td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      {formatDate(row.last_reviewed_at)}
                    </td>
                    <td>
                      <Link
                        href={`/admin/portraits/${encodeURIComponent(row.user_id)}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
