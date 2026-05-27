'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

export const FRICTION_STATUSES = ['new', 'triaged', 'resolved', 'wont_fix'] as const;
export const FRICTION_REASONS = ['tedious', 'unclear', 'other'] as const;

export type FrictionStatus = (typeof FRICTION_STATUSES)[number];
export type FrictionReason = (typeof FRICTION_REASONS)[number];

export interface FrictionLogListRow {
  id: string;
  user_id: string | null;
  product_session_id: string | null;
  product_slug: string;
  step_index: number | null;
  reason: FrictionReason;
  note: string | null;
  response_excerpt: string | null;
  status: FrictionStatus;
  triaged_by: string | null;
  triaged_at: string | null;
  triage_note: string | null;
  created_at: string;
  updated_at: string;
}

interface FrictionLogListProps {
  initialRows: FrictionLogListRow[];
  productSlugs: string[];
}

type StatusFilter = FrictionStatus | 'all';
type ReasonFilter = FrictionReason | 'all';

const REASON_LABELS: Record<FrictionReason, string> = {
  tedious: 'Too tedious',
  unclear: 'Unclear',
  other: 'Other',
};

const STATUS_LABELS: Record<FrictionStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  resolved: 'Resolved',
  wont_fix: "Won't fix",
};

function statusBadgeClass(status: FrictionStatus): string {
  switch (status) {
    case 'new':
      return styles.badgeWarning;
    case 'triaged':
      return styles.badgeNeutral;
    case 'resolved':
      return styles.badgeSuccess;
    case 'wont_fix':
      return styles.badgeDanger;
    default:
      return styles.badgeNeutral;
  }
}

function reasonBadgeClass(reason: FrictionReason): string {
  switch (reason) {
    case 'tedious':
      return styles.badgeWarning;
    case 'unclear':
      return styles.badgeNeutral;
    case 'other':
      return styles.badgeNeutral;
    default:
      return styles.badgeNeutral;
  }
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function truncate(text: string | null, max: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
}

export default function FrictionLogList({ initialRows, productSlugs }: FrictionLogListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [productFilter, setProductFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>('all');

  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (productFilter && row.product_slug !== productFilter) return false;
      if (reasonFilter !== 'all' && row.reason !== reasonFilter) return false;
      return true;
    });
  }, [initialRows, statusFilter, productFilter, reasonFilter]);

  const resetFilters = () => {
    setStatusFilter('all');
    setProductFilter('');
    setReasonFilter('all');
  };

  const hasFilters = statusFilter !== 'all' || productFilter !== '' || reasonFilter !== 'all';

  return (
    <>
      {/* Filters */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Status</label>
            <select
              className={styles.formInput}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              {FRICTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Product slug</label>
            <select
              className={styles.formInput}
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="">All products</option>
              {productSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {slug}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Reason</label>
            <select
              className={styles.formInput}
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as ReasonFilter)}
            >
              <option value="all">All reasons</option>
              {FRICTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
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
            Friction events
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
            <div className={styles.emptyTitle}>No friction events match the current filters</div>
            <div className={styles.emptyDescription}>
              {initialRows.length === 0
                ? 'Nothing has been flagged yet. When customers flag a step, it will show up here.'
                : 'Try clearing the filters or expanding your selection.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product / step</th>
                  <th style={{ width: 110 }}>Reason</th>
                  <th>Note</th>
                  <th style={{ width: 160 }}>Created</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      <div>{row.product_slug}</div>
                      <div style={{ color: 'var(--admin-text-muted)' }}>
                        step {row.step_index ?? '—'}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${reasonBadgeClass(row.reason)}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {REASON_LABELS[row.reason]}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', maxWidth: 360 }}>
                      {row.note ? (
                        truncate(row.note, 120)
                      ) : (
                        <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                          —
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--admin-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(row.created_at)}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${statusBadgeClass(row.status)}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/admin/friction-log/${encodeURIComponent(row.id)}`}
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
    </>
  );
}
