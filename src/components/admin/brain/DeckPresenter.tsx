'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import type { BrainDeck, PillarSlug } from '@/lib/brain/snapshot';
import { brainSourceUrl, formatDate } from '@/lib/brain/viz';
import { FeedbackComposer, FeedbackThread } from './Feedback';
import { SLIDE_KIND_LABEL, SlideRenderer } from './SlideRenderer';
import { keyToAction } from './deckNavigation';
import { useDeckNavigation } from './useDeckNavigation';
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
  /** Existing notes for this deck. When omitted, the Feedback control is hidden. */
  feedback?: { rows: BrainFeedbackRow[]; error?: string };
}

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
}: DeckPresenterProps) {
  const total = deck.slides.length;
  const nav = useDeckNavigation({ count: total, initialIndex });
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sourcesButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const feedbackButtonRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackScope, setFeedbackScope] = useState<'slide' | 'deck'>('slide');
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
  const deckNotes = notesBySlide.get('') ?? [];
  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    feedbackButtonRef.current?.focus();
  }, []);
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
    sourcesButtonRef.current?.focus();
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
          else {
            setFeedbackOpen(false);
            setDrawerOpen(true);
          }
          break;
        case 'close':
          if (feedbackOpen) {
            closeFeedback();
            break;
          }
          if (!drawerOpen) return; // let the browser exit full screen
          closeDrawer();
          break;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, drawerOpen, feedbackOpen, toggleFullscreen, closeDrawer, closeFeedback]);

  useEffect(() => {
    thumbRefs.current[nav.index]?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [nav.index, reduce]);

  useEffect(() => {
    if (drawerOpen) drawerCloseRef.current?.focus();
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
      className={styles.presenter}
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
        {feedback && (
          <button
            ref={feedbackButtonRef}
            type="button"
            className={`${styles.toolButton} ${feedbackOpen ? styles.toolButtonActive : ''}`}
            onClick={() => {
              if (feedbackOpen) closeFeedback();
              else {
                setDrawerOpen(false);
                setFeedbackOpen(true);
              }
            }}
            aria-expanded={feedbackOpen}
            aria-controls="brain-feedback-drawer"
          >
            Feedback{slideNotes.length ? ` (${slideNotes.length})` : ''}
          </button>
        )}
        <button
          ref={sourcesButtonRef}
          type="button"
          className={`${styles.toolButton} ${drawerOpen ? styles.toolButtonActive : ''}`}
          onClick={() => {
            if (drawerOpen) closeDrawer();
            else {
              setFeedbackOpen(false);
              setDrawerOpen(true);
            }
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

      {feedback && (
        <>
          {feedbackOpen && <button type="button" className={styles.scrim} aria-label="Close feedback" tabIndex={-1} onClick={closeFeedback} />}
          <motion.aside
            id="brain-feedback-drawer"
            className={styles.drawer}
            role="dialog"
            aria-modal="false"
            aria-label={feedbackScope === 'slide' ? `Feedback on slide ${nav.index + 1}` : 'Feedback on the deck'}
            aria-hidden={!feedbackOpen}
            inert={!feedbackOpen}
            initial={false}
            animate={feedbackOpen ? { x: 0, opacity: 1 } : reduce ? { x: 0, opacity: 0 } : { x: '125%', opacity: 1 }}
            transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.drawerHead}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.66rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                  {feedbackScope === 'slide' ? `Slide ${nav.index + 1} · ${slide.title}` : `Whole deck · ${deck.period}`}
                </div>
                <div className={styles.drawerTitle}>Feedback</div>
              </div>
              <button type="button" className={styles.toolButton} onClick={closeFeedback}>
                Close <span className={styles.kbd}>Esc</span>
              </button>
            </div>
            <div className={styles.drawerBody}>
              <div className={base.segmented} role="tablist" aria-label="Feedback on">
                <button
                  type="button"
                  role="tab"
                  aria-selected={feedbackScope === 'slide'}
                  className={`${base.segment} ${feedbackScope === 'slide' ? base.segmentActive : ''}`}
                  onClick={() => setFeedbackScope('slide')}
                >
                  This slide{slideNotes.length ? ` · ${slideNotes.length}` : ''}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={feedbackScope === 'deck'}
                  className={`${base.segment} ${feedbackScope === 'deck' ? base.segmentActive : ''}`}
                  onClick={() => setFeedbackScope('deck')}
                >
                  Whole deck{deckNotes.length ? ` · ${deckNotes.length}` : ''}
                </button>
              </div>
              {feedback.error && (
                <p style={{ color: 'var(--warning)', fontSize: '0.8rem', margin: 0 }}>Feedback could not be loaded ({feedback.error}).</p>
              )}
              <FeedbackComposer
                key={feedbackScope === 'slide' ? `slide-${slide.id}` : 'deck'}
                target={
                  feedbackScope === 'slide'
                    ? { target_type: 'slide', target_id: deck.id, slide_id: slide.id }
                    : { target_type: 'deck', target_id: deck.id }
                }
                onSaved={(row) => setNotes((prev) => [...prev, row])}
              />
              <FeedbackThread
                rows={feedbackScope === 'slide' ? slideNotes : deckNotes}
                emptyText={feedbackScope === 'slide' ? 'No notes on this slide yet.' : 'No notes on the whole deck yet.'}
                onUpdated={(row) => setNotes((prev) => prev.map((n) => (n.id === row.id ? row : n)))}
                onDeleted={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
              />
            </div>
          </motion.aside>
        </>
      )}
    </div>
  );
}
