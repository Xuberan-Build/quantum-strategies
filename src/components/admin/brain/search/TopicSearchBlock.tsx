'use client';

/**
 * "Search performance" block for the topical map's topic panel: where the topic's head term ranks on Google,
 * and the clicks and impressions of every query mapped to the topic, over the last 28 days of Search Console
 * data. Renders nothing until Search Console has data (the API answers 204).
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TopicSearchPerformance } from '@/lib/seo/search-report';
import mapStyles from '../map/map.module.css';
import s from './search.module.css';

const fmt = (n: number) => n.toLocaleString('en-US');

export function TopicSearchBlock({ id }: { id: string }) {
  const [perf, setPerf] = useState<TopicSearchPerformance | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/admin/brain/search/topic/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(async (res) => (res.status === 200 ? ((await res.json()) as TopicSearchPerformance) : null))
      .then((json) => {
        if (!ctrl.signal.aborted) setPerf(json);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [id]);

  if (!perf?.period) return null;
  const h = perf.headTerm;

  return (
    <section className={mapStyles.section} aria-label="Search performance">
      <h3 className={mapStyles.sectionTitle}>Search performance</h3>
      <p className={mapStyles.hint}>
        Google Search Console, {perf.period.startDate} to {perf.period.endDate}. Every query mapped to this topic counts.
      </p>
      <div className={s.perfGrid}>
        <div className={s.perfCell}>
          <div className={s.perfLabel}>Clicks</div>
          <div className={s.perfValue}>{fmt(perf.clicks)}</div>
        </div>
        <div className={s.perfCell}>
          <div className={s.perfLabel}>Impressions</div>
          <div className={s.perfValue}>{fmt(perf.impressions)}</div>
        </div>
        <div className={s.perfCell}>
          <div className={s.perfLabel}>Avg position</div>
          <div className={s.perfValue}>{perf.position === null ? '–' : perf.position.toFixed(1)}</div>
        </div>
      </div>
      {h && (
        <p className={mapStyles.whyLine}>
          <span className={mapStyles.whyTag}>Head term</span>
          &ldquo;{h.text}&rdquo; ({fmt(h.volume)} searches a month):{' '}
          {h.position === null
            ? 'not ranking yet. No impressions for the exact phrase in this period.'
            : `position ${h.position.toFixed(1)}, ${fmt(h.impressions)} impressions, ${fmt(h.clicks)} clicks.`}
        </p>
      )}
      {perf.topQueries.length > 0 && (
        <ul className={mapStyles.queryList}>
          {perf.topQueries.map((q) => (
            <li key={q.query} className={mapStyles.query}>
              <span className={mapStyles.queryText}>&ldquo;{q.query}&rdquo;</span>
              <span className={mapStyles.queryMeta}>
                position {q.position === null ? '–' : q.position.toFixed(1)} · {fmt(q.impressions)} impressions · {fmt(q.clicks)} clicks
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className={mapStyles.linkRow}>
        <Link href="/admin/brain/search" className={mapStyles.textLink}>
          All keywords and pages →
        </Link>
      </div>
    </section>
  );
}
