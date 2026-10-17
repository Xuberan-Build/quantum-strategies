'use client';

/**
 * WebGL force-directed graph (sigma.js + graphology + ForceAtlas2 in a web worker).
 *
 * The graphology graph is kept between renders and diffed against the visible node and
 * edge lists, so filtering re-flows the layout instead of rebuilding it. The layout runs
 * for a bounded "settle" window and then stops (no endless jitter). With reduced motion
 * the layout runs on a copy in the worker and the result is applied once.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { default as SigmaType } from 'sigma';
import type { AbstractGraph } from 'graphology-types';
import { GAP_COLOR, colorForType, nodeSize, type GraphEdge, type GraphNode } from '@/lib/brain/graph';
import { dim, drawFadingLabel, drawGlowHover, loadSigma, withAlpha } from './sigma-programs';
import styles from './graph.module.css';

export type PositionCache = Map<string, { x: number; y: number }>;

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  /** Nodes drawn in the warning colour (gaps). */
  highlightIds?: ReadonlySet<string> | null;
  /** Change the nonce to fly the camera to focusId. */
  focusId?: string | null;
  focusNonce?: number;
  /** Change to re-run the layout. */
  reheatNonce?: number;
  /** Change to fit the whole graph in view. */
  fitNonce?: number;
  reducedMotion: boolean;
  onNodeClick: (id: string) => void;
  onStageClick?: () => void;
  variant?: 'full' | 'mini';
  positions?: PositionCache;
  ariaLabel: string;
  onSettledChange?: (settled: boolean) => void;
}

type Loaded = Awaited<ReturnType<typeof loadSigma>>;
type G = AbstractGraph;
type Layout = { stop(): void; kill(): void; start(): void };

const EDGE_COLOR = 'rgba(196, 184, 165, 0.14)';
const EDGE_COLOR_MINI = 'rgba(196, 184, 165, 0.26)';
const EDGE_FAINT = 'rgba(196, 184, 165, 0.035)';

export function webglAvailable(): boolean {
  if (typeof window === 'undefined' || typeof WebGLRenderingContext === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const edgeKey = (e: GraphEdge) => `${e.src}|${e.dst}|${e.type}`;

export function GraphCanvas(props: GraphCanvasProps) {
  const { nodes, edges, variant = 'full', ariaLabel } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<Loaded | null>(null);
  const sigmaRef = useRef<SigmaType | null>(null);
  const graphRef = useRef<G | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef<{ node: string | null; neighbours: Set<string> }>({ node: null, neighbours: new Set() });
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const positionsRef = useRef<PositionCache>(props.positions ?? new Map());
  const firstSync = useRef(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported' | 'error'>('loading');

  /* ------------------------------------------------------------ layout */

  function savePositions() {
    const g = graphRef.current;
    if (!g) return;
    g.forEachNode((id, a) => positionsRef.current.set(id, { x: a.x, y: a.y }));
  }

  function stopLayout() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    if (layoutRef.current) {
      layoutRef.current.kill();
      layoutRef.current = null;
    }
  }

  function runLayout(durationMs: number) {
    const lib = libRef.current;
    const g = graphRef.current;
    if (!lib || !g || g.order === 0) return;
    stopLayout();
    const order = g.order;
    const settings = {
      ...lib.inferSettings(g),
      gravity: variant === 'mini' ? 2 : 0.8,
      scalingRatio: variant === 'mini' ? 6 : 12,
      slowDown: 2 + Math.log10(order + 1) * 2,
      barnesHutOptimize: order > 800,
      edgeWeightInfluence: 0.6,
      adjustSizes: false,
    };
    const reduced = propsRef.current.reducedMotion;
    // Reduced motion: lay out a copy, then apply the result in one step.
    const target = reduced ? (g.copy() as G) : g;
    const layout = new lib.FA2Layout(target, { settings, getEdgeWeight: 'weight' }) as unknown as Layout;
    layoutRef.current = layout;
    propsRef.current.onSettledChange?.(false);
    layout.start();
    settleTimer.current = setTimeout(() => {
      layout.kill();
      if (layoutRef.current === layout) layoutRef.current = null;
      settleTimer.current = null;
      if (reduced && graphRef.current) {
        target.forEachNode((id, a) => {
          if (g.hasNode(id) && !g.getNodeAttribute(id, 'fixed')) g.mergeNodeAttributes(id, { x: a.x, y: a.y });
        });
      }
      savePositions();
      propsRef.current.onSettledChange?.(true);
    }, durationMs);
  }

  /* ------------------------------------------------------------ mount */

  useEffect(() => {
    if (!webglAvailable()) {
      setStatus('unsupported');
      return;
    }
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const cleanups: (() => void)[] = [];

    loadSigma()
      .then((lib) => {
        if (cancelled || !containerRef.current) return;
        libRef.current = lib;
        const graph = new lib.Graph({ multi: true, type: 'directed', allowSelfLoops: false }) as unknown as G;
        graphRef.current = graph;
        const mini = variant === 'mini';

        const sigma = new lib.Sigma(graph as never, containerRef.current, {
          allowInvalidContainer: true,
          zIndex: true,
          defaultNodeType: 'glow',
          nodeProgramClasses: { glow: lib.NodeGlowProgram },
          defaultEdgeType: 'line',
          defaultEdgeColor: mini ? EDGE_COLOR_MINI : EDGE_COLOR,
          minEdgeThickness: 0.6,
          renderEdgeLabels: false,
          labelFont: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
          labelSize: mini ? 10 : 11,
          labelWeight: '500',
          labelColor: { color: '#efe6d6' },
          labelDensity: mini ? 2 : 0.9,
          labelGridCellSize: mini ? 60 : 110,
          labelRenderedSizeThreshold: mini ? 0 : 4.5,
          defaultDrawNodeLabel: drawFadingLabel,
          defaultDrawNodeHover: drawGlowHover,
          stagePadding: mini ? 24 : 48,
          minCameraRatio: 0.02,
          maxCameraRatio: 6,
          hideEdgesOnMove: false,
          nodeReducer: (node, data) => {
            const p = propsRef.current;
            const hover = hoverRef.current;
            const res: Record<string, unknown> = { ...data };
            const isGap = p.highlightIds?.has(node);
            if (isGap) {
              res.color = GAP_COLOR;
              res.size = (data.size as number) * 1.25;
              res.zIndex = 2;
            }
            if (node === p.selectedId) {
              res.highlighted = true;
              res.forceLabel = true;
              res.zIndex = 3;
            }
            if (hover.node) {
              if (node === hover.node || hover.neighbours.has(node)) {
                res.forceLabel = true;
                res.zIndex = Math.max((res.zIndex as number) ?? 0, 2);
              } else {
                res.color = dim(isGap ? GAP_COLOR : (data.baseColor as string));
                res.label = '';
                res.zIndex = 0;
              }
            }
            return res;
          },
          edgeReducer: (edge, data) => {
            const p = propsRef.current;
            const hover = hoverRef.current;
            const g = graphRef.current;
            if (!g) return data;
            const focus = hover.node ?? p.selectedId;
            if (!focus) return data;
            const [s, t] = g.extremities(edge);
            const touches = s === focus || t === focus;
            if (touches) {
              const other = s === focus ? t : s;
              const c = g.hasNode(other) ? (g.getNodeAttribute(other, 'baseColor') as string) : '#c4b8a5';
              return { ...data, color: withAlpha(c, hover.node ? 0.75 : 0.5), size: 1.2, zIndex: 1 };
            }
            return hover.node ? { ...data, color: EDGE_FAINT } : data;
          },
        });
        sigmaRef.current = sigma;

        /* hover */
        sigma.on('enterNode', ({ node }) => {
          hoverRef.current = { node, neighbours: new Set(graph.neighbors(node)) };
          if (containerRef.current) containerRef.current.style.cursor = 'pointer';
          sigma.refresh({ skipIndexation: true });
        });
        sigma.on('leaveNode', () => {
          hoverRef.current = { node: null, neighbours: new Set() };
          if (containerRef.current) containerRef.current.style.cursor = '';
          sigma.refresh({ skipIndexation: true });
        });

        /* drag (neighbours follow a little; the layout re-settles on release) */
        let dragged: string | null = null;
        let moved = false;
        let last: { x: number; y: number } | null = null;
        sigma.on('downNode', ({ node }) => {
          dragged = node;
          moved = false;
          last = { x: graph.getNodeAttribute(node, 'x'), y: graph.getNodeAttribute(node, 'y') };
          stopLayout();
          graph.setNodeAttribute(node, 'fixed', true);
          if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
        });
        sigma.on('moveBody', ({ event }) => {
          if (!dragged) return;
          const pos = sigma.viewportToGraph(event);
          if (last) {
            const dx = pos.x - last.x;
            const dy = pos.y - last.y;
            if (Math.abs(dx) + Math.abs(dy) > 0) moved = true;
            for (const n of graph.neighbors(dragged)) {
              if (graph.getNodeAttribute(n, 'fixed')) continue;
              graph.mergeNodeAttributes(n, { x: graph.getNodeAttribute(n, 'x') + dx * 0.3, y: graph.getNodeAttribute(n, 'y') + dy * 0.3 });
            }
          }
          last = pos;
          graph.mergeNodeAttributes(dragged, { x: pos.x, y: pos.y });
          event.preventSigmaDefault();
          event.original.preventDefault();
          event.original.stopPropagation();
        });
        const release = () => {
          if (!dragged) return;
          graph.removeNodeAttribute(dragged, 'fixed');
          dragged = null;
          last = null;
          if (moved) runLayout(1500);
          else savePositions();
        };
        sigma.on('upNode', release);
        sigma.on('upStage', release);

        sigma.on('clickNode', ({ node }) => {
          if (moved) {
            moved = false;
            return;
          }
          propsRef.current.onNodeClick(node);
        });
        sigma.on('clickStage', () => propsRef.current.onStageClick?.());

        observer = new ResizeObserver(() => {
          sigma.resize();
          sigma.refresh({ skipIndexation: true });
        });
        observer.observe(containerRef.current);
        cleanups.push(() => observer?.disconnect());

        setStatus('ready');
      })
      .catch((err) => {
        console.error('[brain graph] renderer failed to start:', err);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      savePositions();
      stopLayout();
      sigmaRef.current?.kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
    // The renderer is created once per mount; later props flow through refs and the sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------ sync data */

  useEffect(() => {
    const g = graphRef.current;
    const sigma = sigmaRef.current;
    if (status !== 'ready' || !g || !sigma) return;

    const visible = new Set(nodes.map((n) => n.id));
    let structural = false;
    g.forEachNode((id) => {
      if (!visible.has(id)) {
        positionsRef.current.set(id, { x: g.getNodeAttribute(id, 'x'), y: g.getNodeAttribute(id, 'y') });
        g.dropNode(id);
        structural = true;
      }
    });

    let maxW = 0;
    let maxD = 0;
    for (const n of nodes) {
      maxW = Math.max(maxW, n.weight ?? 0);
      maxD = Math.max(maxD, n.degree);
    }
    const scale = variant === 'mini' ? 0.8 : 1;
    const spread = Math.sqrt(nodes.length + 1) * 12;

    // Index neighbours so new nodes can start beside an already-placed one.
    const nbr = new Map<string, string[]>();
    for (const e of edges) {
      (nbr.get(e.src) ?? nbr.set(e.src, []).get(e.src)!).push(e.dst);
      (nbr.get(e.dst) ?? nbr.set(e.dst, []).get(e.dst)!).push(e.src);
    }

    for (const n of nodes) {
      const color = colorForType(n.type);
      const attrs = {
        label: n.label,
        size: nodeSize(n.weight, n.degree, maxW, maxD, scale),
        color,
        baseColor: color,
        nodeType: n.type,
      };
      if (g.hasNode(n.id)) {
        g.mergeNodeAttributes(n.id, attrs);
        continue;
      }
      let pos = positionsRef.current.get(n.id);
      if (!pos) {
        const anchor = (nbr.get(n.id) ?? []).map((id) => (g.hasNode(id) ? g.getNodeAttributes(id) : positionsRef.current.get(id))).find(Boolean) as
          | { x: number; y: number }
          | undefined;
        const a = Math.random() * Math.PI * 2;
        const r = anchor ? 2 + Math.random() * 6 : Math.sqrt(Math.random()) * spread;
        pos = { x: (anchor?.x ?? 0) + Math.cos(a) * r, y: (anchor?.y ?? 0) + Math.sin(a) * r };
      }
      g.addNode(n.id, { ...attrs, x: pos.x, y: pos.y });
      structural = true;
    }

    const wanted = new Map(edges.map((e) => [edgeKey(e), e]));
    g.forEachEdge((key) => {
      if (!wanted.has(key)) {
        g.dropEdge(key);
        structural = true;
      }
    });
    for (const [key, e] of wanted) {
      if (g.hasEdge(key) || !g.hasNode(e.src) || !g.hasNode(e.dst)) continue;
      g.addDirectedEdgeWithKey(key, e.src, e.dst, { weight: Math.max(0.1, Math.min(2, e.weight ?? 1)), edgeType: e.type });
      structural = true;
    }

    if (structural) {
      sigma.setCustomBBox(null);
      const initial = firstSync.current;
      firstSync.current = false;
      const n = g.order;
      runLayout(initial ? Math.min(9000, 2500 + n * 1.2) : variant === 'mini' ? 1500 : 2200);
    } else {
      sigma.refresh();
    }
    // runLayout reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, nodes, edges, variant]);

  /* ------------------------------------------------------------ selection / highlights → repaint */

  useEffect(() => {
    if (status === 'ready') sigmaRef.current?.refresh({ skipIndexation: true });
  }, [status, props.selectedId, props.highlightIds]);

  /* ------------------------------------------------------------ camera */

  useEffect(() => {
    const sigma = sigmaRef.current;
    const g = graphRef.current;
    const id = props.focusId;
    if (status !== 'ready' || !sigma || !g || !id || !g.hasNode(id)) return;
    // Wait a frame so a node added in the same render has display data.
    const raf = requestAnimationFrame(() => {
      const d = sigma.getNodeDisplayData(id);
      if (!d) return;
      sigma.getCamera().animate({ x: d.x, y: d.y, ratio: Math.min(sigma.getCamera().ratio, 0.35) }, { duration: props.reducedMotion ? 0 : 650 });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, props.focusNonce]);

  useEffect(() => {
    if (status !== 'ready' || !props.fitNonce) return;
    sigmaRef.current?.setCustomBBox(null);
    sigmaRef.current?.getCamera().animatedReset({ duration: props.reducedMotion ? 0 : 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, props.fitNonce]);

  useEffect(() => {
    if (status === 'ready' && props.reheatNonce) runLayout(3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, props.reheatNonce]);

  return (
    <div className={variant === 'mini' ? styles.canvasMini : styles.canvas}>
      <div ref={containerRef} className={styles.sigma} role="img" aria-label={ariaLabel} />
      {status === 'unsupported' && (
        <p className={styles.canvasNote}>This browser has no WebGL, so the graph cannot be drawn. Search and the side panel still work.</p>
      )}
      {status === 'error' && <p className={styles.canvasNote}>The graph renderer failed to start. Reload to try again.</p>}
    </div>
  );
}
