'use client';

/**
 * Zoomable sunburst for the topical map. The central entity sits in the middle; each
 * ring steps outward one level (pillar, section, topic, subtopic). Three rings show at
 * a time; clicking an arc zooms into it, clicking the centre zooms back out.
 *
 * Arc angle = demand (leaves sized by demand, parents are the sum). Fill = the chosen
 * metric on a sequential ramp. Status is drawn on top: LIVE a solid light outline,
 * BUILT a dashed outline, TO BUILD a hatch. Plain SVG, no chart library.
 *
 * Keyboard: Tab reaches each visible arc; Enter or Space opens it; arrow keys move
 * between siblings; Escape or Backspace zooms out.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  LEVEL_LABEL,
  METRIC_INFO,
  STATUS_INFO,
  arcFor,
  arcPath,
  band,
  descendants,
  rampColor,
  type ArcPos,
  type MapNode,
  type Metric,
  type TopicalMap,
} from '@/lib/brain/topical-map-view';
import styles from './map.module.css';

const R = 380;
const CENTER = 150;
const RINGS = 3;
const RING_W = (R - CENTER) / RINGS;
const MIN_SPAN = 0.0025; // radians; thinner slivers are not drawn
const DURATION = 520;

interface Props {
  root: MapNode;
  focus: MapNode;
  centralEntity: TopicalMap['centralEntity'];
  metric: Metric;
  lit: Set<string> | null;
  selectedId: string | null;
  reducedMotion: boolean;
  onActivate: (m: MapNode) => void;
  onZoomOut: () => void;
}

interface DrawnArc {
  m: MapNode;
  pos: ArcPos;
}

const ringRadii = (r: number) => [CENTER + (r - 1) * RING_W, CENTER + r * RING_W] as const;
const visibleRing = (r: number) => r >= 0.5 && r <= RINGS + 0.5;

function visibleUnder(focus: MapNode): MapNode[] {
  return descendants(focus).filter((m) => {
    const r = m.depth - focus.depth;
    return r >= 1 && r <= RINGS && (m.x1 - m.x0) / ((focus.x1 - focus.x0) || 1) * Math.PI * 2 >= MIN_SPAN;
  });
}

function bandWord(metric: Metric, score: number): string {
  const b = band(score);
  return b === 'medium' ? 'medium' : METRIC_INFO[metric][b];
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function Sunburst({ root, focus, centralEntity, metric, lit, selectedId, reducedMotion, onActivate, onZoomOut }: Props) {
  const [animState, setAnim] = useState<{ from: MapNode; to: MapNode; t: number } | null>(null);
  // A frame left over from an interrupted animation never outlives a jump without motion.
  const anim = reducedMotion || (animState && animState.to !== focus) ? null : animState;
  const shown = useRef<MapNode>(focus);
  const [tip, setTip] = useState<{ m: MapNode; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const arcRefs = useRef(new Map<string, SVGPathElement>());

  // Animate between the previous focus and the new one.
  useEffect(() => {
    const from = shown.current;
    shown.current = focus;
    if (from === focus) return;
    if (reducedMotion || typeof requestAnimationFrame !== 'function') return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setAnim(t < 1 ? { from, to: focus, t: ease(t) } : null);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [focus, reducedMotion]);

  const arcs: DrawnArc[] = useMemo(() => {
    if (!anim) return visibleUnder(focus).map((m) => ({ m, pos: arcFor(m, focus) }));
    const set = new Set([...visibleUnder(anim.from), ...visibleUnder(anim.to)]);
    const { t } = anim;
    return [...set].map((m) => {
      const a = arcFor(m, anim.from);
      const b = arcFor(m, anim.to);
      return { m, pos: { a0: a.a0 + (b.a0 - a.a0) * t, a1: a.a1 + (b.a1 - a.a1) * t, r: a.r + (b.r - a.r) * t } };
    });
  }, [anim, focus]);

  const interactive = !anim;

  const focusSibling = useCallback(
    (m: MapNode, dir: 1 | -1) => {
      const sibs = (m.parent?.children ?? []).filter((s) => arcRefs.current.has(s.id));
      if (!sibs.length) return;
      const i = sibs.indexOf(m);
      const next = sibs[(i + dir + sibs.length) % sibs.length];
      arcRefs.current.get(next.id)?.focus();
    },
    [],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.key === 'Escape' || e.key === 'Backspace') && focus !== root) {
      e.preventDefault();
      e.stopPropagation();
      onZoomOut();
    }
  };

  const moveTip = useCallback((m: MapNode, e: React.MouseEvent) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ m, x: e.clientX - box.left, y: e.clientY - box.top });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  const fn = focus.node;
  const zoomed = focus !== root;

  return (
    <div className={styles.sunWrap} ref={wrapRef} onMouseLeave={() => setTip(null)}>
      <svg
        className={styles.sun}
        viewBox={`${-R - 4} ${-R - 4} ${2 * R + 8} ${2 * R + 8}`}
        role="group"
        aria-label={`Topical map. Centre: ${fn ? fn.label : centralEntity.label}. Ring size is demand, colour is ${METRIC_INFO[metric].label.toLowerCase()}.`}
        onKeyDown={onKey}
      >
        <defs>
          <pattern id="tm-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(14, 11, 9, 0.75)" strokeWidth="2.4" />
          </pattern>
          <radialGradient id="tm-core" r="0.75">
            <stop offset="0%" stopColor="#2a2032" />
            <stop offset="100%" stopColor="#16120e" />
          </radialGradient>
        </defs>

        <ArcLayer
          arcs={arcs}
          metric={metric}
          lit={lit}
          selectedId={selectedId}
          interactive={interactive}
          arcRefs={arcRefs}
          onActivate={onActivate}
          onSibling={focusSibling}
          onHover={moveTip}
          onLeave={hideTip}
        />

        <g
          className={zoomed ? styles.coreButton : undefined}
          role={zoomed ? 'button' : undefined}
          tabIndex={zoomed ? 0 : undefined}
          aria-label={zoomed ? `Zoom out from ${fn?.label}` : undefined}
          onClick={zoomed ? onZoomOut : undefined}
          onKeyDown={
            zoomed
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onZoomOut();
                  }
                }
              : undefined
          }
        >
          <circle r={CENTER - 3} fill="url(#tm-core)" stroke="var(--axis)" strokeWidth={1} />
          <foreignObject x={-CENTER * 0.78} y={-CENTER * 0.72} width={CENTER * 1.56} height={CENTER * 1.44}>
            <div className={styles.core}>
              {fn ? (
                <>
                  <span className={styles.coreEyebrow}>
                    {LEVEL_LABEL[fn.level]} · {fn.pillarCode}
                  </span>
                  <span className={styles.coreTitle}>{fn.label}</span>
                  <span className={styles.coreHint}>
                    {METRIC_INFO[metric].label} {Math.round(fn.scores[metric])} · click to zoom out
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.coreEyebrow}>Central entity</span>
                  <span className={styles.coreTitle}>{centralEntity.label}</span>
                  <span className={styles.coreDef}>{centralEntity.definition}</span>
                </>
              )}
            </div>
          </foreignObject>
        </g>
      </svg>

      {tip && tip.m.node && (
        <div className={styles.tip} style={{ left: tip.x, top: tip.y }} role="presentation">
          <span className={styles.tipMeta}>
            {LEVEL_LABEL[tip.m.node.level]} · {tip.m.node.pillarCode}
          </span>
          <strong className={styles.tipTitle}>{tip.m.node.label}</strong>
          <span>
            {METRIC_INFO[metric].label} {Math.round(tip.m.node.scores[metric])}: {bandWord(metric, tip.m.node.scores[metric])}
          </span>
          <span>
            Demand {Math.round(tip.m.node.scores.demand)} · {STATUS_INFO[tip.m.node.status].label}
          </span>
        </div>
      )}
    </div>
  );
}

interface LayerProps {
  arcs: DrawnArc[];
  metric: Metric;
  lit: Set<string> | null;
  selectedId: string | null;
  interactive: boolean;
  arcRefs: RefObject<Map<string, SVGPathElement>>;
  onActivate: (m: MapNode) => void;
  onSibling: (m: MapNode, dir: 1 | -1) => void;
  onHover: (m: MapNode, e: React.MouseEvent) => void;
  onLeave: () => void;
}

const ArcLayer = memo(function ArcLayer({ arcs, metric, lit, selectedId, interactive, arcRefs, onActivate, onSibling, onHover, onLeave }: LayerProps) {
  const drawn = arcs.filter(({ pos }) => visibleRing(pos.r) && pos.a1 - pos.a0 >= MIN_SPAN);
  return (
    <g>
      {drawn.map(({ m, pos }) => {
        const n = m.node!;
        const [r0, r1] = ringRadii(pos.r);
        const d = arcPath(pos.a0, pos.a1, r0 + 1, r1 - 1);
        if (!d) return null;
        const dim = lit && !lit.has(m.id);
        const selected = m.id === selectedId;
        const score = Math.round(n.scores[metric]);
        const outline =
          selected
            ? { stroke: 'var(--jewel)', strokeWidth: 3 }
            : n.status === 'LIVE'
              ? { stroke: 'var(--ink)', strokeWidth: 1.8 }
              : n.status === 'BUILT'
                ? { stroke: 'var(--ink-2)', strokeWidth: 1.4, strokeDasharray: '4 3' }
                : { stroke: 'var(--plane)', strokeWidth: 0.8 };
        return (
          <g key={m.id} opacity={dim ? 0.16 : 1} className={styles.arcGroup}>
            <path
              ref={(el) => {
                if (el && interactive) arcRefs.current.set(m.id, el);
                else arcRefs.current.delete(m.id);
              }}
              d={d}
              data-id={m.id}
              fill={rampColor(n.scores[metric])}
              {...outline}
              className={styles.arc}
              tabIndex={interactive && !dim ? 0 : -1}
              role="button"
              aria-label={`${n.label}. ${LEVEL_LABEL[n.level]} in ${n.pillarCode}. ${METRIC_INFO[metric].label} ${score}. ${STATUS_INFO[n.status].label}.${m.children.some((c) => c.children.length) ? ' Opens and zooms in.' : ''}`}
              aria-pressed={selected}
              onClick={() => interactive && onActivate(m)}
              onMouseMove={(e) => onHover(m, e)}
              onMouseLeave={onLeave}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onActivate(m);
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  onSibling(m, 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  onSibling(m, -1);
                }
              }}
            />
            {n.status === 'TO BUILD' && <path d={d} fill="url(#tm-hatch)" pointerEvents="none" />}
            <ArcLabel label={n.label} pos={pos} r0={r0} r1={r1} light={score < 55} />
          </g>
        );
      })}
    </g>
  );
});

function ArcLabel({ label, pos, r0, r1, light }: { label: string; pos: ArcPos; r0: number; r1: number; light: boolean }) {
  const rm = (r0 + r1) / 2;
  if ((pos.a1 - pos.a0) * rm < 16) return null;
  const maxChars = Math.floor((r1 - r0 - 10) / 7.4);
  // A label cut to a stub is noise: show it whole, or with at least 8 characters kept.
  if (label.length > maxChars && maxChars < 9) return null;
  const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
  const deg = (((pos.a0 + pos.a1) / 2) * 180) / Math.PI;
  return (
    <text
      transform={`rotate(${deg - 90}) translate(${rm},0) rotate(${deg < 180 ? 0 : 180})`}
      className={styles.arcLabel}
      fill={light ? 'var(--ink)' : '#1a130c'}
      textAnchor="middle"
      dy="0.35em"
      pointerEvents="none"
      aria-hidden="true"
    >
      {text}
    </text>
  );
}
