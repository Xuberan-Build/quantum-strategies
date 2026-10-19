'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { READ_STATUS_LABEL, type DeckReadState, type DeckReadStatus } from '@/lib/brain/deck-reads';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import type { BrainDeck } from '@/lib/brain/snapshot';
import { formatDate } from '@/lib/brain/viz';
import { FeedbackComposer, FeedbackThread } from './Feedback';
import { SyncHint } from './SyncHint';
import base from './brain.module.css';
import styles from './review.module.css';

export interface ReviewReading {
  enabled: boolean;
  status: DeckReadStatus;
  state: DeckReadState | null;
  busy: boolean;
  error: string | null;
  /** Load error (e.g. brain_deck_reads missing). */
  unavailable?: string;
  onToggle: () => void;
}

interface ReviewSidebarProps {
  deck: BrainDeck;
  index: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  notes: BrainFeedbackRow[];
  notesError?: string;
  onNoteSaved: (row: BrainFeedbackRow) => void;
  onNoteUpdated: (row: BrainFeedbackRow) => void;
  onNoteDeleted: (id: string) => void;
  onJump: (index: number) => void;
  reading?: ReviewReading;
  nextUnread?: { href: string; title: string } | null;
  decksHref?: string;
  resumedAt?: number | null;
  onStartOver?: () => void;
}

function ChevronIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" style={{ transform: flipped ? 'rotate(180deg)' : undefined }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ReviewSidebar({
  deck,
  index,
  collapsed,
  onCollapsedChange,
  notes,
  notesError,
  onNoteSaved,
  onNoteUpdated,
  onNoteDeleted,
  onJump,
  reading,
  nextUnread,
  decksHref = '/admin/brain/decks',
  resumedAt,
  onStartOver,
}: ReviewSidebarProps) {
  const [view, setView] = useState<'slide' | 'all'>('slide');
  const [target, setTarget] = useState<'slide' | 'deck'>('slide');
  const slide = deck.slides[index];

  const slideIndexById = useMemo(() => new Map(deck.slides.map((s, i) => [s.id, i])), [deck.slides]);
  const slideNotes = useMemo(() => notes.filter((n) => n.slide_id === slide.id), [notes, slide.id]);
  const allNotes = useMemo(
    () =>
      [...notes].sort(
        (a, b) =>
          (a.slide_id ? slideIndexById.get(a.slide_id) ?? 9999 : -1) - (b.slide_id ? slideIndexById.get(b.slide_id) ?? 9999 : -1) ||
          a.created_at.localeCompare(b.created_at),
      ),
    [notes, slideIndexById],
  );
  const waiting = notes.filter((n) => !n.synced_to_brain_at).length;
  const status = reading?.status ?? 'unread';

  if (collapsed) {
    return (
      <aside id="brain-review-sidebar" className={`${styles.review} ${styles.reviewCollapsed}`} aria-label="Review">
        <button type="button" className={styles.railButton} onClick={() => onCollapsedChange(false)} aria-label="Expand review sidebar" aria-expanded={false} title="Expand review ( R )">
          <ChevronIcon flipped />
        </button>
        {reading?.enabled && <span className={`${styles.railDot} ${styles[`dot_${status}`]}`} title={READ_STATUS_LABEL[status]} aria-label={READ_STATUS_LABEL[status]} role="img" />}
        <span className={styles.railLabel} aria-hidden="true">
          Review
        </span>
        {notes.length > 0 && (
          <span className={styles.railCount} title={`${notes.length} note${notes.length === 1 ? '' : 's'} on this deck`}>
            {notes.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside id="brain-review-sidebar" className={styles.review} aria-label="Review">
      <div className={styles.head}>
        <div className={styles.headText}>
          <div className={styles.eyebrow}>
            Slide {index + 1} of {deck.slides.length}
          </div>
          <div className={styles.title}>Review</div>
        </div>
        <button type="button" className={styles.collapseButton} onClick={() => onCollapsedChange(true)} aria-label="Collapse review sidebar" aria-expanded title="Collapse review ( R )">
          <ChevronIcon />
        </button>
      </div>

      <div className={styles.body}>
        {reading?.enabled && (
          <section className={`${styles.readCard} ${styles[`readCard_${status}`]}`} aria-label="Read status">
            <div className={styles.readLine}>
              <span className={`${styles.readChip} ${styles[`chip_${status}`]}`}>{status === 'read' ? '✓ Read' : READ_STATUS_LABEL[status]}</span>
              {reading.state?.read_at && <span className={styles.readWhen}>{status === 'updated' ? `You read it ${formatDate(reading.state.read_at)}` : formatDate(reading.state.read_at)}</span>}
            </div>
            <p className={styles.readText}>
              {status === 'read'
                ? 'Marked read. It comes back as updated if the deck changes.'
                : status === 'updated'
                  ? 'The deck changed after you read it. Mark it read again once you have been through it.'
                  : 'Reaching the last slide marks it read.'}
            </p>
            <div className={styles.readActions}>
              <button type="button" className={styles.readButton} onClick={reading.onToggle} disabled={reading.busy} aria-pressed={status === 'read'}>
                {status === 'read' ? 'Mark unread' : 'Mark read'} <span className={styles.kbd}>U</span>
              </button>
            </div>
            {resumedAt != null && resumedAt > 0 && (
              <p className={styles.resumed}>
                Resumed at slide {resumedAt + 1}.{' '}
                {onStartOver && (
                  <button type="button" className={styles.linkButton} onClick={onStartOver}>
                    Start from the beginning
                  </button>
                )}
              </p>
            )}
            {reading.error && (
              <p className={styles.error} role="alert">
                {reading.error}
              </p>
            )}
            {reading.unavailable && <p className={styles.muted}>Read status is not being saved ({reading.unavailable}).</p>}
          </section>
        )}

        <div className={base.segmented} role="tablist" aria-label="Notes to show">
          <button type="button" role="tab" aria-selected={view === 'slide'} className={`${base.segment} ${view === 'slide' ? base.segmentActive : ''}`} onClick={() => setView('slide')}>
            This slide{slideNotes.length ? ` · ${slideNotes.length}` : ''}
          </button>
          <button type="button" role="tab" aria-selected={view === 'all'} className={`${base.segment} ${view === 'all' ? base.segmentActive : ''}`} onClick={() => setView('all')}>
            All of deck{notes.length ? ` · ${notes.length}` : ''}
          </button>
        </div>

        {notesError && <p className={styles.error}>Notes could not be loaded ({notesError}).</p>}

        <div className={styles.composeBlock}>
          <div className={styles.targetRow} role="radiogroup" aria-label="Note on">
            <span className={styles.targetLabel}>Note on</span>
            <button type="button" role="radio" aria-checked={target === 'slide'} className={`${styles.target} ${target === 'slide' ? styles.targetActive : ''}`} onClick={() => setTarget('slide')}>
              Slide {index + 1}
            </button>
            <button type="button" role="radio" aria-checked={target === 'deck'} className={`${styles.target} ${target === 'deck' ? styles.targetActive : ''}`} onClick={() => setTarget('deck')}>
              Whole deck
            </button>
          </div>
          <FeedbackComposer
            key={target === 'slide' ? `slide-${slide.id}` : 'deck'}
            context={target === 'slide' ? `Slide ${index + 1} · ${slide.title}` : `Whole deck · ${deck.title}`}
            target={target === 'slide' ? { target_type: 'slide', target_id: deck.id, slide_id: slide.id } : { target_type: 'deck', target_id: deck.id }}
            onSaved={onNoteSaved}
          />
        </div>

        {view === 'slide' ? (
          <FeedbackThread rows={slideNotes} emptyText="No notes on this slide yet." showSync onUpdated={onNoteUpdated} onDeleted={onNoteDeleted} />
        ) : (
          <FeedbackThread
            rows={allNotes}
            emptyText="No notes on this deck yet."
            showSync
            onUpdated={onNoteUpdated}
            onDeleted={onNoteDeleted}
            noteContext={(row) => {
              if (!row.slide_id) return 'Whole deck';
              const i = slideIndexById.get(row.slide_id);
              if (i === undefined) return `Slide ${row.slide_id} (removed)`;
              return (
                <button type="button" onClick={() => onJump(i)} aria-label={`Go to slide ${i + 1}`}>
                  Slide {i + 1} · {deck.slides[i].title}
                </button>
              );
            }}
          />
        )}

        <SyncHint waiting={waiting} compact />

        <div className={styles.upNext}>
          {nextUnread ? (
            <Link href={nextUnread.href} className={styles.nextLink}>
              <span className={styles.nextEyebrow}>
                Next unread deck <span className={styles.kbd}>N</span>
              </span>
              <span className={styles.nextTitle}>{nextUnread.title} →</span>
            </Link>
          ) : reading?.enabled ? (
            <p className={styles.muted}>
              No other unread decks. <Link href={decksHref}>Back to the archive</Link>
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
