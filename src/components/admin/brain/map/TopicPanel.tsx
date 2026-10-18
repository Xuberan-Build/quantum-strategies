'use client';

/**
 * Drill-down for one topic: where it sits, what it is, the six scores with a one-line
 * "why" each, the audience's own words, the problems behind it (share + top quotes),
 * claims with their graded strength and the corpus passages behind them, assets
 * (LIVE / BUILT / TO BUILD / internal), competitors as context, the products it
 * routes to (status + fit), its queue position and Austin's comments.
 *
 * Renders the data layer's TopicScorecard as-is (src/lib/brain/topical-map.ts).
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { BrainFeedbackRow } from '@/lib/brain/feedback';
import {
  CHANNELS,
  CHANNEL_INFO,
  INTENT_LABEL,
  LEVEL_LABEL,
  METRIC_INFO,
  QUERY_SOURCE_LABEL,
  SCORE_KEYS,
  STANCE_LABEL,
  STATUS_INFO,
  assetState,
  audienceWhy,
  bestChannel,
  channelWhy,
  graphHref,
  headTermWhy,
  rampColor,
  scoreWhy,
  searchWhy,
  topicApiPath,
  whyNow,
  type TopicNode,
  type TopicPayload,
} from '@/lib/brain/topical-map-view';
import { FeedbackComposer, FeedbackThread } from '../Feedback';
import styles from './map.module.css';

const isHttp = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);
const isLocal = (u: string | null | undefined): u is string => !!u && u.startsWith('/') && !u.startsWith('//');

/** Chip for a claim's graded strength (Strong / Moderate / Weak / Model / Myth from the claim register). */
function strengthGrade(strength: string | null): { label: string; cls: string } {
  if (!strength) return { label: 'ungraded', cls: styles.gradeThin };
  const s = strength.toLowerCase();
  if (s.startsWith('strong')) return { label: strength, cls: styles.gradeStrong };
  if (s.startsWith('moderate')) return { label: strength, cls: styles.gradeMedium };
  return { label: strength, cls: styles.gradeThin };
}

const clip = (text: string, max = 280) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const pctOf = (v: number) => `${Math.round(v * 100)}%`;
const SOURCE_NAME: Record<string, string> = { youtube: 'YouTube', forum: 'a forum', reddit: 'Reddit' };

export function StatusChip({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls = s === 'LIVE' ? styles.statusLive : s === 'BUILT' ? styles.statusBuilt : s === 'TO BUILD' ? styles.statusToBuild : styles.statusNone;
  const label = s === 'INTERNAL' ? 'Internal' : s in STATUS_INFO ? STATUS_INFO[s as TopicNode['status']].label : status;
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

  const n: TopicNode | null = detail?.topic ?? lite;
  const label = n?.label ?? id;
  const stance = n?.stance ? STANCE_LABEL[n.stance] : null;
  const queuePosition = detail?.queue.position ?? null;

  return (
    <aside className={styles.panel} aria-label={`Topic: ${label}`}>
      <header className={styles.panelHead}>
        <div className={styles.chipRow}>
          {n && <span className={styles.metaChip}>{LEVEL_LABEL[n.level]}</span>}
          {n && <span className={styles.metaChip}>{n.pillarCode}</span>}
          {n && <StatusChip status={n.status} />}
          {n && <span className={styles.metaChip}>{INTENT_LABEL[n.intent] ?? n.intent}</span>}
          {stance && <span className={styles.metaChip}>{stance}</span>}
          {detail?.fixture && <span className={styles.fixtureChip}>fixture</span>}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close topic">
          ×
        </button>
      </header>

      {detail && detail.breadcrumb.length > 0 && (
        <p className={styles.hint}>{detail.breadcrumb.map((b) => b.label).join(' › ')}</p>
      )}
      <h2 className={styles.panelTitle} tabIndex={-1} ref={headingRef}>
        {label}
      </h2>
      {n?.summary && <p className={styles.summary}>{n.summary}</p>}

      {n && (
        <p className={styles.whyLine}>
          <span className={styles.whyTag}>Why it matters</span>
          {queuePosition != null ? `Number ${queuePosition} of ${detail?.queue.size} to make next. ` : ''}
          {whyNow(n)}
        </p>
      )}
      {n?.reasons?.placement && <p className={styles.hint}>Why it sits here: {n.reasons.placement}.</p>}

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

      {n && n.searchVolume !== undefined && (
        <section className={styles.section} aria-label="Search and audience demand">
          <h3 className={styles.sectionTitle}>Searched and said</h3>
          <p className={styles.hint}>
            Search is what people type into Google (Keyword Planner, US, monthly, Oct 2025 to Sep 2026). Audience is what they say in comments and posts.
          </p>
          <ul className={styles.scoreList}>
            {(['searchDemand', 'audienceDemand'] as const).map((k) => {
              const v = Math.round(n.scores[k] ?? 0);
              return (
                <li key={k} className={styles.score}>
                  <div className={styles.scoreHead}>
                    <span>{METRIC_INFO[k].label}</span>
                    <span className={styles.scoreValue}>{k === 'searchDemand' ? `${(n.searchVolume ?? 0).toLocaleString('en-US')}/mo · ${v}` : v}</span>
                  </div>
                  <div className={styles.bar} role="img" aria-label={`${METRIC_INFO[k].label} ${v} of 100`}>
                    <span style={{ width: `${Math.max(1.5, v)}%`, background: rampColor(v) }} />
                  </div>
                  <p className={styles.scoreWhy}>{k === 'searchDemand' ? searchWhy(n) : audienceWhy(n)}</p>
                </li>
              );
            })}
          </ul>
          {headTermWhy(n) && (
            <p className={styles.whyLine}>
              <span className={styles.whyTag}>Title and hook</span>
              {headTermWhy(n)}
            </p>
          )}
          {n.channelFit && (
            <>
              <h3 className={styles.sectionTitle}>Channel fit, 0 to 100</h3>
              <ul className={styles.scoreList}>
                {CHANNELS.map((c) => {
                  const v = Math.round(n.channelFit![c]);
                  return (
                    <li key={c} className={styles.score}>
                      <div className={styles.scoreHead}>
                        <span>
                          {CHANNEL_INFO[c].label}
                          {bestChannel(n) === c ? ' · best fit' : ''}
                        </span>
                        <span className={styles.scoreValue}>{v}</span>
                      </div>
                      <div className={styles.bar} role="img" aria-label={`${CHANNEL_INFO[c].label} fit ${v} of 100`}>
                        <span style={{ width: `${Math.max(1.5, v)}%`, background: rampColor(v) }} />
                      </div>
                      <p className={styles.scoreWhy}>{CHANNEL_INFO[c].definition}</p>
                    </li>
                  );
                })}
              </ul>
              {channelWhy(n) && <p className={styles.hint}>{channelWhy(n)}</p>}
            </>
          )}
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
                  <span className={styles.queryMeta}>
                    {q.sources.map((src) => QUERY_SOURCE_LABEL[src] ?? src).join(', ')}
                    {typeof q.volume === 'number' ? ` · ${q.volume.toLocaleString('en-US')} Google searches a month` : ''}
                  </span>
                </li>
              ))}
          </ul>
          {n?.audienceWords && n.audienceWords.length > 0 && (
            <>
              <p className={styles.hint}>In their own words:</p>
              {n.audienceWords.slice(0, 4).map((w, i) => (
                <blockquote key={i} className={styles.excerpt}>
                  {w}
                </blockquote>
              ))}
            </>
          )}
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
                  {p.quoteCount != null && <span className={styles.metaChip}>{p.quoteCount.toLocaleString()} quotes</span>}
                </div>
                {p.share != null && <span className={styles.queryMeta}>{pctOf(p.share)} of this problem&rsquo;s audience lands on this topic</span>}
                {p.quotes.slice(0, 3).map((q, i) => (
                  <figure key={i} className={styles.quote}>
                    <blockquote>{clip(q.text)}</blockquote>
                    <figcaption>
                      {isHttp(q.url) ? (
                        <a href={q.url} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                          {SOURCE_NAME[q.source ?? ''] ?? q.source ?? 'source'} ↗
                        </a>
                      ) : (
                        (SOURCE_NAME[q.source ?? ''] ?? q.source ?? 'source')
                      )}
                      {q.likes ? ` · ${q.likes.toLocaleString()} likes` : ''}
                    </figcaption>
                  </figure>
                ))}
              </li>
            ))}
          </ul>
          <p className={styles.hint}>Likes show attention, not agreement. The share is how much of the problem&rsquo;s audience this topic answers.</p>
        </section>
      )}

      {detail && (detail.claims.length > 0 || detail.evidence.length > 0) && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Claims and evidence</h3>
          <p className={styles.hint}>
            Strength is the claim&rsquo;s grade in the claim register. The match is how close the nearest corpus passage sits to it (1.00 is identical).
          </p>
          <ul className={styles.cardList}>
            {detail.claims.map((c) => {
              const g = strengthGrade(c.strength);
              return (
                <li key={c.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}>{c.label}</span>
                    <span className={`${styles.grade} ${g.cls}`}>{g.label}</span>
                  </div>
                  <span className={styles.queryMeta}>
                    {[c.tier && `tier ${c.tier}`, c.similarity != null ? `closest match ${c.similarity.toFixed(2)}` : 'no corpus match yet', c.via && `linked by ${c.via}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {c.evidence.slice(0, 2).map((e) => (
                    <figure key={e.chunkId} className={styles.quote}>
                      <blockquote>{clip(e.content)}</blockquote>
                      <figcaption>
                        {isHttp(e.url) ? (
                          <a href={e.url} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                            {e.source} ↗
                          </a>
                        ) : (
                          e.source
                        )}
                        {e.similarity != null ? ` · match ${e.similarity.toFixed(2)}` : ''}
                        {e.tier ? ` · ${e.tier}` : ''}
                      </figcaption>
                    </figure>
                  ))}
                </li>
              );
            })}
            {detail.evidence.map((e, i) => (
              <li key={`own-${i}`} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Closest corpus passage to the topic itself</span>
                  {e.similarity != null && <span className={`${styles.grade} ${styles.gradeThin}`}>match {e.similarity.toFixed(2)}</span>}
                </div>
                <blockquote className={styles.excerpt}>{clip(e.label)}</blockquote>
                {e.source && <span className={styles.queryMeta}>{e.source}</span>}
              </li>
            ))}
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
                  <StatusChip status={assetState(a)} />
                  <span className={styles.rowKind}>{a.kind}</span>
                  {isLocal(a.href) ? (
                    <Link href={a.href} className={styles.textLink}>
                      {a.label ?? a.ref}
                    </Link>
                  ) : isHttp(a.href) ? (
                    <a href={a.href} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                      {a.label ?? a.ref} ↗
                    </a>
                  ) : (
                    <span className={styles.rowLabel}>{a.label ?? a.ref}</span>
                  )}
                  {a.detail && assetState(a) !== 'INTERNAL' && <span className={styles.queryMeta}>{a.detail}</span>}
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
                {p.status && <StatusChip status={p.status} />}
                <span className={styles.rowLabel}>{p.label}</span>
                {p.fit != null && <span className={styles.queryMeta}>fit {pctOf(p.fit)}</span>}
                {p.via && <span className={styles.queryMeta}>{p.via}</span>}
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
              <li key={c.creatorId} className={styles.row}>
                {isHttp(c.url) ? (
                  <a href={c.url} className={styles.textLink} target="_blank" rel="noopener noreferrer">
                    {c.label} ↗
                  </a>
                ) : (
                  <span className={styles.rowLabel}>{c.label}</span>
                )}
                <span className={styles.queryMeta}>overlap {pctOf(c.weight)}</span>
                {c.outlier != null && <span className={styles.queryMeta}>best video {c.outlier.toFixed(1)} times their usual views</span>}
                {c.via && <span className={styles.queryMeta}>{c.via}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail?.topic.notes && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Builder notes</h3>
          <p className={styles.summary}>{detail.topic.notes}</p>
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
