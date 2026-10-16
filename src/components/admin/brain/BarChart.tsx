'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
import { formatCompact, linearTicks } from '@/lib/brain/viz';
import styles from './brain.module.css';

export interface BarDatum {
  label: string;
  value: number;
  note?: string;
}

interface BarChartProps {
  data: readonly BarDatum[];
  /** Accessible summary of what is plotted (the title names the single series). */
  ariaLabel: string;
  format?: (value: number) => string;
  color?: string;
  /** Larger type for slides. */
  size?: 'md' | 'lg';
  animate?: boolean;
}

/**
 * Horizontal bar chart, one series. Thin bars (<= 24px) with a 4px rounded data
 * end, square at the baseline; value at the tip; hairline grid; per-bar hover and
 * focus tooltip that carries the note.
 */
export function BarChart({ data, ariaLabel, format = formatCompact, color, size = 'md', animate = true }: BarChartProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = linearTicks(max, 4);
  const domainMax = ticks[ticks.length - 1] || 1;
  const large = size === 'lg';

  const show = (i: number, el: HTMLElement) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!wrap) return;
    const inner = Math.max(0, r.width - 72); // track minus the value gutter
    setTip({ i, x: r.left - wrap.left + (data[i].value / domainMax) * inner, y: r.top - wrap.top });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div className={styles.bars} role="list" aria-label={ariaLabel}>
        {data.map((d, i) => {
          const pct = domainMax > 0 ? (d.value / domainMax) * 100 : 0;
          return (
            <div key={`${d.label}-${i}`} role="listitem" style={{ display: 'contents' }}>
              <div className={styles.barLabel} style={large ? { fontSize: '1rem' } : undefined} aria-hidden="true">
                {d.label}
              </div>
              <div
                className={styles.barTrack}
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}${d.note ? `. ${d.note}` : ''}`}
                onPointerEnter={(e) => show(i, e.currentTarget)}
                onPointerLeave={() => setTip(null)}
                onFocus={(e) => show(i, e.currentTarget)}
                onBlur={() => setTip(null)}
                style={large ? { minHeight: '2.75rem' } : undefined}
              >
                <div className={styles.barInner}>
                  {ticks.slice(1).map((t) => (
                    <span key={t} className={styles.barGrid} style={{ left: `${(t / domainMax) * 100}%` }} aria-hidden="true" />
                  ))}
                  <span className={styles.barBaseline} aria-hidden="true" />
                  <motion.div
                    className={styles.barFill}
                    style={{ width: `${pct}%`, background: color, height: large ? 24 : 18, originX: 0 }}
                    initial={animate && !reduce ? { scaleX: 0 } : false}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <span className={styles.barValue} style={large ? { fontSize: '1rem' } : undefined} aria-hidden="true">
                    {format(d.value)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div className={styles.barAxis} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className={styles.barTick} style={{ left: `${(t / domainMax) * 100}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
      </div>
      {tip && (
        <div className={styles.tooltip} style={{ left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)' }} aria-hidden="true">
          <span className={styles.tooltipValue}>{format(data[tip.i].value)}</span>
          {data[tip.i].label}
          {data[tip.i].note && <div style={{ marginTop: 4, color: 'var(--ink-3)' }}>{data[tip.i].note}</div>}
        </div>
      )}
    </div>
  );
}

export function BarTable({ data, valueLabel = 'Value', format = formatCompact }: { data: readonly BarDatum[]; valueLabel?: string; format?: (v: number) => string }) {
  const hasNotes = data.some((d) => d.note);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Label</th>
          <th scope="col" className={styles.num}>
            {valueLabel}
          </th>
          {hasNotes && <th scope="col">Note</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((d, i) => (
          <tr key={`${d.label}-${i}`}>
            <td>{d.label}</td>
            <td className={styles.num}>{format(d.value)}</td>
            {hasNotes && <td>{d.note ?? ''}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
