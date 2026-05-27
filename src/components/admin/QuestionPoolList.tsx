'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

const AUDIENCE_TRACKS = ['operator', 'side_builder', 'inside_player', 'almost_builder', 'seeker', 'all'] as const;

export interface QuestionPoolListRow {
  id: string;
  product_slug: string;
  step_index: number;
  domain: string;
  rite: string;
  question_role: string;
  experience_level: number;
  audience_tracks: string[];
  prompt_text: string;
  active: boolean;
}

interface QuestionPoolListProps {
  initialRows: QuestionPoolListRow[];
  productSlugs: string[];
}

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function QuestionPoolList({ initialRows, productSlugs }: QuestionPoolListProps) {
  const [productFilter, setProductFilter] = useState<string>('');
  const [stepFilter, setStepFilter] = useState<string>('');
  const [tracksFilter, setTracksFilter] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const toggleTrackFilter = (track: string) => {
    setTracksFilter((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track]
    );
  };

  const filteredRows = useMemo(() => {
    return initialRows.filter((row) => {
      if (productFilter && row.product_slug !== productFilter) return false;
      if (stepFilter && row.step_index !== Number(stepFilter)) return false;
      if (tracksFilter.length > 0) {
        const has = tracksFilter.some((t) => row.audience_tracks.includes(t));
        if (!has) return false;
      }
      if (activeFilter === 'active' && !row.active) return false;
      if (activeFilter === 'inactive' && row.active) return false;
      return true;
    });
  }, [initialRows, productFilter, stepFilter, tracksFilter, activeFilter]);

  const resetFilters = () => {
    setProductFilter('');
    setStepFilter('');
    setTracksFilter([]);
    setActiveFilter('all');
  };

  const hasFilters =
    productFilter !== '' ||
    stepFilter !== '' ||
    tracksFilter.length > 0 ||
    activeFilter !== 'all';

  return (
    <>
      {/* Filters */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 1fr 1fr auto',
            gap: '1rem',
            alignItems: 'end',
          }}
        >
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
            <label className={styles.formLabel}>Step</label>
            <input
              type="number"
              min={1}
              className={styles.formInput}
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              placeholder="Any"
            />
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Audience tracks</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {AUDIENCE_TRACKS.map((track) => {
                const checked = tracksFilter.includes(track);
                return (
                  <button
                    key={track}
                    type="button"
                    onClick={() => toggleTrackFilter(track)}
                    className={`${styles.badge} ${checked ? styles.badgeSuccess : styles.badgeNeutral}`}
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      fontFamily: 'monospace',
                      fontSize: '0.65rem',
                    }}
                  >
                    {track}
                  </button>
                );
              })}
            </div>
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
            Questions
            <span
              style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)', fontWeight: 400 }}
            >
              {filteredRows.length} of {initialRows.length}
            </span>
          </h2>
        </div>

        {filteredRows.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No questions match the current filters</div>
            <div className={styles.emptyDescription}>
              {initialRows.length === 0
                ? 'Create your first pool entry to get started.'
                : 'Try clearing the filters or expanding your selection.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Product</th>
                  <th style={{ width: 60, textAlign: 'center' }}>Step</th>
                  <th>Domain</th>
                  <th>Role</th>
                  <th>Audience</th>
                  <th>Prompt preview</th>
                  <th style={{ width: 70, textAlign: 'center' }}>Active</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const preview =
                    row.prompt_text.length > 80
                      ? row.prompt_text.slice(0, 80) + '…'
                      : row.prompt_text;
                  return (
                    <tr key={row.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.id}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {row.product_slug}
                      </td>
                      <td style={{ textAlign: 'center' }}>{row.step_index}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.domain}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontSize: '0.65rem' }}>
                          {row.question_role}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        {row.audience_tracks.join(', ')}
                      </td>
                      <td style={{ fontSize: '0.8125rem', maxWidth: 320 }}>{preview}</td>
                      <td style={{ textAlign: 'center' }}>
                        {row.active ? (
                          <span
                            className={`${styles.badge} ${styles.badgeSuccess}`}
                            style={{ fontSize: '0.65rem' }}
                          >
                            on
                          </span>
                        ) : (
                          <span
                            className={`${styles.badge} ${styles.badgeDanger}`}
                            style={{ fontSize: '0.65rem' }}
                          >
                            off
                          </span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/admin/question-pool/${encodeURIComponent(row.id)}`}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                        >
                          Edit
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
    </>
  );
}
