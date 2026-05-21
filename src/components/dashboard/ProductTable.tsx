'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import SessionVersionManager from '@/components/dashboard/SessionVersionManager';
import styles from '@/app/dashboard/dashboard.module.css';

export type ProductTableRow = {
  slug: string;
  name: string;
  estimatedDuration: string;
  totalSteps: number;
  riteLabel: string;
  displayOrder: number;
  statusLabel: 'Locked' | 'Ready' | 'In Progress' | 'Complete';
  statusClass: string;
  statusRank: number;
  progressLabel: string;
  progressValue: number;
  lastActivityLabel: string;
  lastActivityTimestamp: number;
  primaryHref: string;
  primaryLabel: string;
  primaryVariant: 'primary' | 'purchase';
  detailsHref: string;
  showChat: boolean;
  chatHref?: string;
  sessionId?: string;
  attemptsRemaining: number | null;
};

type SortKey = 'product' | 'rite' | 'order' | 'status' | 'progress' | 'lastActivity';

type SortState = {
  key: SortKey;
  direction: 'asc' | 'desc';
};

type Props = {
  rows: ProductTableRow[];
  createNewVersionAction: (formData: FormData) => Promise<void>;
};

const defaultSort: SortState = {
  key: 'order',
  direction: 'asc',
};

const defaultDirectionByKey: Record<SortKey, SortState['direction']> = {
  product: 'asc',
  rite: 'asc',
  order: 'asc',
  status: 'asc',
  progress: 'desc',
  lastActivity: 'desc',
};

function getSortValue(row: ProductTableRow, key: SortKey) {
  switch (key) {
    case 'product':
      return row.name.toLowerCase();
    case 'rite':
      return row.riteLabel.toLowerCase();
    case 'order':
      return row.displayOrder;
    case 'status':
      return row.statusRank;
    case 'progress':
      return row.progressValue;
    case 'lastActivity':
      return row.lastActivityTimestamp;
    default:
      return '';
  }
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

function SortIndicator({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  const classes = [
    styles.sortIcon,
    active ? styles.sortIconActive : '',
    direction === 'desc' ? styles.sortIconDown : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} aria-hidden="true">
      ^
    </span>
  );
}

export default function ProductTable({ rows, createNewVersionAction }: Props) {
  const [sortState, setSortState] = useState<SortState>(defaultSort);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const valueA = getSortValue(a, sortState.key);
      const valueB = getSortValue(b, sortState.key);
      const primaryCompare = compareValues(valueA, valueB);
      if (primaryCompare !== 0) {
        return sortState.direction === 'asc' ? primaryCompare : -primaryCompare;
      }
      const fallbackCompare = b.lastActivityTimestamp - a.lastActivityTimestamp;
      return fallbackCompare;
    });

    return sorted;
  }, [rows, sortState]);

  const handleSort = (key: SortKey) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: defaultDirectionByKey[key],
      };
    });
  };

  return (
    <>
      {/* Mobile card layout */}
      <div className={styles.mobileOnly}>
        <div className={styles.mobileCardList}>
          {sortedRows.map((row) => (
            <div key={row.slug} className={styles.mobileCard}>
              <div className={styles.mobileCardTop}>
                <div className={styles.mobileCardInfo}>
                  <div className={styles.productName}>{row.name}</div>
                  <div className={styles.productSub}>
                    {row.riteLabel} · #{row.displayOrder} · {row.estimatedDuration}
                  </div>
                </div>
                <span className={`${styles.statusPill} ${styles[row.statusClass]}`}>
                  {row.statusLabel}
                </span>
              </div>
              <div className={styles.mobileCardMeta}>
                <span>{row.progressLabel}</span>
                <span>·</span>
                <span>{row.lastActivityLabel}</span>
              </div>
              <Link
                href={row.primaryHref}
                className={row.primaryVariant === 'primary' ? styles.mobilePrimaryAction : styles.mobilePurchaseAction}
              >
                {row.primaryLabel}
                <svg className={styles.mobilePrimaryArrow} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <div className={styles.mobileSecondaryActions}>
                <Link href={row.detailsHref} className={styles.secondaryAction}>Overview</Link>
                {row.showChat && row.chatHref && (
                  <Link href={row.chatHref} className={styles.secondaryAction}>View Chat</Link>
                )}
                {row.sessionId && row.attemptsRemaining !== null && (
                  <SessionVersionManager
                    sessionId={row.sessionId}
                    productSlug={row.slug}
                    attemptsRemaining={row.attemptsRemaining}
                    createNewVersionAction={createNewVersionAction}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop table layout */}
      <div className={`${styles.table} ${styles.desktopOnly}`}>
      <div className={styles.tableHeader}>
        <button
          type="button"
          className={styles.tableHeaderCell}
          onClick={() => handleSort('product')}
        >
          Product
          <SortIndicator active={sortState.key === 'product'} direction={sortState.direction} />
        </button>
        <button
          type="button"
          className={styles.tableHeaderCell}
          onClick={() => handleSort('rite')}
        >
          Rite
          <SortIndicator active={sortState.key === 'rite'} direction={sortState.direction} />
        </button>
        <button
          type="button"
          className={styles.tableHeaderCell}
          onClick={() => handleSort('order')}
        >
          Order
          <SortIndicator active={sortState.key === 'order'} direction={sortState.direction} />
        </button>
        <button
          type="button"
          className={styles.tableHeaderCell}
          onClick={() => handleSort('status')}
        >
          Status
          <SortIndicator active={sortState.key === 'status'} direction={sortState.direction} />
        </button>
        <button
          type="button"
          className={styles.tableHeaderCell}
          onClick={() => handleSort('progress')}
        >
          Progress
          <SortIndicator active={sortState.key === 'progress'} direction={sortState.direction} />
        </button>
        <button
          type="button"
          className={styles.tableHeaderCell}
          onClick={() => handleSort('lastActivity')}
        >
          Last Activity
          <SortIndicator active={sortState.key === 'lastActivity'} direction={sortState.direction} />
        </button>
        <span className={styles.tableHeaderCellStatic}>Next Action</span>
      </div>
      {sortedRows.map((row) => (
        <div key={row.slug} className={styles.tableRow}>
          <div className={styles.tableCell}>
            <div className={styles.productName}>{row.name}</div>
            <div className={styles.productSub}>
              {row.estimatedDuration} • {row.totalSteps} steps
            </div>
            <Link href={row.detailsHref} className={styles.secondaryAction}>
              Overview
            </Link>
          </div>
          <div className={styles.tableCell}>{row.riteLabel}</div>
          <div className={styles.tableCell}>{row.displayOrder}</div>
          <div className={styles.tableCell}>
            <span
              className={`${styles.statusPill} ${styles[row.statusClass]}`}
            >
              {row.statusLabel}
            </span>
          </div>
          <div className={styles.tableCell}>{row.progressLabel}</div>
          <div className={styles.tableCell}>{row.lastActivityLabel}</div>
          <div className={styles.tableCell}>
            <div className={styles.actionStack}>
              <Link
                href={row.primaryHref}
                className={row.primaryVariant === 'primary' ? styles.primaryAction : styles.purchaseAction}
              >
                {row.primaryLabel}
              </Link>
              <div className={styles.secondaryActions}>
                {row.showChat && row.chatHref && (
                  <Link href={row.chatHref} className={styles.secondaryAction}>
                    View Chat
                  </Link>
                )}
                {row.sessionId && row.attemptsRemaining !== null && (
                  <SessionVersionManager
                    sessionId={row.sessionId}
                    productSlug={row.slug}
                    attemptsRemaining={row.attemptsRemaining}
                    createNewVersionAction={createNewVersionAction}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
    </>
  );
}
