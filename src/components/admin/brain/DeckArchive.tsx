'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { collectTags, groupByMonth } from '@/lib/brain/archive';
import {
  READ_STATUS_LABEL,
  deckReadStatus,
  filterByReadStatus,
  readCounts,
  sortUnreadFirst,
  type DeckNoteStats,
  type DeckReadFilter,
  type DeckReadState,
  type DeckReadStatus,
} from '@/lib/brain/deck-reads';
import type { DeckIndexEntry, DeckStatus } from '@/lib/brain/snapshot';
import { formatDate } from '@/lib/brain/viz';
import { SyncHint } from './SyncHint';
import base from './brain.module.css';
import styles from './archive.module.css';

const STATUS_LABEL: Record<DeckStatus, string> = { current: 'Current', superseded: 'Superseded', archived: 'Archived' };

const FILTERS: { key: DeckReadFilter; label: string }[] = [
  { key: 'unread', label: 'Unread' },
  { key: 'updated', label: 'Updated' },
  { key: 'read', label: 'Read' },
  { key: 'all', label: 'All' },
];

const SECTION_LABEL: Record<DeckReadStatus, string> = { unread: 'Unread', updated: 'Updated since you read them', read: 'Read' };

type Row = Omit<DeckIndexEntry, 'status'> & { status: DeckReadStatus; deckStatus: DeckStatus; read?: DeckReadState; notes?: DeckNoteStats };

interface DeckArchiveProps {
  decks: DeckIndexEntry[];
  /** The signed-in admin's read receipts, keyed by deck id. */
  reads?: Record<string, DeckReadState>;
  /** Open and waiting-for-sync note counts, keyed by deck id. */
  noteStats?: Record<string, DeckNoteStats>;
}

export function DeckArchive({ decks, reads = {}, noteStats = {} }: DeckArchiveProps) {
  const [tag, setTag] = useState<string | null>(null);
  const [filter, setFilter] = useState<DeckReadFilter>('all');
  const tags = useMemo(() => collectTags(decks), [decks]);

  const rows = useMemo<Row[]>(
    () =>
      decks.map((d) => ({
        ...d,
        deckStatus: d.status,
        status: deckReadStatus(reads[d.id], d.contentHash),
        read: reads[d.id],
        notes: noteStats[d.id],
      })),
    [decks, reads, noteStats],
  );
  const tagged = useMemo(() => (tag ? rows.filter((d) => d.tags.includes(tag)) : rows), [rows, tag]);
  const counts = useMemo(() => readCounts(tagged), [tagged]);
  const totals = useMemo(() => readCounts(rows), [rows]);
  const visible = useMemo(() => sortUnreadFirst(filterByReadStatus(tagged, filter)), [tagged, filter]);
  const unsynced = useMemo(() => Object.values(noteStats).reduce((n, s) => n + s.unsynced, 0), [noteStats]);

  // "All" groups by read status (unread first); a single-status filter groups by month.
  const groups = useMemo(() => {
    if (filter !== 'all') return groupByMonth(visible).map((g) => ({ key: g.key, label: g.label, items: g.items }));
    return (['unread', 'updated', 'read'] as const)
      .map((s) => ({ key: s, label: SECTION_LABEL[s], items: visible.filter((d) => d.status === s) }))
      .filter((g) => g.items.length > 0);
  }, [visible, filter]);

  if (!decks.length) {
    return <p className={`${base.small} ${base.muted}`}>No decks have been published yet.</p>;
  }

  return (
    <>
      <div className={styles.readSummary}>
        <span className={styles.readSummaryCount} aria-label={`${totals.read} of ${totals.all} decks read`}>
          <strong>{totals.read}</strong> of {totals.all} read
        </span>
        <span className={styles.readTrack} aria-hidden="true">
          <span className={styles.readTrackFill} style={{ width: `${totals.all ? (totals.read / totals.all) * 100 : 0}%` }} />
        </span>
        {totals.updated > 0 && <span className={styles.readSummaryNote}>{totals.updated} updated since you read them</span>}
      </div>

      <div className={base.filterRow}>
        <span className={base.filterLabel}>Show</span>
        <div className={styles.tagRow} role="group" aria-label="Filter by read status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${base.segment} ${filter === f.key ? base.segmentActive : ''}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className={base.count}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div className={base.filterRow}>
          <span className={base.filterLabel}>Tag</span>
          <div className={styles.tagRow} role="group" aria-label="Filter by tag">
            <button type="button" className={`${base.segment} ${tag === null ? base.segmentActive : ''}`} aria-pressed={tag === null} onClick={() => setTag(null)}>
              All <span className={base.count}>{decks.length}</span>
            </button>
            {tags.map((t) => (
              <button key={t} type="button" className={`${base.segment} ${tag === t ? base.segmentActive : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {unsynced > 0 && <SyncHint waiting={unsynced} />}

      {groups.map((group) => (
        <section key={group.key} className={base.section} aria-labelledby={`decks-${group.key}`}>
          <div className={base.sectionHead}>
            <h2 id={`decks-${group.key}`} className={base.sectionTitle}>
              {group.label}
            </h2>
            <span className={base.count}>
              {group.items.length} deck{group.items.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className={styles.list}>
            {group.items.map((d) => (
              <DeckItem key={d.id} deck={d} onTag={setTag} />
            ))}
          </ul>
        </section>
      ))}
      {visible.length === 0 && (
        <p className={`${base.small} ${base.muted}`}>
          {filter === 'unread' ? 'Nothing unread. You are caught up.' : filter === 'updated' ? 'No deck has changed since you read it.' : 'No decks match.'}
        </p>
      )}
    </>
  );
}

function DeckItem({ deck: d, onTag }: { deck: Row; onTag: (t: string) => void }) {
  const presentHref = `/admin/brain/deck/${encodeURIComponent(d.id)}?from=decks`;
  const inProgress = d.status !== 'read' && (d.read?.last_slide ?? 0) > 0;
  const openNotes = d.notes?.open ?? 0;
  return (
    <li className={`${styles.item} ${d.deckStatus !== 'current' || d.status === 'read' ? styles.itemDim : ''}`} data-read-status={d.status}>
      <div className={styles.itemMain}>
        <div className={styles.itemMeta}>
          <span className={`${styles.readBadge} ${styles[`read_${d.status}`]}`} title={d.read?.read_at ? `Read ${formatDate(d.read.read_at)}` : undefined}>
            {d.status === 'read' ? '✓ Read' : READ_STATUS_LABEL[d.status]}
          </span>
          <time dateTime={d.createdAt}>{formatDate(d.createdAt)}</time>
          <span className={`${styles.status} ${styles[`status_${d.deckStatus}`]}`}>{STATUS_LABEL[d.deckStatus]}</span>
          <span>
            {d.slideCount} slide{d.slideCount === 1 ? '' : 's'}
          </span>
          <span>{d.period}</span>
          {openNotes > 0 && (
            <span className={styles.noteCount}>
              {openNotes} open note{openNotes === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <h3 className={styles.title}>
          {d.externalUrl ? (
            <a href={d.externalUrl} target="_blank" rel="noreferrer noopener">
              {d.title} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <Link href={presentHref}>{d.title}</Link>
          )}
        </h3>
        <p className={styles.summary}>{d.summary}</p>
        <div className={styles.itemFoot}>
          {inProgress && (
            <span className={styles.progressNote}>
              Stopped at slide {Math.min(d.slideCount, (d.read?.last_slide ?? 0) + 1)} of {d.slideCount}
            </span>
          )}
          {d.source && (
            <span className={styles.source} title="Source report in the brain">
              brain/{d.source}
            </span>
          )}
          {d.tags.map((t) => (
            <button key={t} type="button" className={`${base.chip} ${styles.tagChip}`} onClick={() => onTag(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.actions}>
        <Link href={presentHref} className={`${base.button} ${styles.smallButton}`}>
          {d.status === 'read' ? 'Present' : inProgress ? 'Resume' : 'Read'}
        </Link>
        {d.externalUrl && (
          <a href={d.externalUrl} target="_blank" rel="noreferrer noopener" className={`${base.button} ${base.buttonGhost} ${styles.smallButton}`}>
            Open original ↗
          </a>
        )}
      </div>
    </li>
  );
}
