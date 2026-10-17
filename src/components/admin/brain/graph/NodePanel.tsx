'use client';

/**
 * Right-hand panel for one node: summary, props, links out (doc / url), a mini local
 * graph, outgoing links and backlinks grouped by edge type, corpus evidence, top quotes
 * (problems) and Austin's comments (brain_feedback target_type 'node').
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import {
  colorForType,
  groupLinks,
  humanize,
  neighbourhood,
  nodeApiPath,
  type GraphEdge,
  type GraphNode,
  type NeighbourLink,
  type NodeDetail,
} from '@/lib/brain/graph';
import { FeedbackComposer, FeedbackThread } from '../Feedback';
import { GraphCanvas, type PositionCache } from './GraphCanvas';
import styles from './graph.module.css';

interface Props {
  id: string;
  lite: GraphNode | null;
  nodeById: Map<string, GraphNode>;
  adj: Map<string, Set<string>>;
  edges: GraphEdge[];
  depth: number;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const PROP_ORDER = ['likes', 'score', 'stage', 'tier', 'count', 'mentions', 'platform', 'community', 'date'];

const isHttp = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);

function formatProp(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  if (typeof v === 'string') return v.length > 120 ? `${v.slice(0, 119)}…` : v;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.slice(0, 8).join(', ');
  return null;
}

export function NodePanel({ id, lite, nodeById, adj, edges, depth, reducedMotion, onSelect, onClose }: Props) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<BrainFeedbackRow[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);
  const miniPositions = useRef<PositionCache>(new Map());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setDetail(null);
    setError(null);
    setNotes([]);
    setNotesError(null);
    fetch(nodeApiPath(id), { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as NodeDetail & { error?: string };
        if (!res.ok) throw new Error(json.error || `Load failed (${res.status})`);
        setDetail(json);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Load failed');
      });
    fetch(`/api/admin/brain/feedback?target_type=node&target_id=${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { rows?: BrainFeedbackRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || `Notes unavailable (${res.status})`);
        setNotes(json.rows ?? []);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setNotesError(err instanceof Error ? err.message : 'Notes unavailable');
      });
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [id]);

  // Mini local graph (depth 1-2) from the already-loaded edges.
  const mini = useMemo(() => {
    const keep = neighbourhood(adj, id, Math.min(depth, 2), 160);
    const degree = new Map<string, number>();
    const es = edges.filter((e) => keep.has(e.src) && keep.has(e.dst));
    for (const e of es) {
      degree.set(e.src, (degree.get(e.src) ?? 0) + 1);
      degree.set(e.dst, (degree.get(e.dst) ?? 0) + 1);
    }
    const ns: GraphNode[] = [...keep]
      .map((nid) => nodeById.get(nid))
      .filter((n): n is GraphNode => !!n)
      .map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 }));
    return { nodes: ns, edges: es };
  }, [adj, id, depth, edges, nodeById]);

  const node = detail?.node;
  const label = node?.label ?? lite?.label ?? id;
  const type = node?.type ?? lite?.type ?? id.split(':')[0];
  const tier = node?.tier ?? lite?.tier ?? null;
  const weight = node?.weight ?? lite?.weight ?? null;

  const props = useMemo(() => {
    const p = node?.props ?? {};
    const keys = Object.keys(p).filter((k) => k !== 'chunk_ids' && k !== 'embedding' && k !== 'text');
    keys.sort((a, b) => {
      const ia = PROP_ORDER.indexOf(a);
      const ib = PROP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return keys
      .map((k) => [k, formatProp(p[k])] as const)
      .filter((kv): kv is readonly [string, string] => kv[1] !== null)
      .slice(0, 14);
  }, [node]);

  return (
    <aside className={styles.sidePanel} aria-label={`Node: ${label}`}>
      <header className={styles.sideHead}>
        <div className={styles.sideMeta}>
          <span className={styles.typeChip} style={{ ['--c' as string]: colorForType(type) }}>
            <span className={styles.dot} style={{ background: colorForType(type) }} />
            {humanize(type)}
          </span>
          {tier && <span className={styles.metaChip}>{humanize(tier)}</span>}
          {weight != null && <span className={styles.metaChip}>weight {weight.toFixed(2)}</span>}
          {detail?.fixture && <span className={styles.fixtureChip}>fixture</span>}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </header>
      <h2 className={styles.sideTitle} tabIndex={-1} ref={headingRef}>
        {label}
      </h2>
      <p className={styles.sideId}>{id}</p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!detail && !error && <p className={styles.hint}>Loading…</p>}

      {node?.summary && <p className={styles.summary}>{node.summary}</p>}

      {(detail?.docHref || isHttp(node?.url) || node?.source_path) && (
        <div className={styles.sideLinks}>
          {detail?.docHref && (
            <Link href={detail.docHref} className={styles.sideLink}>
              Open brain doc →
            </Link>
          )}
          {isHttp(node?.url) && (
            <a href={node!.url!} className={styles.sideLink} target="_blank" rel="noopener noreferrer">
              Open source ↗
            </a>
          )}
          {node?.source_path && !detail?.docHref && <span className={styles.sidePath}>brain/{node.source_path}</span>}
        </div>
      )}

      {props.length > 0 && (
        <dl className={styles.props}>
          {props.map(([k, v]) => (
            <div key={k} className={styles.prop}>
              <dt>{humanize(k)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {mini.nodes.length > 1 && (
        <section className={styles.sideSection}>
          <h3 className={styles.sideSectionTitle}>Local graph · depth {Math.min(depth, 2)}</h3>
          <GraphCanvas
            variant="mini"
            nodes={mini.nodes}
            edges={mini.edges}
            selectedId={id}
            reducedMotion={reducedMotion}
            onNodeClick={(nid) => nid !== id && onSelect(nid)}
            positions={miniPositions.current}
            ariaLabel={`Local graph around ${label}: ${mini.nodes.length} nodes.`}
          />
        </section>
      )}

      {detail && <LinkGroups title="Outgoing links" links={detail.outgoing} onSelect={onSelect} />}
      {detail && <LinkGroups title="Backlinks" links={detail.incoming} onSelect={onSelect} />}

      {detail && detail.evidence.length > 0 && (
        <section className={styles.sideSection}>
          <h3 className={styles.sideSectionTitle}>Corpus evidence · {detail.evidence.length}</h3>
          <ul className={styles.evidenceList}>
            {detail.evidence.map((ev) => (
              <li key={`${ev.chunkId}-${ev.viaId}`} className={styles.evidence}>
                <div className={styles.evidenceHead}>
                  <span className={styles.evidenceSource}>{ev.sourceTitle ?? ev.viaLabel}</span>
                  {ev.tier && <span className={styles.metaChip}>{humanize(ev.tier)}</span>}
                  {ev.similarity != null && <span className={styles.metaChip}>sim {ev.similarity.toFixed(2)}</span>}
                </div>
                <blockquote className={styles.excerpt}>{ev.excerpt}</blockquote>
                <div className={styles.evidenceFoot}>
                  {ev.author && <span>{ev.author}</span>}
                  <button type="button" className={styles.linkButton} onClick={() => onSelect(ev.viaId)}>
                    via {ev.viaLabel}
                  </button>
                  {isHttp(ev.sourceUrl) && (
                    <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                      source ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail && detail.quotes.length > 0 && (
        <section className={styles.sideSection}>
          <h3 className={styles.sideSectionTitle}>Top quotes</h3>
          <ul className={styles.evidenceList}>
            {detail.quotes.map((q) => (
              <li key={q.id} className={styles.evidence}>
                <blockquote className={styles.excerpt}>{q.text ?? q.label}</blockquote>
                <div className={styles.evidenceFoot}>
                  {q.likes != null && <span>{q.likes.toLocaleString()} likes</span>}
                  {q.weight != null && <span>weight {q.weight.toFixed(2)}</span>}
                  <button type="button" className={styles.linkButton} onClick={() => onSelect(q.id)}>
                    open
                  </button>
                  {isHttp(q.url) && (
                    <a href={q.url} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                      source ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.sideSection}>
        <h3 className={styles.sideSectionTitle}>Notes for Claude</h3>
        {notesError ? (
          <p className={styles.hint}>{notesError}</p>
        ) : (
          <FeedbackThread
            rows={notes}
            compact
            onUpdated={(row) => setNotes((rs) => rs.map((r) => (r.id === row.id ? row : r)))}
            onDeleted={(rid) => setNotes((rs) => rs.filter((r) => r.id !== rid))}
          />
        )}
        <FeedbackComposer
          key={id}
          target={{ target_type: 'node', target_id: id }}
          context={`On ${humanize(type)}: ${label}`}
          onSaved={(row) => setNotes((rs) => [...rs, row])}
        />
      </section>
    </aside>
  );
}

function LinkGroups({ title, links, onSelect }: { title: string; links: NeighbourLink[]; onSelect: (id: string) => void }) {
  const groups = useMemo(() => groupLinks(links), [links]);
  if (!links.length) return null;
  return (
    <section className={styles.sideSection}>
      <h3 className={styles.sideSectionTitle}>
        {title} · {links.length}
      </h3>
      {groups.map(([edgeType, items]) => (
        <details key={edgeType} className={styles.linkGroup} open={items.length <= 12}>
          <summary className={styles.linkGroupHead}>
            {humanize(edgeType)} <span className={styles.legendCount}>{items.length}</span>
          </summary>
          <ul className={styles.linkList}>
            {items.slice(0, 80).map((l) => (
              <li key={`${l.direction}-${l.edgeType}-${l.id}`}>
                <button type="button" className={styles.linkItem} onClick={() => onSelect(l.id)}>
                  <span className={styles.dot} style={{ background: colorForType(l.type) }} />
                  <span className={styles.linkLabel}>{l.label}</span>
                  {l.similarity != null && <span className={styles.linkMeta}>{l.similarity.toFixed(2)}</span>}
                </button>
              </li>
            ))}
            {items.length > 80 && <li className={styles.hint}>+{items.length - 80} more</li>}
          </ul>
        </details>
      ))}
    </section>
  );
}
