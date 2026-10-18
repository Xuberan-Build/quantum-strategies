'use client';

/**
 * /admin/brain/map: the topical map. Every topic Austin could own, arranged around
 * the central entity of his method, sized by demand and coloured by a chosen metric,
 * with a drill-down scorecard and the "make next" queue.
 *
 * Loads the whole map once and filters on the client. View state lives in the URL
 * (?topic=&metric=&pillar=&status=&intent=&min=) via history.replaceState.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  INTENTS,
  INTENT_LABEL,
  LEVEL_LABEL,
  METRICS,
  METRIC_INFO,
  RAMP,
  ROOT_ID,
  SCORE_KEYS,
  STATUSES,
  STATUS_INFO,
  ancestors,
  buildTree,
  filtersActive,
  litIds,
  mapTotals,
  mapViewFromParams,
  mapViewToQuery,
  pct,
  type MapNode,
  type MapViewState,
  type Metric,
  type QueuePayload,
  type TopicIntent,
  type TopicNode,
  type TopicStatus,
  type TopicalMapPayload,
} from '@/lib/brain/topical-map-view';
import { formatDate } from '@/lib/brain/viz';
import { QueuePanel } from './QueuePanel';
import { Sunburst } from './Sunburst';
import { TopicPanel } from './TopicPanel';
import styles from './map.module.css';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const motionQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_MOTION) : null);

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (on) => {
      const mq = motionQuery();
      mq?.addEventListener?.('change', on);
      return () => mq?.removeEventListener?.('change', on);
    },
    () => !!motionQuery()?.matches,
    () => false,
  );
}

type LoadState = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: TopicalMapPayload };

/**
 * Zoom target that shows a node with context: its ancestor two levels up, so the node
 * sits in the second ring with its parent inside and its children outside.
 */
function zoomTargetFor(m: MapNode | undefined): MapNode | null {
  if (!m) return null;
  let cur: MapNode = m;
  while (cur.parent && cur.depth > m.depth - 2) cur = cur.parent;
  return cur;
}
const hasGrandchildren = (m: MapNode) => m.children.some((c) => c.children.length > 0);

export function TopicalMapView() {
  const params = useSearchParams();
  const pathname = usePathname() ?? '/admin/brain/map';
  const [view, setView] = useState<MapViewState>(() => mapViewFromParams(params ?? new URLSearchParams()));
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [queue, setQueue] = useState<QueuePayload | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string>(ROOT_ID);
  const reducedMotion = useReducedMotion();

  /* ---------------------------------------------------------- data */

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/admin/brain/map', { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as TopicalMapPayload;
        if (!res.ok) throw new Error(json.error || `Load failed (${res.status})`);
        setLoad({ status: 'ready', data: { ...json, nodes: json.nodes ?? [] } });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setLoad({ status: 'error', error: err instanceof Error ? err.message : 'Load failed' });
      });
    fetch('/api/admin/brain/map/queue?limit=20', { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as QueuePayload;
        if (!res.ok) throw new Error(json.error || `Queue failed (${res.status})`);
        setQueue({ items: json.items ?? [], fixture: json.fixture });
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setQueueError(err instanceof Error ? err.message : 'Queue failed');
      });
    return () => ctrl.abort();
  }, []);

  const data = load.status === 'ready' ? load.data : null;
  const tree = useMemo(() => (data ? buildTree(data.nodes) : null), [data]);
  const pillars = useMemo(() => (data?.nodes ?? []).filter((n) => n.level === 'pillar'), [data]);
  const totals = useMemo(() => mapTotals(data?.nodes ?? []), [data]);

  // Initial zoom from the URL once the tree exists.
  useEffect(() => {
    if (!tree) return;
    const fromTopic = view.topic ? zoomTargetFor(tree.byId.get(view.topic)) : null;
    const pillarNode = view.pillar ? tree.root.children.find((c) => c.node?.pillarCode === view.pillar) : null;
    setFocusId((fromTopic ?? pillarNode ?? tree.root).id);
    // Only on load: later changes drive the zoom through the handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  /* ---------------------------------------------------------- URL state */

  useEffect(() => {
    const q = mapViewToQuery(view);
    const next = q ? `${pathname}?${q}` : pathname;
    if (typeof window !== 'undefined' && `${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, '', next);
    }
  }, [view, pathname]);

  const patch = useCallback((p: Partial<MapViewState>) => setView((v) => ({ ...v, ...p })), []);

  /* ---------------------------------------------------------- actions */

  const focus = tree ? tree.byId.get(focusId) ?? tree.root : null;
  const lit = useMemo(() => (tree ? litIds(tree.byId, view) : null), [tree, view]);

  const select = useCallback(
    (id: string) => {
      patch({ topic: id });
      const target = tree ? zoomTargetFor(tree.byId.get(id)) : null;
      if (target) setFocusId(target.id);
    },
    [tree, patch],
  );

  const activate = useCallback(
    (m: MapNode) => {
      patch({ topic: m.id });
      // Pillars and sections open into their own rings; a topic stays in view with its context.
      const target = hasGrandchildren(m) ? m : zoomTargetFor(m);
      if (target) setFocusId(target.id);
    },
    [patch],
  );

  const zoomOut = useCallback(() => {
    setFocusId((cur) => tree?.byId.get(cur)?.parent?.id ?? ROOT_ID);
  }, [tree]);

  const setPillar = (code: string | null) => {
    patch({ pillar: code });
    const p = code && tree ? tree.root.children.find((c) => c.node?.pillarCode === code) : null;
    setFocusId(p ? p.id : ROOT_ID);
  };

  const toggleStatus = (s: TopicStatus) => {
    const cur = view.statuses ?? [];
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    patch({ statuses: next.length && next.length < STATUSES.length ? next : null });
  };
  const toggleIntent = (i: TopicIntent) => {
    const cur = view.intents ?? [];
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
    patch({ intents: next.length && next.length < INTENTS.length ? next : null });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT')) return;
      setView((v) => (v.topic ? { ...v, topic: null } : v));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pillarLabel = useCallback(
    (code: string) => {
      const p = pillars.find((x) => x.pillarCode === code);
      return p ? `${code} · ${p.label}` : code;
    },
    [pillars],
  );

  const selectedNode = view.topic && tree ? tree.byId.get(view.topic)?.node ?? null : null;
  const trail = focus ? ancestors(focus) : [];
  const live = totals.byStatus.LIVE;

  /* ---------------------------------------------------------- render */

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <span className={styles.eyebrow}>
          Topical map
          {data?.fixture && (
            <span className={styles.fixtureChip} title="Synthetic data, development only">
              Dev fixture
            </span>
          )}
        </span>
        {data ? (
          <>
            <h1 className={styles.title}>
              {live.toLocaleString()} of {totals.topics.toLocaleString()} topics have a LIVE asset. The queue says which to make next.
            </h1>
            <p className={styles.lede}>
              Every topic Austin could own, arranged around his method. The centre is the central entity; each ring steps out one level: pillar,
              section, topic, subtopic. Arc size is demand, so the wide arcs are where people already ask.
            </p>
            <div className={styles.stats}>
              <Stat label="Topics and subtopics" value={totals.topics.toLocaleString()} note={`across ${pillars.length} pillars`} />
              <Stat label="LIVE" value={`${pct(live, totals.topics)}%`} note={`${live.toLocaleString()} reachable today`} />
              <Stat label="BUILT, not launched" value={totals.byStatus.BUILT.toLocaleString()} note="made, waiting to ship" />
              <Stat label="TO BUILD" value={totals.byStatus['TO BUILD'].toLocaleString()} note="planned, nothing made" />
              <Stat label="Nothing yet" value={totals.byStatus.NONE.toLocaleString()} note="no asset, no plan" />
            </div>
            <p className={styles.whyLine}>
              <span className={styles.whyTag}>Why it matters</span>
              Demand decides the order. Owning a topic means a LIVE asset that answers it and routes to a Rite or the quiz. Work the queue from the
              top.
            </p>
            <p className={styles.source}>
              {data.sourceContext}
              {data.generatedAt ? ` · built ${formatDate(data.generatedAt)}` : ''}
            </p>
          </>
        ) : (
          <h1 className={styles.title}>Which topics to own, in what order</h1>
        )}
      </header>

      {load.status === 'error' && (
        <div className={styles.notice} role="alert">
          <strong>The topical map could not be loaded.</strong>
          <span>{load.error}</span>
          <span className={styles.hint}>The topical map data may not be built yet.</span>
        </div>
      )}
      {load.status === 'loading' && <div className={styles.notice}>Loading the map…</div>}

      {tree && focus && data && (
        <div className={styles.grid}>
          {/* ------------------------------------------------ controls */}
          <aside className={styles.controls} aria-label="Map controls">
            <SearchBox nodes={data.nodes} onPick={select} />

            <section className={styles.box}>
              <h2 className={styles.boxTitle}>Colour by</h2>
              <div className={styles.segmented} role="radiogroup" aria-label="Colour by metric">
                {METRICS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={view.metric === m}
                    className={`${styles.segment} ${view.metric === m ? styles.segmentActive : ''}`}
                    onClick={() => patch({ metric: m })}
                  >
                    {METRIC_INFO[m].label}
                  </button>
                ))}
              </div>
              <Legend metric={view.metric} />
            </section>

            <section className={styles.box}>
              <h2 className={styles.boxTitle}>Filter</h2>
              <div className={styles.field}>
                <label htmlFor="tm-pillar" className={styles.fieldLabel}>
                  Pillar
                </label>
                <select id="tm-pillar" className={styles.select} value={view.pillar ?? ''} onChange={(e) => setPillar(e.target.value || null)}>
                  <option value="">All pillars</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.pillarCode}>
                      {p.pillarCode} · {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <span className={styles.fieldLabel}>Status</span>
              <div className={styles.chips}>
                {STATUSES.map((s) => {
                  const on = !!view.statuses?.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                      aria-pressed={on}
                      onClick={() => toggleStatus(s)}
                      title={STATUS_INFO[s].definition}
                    >
                      {STATUS_INFO[s].label}
                    </button>
                  );
                })}
              </div>

              <span className={styles.fieldLabel}>Searcher intent</span>
              <div className={styles.chips}>
                {INTENTS.map((i) => {
                  const on = !!view.intents?.includes(i);
                  return (
                    <button key={i} type="button" className={`${styles.chip} ${on ? styles.chipOn : ''}`} aria-pressed={on} onClick={() => toggleIntent(i)}>
                      {INTENT_LABEL[i]}
                    </button>
                  );
                })}
              </div>

              <div className={styles.field}>
                <label htmlFor="tm-min" className={styles.fieldLabel}>
                  Min priority <span className={styles.fieldValue}>{view.minPriority}</span>
                </label>
                <input
                  id="tm-min"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={view.minPriority}
                  onChange={(e) => patch({ minPriority: Number(e.target.value) })}
                  className={styles.range}
                />
              </div>
              {filtersActive(view) && (
                <button type="button" className={styles.textButton} onClick={() => { patch({ statuses: null, intents: null, minPriority: 0 }); setPillar(null); }}>
                  Reset filters
                </button>
              )}
              {filtersActive(view) && <p className={styles.hint}>Topics outside the filter fade; the path to each match stays lit.</p>}
            </section>

            <StatusLegend />
          </aside>

          {/* ------------------------------------------------ sunburst */}
          <section className={styles.center} aria-label="Topical map">
            <nav className={styles.trail} aria-label="Zoom path">
              {trail.map((m, i) => (
                <span key={m.id} className={styles.trailItem}>
                  {i > 0 && <span className={styles.trailSep}>›</span>}
                  <button
                    type="button"
                    className={`${styles.trailButton} ${m === focus ? styles.trailCurrent : ''}`}
                    aria-current={m === focus ? 'location' : undefined}
                    onClick={() => setFocusId(m.id)}
                  >
                    {m.node ? m.node.label : data.centralEntity.label}
                  </button>
                </span>
              ))}
            </nav>
            <Sunburst
              root={tree.root}
              focus={focus}
              centralEntity={data.centralEntity}
              metric={view.metric}
              lit={lit}
              selectedId={view.topic}
              reducedMotion={reducedMotion}
              onActivate={activate}
              onZoomOut={zoomOut}
            />
            <p className={styles.caption}>
              Showing {focus.node ? `${LEVEL_LABEL[focus.node.level].toLowerCase()} ${focus.node.label}` : 'the whole map'}, three rings deep. Click an arc
              to open it and zoom in; click the centre to zoom out. Tab and the arrow keys work too.
            </p>
          </section>

          {/* ------------------------------------------------ right column */}
          <div className={styles.side}>
            {view.topic ? (
              <>
                <button type="button" className={styles.textButton} onClick={() => patch({ topic: null })}>
                  ← Make next queue
                </button>
                <TopicPanel key={view.topic} id={view.topic} lite={selectedNode} onClose={() => patch({ topic: null })} />
              </>
            ) : (
              <QueuePanel queue={queue} error={queueError} labelFor={pillarLabel} onPick={select} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statNote}>{note}</span>
    </div>
  );
}

function Legend({ metric }: { metric: Metric }) {
  const info = METRIC_INFO[metric];
  return (
    <div className={styles.legend}>
      <div className={styles.ramp} style={{ background: `linear-gradient(90deg, ${RAMP.join(', ')})` }} aria-hidden="true" />
      <div className={styles.rampLabels}>
        <span>0 · {info.low}</span>
        <span>100 · {info.high}</span>
      </div>
      <p className={styles.legendDef}>
        <strong>{info.label}:</strong> {info.definition}
      </p>
      <details className={styles.defs}>
        <summary>What every score means</summary>
        <dl>
          {SCORE_KEYS.map((k) => (
            <div key={k}>
              <dt>{METRIC_INFO[k].label}</dt>
              <dd>{METRIC_INFO[k].definition}</dd>
            </div>
          ))}
          <div>
            <dt>Arc size</dt>
            <dd>Demand. A parent is as wide as its children together.</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}

function StatusLegend() {
  return (
    <section className={styles.box} aria-label="Status key">
      <h2 className={styles.boxTitle}>Status on the map</h2>
      <ul className={styles.statusKey}>
        {STATUSES.map((s) => (
          <li key={s}>
            <svg width="26" height="16" aria-hidden="true">
              <defs>
                <pattern id={`tm-key-hatch-${s.replace(' ', '-')}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(14, 11, 9, 0.75)" strokeWidth="2" />
                </pattern>
              </defs>
              <rect
                x="1.5"
                y="1.5"
                width="23"
                height="13"
                rx="2"
                fill={RAMP[3]}
                stroke={s === 'LIVE' ? 'var(--ink)' : s === 'BUILT' ? 'var(--ink-2)' : 'var(--plane)'}
                strokeWidth={s === 'LIVE' ? 1.8 : 1.4}
                strokeDasharray={s === 'BUILT' ? '4 3' : undefined}
              />
              {s === 'TO BUILD' && <rect x="1.5" y="1.5" width="23" height="13" rx="2" fill={`url(#tm-key-hatch-${s.replace(' ', '-')})`} />}
            </svg>
            <span>
              <strong>{STATUS_INFO[s].label}</strong> {STATUS_INFO[s].definition}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SearchBox({ nodes, onPick }: { nodes: TopicNode[]; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const scored: { n: TopicNode; score: number }[] = [];
    for (const n of nodes) {
      const label = n.label.toLowerCase();
      const i = label.indexOf(s);
      if (i < 0) continue;
      scored.push({ n, score: (label === s ? 300 : i === 0 ? 200 : 100) + n.scores.demand });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.n);
  }, [q, nodes]);

  const pick = (n: TopicNode | undefined) => {
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
        placeholder="Search topics…"
        aria-label="Search topics"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls="tm-search-results"
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
        <ul id="tm-search-results" className={styles.searchResults} role="listbox">
          {matches.map((n, i) => (
            <li key={n.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`${styles.searchResult} ${i === active ? styles.searchResultActive : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(n)}
              >
                <span className={styles.searchLabel}>{n.label}</span>
                <span className={styles.searchType}>
                  {LEVEL_LABEL[n.level]} · {n.pillarCode}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
