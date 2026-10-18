'use client';

/**
 * Drill-down for one topic: what it is, the six scores with a one-line "why" each,
 * the audience's own words, the problems behind it with top quotes, claims with
 * evidence strength, assets (LIVE / BUILT / TO BUILD), competitors as context,
 * the products it routes to, its queue position and Austin's comments.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import {
  INTENT_LABEL,
  LEVEL_LABEL,
  METRIC_INFO,
  SCORE_KEYS,
  STATUS_INFO,
  graphHref,
  rampColor,
  scoreWhy,
  topicApiPath,
  whyNow,
  type TopicNode,
  type TopicPayload,
} from '@/lib/brain/topical-map-view';
import { FeedbackComposer, FeedbackThread } from '../Feedback';
import styles from './map.module.css';

const isHttp = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);
const isLocal = (u: string | null | undefined): u is string => !!u && u.startsWith('/') && !u.startsWith('//');

function evidenceGrade(sim: number | null): { label: string; cls: string } {
  if (sim == null) return { label: 'unmatched', cls: styles.gradeThin };
  if (sim >= 0.8) return { label: `strong · ${sim.toFixed(2)}`, cls: styles.gradeStrong };
  if (sim >= 0.65) return { label: `medium · ${sim.toFixed(2)}`, cls: styles.gradeMedium };
  return { label: `thin · ${sim.toFixed(2)}`, cls: styles.gradeThin };
}

export function StatusChip({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls = s === 'LIVE' ? styles.statusLive : s === 'BUILT' ? styles.statusBuilt : s === 'TO BUILD' ? styles.statusToBuild : styles.statusNone;
  const label = s in STATUS_INFO ? STATUS_INFO[s as TopicNode['status']].label : status;
  return <span className={`${styles.statusChip} ${cls}`}>{label}</span>;
}

interface Props {
  id: string;
  lite: TopicNode | null;
  onClose: () => void;
}

export function TopicPanel({ id, lite, onClose }: Props) {
  const [detail, setDetail] = useState<TopicPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<BrainFeedbackRow[]>([]);
  const [notesError, setNotesError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The parent keys this panel by id, so state starts fresh for each topic.
    const ctrl = new AbortController();
    fetch(topicApiPath(id), { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as TopicPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || `Load failed (${res.status})`);
        setDetail(json);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Load failed');
      });
    fetch(`/api/admin/brain/feedback?target_type=node&target_id=${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { rows?: BrainFeedbackRow[]; error?: string };
        if (!res.ok) throw new Error(json.error || `Comments unavailable (${res.status})`);
        setNotes(json.rows ?? []);
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) setNotesError(err instanceof Error ? err.message : 'Comments unavailable');
      });
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [id]);

  const n: TopicNode | null = detail ?? lite;
  const label = n?.label ?? id;

  return (
    <aside className={styles.panel} aria-label={`Topic: ${label}`}>
      <header className={styles.panelHead}>
        <div className={styles.chipRow}>
          {n && <span className={styles.metaChip}>{LEVEL_LABEL[n.level]}</span>}
          {n && <span className={styles.metaChip}>{n.pillarCode}</span>}
          {n && <StatusChip status={n.status} />}
          {n && <span className={styles.metaChip}>{INTENT_LABEL[n.intent] ?? n.intent}</span>}
          {detail?.fixture && <span className={styles.fixtureChip}>fixture</span>}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close topic">
          ×
        </button>
      </header>

      <h2 className={styles.panelTitle} tabIndex={-1} ref={headingRef}>
        {label}
      </h2>
      {n?.summary && <p className={styles.summary}>{n.summary}</p>}

      {n && (
        <p className={styles.whyLine}>
          <span className={styles.whyTag}>Why it matters</span>
          {detail?.queuePosition != null ? `Number ${detail.queuePosition} to make next. ` : ''}
          {whyNow(n)}
        </p>
      )}

      <div className={styles.linkRow}>
        <Link href={graphHref(id)} className={styles.textLink}>
          Open in graph →
        </Link>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!detail && !error && <p className={styles.hint}>Loading the scorecard…</p>}

      {n && (
        <section className={styles.section} aria-label="Scores">
          <h3 className={styles.sectionTitle}>Scores, 0 to 100</h3>
          <ul className={styles.scoreList}>
            {SCORE_KEYS.map((k) => {
              const v = Math.round(n.scores[k] ?? 0);
              return (
                <li key={k} className={styles.score}>
                  <div className={styles.scoreHead}>
                    <span>{METRIC_INFO[k].label}</span>
                    <span className={styles.scoreValue}>{v}</span>
                  </div>
                  <div className={styles.bar} role="img" aria-label={`${METRIC_INFO[k].label} ${v} of 100`}>
                    <span style={{ width: `${Math.max(1.5, v)}%`, background: rampColor(v) }} />
                  </div>
                  <p className={styles.scoreWhy}>{detail ? scoreWhy(k, detail) : METRIC_INFO[k].definition}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {detail && detail.queries.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Their words · {detail.queries.length}</h3>
          <p className={styles.hint}>What people type and say, strongest signal first.</p>
          <ul className={styles.queryList}>
            {[...detail.queries]
              .sort((a, b) => b.signal - a.signal)
              .slice(0, 12)
              .map((q, i) => (
                <li key={`${q.text}-${i}`} className={styles.query}>
                  <span className={styles.queryText}>&ldquo;{q.text}&rdquo;</span>
                  <span className={styles.queryMeta}>{q.sources.join(', ')}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {detail && detail.problems.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Problems behind it</h3>
          <ul className={styles.cardList}>
            {detail.problems.map((p) => (
              <li key={p.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>{p.label}</span>
                  <span className={styles.metaChip}>{p.quoteCount.toLocaleString()} quotes</span>
                </div>
                {p.topQuotes.slice(0, 3).map((q, i) => (
                  <figure key={i} className={styles.quote}>
                    <blockquote>{q.text}</blockquote>
                    <figcaption>
                      {q.source}
                      {q.likes ? ` · ${q.likes.toLocaleString()} likes` : ''}
                    </figcaption>
                  </figure>
                ))}
              </li>
            ))}
          </ul>
          <p className={styles.hint}>Likes show attention, not agreement.</p>
        </section>
      )}

      {detail && detail.claims.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Claims and evidence</h3>
          <ul className={styles.cardList}>
            {detail.claims.map((c) => {
              const g = evidenceGrade(c.bestSimilarity);
              return (
                <li key={c.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}>{c.label}</span>
                    <span className={`${styles.grade} ${g.cls}`}>{g.label}</span>
                  </div>
                  <span className={styles.queryMeta}>{c.tier}</span>
                  {c.excerpt && <blockquote className={styles.excerpt}>{c.excerpt}</blockquote>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {detail && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Assets</h3>
          {detail.assets.length === 0 ? (
            <p className={styles.hint}>Nothing made or planned on this topic yet.</p>
          ) : (
            <ul className={styles.rowList}>
              {detail.assets.map((a, i) => (
                <li key={`${a.kind}-${a.ref}-${i}`} className={styles.row}>
                  <StatusChip status={a.status} />
                  <span className={styles.rowKind}>{a.kind}</span>
                  {isLocal(a.href) ? (
                    <Link href={a.href} className={styles.textLink}>
                      {a.ref}
                    </Link>
                  ) : isHttp(a.href) ? (
                    <a href={a.href} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                      {a.ref} ↗
                    </a>
                  ) : (
                    <span className={styles.rowLabel}>{a.ref}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {detail && detail.products.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Routes to</h3>
          <ul className={styles.rowList}>
            {detail.products.map((p) => (
              <li key={p.id} className={styles.row}>
                <span className={styles.rowLabel}>{p.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail && detail.competitors.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Who else covers it (context)</h3>
          <ul className={styles.rowList}>
            {detail.competitors.map((c) => (
              <li key={c.id} className={styles.row}>
                {isHttp(c.url) ? (
                  <a href={c.url} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                    {c.label} ↗
                  </a>
                ) : (
                  <span className={styles.rowLabel}>{c.label}</span>
                )}
                {c.outlier != null && <span className={styles.queryMeta}>best video {c.outlier.toFixed(1)} times their usual views</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail?.notes && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Notes</h3>
          <p className={styles.summary}>{detail.notes}</p>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Comments for Claude</h3>
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
          context={`On the topic: ${label}`}
          onSaved={(row) => setNotes((rs) => [...rs, row])}
        />
      </section>
    </aside>
  );
}
