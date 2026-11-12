'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Insight, InsightSourceKind } from '@/lib/content/any-to-any/types';
import admin from '@/app/admin/admin-layout.module.css';
import s from './insights.module.css';
import { createInsight, listInsights, PILLARS, SOURCE_KIND_LABELS } from './api';
import InsightForm from './InsightForm';
import ExtractFromArticle from './ExtractFromArticle';

const KINDS = Object.keys(SOURCE_KIND_LABELS) as InsightSourceKind[];

/** /admin/studio/insights: the insight bank, searchable and filterable, with "New" and "Extract from article". */
export default function InsightsView() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pillar, setPillar] = useState('');
  const [sourceKind, setSourceKind] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'new' | 'extract'>('none');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const list = await listInsights({ q: debounced, pillar, sourceKind, status, limit: 200 });
      setInsights(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load insights');
      setInsights([]);
    }
  }, [debounced, pillar, sourceKind, status]);

  useEffect(() => {
    let live = true;
    listInsights({ q: debounced, pillar, sourceKind, status, limit: 200 })
      .then((list) => { if (live) { setInsights(list); setError(null); } })
      .catch((e) => { if (live) { setError(e instanceof Error ? e.message : 'Could not load insights'); setInsights([]); } });
    return () => { live = false; };
  }, [debounced, pillar, sourceKind, status]);

  return (
    <div>
      <div className={admin.pageHeader}>
        <h1 className={admin.pageTitle}>Insights</h1>
        <p className={admin.pageDescription}>
          One idea Austin said or wrote, with its source. Every piece and post carries one, so any asset can become any other.
        </p>
      </div>

      <div className={s.toolbar}>
        <input type="search" className={admin.formInput} placeholder="Search lines, claims, notes, sources" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search insights" />
        <select className={s.select} value={pillar} onChange={(e) => setPillar(e.target.value)} aria-label="Pillar">
          <option value="">All pillars</option>
          {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={s.select} value={sourceKind} onChange={(e) => setSourceKind(e.target.value)} aria-label="Source kind">
          <option value="">All sources</option>
          {KINDS.map((k) => <option key={k} value={k}>{SOURCE_KIND_LABELS[k]}</option>)}
        </select>
        <select className={s.select} value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'archived')} aria-label="Status">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <span className={s.spacer} />
        <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={() => setMode(mode === 'extract' ? 'none' : 'extract')}>Extract from article</button>
        <button type="button" className={`${admin.btn} ${admin.btnPrimary} ${admin.btnSmall}`} onClick={() => setMode(mode === 'new' ? 'none' : 'new')}>New insight</button>
      </div>

      {notice && <p className={s.muted} role="status">{notice}</p>}

      {mode === 'new' && (
        <div className={s.panel}>
          <h2 className={s.panelTitle}>New insight</h2>
          <InsightForm
            onCancel={() => setMode('none')}
            onSubmit={async (input) => {
              await createInsight(input);
              setMode('none');
              setNotice('Insight saved.');
              await load();
            }}
          />
        </div>
      )}
      {mode === 'extract' && (
        <ExtractFromArticle
          onClose={() => setMode('none')}
          onSaved={async (count) => {
            setMode('none');
            setNotice(`${count} insight${count === 1 ? '' : 's'} saved from the article.`);
            await load();
          }}
        />
      )}

      {error && <p className={s.error} role="alert">{error}</p>}
      {insights === null ? (
        <p className={s.muted}>Loading…</p>
      ) : insights.length === 0 ? (
        <div className={admin.emptyState}>
          <p className={admin.emptyTitle}>No insights yet</p>
          <p className={admin.emptyDescription}>Extract them from a published article, or add one by hand.</p>
        </div>
      ) : (
        <div className={s.list}>
          {insights.map((i) => (
            <Link key={i.id} href={`/admin/studio/insights/${i.id}`} className={s.row}>
              <p className={s.line}>{i.line}</p>
              <div className={s.meta}>
                <span className={`${s.tag} ${s.tagPrimary}`}>{SOURCE_KIND_LABELS[i.source_kind] ?? i.source_kind}</span>
                {i.pillar && <span className={s.tag}>{i.pillar}</span>}
                {i.cluster && <span className={s.tag}>Cluster {i.cluster}</span>}
                {i.claim && <span className={s.tag}>Claim</span>}
                {i.source_ref && <span>{i.source_ref}</span>}
                {i.tags.map((t) => <span key={t}>#{t}</span>)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
