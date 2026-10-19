'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nextUnreadDeck, type DeckReadStatus } from '@/lib/brain/deck-reads';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import type { BrainDeck, PillarSlug } from '@/lib/brain/snapshot';
import { brainSourceUrl, formatDate } from '@/lib/brain/viz';
import { ReviewSidebar } from './ReviewSidebar';
import { SLIDE_KIND_LABEL, SlideRenderer } from './SlideRenderer';
import { keyToAction } from './deckNavigation';
import { useDeckNavigation } from './useDeckNavigation';
import { useDeckReading, type DeckReadingProps } from './useDeckReading';
import base from './brain.module.css';
import styles from './deck.module.css';

interface DeckPresenterProps {
  deck: BrainDeck;
  pillarTitles: Record<PillarSlug, string>;
  /** brain-relative path → ISO date, from snapshot.sources. */
  sourceDates?: Record<string, string>;
  brainCommit?: string;
  initialIndex?: number;
  backHref?: string;
  /** Where the deck also lives (e.g. a claude.ai artifact). */
  externalUrl?: string;
  /** Existing notes for this deck. When omitted (and `reading` too), the review sidebar is hidden. */
  feedback?: { rows: BrainFeedbackRow[]; error?: string };
  /** Read receipt for the signed-in admin. When omitted, read tracking is off. */
  reading?: DeckReadingProps & {
    /** Every deck in archive order with its read status, for "Next unread deck". */
    queue?: { id: string; title: string; status: DeckReadStatus }[];
    /** Set when the presenter opened on the saved last slide instead of slide 1. */
    resumedAt?: number | null;
  };
}

const REVIEW_STORAGE_KEY = 'qs-brain-review';

const isExternal = (p: string) => /^https?:\/\//i.test(p);

export function DeckPresenter({
  deck,
  pillarTitles,
  sourceDates = {},
  brainCommit,
  initialIndex = 0,
  backHref = '/admin/brain',
  externalUrl,
  feedback,
  reading,
}: DeckPresenterProps) {
  const total = deck.slides.length;
  const nav = useDeckNavigation({ count: total, initialIndex });
  const router = useRouter();
  const read = useDeckReading(deck.id, reading);
  const hasReview = Boolean(feedback || reading);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [resumedAt, setResumedAt] = useState<number | null>(reading?.resumedAt ?? null);
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sourcesButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notes, setNotes] = useState<BrainFeedbackRow[]>(feedback?.rows ?? []);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slide = deck.slides[nav.index];
  const notesBySlide = useMemo(() => {
    const map = new Map<string, BrainFeedbackRow[]>();
    for (const n of notes) {
      const key = n.slide_id ?? '';
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return map;
  }, [notes]);
  const slideNotes = notesBySlide.get(slide.id) ?? [];

  const queue = reading?.queue;
  const nextUnread = useMemo(() => {
    const next = queue ? nextUnreadDeck(queue, deck.id) : null;
    return next ? { href: `/admin/brain/deck/${encodeURIComponent(next.id)}?from=decks`, title: next.title } : null;
  }, [queue, deck.id]);

  const toggleRead = useCallback(() => {
    if (!read.enabled || read.busy) return;
    void read.setRead(read.status !== 'read');
  }, [read]);

  // Review sidebar open/collapsed, remembered per browser (like the admin sidebar).
  useEffect(() => {
    try {
      // Read after mount (not in the initial state) so server and client render the same markup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReviewCollapsed(window.localStorage.getItem(REVIEW_STORAGE_KEY) === 'collapsed');
    } catch {
      /* storage unavailable: stay expanded */
    }
  }, []);
  const setCollapsed = useCallback((collapsed: boolean) => {
    setReviewCollapsed(collapsed);
    try {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* ignore */
    }
  }, []);

  // Reaching the last slide marks the deck read (on arrival only, so "Mark unread" there sticks).
  // Every slide change is saved, debounced, so the deck can resume where the reader stopped.
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  }, [read]);
  const firstIndex = useRef(true);
  useEffect(() => {
    const r = readRef.current;
    if (!r.enabled) return;
    if (nav.index === total - 1 && r.status !== 'read' && !r.busy) void r.setRead(true, nav.index);
    if (firstIndex.current) {
      firstIndex.current = false;
      return;
    }
    r.saveProgress(nav.index);
  }, [nav.index, total]);
  const pillarTitle = useCallback((slug: PillarSlug) => pillarTitles[slug], [pillarTitles]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el || typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void el.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    sourcesButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = keyToAction(event, event.target);
      if (!action) return;
      if (drawerOpen && action !== 'close' && action !== 'sources') return;
      switch (action) {
        case 'nextUnread':
          if (!nextUnread) return;
          router.push(nextUnread.href);
          break;
        case 'toggleRead':
          if (!read.enabled) return;
          toggleRead();
          break;
        case 'review':
          if (!hasReview) return;
          setCollapsed(!reviewCollapsed);
          break;
        case 'next':
          nav.next();
          break;
        case 'prev':
          nav.prev();
          break;
        case 'first':
          nav.first();
          break;
        case 'last':
          nav.last();
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
        case 'sources':
          if (drawerOpen) closeDrawer();
          else setDrawerOpen(true);
          break;
        case 'close':
          if (!drawerOpen) return; // let the browser exit full screen
          closeDrawer();
          break;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, drawerOpen, toggleFullscreen, closeDrawer, nextUnread, router, read.enabled, toggleRead, hasReview, setCollapsed, reviewCollapsed]);

  useEffect(() => {
    // Scroll only the thumbnail rail. scrollIntoView would also scroll every
    // ancestor (the presenter and the page), shifting the whole view per slide.
    const thumb = thumbRefs.current[nav.index];
    const rail = thumb?.parentElement;
    if (!thumb || !rail) return;
    const left = thumb.offsetLeft - (rail.clientWidth - thumb.offsetWidth) / 2;
    rail.scrollTo?.({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
  }, [nav.index, reduce]);

  useEffect(() => {
    if (drawerOpen) drawerCloseRef.current?.focus({ preventScroll: true });
  }, [drawerOpen]);

  const variants = {
    enter: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60, scale: 0.985 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60, scale: 0.985 }),
  };

  const sources = slide.sources ?? [];

  return (
    <div
      ref={rootRef}
      className={`${styles.presenter} ${hasReview ? styles.withReview : ''}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${deck.title} slides`}
    >
      <div className={styles.topbar}>
        <Link href={backHref} className={styles.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Brain
        </Link>
        <div className={styles.deckTitle} title={deck.title}>
          {deck.title} <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>· {deck.period}</span>
        </div>
        <span className={styles.counter} aria-hidden="true">
          <strong>{String(nav.index + 1).padStart(2, '0')}</strong> / {String(total).padStart(2, '0')}
        </span>
        {externalUrl && (
          <a className={styles.toolButton} href={externalUrl} target="_blank" rel="noreferrer noopener">
            Open original ↗
          </a>
        )}
        {nav.isLast && nextUnread && (
          <Link href={nextUnread.href} className={`${styles.toolButton} ${styles.toolButtonNext}`} title={nextUnread.title}>
            Next unread deck → <span className={`${styles.kbd} ${styles.kbdHint}`}>N</span>
          </Link>
        )}
        {hasReview && (
          <button
            type="button"
            className={`${styles.toolButton} ${!reviewCollapsed ? styles.toolButtonActive : ''}`}
            onClick={() => setCollapsed(!reviewCollapsed)}
            aria-expanded={!reviewCollapsed}
            aria-controls="brain-review-sidebar"
          >
            Review{slideNotes.length ? ` (${slideNotes.length})` : ''} <span className={`${styles.kbd} ${styles.kbdHint}`}>R</span>
          </button>
        )}
        <button
          ref={sourcesButtonRef}
          type="button"
          className={`${styles.toolButton} ${drawerOpen ? styles.toolButtonActive : ''}`}
          onClick={() => {
            if (drawerOpen) closeDrawer();
            else setDrawerOpen(true);
          }}
          aria-expanded={drawerOpen}
          aria-controls="brain-sources-drawer"
        >
          Sources{sources.length ? ` (${sources.length})` : ''} <span className={`${styles.kbd} ${styles.kbdHint}`}>S</span>
        </button>
        <button type="button" className={styles.toolButton} onClick={toggleFullscreen} aria-pressed={isFullscreen}>
          {isFullscreen ? 'Exit full screen' : 'Full screen'} <span className={`${styles.kbd} ${styles.kbdHint}`}>F</span>
        </button>
      </div>

      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Deck progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={nav.index + 1}
        aria-valuetext={`Slide ${nav.index + 1} of ${total}`}
      >
        <div className={styles.progressFill} style={{ width: `${((nav.index + 1) / total) * 100}%` }} />
      </div>

      <div
        className={styles.stage}
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null) return;
          if (end - start < -60) nav.next();
          if (end - start > 60) nav.prev();
        }}
      >
        <button type="button" className={`${styles.navZone} ${styles.navPrev}`} onClick={nav.prev} disabled={nav.isFirst} aria-label="Previous slide">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className={styles.canvas}>
          <AnimatePresence initial={false} custom={nav.direction} mode="popLayout">
            <motion.div
              key={slide.id}
              custom={nav.direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: 0.12 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={styles.slideMotion}
            >
              <SlideRenderer slide={slide} index={nav.index} total={total} pillarTitle={pillarTitle} animate={!reduce} />
            </motion.div>
          </AnimatePresence>
        </div>
        <button type="button" className={`${styles.navZone} ${styles.navNext}`} onClick={nav.next} disabled={nav.isLast} aria-label="Next slide">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <nav className={styles.rail} aria-label="Slides">
        {deck.slides.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              thumbRefs.current[i] = el;
            }}
            type="button"
            className={`${styles.thumb} ${i === nav.index ? styles.thumbActive : ''}`}
            onClick={() => nav.go(i)}
            aria-current={i === nav.index ? 'step' : undefined}
            aria-label={`Go to slide ${i + 1}: ${s.title}`}
          >
            <span className={styles.thumbMeta} aria-hidden="true">
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span>{SLIDE_KIND_LABEL[s.kind]}</span>
            </span>
            <span className={styles.thumbTitle} aria-hidden="true">
              {s.title}
            </span>
            {(notesBySlide.get(s.id)?.length ?? 0) > 0 && (
              <span className={styles.thumbNotes} aria-hidden="true" title="Notes on this slide">
                {notesBySlide.get(s.id)?.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      <p className={base.srOnly} aria-live="polite" aria-atomic="true">
        {`Slide ${nav.index + 1} of ${total}: ${slide.title}`}
      </p>

            {drawerOpen && <button type="button" className={styles.scrim} aria-label="Close sources" tabIndex={-1} onClick={closeDrawer} />}
            <motion.aside
              id="brain-sources-drawer"
              className={styles.drawer}
              role="dialog"
              aria-modal="false"
              aria-label={`Sources for slide ${nav.index + 1}`}
              aria-hidden={!drawerOpen}
              inert={!drawerOpen}
              initial={false}
              animate={drawerOpen ? { x: 0, opacity: 1 } : reduce ? { x: 0, opacity: 0 } : { x: '125%', opacity: 1 }}
              transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={styles.drawerHead}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                    Slide {nav.index + 1} · brain paths
                  </div>
                  <div className={styles.drawerTitle}>Sources</div>
                </div>
                <button ref={drawerCloseRef} type="button" className={styles.toolButton} onClick={closeDrawer}>
                  Close <span className={styles.kbd}>Esc</span>
                </button>
              </div>
              <div className={styles.drawerBody}>
                {sources.length === 0 ? (
                  <p style={{ color: 'var(--ink-3)', fontSize: '0.88rem' }}>No sources were recorded for this slide.</p>
                ) : (
                  sources.map((p) =>
                    isExternal(p) ? (
                      <a key={p} className={styles.sourceItem} href={p} target="_blank" rel="noreferrer noopener">
                        <div className={styles.sourcePath}>{p.replace(/^https?:\/\//i, '')}</div>
                        <div className={styles.sourceMeta}>External link ↗</div>
                      </a>
                    ) : (
                      <a key={p} className={styles.sourceItem} href={brainSourceUrl(p, brainCommit)} target="_blank" rel="noreferrer noopener">
                        <div className={styles.sourcePath}>brain/{p.replace(/^brain\//, '')}</div>
                        <div className={styles.sourceMeta}>
                          {sourceDates[p] ? `Updated ${formatDate(sourceDates[p])}` : 'Open in the private brain repo'}
                          {brainCommit ? ` · @${brainCommit.slice(0, 7)}` : ''}
                        </div>
                      </a>
                    ),
                  )
                )}
              </div>
            </motion.aside>

      {hasReview && (
        <ReviewSidebar
          deck={deck}
          index={nav.index}
          collapsed={reviewCollapsed}
          onCollapsedChange={setCollapsed}
          notes={notes}
          notesError={feedback?.error}
          onNoteSaved={(row) => setNotes((prev) => [...prev, row])}
          onNoteUpdated={(row) => setNotes((prev) => prev.map((n) => (n.id === row.id ? row : n)))}
          onNoteDeleted={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
          onJump={nav.go}
          reading={
            read.enabled
              ? { enabled: true, status: read.status, state: read.state, busy: read.busy, error: read.error, unavailable: reading?.error, onToggle: toggleRead }
              : undefined
          }
          nextUnread={nextUnread}
          decksHref={backHref === '/admin/brain' ? '/admin/brain/decks' : backHref}
          resumedAt={resumedAt}
          onStartOver={() => {
            setResumedAt(null);
            nav.first();
          }}
        />
      )}
    </div>
  );
}
