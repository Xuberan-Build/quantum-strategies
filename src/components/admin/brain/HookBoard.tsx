'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { BrainSnapshot, PillarSlug, Rite } from '@/lib/brain/snapshot';
import { PILLAR_COLOR, PILLAR_ORDER, RITE_COLOR, RITE_NUMERAL, RITE_ORDER, riteTitle } from '@/lib/brain/viz';
import { TagChips } from './primitives';
import styles from './brain.module.css';
import h from './hooks.module.css';

type Hook = BrainSnapshot['hooks'][number];
type Status = Hook['status'];

const STATUSES: { key: Status; label: string }[] = [
  { key: 'validated', label: 'Validated' },
  { key: 'idea', label: 'Idea' },
  { key: 'used', label: 'Used' },
];

const FLAG = /contradict|retire|flagged|avoid/i;

export function StatusBadge({ status }: { status: Status }) {
  const label = STATUSES.find((s) => s.key === status)?.label ?? status;
  return (
    <span className={`${h.status} ${h[`status_${status}`] ?? ''}`}>
      <StatusIcon status={status} />
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'validated')
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === 'used')
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="12" r="6" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

export function HookBoard({ hooks, titles }: { hooks: Hook[]; titles: Record<PillarSlug, string> }) {
  const [groupBy, setGroupBy] = useState<'pillar' | 'rite'>('pillar');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [query, setQuery] = useState('');
  const reduce = useReducedMotion();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hooks.filter(
      (hk) => (status === 'all' || hk.status === status) && (!q || hk.text.toLowerCase().includes(q) || (hk.evidence ?? '').toLowerCase().includes(q)),
    );
  }, [hooks, status, query]);

  const groups: { key: string; title: string; color?: string; numeral?: string; items: Hook[] }[] =
    groupBy === 'pillar'
      ? [
          ...PILLAR_ORDER.map((p) => ({ key: p, title: titles[p], color: PILLAR_COLOR[p], items: filtered.filter((hk) => hk.tags.pillar === p) })),
          { key: 'none', title: 'No pillar', items: filtered.filter((hk) => !hk.tags.pillar) },
        ]
      : [
          ...RITE_ORDER.map((r: Rite) => ({ key: r, title: riteTitle(r), color: RITE_COLOR[r], numeral: RITE_NUMERAL[r], items: filtered.filter((hk) => hk.tags.rite === r) })),
          { key: 'none', title: 'No Rite', items: filtered.filter((hk) => !hk.tags.rite) },
        ];

  const pillarTitle = (slug: PillarSlug) => titles[slug];

  return (
    <div>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Group by</span>
        <div className={styles.segmented} role="group" aria-label="Group hooks by">
          {(['pillar', 'rite'] as const).map((g) => (
            <button key={g} type="button" className={`${styles.segment} ${groupBy === g ? styles.segmentActive : ''}`} aria-pressed={groupBy === g} onClick={() => setGroupBy(g)}>
              {g === 'pillar' ? 'Pillar' : 'Rite'}
            </button>
          ))}
        </div>
        <span className={styles.filterLabel}>Status</span>
        <div className={styles.segmented} role="group" aria-label="Filter by status">
          <button type="button" className={`${styles.segment} ${status === 'all' ? styles.segmentActive : ''}`} aria-pressed={status === 'all'} onClick={() => setStatus('all')}>
            All <span className={styles.count}>{hooks.length}</span>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.segment} ${status === s.key ? styles.segmentActive : ''}`}
              aria-pressed={status === s.key}
              onClick={() => setStatus(status === s.key ? 'all' : s.key)}
            >
              <StatusIcon status={s.key} />
              {s.label} <span className={styles.count}>{hooks.filter((hk) => hk.status === s.key).length}</span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className={styles.search}
          placeholder="Search hooks and evidence"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search hooks"
        />
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {filtered.length} hooks shown
      </p>

      <div className={h.board}>
        {groups
          .filter((g) => g.key !== 'none' || g.items.length > 0)
          .map((g) => (
            <section key={g.key} className={h.column} aria-labelledby={`hooks-${g.key}`}>
              <header className={h.columnHead}>
                {g.numeral ? (
                  <span className={h.numeral} style={{ color: g.color }} aria-hidden="true">
                    {g.numeral}
                  </span>
                ) : g.color ? (
                  <span className={styles.chipDot} style={{ background: g.color }} aria-hidden="true" />
                ) : null}
                <h2 id={`hooks-${g.key}`} className={h.columnTitle}>
                  {g.title}
                </h2>
                <span className={styles.count}>{g.items.length}</span>
              </header>
              <div className={h.stack}>
                <AnimatePresence initial={false}>
                  {g.items.map((hk) => {
                    const flagged = FLAG.test(hk.evidence ?? '');
                    return (
                      <motion.article
                        key={hk.text}
                        layout={!reduce}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`${h.card} ${flagged ? h.cardFlagged : ''}`}
                      >
                        <div className={h.cardTop}>
                          <StatusBadge status={hk.status} />
                          {flagged && <span className={h.flag}>⚠ Flagged</span>}
                        </div>
                        <p className={h.hookText}>{hk.text}</p>
                        {hk.evidence && (
                          <p className={h.evidence}>
                            <span className={styles.filterLabel}>Evidence</span> {hk.evidence}
                          </p>
                        )}
                        <TagChips tags={groupBy === 'pillar' ? { rite: hk.tags.rite, domain: hk.tags.domain } : { pillar: hk.tags.pillar, domain: hk.tags.domain }} pillarTitle={pillarTitle} />
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
                {g.items.length === 0 && <p className={`${styles.small} ${styles.muted}`}>No hooks here yet.</p>}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
