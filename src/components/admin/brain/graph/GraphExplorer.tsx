'use client';

/**
 * /admin/brain/graph: an Obsidian-style explorer over kg_nodes / kg_edges.
 *
 * Loads the whole (capped) graph once and filters on the client so toggles are instant.
 * View state lives in the URL (?node=&types=&edges=&minWeight=&tier=&orphans=&gaps=&depth=&local=)
 * so a view can be bookmarked or shared. Nothing secret goes in the URL.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EDGE_TYPES,
  NODE_TYPES,
  NODE_TYPE_LABEL,
  adjacency,
  colorForType,
  humanize,
  neighbourhood,
  viewFromParams,
  viewToQuery,
  type EdgeType,
  type GapRow,
  type GapsPayload,
  type GraphNode,
  type GraphPayload,
  type GraphViewState,
  type NodeType,
} from '@/lib/brain/graph';
import { GraphCanvas, type PositionCache } from './GraphCanvas';
import { NodePanel } from './NodePanel';
import styles from './graph.module.css';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

type LoadState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: GraphPayload };

export function GraphExplorer() {
  const params = useSearchParams();
  const pathname = usePathname() ?? '/admin/brain/graph';
  const [view, setView] = useState<GraphViewState>(() => viewFromParams(params ?? new URLSearchParams()));
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [gaps, setGaps] = useState<GapsPayload | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; nonce: number }>({ id: view.node, nonce: view.node ? 1 : 0 });
  const [reheat, setReheat] = useState(0);
  const [fit, setFit] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [settled, setSettled] = useState(false);
  const reducedMotion = useReducedMotion();
  const positions = useRef<PositionCache>(new Map());

  /* ---------------------------------------------------------- data */

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/admin/brain/graph', { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as GraphPayload;
        if (!res.ok) throw new Error(json.error || `Load failed (${res.status})`);
        setLoad({ status: 'ready', data: { nodes: json.nodes ?? [], edges: json.edges ?? [], truncated: json.truncated, fixture: json.fixture } });
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setLoad({ status: 'error', error: err instanceof Error ? err.message : 'Load failed' });
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!view.gaps || gaps) return;
    const ctrl = new AbortController();
    fetch('/api/admin/brain/graph/gaps', { signal: ctrl.signal })
      .then((res) => res.json() as Promise<GapsPayload>)
      .then((json) => setGaps({ rows: json.rows ?? [], available: !!json.available, fixture: json.fixture }))
      .catch(() => {
        if (!ctrl.signal.aborted) setGaps({ rows: [], available: false });
      });
    return () => ctrl.abort();
  }, [view.gaps, gaps]);

  /* ---------------------------------------------------------- URL state */

  useEffect(() => {
    const q = viewToQuery(view);
    const next = q ? `${pathname}?${q}` : pathname;
    if (typeof window !== 'undefined' && `${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [view, pathname]);

  const patch = useCallback((p: Partial<GraphViewState>) => setView((v) => ({ ...v, ...p })), []);

  /* ---------------------------------------------------------- derived graph */

  const data = load.status === 'ready' ? load.data : null;
  const allNodes = useMemo(() => data?.nodes ?? [], [data]);
  const allEdges = useMemo(() => data?.edges ?? [], [data]);
  const nodeById = useMemo(() => new Map(allNodes.map((n) => [n.id, n])), [allNodes]);

  const presentTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of allNodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    return counts;
  }, [allNodes]);
  const presentEdgeTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of allEdges) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return counts;
  }, [allEdges]);
  const tiers = useMemo(() => [...new Set(allNodes.map((n) => n.tier).filter((t): t is string => !!t))].sort(), [allNodes]);
  const maxWeight = useMemo(() => allNodes.reduce((m, n) => Math.max(m, n.weight ?? 0), 0), [allNodes]);

  const typeOn = useCallback((t: string) => !view.types || view.types.includes(t as NodeType), [view.types]);
  const edgeOn = useCallback((t: string) => !view.edgeTypes || view.edgeTypes.includes(t as EdgeType), [view.edgeTypes]);

  const filtered = useMemo(() => {
    let nodes = allNodes.filter((n) => typeOn(n.type) && (n.weight ?? 0) >= view.minWeight && (!view.tier || n.tier === view.tier));
    let ids = new Set(nodes.map((n) => n.id));
    let edges = allEdges.filter((e) => edgeOn(e.type) && ids.has(e.src) && ids.has(e.dst));

    if (view.local && view.node && ids.has(view.node)) {
      const keep = neighbourhood(adjacency(edges), view.node, view.depth, 2000);
      nodes = nodes.filter((n) => keep.has(n.id));
      ids = keep;
      edges = edges.filter((e) => keep.has(e.src) && keep.has(e.dst));
    }

    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e.src, (degree.get(e.src) ?? 0) + 1);
      degree.set(e.dst, (degree.get(e.dst) ?? 0) + 1);
    }
    let out: GraphNode[] = nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 }));
    if (!view.orphans) out = out.filter((n) => n.degree > 0 || n.id === view.node);
    return { nodes: out, edges };
  }, [allNodes, allEdges, typeOn, edgeOn, view.minWeight, view.tier, view.local, view.node, view.depth, view.orphans]);

  const adj = useMemo(() => adjacency(allEdges.filter((e) => edgeOn(e.type))), [allEdges, edgeOn]);

  const gapIds = useMemo(() => (view.gaps && gaps ? new Set(gaps.rows.map((r) => r.node_id)) : null), [view.gaps, gaps]);

  /* ---------------------------------------------------------- actions */

  const selectNode = useCallback(
    (id: string | null, opts: { fly?: boolean } = {}) => {
      setView((v) => {
        const next: GraphViewState = { ...v, node: id };
        // Make sure a searched-for node is not hidden by the type filter.
        const n = id ? nodeById.get(id) : null;
        if (n && v.types && !v.types.includes(n.type as NodeType)) next.types = [...v.types, n.type as NodeType];
        return next;
      });
      if (id && opts.fly !== false) setFocus((f) => ({ id, nonce: f.nonce + 1 }));
    },
    [nodeById],
  );

  const toggleType = (t: NodeType) => {
    const current = view.types ?? NODE_TYPES.filter((x) => presentTypes.has(x));
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    const allPresent = NODE_TYPES.filter((x) => presentTypes.has(x));
    patch({ types: allPresent.every((x) => next.includes(x)) ? null : next });
  };
  const soloType = (t: NodeType) => patch({ types: view.types?.length === 1 && view.types[0] === t ? null : [t] });

  const toggleEdgeType = (t: EdgeType) => {
    const current = view.edgeTypes ?? EDGE_TYPES.filter((x) => presentEdgeTypes.has(x));
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    const allPresent = EDGE_TYPES.filter((x) => presentEdgeTypes.has(x));
    patch({ edgeTypes: allPresent.every((x) => next.includes(x)) ? null : next });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      setView((v) => (v.node ? { ...v, node: null, local: false } : v));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------------------------------------------------- render */

  const selected = view.node ? nodeById.get(view.node) ?? null : null;
  const ariaLabel = `Knowledge graph: ${filtered.nodes.length} nodes and ${filtered.edges.length} links shown.`;

  return (
    <div className={styles.stage}>
      {load.status === 'ready' && (
        <GraphCanvas
          nodes={filtered.nodes}
          edges={filtered.edges}
          selectedId={view.node}
          highlightIds={gapIds}
          focusId={focus.id}
          focusNonce={focus.nonce}
          reheatNonce={reheat}
          fitNonce={fit}
          reducedMotion={reducedMotion}
          onNodeClick={(id) => selectNode(id, { fly: false })}
          positions={positions.current}
          ariaLabel={ariaLabel}
          onSettledChange={setSettled}
        />
      )}

      {load.status === 'loading' && <div className={styles.centerNote}>Loading the graph…</div>}
      {load.status === 'error' && (
        <div className={styles.centerNote} role="alert">
          <strong>The knowledge graph could not be loaded.</strong>
          <span>{load.error}</span>
          <span className={styles.muted}>kg_nodes / kg_edges may not be built yet.</span>
        </div>
      )}

      {/* Top bar: search, counts, view toggles */}
      <div className={styles.topBar}>
        <SearchBox nodes={allNodes} onPick={(id) => selectNode(id)} />
        <span className={styles.counts} aria-live="polite">
          {filtered.nodes.length.toLocaleString()} nodes · {filtered.edges.length.toLocaleString()} links
          {data?.truncated?.nodes || data?.truncated?.edges ? ' · capped' : ''}
          {load.status === 'ready' && !settled && !reducedMotion ? ' · settling' : ''}
        </span>
        {data?.fixture && (
          <span className={styles.fixtureChip} title="Synthetic data, development only">
            Dev fixture
          </span>
        )}
        <div className={styles.topActions}>
          <button
            type="button"
            className={`${styles.toggle} ${view.gaps ? styles.toggleOnWarn : ''}`}
            aria-pressed={view.gaps}
            onClick={() => patch({ gaps: !view.gaps })}
          >
            Gaps{view.gaps && gaps ? ` · ${gaps.rows.length}` : ''}
          </button>
          <button type="button" className={styles.toggle} onClick={() => setReheat((n) => n + 1)} title="Re-run the layout">
            Re-settle
          </button>
          <button type="button" className={styles.toggle} onClick={() => setFit((n) => n + 1)} title="Fit the graph to the screen">
            Fit
          </button>
          <button type="button" className={styles.toggle} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            {filtersOpen ? 'Hide filters' : 'Filters'}
          </button>
        </div>
      </div>

      {/* Left column: filters, legend, gaps */}
      <aside className={styles.leftCol} aria-label="Graph filters">
        {filtersOpen && (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Groups</h2>
            <p className={styles.hint}>Click to toggle, double-click to show only that group.</p>
            <ul className={styles.legend}>
              {NODE_TYPES.filter((t) => presentTypes.has(t)).map((t) => {
                const on = typeOn(t);
                return (
                  <li key={t}>
                    <button
                      type="button"
                      className={`${styles.legendItem} ${on ? '' : styles.legendOff}`}
                      aria-pressed={on}
                      onClick={() => toggleType(t)}
                      onDoubleClick={() => soloType(t)}
                    >
                      <span className={styles.dot} style={{ background: colorForType(t), boxShadow: on ? `0 0 8px ${colorForType(t)}` : 'none' }} />
                      <span className={styles.legendLabel}>{NODE_TYPE_LABEL[t]}</span>
                      <span className={styles.legendCount}>{presentTypes.get(t)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <h2 className={styles.panelTitle}>Links</h2>
            <div className={styles.chips}>
              {EDGE_TYPES.filter((t) => presentEdgeTypes.has(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.chip} ${edgeOn(t) ? styles.chipOn : ''}`}
                  aria-pressed={edgeOn(t)}
                  onClick={() => toggleEdgeType(t)}
                  title={`${presentEdgeTypes.get(t)} links`}
                >
                  {humanize(t)}
                </button>
              ))}
            </div>

            <div className={styles.field}>
              <label htmlFor="kg-min-weight" className={styles.fieldLabel}>
                Min weight <span className={styles.fieldValue}>{view.minWeight.toFixed(2)}</span>
              </label>
              <input
                id="kg-min-weight"
                type="range"
                min={0}
                max={maxWeight > 0 ? maxWeight : 1}
                step={(maxWeight > 0 ? maxWeight : 1) / 100}
                value={view.minWeight}
                onChange={(e) => patch({ minWeight: Number(e.target.value) })}
                className={styles.range}
              />
            </div>

            {tiers.length > 0 && (
              <div className={styles.field}>
                <label htmlFor="kg-tier" className={styles.fieldLabel}>
                  Tier
                </label>
                <select id="kg-tier" className={styles.select} value={view.tier ?? ''} onChange={(e) => patch({ tier: e.target.value || null })}>
                  <option value="">All tiers</option>
                  {tiers.map((t) => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className={styles.check}>
              <input type="checkbox" checked={view.orphans} onChange={(e) => patch({ orphans: e.target.checked })} />
              Show orphans
            </label>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Local graph depth</span>
              <div className={styles.segmented} role="radiogroup" aria-label="Local graph depth">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={view.depth === d}
                    className={`${styles.segment} ${view.depth === d ? styles.segmentActive : ''}`}
                    onClick={() => patch({ depth: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={view.local} disabled={!view.node} onChange={(e) => patch({ local: e.target.checked })} />
              Main graph: only the selected node&rsquo;s neighbourhood
            </label>

            {(view.types || view.edgeTypes || view.minWeight > 0 || view.tier || !view.orphans || view.local) && (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => patch({ types: null, edgeTypes: null, minWeight: 0, tier: null, orphans: true, local: false })}
              >
                Reset filters
              </button>
            )}
          </section>
        )}

        {view.gaps && <GapsList gaps={gaps} nodeById={nodeById} selectedId={view.node} onPick={(id) => selectNode(id)} />}
      </aside>

      {selected || view.node ? (
        <NodePanel
          id={view.node!}
          lite={selected}
          nodeById={nodeById}
          adj={adj}
          edges={allEdges}
          depth={view.depth}
          reducedMotion={reducedMotion}
          onSelect={(id) => selectNode(id)}
          onClose={() => patch({ node: null, local: false })}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ search */

function SearchBox({ nodes, onPick }: { nodes: GraphNode[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const scored: { n: GraphNode; score: number }[] = [];
    for (const n of nodes) {
      const label = n.label.toLowerCase();
      const i = label.indexOf(s);
      const idHit = n.id.toLowerCase().includes(s);
      if (i < 0 && !idHit) continue;
      scored.push({ n, score: (label === s || n.id.toLowerCase() === s ? 5 : i === 0 ? 3 : i > 0 ? 2 : 1) * 10 + Math.log1p(n.degree) + (n.weight ?? 0) });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.n);
  }, [q, nodes]);

  const pick = (n: GraphNode | undefined) => {
    if (!n) return;
    onPick(n.id);
    setQ(n.label);
    setOpen(false);
  };

  return (
    <div className={styles.searchWrap}>
      <input
        type="search"
        className={styles.search}
        placeholder="Search nodes…"
        aria-label="Search nodes"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls="kg-search-results"
        aria-autocomplete="list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(matches[active] ?? matches[0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul id="kg-search-results" className={styles.searchResults} role="listbox">
          {matches.map((n, i) => (
            <li key={n.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`${styles.searchResult} ${i === active ? styles.searchResultActive : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n)}
              >
                <span className={styles.dot} style={{ background: colorForType(n.type) }} />
                <span className={styles.searchLabel}>{n.label}</span>
                <span className={styles.searchType}>{humanize(n.type)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ gaps */

function GapsList({
  gaps,
  nodeById,
  selectedId,
  onPick,
}: {
  gaps: GapsPayload | null;
  nodeById: Map<string, GraphNode>;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const by = new Map<string, GapRow[]>();
    for (const r of gaps?.rows ?? []) by.set(r.kind, [...(by.get(r.kind) ?? []), r]);
    return [...by.entries()];
  }, [gaps]);

  return (
    <section className={`${styles.panel} ${styles.gapsPanel}`} aria-label="Gaps">
      <h2 className={styles.panelTitle}>
        <span className={styles.dot} style={{ background: 'var(--warning)' }} /> Gaps
        {gaps?.fixture && <span className={styles.fixtureChip}>fixture</span>}
      </h2>
      {!gaps && <p className={styles.hint}>Loading…</p>}
      {gaps && !gaps.available && <p className={styles.hint}>kg_gaps() is not available yet.</p>}
      {gaps && gaps.available && gaps.rows.length === 0 && <p className={styles.hint}>No gaps found.</p>}
      {grouped.map(([kind, rows]) => (
        <div key={kind} className={styles.gapGroup}>
          <h3 className={styles.gapKind}>
            {humanize(kind)} <span className={styles.legendCount}>{rows.length}</span>
          </h3>
          <ul className={styles.linkList}>
            {rows.slice(0, 60).map((r) => {
              const n = nodeById.get(r.node_id);
              return (
                <li key={`${kind}-${r.node_id}`}>
                  <button
                    type="button"
                    className={`${styles.linkItem} ${selectedId === r.node_id ? styles.linkItemActive : ''}`}
                    onClick={() => onPick(r.node_id)}
                    title={r.detail ?? undefined}
                  >
                    <span className={styles.dot} style={{ background: colorForType(n?.type ?? r.node_id.split(':')[0]) }} />
                    <span className={styles.linkLabel}>{r.label ?? n?.label ?? r.node_id}</span>
                  </button>
                  {r.detail && <span className={styles.gapDetail}>{r.detail}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

