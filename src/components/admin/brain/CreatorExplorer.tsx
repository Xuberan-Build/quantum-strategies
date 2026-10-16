'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { BrainSnapshot } from '@/lib/brain/snapshot';
import { formatCompact, formatMultiple, logScale, logTicks, stableJitter } from '@/lib/brain/viz';
import { ChartFrame } from './ChartFrame';
import styles from './brain.module.css';
import c from './creators.module.css';

type Creator = BrainSnapshot['creators'][number];

const THRESHOLDS = [2, 5, 10] as const;
const MIN_X = 0.05;
const ROW_H = 64;
const MARGIN = { top: 26, right: 28, bottom: 30, left: 148 };
const JEWEL = '#b48cff';
const DEEMPH = '#6f665a';
const SURFACE = '#16120e';

interface Point {
  key: string;
  creator: string;
  creatorKey: string;
  title: string;
  views: number;
  outlier: number;
  videoId: string;
  x: number;
  y: number;
  row: number;
}

export function CreatorExplorer({ creators }: { creators: Creator[] }) {
  const [threshold, setThreshold] = useState<(typeof THRESHOLDS)[number]>(5);
  const [focus, setFocus] = useState<string | null>(null);

  const visible = focus ? creators.filter((cr) => cr.key === focus) : creators;
  const tableRows = visible
    .flatMap((cr) => cr.outliers.map((o) => ({ ...o, creator: cr.name })))
    .sort((a, b) => b.outlier - a.outlier)
    .slice(0, 120);

  return (
    <div>
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Highlight</span>
        <div className={styles.segmented} role="group" aria-label="Highlight threshold">
          {THRESHOLDS.map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.segment} ${threshold === t ? styles.segmentActive : ''}`}
              aria-pressed={threshold === t}
              onClick={() => setThreshold(t)}
            >
              ≥ {t}×
            </button>
          ))}
        </div>
        <span className={styles.filterLabel}>Creator</span>
        <div className={styles.segmented} role="group" aria-label="Focus a creator">
          <button type="button" className={`${styles.segment} ${focus === null ? styles.segmentActive : ''}`} aria-pressed={focus === null} onClick={() => setFocus(null)}>
            All
          </button>
          {creators.map((cr) => (
            <button
              key={cr.key}
              type="button"
              className={`${styles.segment} ${focus === cr.key ? styles.segmentActive : ''}`}
              aria-pressed={focus === cr.key}
              onClick={() => setFocus(focus === cr.key ? null : cr.key)}
            >
              {cr.name}
            </button>
          ))}
        </div>
      </div>

      <ChartFrame
        title="Every upload against its channel median"
        caption={`Each dot is one recent video: views ÷ that channel's median views, log scale. Dots at or above ${threshold}× are highlighted; the top one per channel is labelled. Click a dot to open the video.`}
        table={
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Creator</th>
                <th scope="col">Title</th>
                <th scope="col" className={styles.num}>
                  Views
                </th>
                <th scope="col" className={styles.num}>
                  × median
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={`${r.creator}-${r.id}`}>
                  <td>{r.creator}</td>
                  <td>{r.title}</td>
                  <td className={styles.num}>{formatCompact(r.views)}</td>
                  <td className={styles.num}>{formatMultiple(r.outlier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <OutlierChart creators={visible} threshold={threshold} />
      </ChartFrame>

      <div className={styles.section} style={{ marginTop: '2rem' }}>
        <div className={c.cards}>
          {creators.map((cr) => (
            <CreatorCard key={cr.key} creator={cr} threshold={threshold} active={focus === cr.key} onToggle={() => setFocus(focus === cr.key ? null : cr.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CreatorCard({ creator, threshold, active, onToggle }: { creator: Creator; threshold: number; active: boolean; onToggle: () => void }) {
  const n = creator.outliers.length;
  const above = creator.outliers.filter((o) => o.outlier >= threshold).length;
  const top = creator.outliers.reduce<Creator['outliers'][number] | null>((best, o) => (!best || o.outlier > best.outlier ? o : best), null);
  return (
    <article className={`${c.card} ${active ? c.cardActive : ''}`}>
      <header className={c.cardHead}>
        <h3 className={styles.cardTitle}>{creator.name}</h3>
        <button type="button" className={styles.segment} aria-pressed={active} onClick={onToggle}>
          {active ? 'Show all' : 'Focus'}
        </button>
      </header>
      <p className={c.stance}>{creator.stance}</p>
      <dl className={c.metrics}>
        <div>
          <dt>Followers</dt>
          <dd>{creator.followers == null ? '—' : formatCompact(creator.followers)}</dd>
        </div>
        <div>
          <dt>Median views</dt>
          <dd>{creator.medianViews == null ? '—' : formatCompact(creator.medianViews)}</dd>
        </div>
        <div>
          <dt>≥ {threshold}×</dt>
          <dd>
            {above}
            <span className={styles.count}> / {n}</span>
          </dd>
        </div>
      </dl>
      {top && (
        <div className={c.topOutlier}>
          <span className={c.topValue}>{formatMultiple(top.outlier)}</span>
          <span className={c.topTitle}>{top.title}</span>
        </div>
      )}
      {creator.takeaways.length > 0 && (
        <ul className={styles.plainList} style={{ marginTop: '0.9rem' }}>
          {creator.takeaways.map((t, i) => (
            <li key={`${i}-${t.slice(0, 12)}`}>{t}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(v: number): number {
  for (const m of [10, 20, 50, 100, 200, 500]) if (v <= m) return m;
  return Math.ceil(v / 100) * 100;
}

function OutlierChart(props: { creators: Creator[]; threshold: number }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  // The plot depends on the measured width, so it renders on the client once measured.
  return (
    <div ref={ref} className={c.chartWrap} style={width === null ? { minHeight: MARGIN.top + props.creators.length * ROW_H + MARGIN.bottom } : undefined}>
      {width !== null && <OutlierPlot {...props} width={width} />}
    </div>
  );
}

function OutlierPlot({ creators, threshold, width }: { creators: Creator[]; threshold: number; width: number }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<Point | null>(null);
  const narrow = width < 640;
  const margin = narrow ? { ...MARGIN, left: 16, top: 40 } : MARGIN;
  const rowH = narrow ? ROW_H + 18 : ROW_H;
  const innerW = width - margin.left - margin.right;
  const height = margin.top + creators.length * rowH + margin.bottom;
  const maxOutlier = Math.max(10, ...creators.flatMap((cr) => cr.outliers.map((o) => o.outlier)));
  const maxX = niceMax(maxOutlier);
  const x = useMemo(() => logScale(MIN_X, maxX, innerW), [maxX, innerW]);
  const ticks = logTicks(MIN_X, maxX).filter((t) => (narrow ? [0.1, 1, 10, 100].includes(t) : true));

  const points = useMemo<Point[]>(
    () =>
      creators.flatMap((cr, row) =>
        cr.outliers.map((o) => {
          const band = narrow ? rowH - 34 : rowH * 0.5;
          const top = margin.top + row * rowH + (narrow ? 26 : (rowH - band) / 2);
          return {
            key: `${cr.key}-${o.id}`,
            creator: cr.name,
            creatorKey: cr.key,
            title: o.title,
            views: o.views,
            outlier: o.outlier,
            videoId: o.id,
            x: margin.left + x(Math.max(MIN_X, o.outlier)),
            y: top + stableJitter(o.id) * band,
            row,
          };
        }),
      ),
    [creators, x, margin.left, margin.top, rowH, narrow],
  );

  const highlighted = useMemo(() => points.filter((p) => p.outlier >= threshold).sort((a, b) => a.x - b.x), [points, threshold]);
  const labelled = useMemo(() => {
    const best = new Map<number, Point>();
    for (const p of highlighted) {
      const cur = best.get(p.row);
      if (!cur || p.outlier > cur.outlier) best.set(p.row, p);
    }
    return [...best.values()];
  }, [highlighted]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const row = Math.floor((py - margin.top) / rowH);
    let best: Point | null = null;
    let bestD = 24 * 24;
    for (const p of points) {
      if (p.row !== row) continue;
      const d = (p.x - px) ** 2 + ((p.y - py) * 0.6) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setHover(best);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (highlighted.length === 0) return;
    const idx = hover ? highlighted.findIndex((p) => p.key === hover.key) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setHover(highlighted[(idx + 1) % highlighted.length]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setHover(highlighted[(idx - 1 + highlighted.length) % highlighted.length]);
    } else if (e.key === 'Enter' && hover) {
      window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(hover.videoId)}`, '_blank', 'noopener');
    } else if (e.key === 'Escape') {
      setHover(null);
    }
  };

  const total = points.length;
  const summary = `Outlier strip chart: ${total} uploads across ${creators.length} creators, log scale from ${MIN_X}× to ${maxX}× the channel median. ${highlighted.length} at or above ${threshold}×. Use the arrow keys to step through highlighted videos; Enter opens one.`;

  return (
    <>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        tabIndex={0}
        className={c.chart}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        onClick={() => hover && window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(hover.videoId)}`, '_blank', 'noopener')}
        style={{ cursor: hover ? 'pointer' : 'default' }}
      >
        {/* grid + axis */}
        {ticks.map((t) => (
          <g key={t} aria-hidden="true">
            <line x1={margin.left + x(t)} x2={margin.left + x(t)} y1={margin.top - 6} y2={height - margin.bottom} stroke={t === 1 ? '#5a4d3e' : '#2c251e'} strokeWidth={1} />
            <text x={margin.left + x(t)} y={height - margin.bottom + 18} textAnchor="middle" className={c.tick}>
              {t < 1 ? `${t}×` : `${t}×`}
            </text>
          </g>
        ))}
        <text x={margin.left + x(1) + 6} y={margin.top - 10} className={c.refLabel} aria-hidden="true">
          channel median
        </text>

        {creators.map((cr, row) => {
          const y0 = margin.top + row * rowH;
          return (
            <g key={cr.key} aria-hidden="true">
              {row > 0 && <line x1={narrow ? 0 : 0} x2={width} y1={y0} y2={y0} stroke="#221c16" strokeWidth={1} />}
              <text x={narrow ? margin.left : margin.left - 14} y={narrow ? y0 + 16 : y0 + rowH / 2 + 4} textAnchor={narrow ? 'start' : 'end'} className={c.rowLabel}>
                {cr.name}
              </text>
            </g>
          );
        })}

        {/* de-emphasised dots first, highlighted on top */}
        <g aria-hidden="true">
          {points
            .filter((p) => p.outlier < threshold)
            .map((p) => (
              <circle key={p.key} cx={p.x} cy={p.y} r={3.5} fill={DEEMPH} fillOpacity={0.75} stroke={SURFACE} strokeWidth={1.5} />
            ))}
        </g>
        <g aria-hidden="true">
          {highlighted.map((p, i) => (
            <motion.circle
              key={p.key}
              cx={p.x}
              cy={p.y}
              r={4.5}
              fill={JEWEL}
              stroke={SURFACE}
              strokeWidth={2}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(0.6, i * 0.01) }}
            />
          ))}
        </g>

        {/* one direct label per row: the channel's top outlier */}
        <g aria-hidden="true">
          {labelled.map((p) => {
            const toLeft = p.x > margin.left + innerW * 0.55;
            const label = p.title.length > 46 ? `${p.title.slice(0, 44)}…` : p.title;
            const ly = margin.top + p.row * rowH + (narrow ? rowH - 6 : 13);
            return (
              <g key={`label-${p.key}`}>
                <line x1={p.x} y1={p.y} x2={p.x} y2={ly + 3} stroke="#5a4d3e" strokeWidth={1} />
                <text x={toLeft ? p.x - 6 : p.x + 6} y={ly} textAnchor={toLeft ? 'end' : 'start'} className={c.pointLabel}>
                  <tspan className={c.pointLabelValue}>{formatMultiple(p.outlier)}</tspan> {narrow ? '' : label}
                </text>
              </g>
            );
          })}
        </g>

        {hover && <circle cx={hover.x} cy={hover.y} r={8} fill="none" stroke="#efe6d6" strokeWidth={1.5} aria-hidden="true" />}
      </svg>

      {hover && (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(Math.max(hover.x, 120), width - 120),
            top: hover.y - 14,
            transform: 'translate(-50%, -100%)',
          }}
          role="status"
        >
          <span className={styles.tooltipValue}>{formatMultiple(hover.outlier)} median</span>
          <span style={{ color: 'var(--ink)' }}>{hover.title}</span>
          <div style={{ marginTop: 4, color: 'var(--ink-3)' }}>
            {hover.creator} · {formatCompact(hover.views)} views
          </div>
        </div>
      )}
    </>
  );
}
