'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

const CORE_STATES = ['Being', 'Inner Peace', 'Love', 'OKness', 'Oneness'] as const;
const TIERS = [1, 2, 3] as const;

export interface TaoSituationListRow {
  id: string;
  domain_id: string;
  domain_name: string;
  name: string;
  tier: number;
  fate: string | null;
  core_state: string | null;
  being_name: string | null;
  variant_count: number | null;
  source_version: string | null;
  active: boolean;
}

interface DomainOption {
  id: string;
  name: string;
}

interface TaoSituationListProps {
  initialRows: TaoSituationListRow[];
  domains: DomainOption[];
}

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function TaoSituationList({ initialRows, domains }: TaoSituationListProps) {
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [coreStateFilter, setCoreStateFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [search, setSearch] = useState<string>('');

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialRows.filter((row) => {
      if (domainFilter && row.domain_id !== domainFilter) return false;
      if (tierFilter && row.tier !== Number(tierFilter)) return false;
      if (coreStateFilter && row.core_state !== coreStateFilter) return false;
      if (activeFilter === 'active' && !row.active) return false;
      if (activeFilter === 'inactive' && row.active) return false;
      if (q) {
        const hay = `${row.id} ${row.name} ${row.being_name ?? ''} ${row.domain_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialRows, domainFilter, tierFilter, coreStateFilter, activeFilter, search]);

  const resetFilters = () => {
    setDomainFilter('');
    setTierFilter('');
    setCoreStateFilter('');
    setActiveFilter('all');
    setSearch('');
  };

  const hasFilters =
    domainFilter !== '' ||
    tierFilter !== '' ||
    coreStateFilter !== '' ||
    activeFilter !== 'all' ||
    search !== '';

  return (
    <>
      {/* Filters */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 90px 1.4fr 1fr 1.4fr auto',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Domain</label>
            <select
              className={styles.formInput}
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
            >
              <option value="">All domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} · {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Tier</label>
            <select
              className={styles.formInput}
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="">All</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Core state</label>
            <select
              className={styles.formInput}
              value={coreStateFilter}
              onChange={(e) => setCoreStateFilter(e.target.value)}
            >
              <option value="">All</option>
              {CORE_STATES.map((cs) => (
                <option key={cs} value={cs}>
                  {cs}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Active</label>
            <select
              className={styles.formInput}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Search</label>
            <input
              type="text"
              className={styles.formInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="id, name, being…"
            />
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
            Situations
            <span
              style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)', fontWeight: 400 }}
            >
              {filteredRows.length} of {initialRows.length}
            </span>
          </h2>
        </div>

        {filteredRows.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>
              {initialRows.length === 0
                ? 'No situations ingested yet'
                : 'No situations match the current filters'}
            </div>
            <div className={styles.emptyDescription}>
              {initialRows.length === 0 ? (
                <>
                  Run{' '}
                  <code style={{ fontFamily: 'monospace' }}>
                    npx tsx scripts/tao-ingest/sync-from-studio.ts &lt;path&gt;
                  </code>{' '}
                  to ingest the studio corpus.
                </>
              ) : (
                'Try clearing the filters or expanding your selection.'
              )}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Name</th>
                  <th>Domain</th>
                  <th style={{ width: 50, textAlign: 'center' }}>Tier</th>
                  <th>Core state</th>
                  <th>Fate</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Variants</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Active</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.id}</td>
                    <td style={{ fontSize: '0.8125rem' }}>
                      {row.name}
                      {row.being_name && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: '0.125rem' }}>
                          {row.being_name}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--admin-text-muted)' }}>
                        {row.domain_id}
                      </span>{' '}
                      {row.domain_name}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontSize: '0.65rem' }}>
                        {row.tier}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{row.core_state ?? '—'}</td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {row.fate ? (
                        <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontSize: '0.65rem' }}>
                          {row.fate}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                      {row.variant_count ?? 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.active ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ fontSize: '0.65rem' }}>
                          on
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeDanger}`} style={{ fontSize: '0.65rem' }}>
                          off
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/tao-situations/${encodeURIComponent(row.id)}`}
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                      >
                        Edit
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
