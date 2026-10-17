'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { collectTags, groupByMonth } from '@/lib/brain/archive';
import type { DeckIndexEntry, DeckStatus } from '@/lib/brain/snapshot';
import { formatDate } from '@/lib/brain/viz';
import base from './brain.module.css';
import styles from './archive.module.css';

const STATUS_LABEL: Record<DeckStatus, string> = { current: 'Current', superseded: 'Superseded', archived: 'Archived' };

export function DeckArchive({ decks }: { decks: DeckIndexEntry[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => collectTags(decks), [decks]);
  const visible = useMemo(() => (tag ? decks.filter((d) => d.tags.includes(tag)) : decks), [decks, tag]);
  const groups = useMemo(() => groupByMonth(visible), [visible]);

  if (!decks.length) {
    return <p className={`${base.small} ${base.muted}`}>No decks have been published yet.</p>;
  }

  return (
    <>
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

      {groups.map((group) => (
        <section key={group.key} className={base.section} aria-labelledby={`month-${group.key}`}>
          <div className={base.sectionHead}>
            <h2 id={`month-${group.key}`} className={base.sectionTitle}>
              {group.label}
            </h2>
            <span className={base.count}>
              {group.items.length} deck{group.items.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className={styles.list}>
            {group.items.map((d) => {
              const presentHref = `/admin/brain/deck/${encodeURIComponent(d.id)}?from=decks`;
              return (
                <li key={d.id} className={`${styles.item} ${d.status !== 'current' ? styles.itemDim : ''}`}>
                  <div className={styles.itemMain}>
                    <div className={styles.itemMeta}>
                      <time dateTime={d.createdAt}>{formatDate(d.createdAt)}</time>
                      <span className={`${styles.status} ${styles[`status_${d.status}`]}`}>{STATUS_LABEL[d.status]}</span>
                      <span>
                        {d.slideCount} slide{d.slideCount === 1 ? '' : 's'}
                      </span>
                      <span>{d.period}</span>
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
                      {d.source && (
                        <span className={styles.source} title="Source report in the brain">
                          brain/{d.source}
                        </span>
                      )}
                      {d.tags.map((t) => (
                        <button key={t} type="button" className={`${base.chip} ${styles.tagChip}`} onClick={() => setTag(t)}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <Link href={presentHref} className={`${base.button} ${styles.smallButton}`}>
                      Present
                    </Link>
                    {d.externalUrl && (
                      <a href={d.externalUrl} target="_blank" rel="noreferrer noopener" className={`${base.button} ${base.buttonGhost} ${styles.smallButton}`}>
                        Open original ↗
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {visible.length === 0 && <p className={`${base.small} ${base.muted}`}>No decks with that tag.</p>}
    </>
  );
}
