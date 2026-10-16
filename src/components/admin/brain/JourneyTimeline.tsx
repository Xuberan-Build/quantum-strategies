'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { BrainSnapshot } from '@/lib/brain/snapshot';
import { formatDate } from '@/lib/brain/viz';
import styles from './brain.module.css';
import j from './journey.module.css';

type Era = BrainSnapshot['journey']['eras'][number];

const DAY = 86_400_000;

function toTime(iso: string): number {
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(t) ? 0 : t;
}

function durationLabel(start: number, end: number): string {
  const days = Math.max(1, Math.round((end - start) / DAY) + 1);
  if (days === 1) return '1 day';
  if (days < 60) return `${days} days`;
  return `${Math.round(days / 30.4)} months`;
}

/** Eras on a true time axis: widths are durations, gaps are silences. */
export function JourneyTimeline({ eras }: { eras: Era[] }) {
  const reduce = useReducedMotion();
  const items = useMemo(
    () =>
      eras
        .map((e, i) => ({ ...e, i, s: toTime(e.start), e: Math.max(toTime(e.end), toTime(e.start)) }))
        .sort((a, b) => a.s - b.s || a.i - b.i),
    [eras],
  );
  const [selected, setSelected] = useState(() => Math.max(0, items.length - 1));

  const min = items.length ? items[0].s : 0;
  const max = items.length ? Math.max(...items.map((it) => it.e)) + DAY : 1;
  const span = Math.max(DAY, max - min);

  // Greedy lanes so overlapping or same-day eras never cover each other.
  const lanes: number[] = [];
  const placed = items.map((it) => {
    const left = ((it.s - min) / span) * 100;
    const width = Math.max(1.2, ((it.e + DAY - it.s) / span) * 100);
    let lane = lanes.findIndex((end) => end <= left - 0.3);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(0);
    }
    lanes[lane] = left + width;
    return { ...it, left, width, lane };
  });
  const laneCount = Math.max(1, lanes.length);

  const months: { t: number; label: string }[] = [];
  if (items.length) {
    const d = new Date(min);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    while (d.getTime() < max) {
      months.push({ t: d.getTime(), label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }) });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  const step = months.length > 12 ? 2 : 1;

  if (items.length === 0) return <p className={styles.muted}>No eras recorded.</p>;
  const current = placed[Math.min(selected, placed.length - 1)];

  return (
    <div>
      <div className={j.timeline} style={{ height: `${laneCount * 40 + 34}px` }} role="group" aria-label="Eras on a time axis">
        {months.map((m, idx) => (
          <div key={m.t} className={j.month} style={{ left: `${((m.t - min) / span) * 100}%` }} aria-hidden="true">
            {idx % step === 0 && <span>{m.label}</span>}
          </div>
        ))}
        {placed.map((p, idx) => {
          const active = p.i === current.i;
          return (
            <button
              key={`${p.title}-${p.i}`}
              type="button"
              className={`${j.era} ${active ? j.eraActive : ''}`}
              style={{ left: `${p.left}%`, width: `${p.width}%`, top: `${p.lane * 40}px` }}
              onClick={() => setSelected(idx)}
              aria-pressed={active}
              aria-label={`${p.title}, ${formatDate(p.start)} to ${formatDate(p.end)}`}
              title={p.title}
            >
              {p.width > 7 && <span className={j.eraLabel}>{p.title}</span>}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.i}
          className={j.eraDetail}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.1 : 0.2 }}
          aria-live="polite"
        >
          <div className={styles.eyebrow}>
            Era {Math.min(selected, placed.length - 1)} · {formatDate(current.start)}
            {current.end !== current.start ? ` → ${formatDate(current.end)}` : ''} · {durationLabel(current.s, current.e)}
          </div>
          <h3 className={j.eraTitle}>{current.title}</h3>
          <p className={j.eraSummary}>{current.summary}</p>
        </motion.div>
      </AnimatePresence>

      <ol className={j.eraList} aria-label="All eras">
        {placed.map((p, idx) => (
          <li key={`list-${p.title}-${p.i}`}>
            <button type="button" className={`${j.eraListItem} ${p.i === current.i ? j.eraListActive : ''}`} onClick={() => setSelected(idx)} aria-pressed={p.i === current.i}>
              <span className={j.eraListNum}>{String(idx).padStart(2, '0')}</span>
              <span className={j.eraListTitle}>{p.title}</span>
              <span className={j.eraListDate}>{formatDate(p.start)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
