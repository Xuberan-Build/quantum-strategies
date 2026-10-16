'use client';

import { useId, useState, type ReactNode } from 'react';
import styles from './brain.module.css';

interface ChartFrameProps {
  title: string;
  caption?: ReactNode;
  /** The chart view. */
  children: ReactNode;
  /** The accessible table twin of the chart. */
  table: ReactNode;
  className?: string;
}

/** Figure container with a chart / table toggle (the table is the WCAG-clean twin). */
export function ChartFrame({ title, caption, children, table, className }: ChartFrameProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const titleId = useId();
  return (
    <figure className={`${styles.figure} ${className ?? ''}`} aria-labelledby={titleId}>
      <div className={styles.figureHead}>
        <div>
          <div id={titleId} className={styles.figureTitle}>
            {title}
          </div>
          {caption && <div className={styles.figureCaption}>{caption}</div>}
        </div>
        <div className={`${styles.segmented} ${styles.viewToggle}`} role="group" aria-label={`${title} view`}>
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`${styles.segment} ${view === v ? styles.segmentActive : ''}`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === 'chart' ? 'Chart' : 'Table'}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? children : <div className={styles.tableWrap}>{table}</div>}
    </figure>
  );
}
