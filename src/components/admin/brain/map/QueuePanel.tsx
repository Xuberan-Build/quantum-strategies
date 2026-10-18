'use client';

/** The "Make next" list: top topics by priority, each with a one-line reason. */
import { whyNow, type QueuePayload } from '@/lib/brain/topical-map-view';
import { StatusChip } from './TopicPanel';
import styles from './map.module.css';

interface Props {
  queue: QueuePayload | null;
  error: string | null;
  labelFor: (pillarCode: string) => string;
  onPick: (id: string) => void;
}

export function QueuePanel({ queue, error, labelFor, onPick }: Props) {
  return (
    <aside className={styles.panel} aria-label="Make next">
      <header className={styles.panelHead}>
        <h2 className={styles.queueTitle}>Make next</h2>
        {queue?.fixture && <span className={styles.fixtureChip}>fixture</span>}
      </header>
      <p className={styles.hint}>
        The topics to make first, highest priority at the top. Topics with a LIVE asset drop out. Click one for its scorecard.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!queue && !error && <p className={styles.hint}>Loading the queue…</p>}
      {queue && queue.items.length === 0 && <p className={styles.hint}>The queue is empty.</p>}
      {queue && queue.items.length > 0 && (
        <ol className={styles.queue}>
          {queue.items.map((q, i) => (
            <li key={q.id}>
              <button type="button" className={styles.queueRow} onClick={() => onPick(q.id)}>
                <span className={styles.queueRank}>{i + 1}</span>
                <span className={styles.queueBody}>
                  <span className={styles.queueHead}>
                    <span className={styles.queueLabel}>{q.label}</span>
                    <span className={styles.queuePriority} title="Priority, 0 to 100">
                      {Math.round(q.priority)}
                    </span>
                  </span>
                  <span className={styles.queueMeta}>
                    <StatusChip status={q.status} />
                    <span>{labelFor(q.pillarCode)}</span>
                  </span>
                  <span className={styles.queueWhy}>{whyNow(q)}</span>
                  {q.topQueries.length > 0 && (
                    <span className={styles.queueQueries}>
                      {q.topQueries
                        .slice(0, 2)
                        .map((t) => `“${t}”`)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
