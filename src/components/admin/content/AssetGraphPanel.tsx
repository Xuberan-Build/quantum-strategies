'use client';

/**
 * Reusable "Made from / Made into" panel for any asset (article, piece, social post, insight, external url).
 * Fetches /api/admin/content/assets/graph and, for pieces and publisher posts, lets you attach an insight.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AssetRef, Insight } from '@/lib/content/any-to-any/types';
import type { AssetGraph, GraphEdge } from '@/lib/content/any-to-any/graph';
import { pieceTypeLabel } from '@/lib/content/calendar';
import admin from '@/app/admin/admin-layout.module.css';
import s from './insights/insights.module.css';
import { getAssetGraph, listInsights, setAssetInsight, unlinkAssets } from './insights/api';

const KIND_LABEL: Record<string, string> = { article: 'Article', piece: 'Piece', social_post: 'Post', insight: 'Insight', external: 'External' };

function EdgeRow({ edge, onUnlink }: { edge: GraphEdge; onUnlink: (linkId: string) => void }) {
  const a = edge.asset;
  const label = a.kind === 'piece' ? pieceTypeLabel(a.type) : a.kind === 'social_post' && a.form ? pieceTypeLabel(a.form) : KIND_LABEL[a.kind] ?? a.kind;
  return (
    <div className={s.assetRow}>
      <span className={s.tag}>{label}</span>
      {a.href ? (
        a.kind === 'external'
          ? <a className={s.assetTitle} href={a.href} target="_blank" rel="noreferrer">{a.title}</a>
          : <Link className={s.assetTitle} href={a.href}>{a.title}</Link>
      ) : <span className={s.assetTitle}>{a.title}</span>}
      {a.platforms.length > 0 && <span className={s.muted}>{a.platforms.join(', ')}</span>}
      {a.status && <span className={`${admin.badge} ${a.status === 'published' ? admin.badgeSuccess : admin.badgeNeutral}`}>{a.status}</span>}
      {edge.direction && <span className={s.muted}>{edge.direction}</span>}
      {edge.linkId
        ? <button type="button" className={s.linkBtn} onClick={() => onUnlink(edge.linkId!)}>Unlink</button>
        : <span className={s.muted} title="Recorded on the row itself (source article or calendar piece)">built in</span>}
    </div>
  );
}

function InsightPicker({ onPick, onCancel }: { onPick: (insight: Insight) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      listInsights({ q, limit: 20 }).then(setResults).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div className={s.toolbar} style={{ marginBottom: 0 }}>
        <input type="search" className={admin.formInput} placeholder="Search insights" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search insights to attach" autoFocus />
        <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={onCancel}>Cancel</button>
      </div>
      {error && <p className={s.error}>{error}</p>}
      <div className={s.pickerList}>
        {results === null && <span className={s.muted}>Searching…</span>}
        {results?.length === 0 && <span className={s.muted}>No matches. Add one in <Link href="/admin/studio/insights">Insights</Link>.</span>}
        {results?.map((i) => (
          <button key={i.id} type="button" className={s.pickerItem} onClick={() => onPick(i)}>{i.line}</button>
        ))}
      </div>
    </div>
  );
}

export default function AssetGraphPanel({ asset, title = 'Made from / made into' }: { asset: AssetRef; title?: string }) {
  const [graph, setGraph] = useState<AssetGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setGraph(await getAssetGraph(asset));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the asset graph');
    }
  }, [asset.kind, asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const canCarry = asset.kind === 'piece' || asset.kind === 'social_post';

  async function attach(insightId: string | null) {
    setBusy(true);
    try {
      await setAssetInsight(asset, insightId);
      setPicking(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attach the insight');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(linkId: string) {
    try {
      await unlinkAssets(linkId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not unlink');
    }
  }

  return (
    <section className={s.panel} aria-label={title}>
      <h2 className={s.panelTitle}>{title}</h2>
      {error && <p className={s.error} role="alert">{error}</p>}
      {!graph ? (
        !error && <p className={s.muted}>Loading…</p>
      ) : (
        <>
          {asset.kind !== 'insight' && (
            <div className={s.meta} style={{ marginTop: 0, fontSize: '0.8125rem' }}>
              <span>Insight:</span>
              {graph.insight ? (
                <Link className={s.chip} href={`/admin/studio/insights/${graph.insight.id}`}>{graph.insight.line}</Link>
              ) : (
                <span className={s.muted}>none</span>
              )}
              {canCarry && !picking && (
                <>
                  <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={() => setPicking(true)} disabled={busy}>
                    {graph.insight ? 'Change' : 'Attach insight'}
                  </button>
                  {graph.insight && <button type="button" className={s.linkBtn} onClick={() => attach(null)} disabled={busy}>Detach</button>}
                </>
              )}
            </div>
          )}
          {picking && <InsightPicker onPick={(i) => attach(i.id)} onCancel={() => setPicking(false)} />}

          <div className={s.group}>
            <h3 className={s.groupTitle}>Made from ({graph.parents.length})</h3>
            {graph.parents.length === 0 ? <p className={s.muted}>Nothing recorded.</p> : graph.parents.map((e) => <EdgeRow key={`${e.asset.kind}:${e.asset.id}`} edge={e} onUnlink={unlink} />)}
          </div>
          <div className={s.group}>
            <h3 className={s.groupTitle}>Made into ({graph.children.length})</h3>
            {graph.children.length === 0 ? <p className={s.muted}>Nothing yet.</p> : graph.children.map((e) => <EdgeRow key={`${e.asset.kind}:${e.asset.id}`} edge={e} onUnlink={unlink} />)}
          </div>
        </>
      )}
    </section>
  );
}
