'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Insight } from '@/lib/content/any-to-any/types';
import { formRelation, sourceFormForInsight, type ResolvedAsset } from '@/lib/content/any-to-any/graph';
import { pieceTypeLabel } from '@/lib/content/calendar';
import MakeFromThis from '@/components/admin/content/MakeFromThis';
import admin from '@/app/admin/admin-layout.module.css';
import s from './insights.module.css';
import { archiveInsight, getInsight, SOURCE_KIND_LABELS, updateInsight, type InsightAssets } from './api';
import InsightForm from './InsightForm';

type Carried = ResolvedAsset & { via: 'insight_id' | 'link'; direction?: string | null };

const KIND_LABEL: Record<string, string> = { article: 'Article', piece: 'Calendar piece', social_post: 'Publisher post', insight: 'Insight', external: 'External' };

function typeLabel(a: ResolvedAsset): string {
  if (a.kind === 'piece') return pieceTypeLabel(a.type);
  if (a.kind === 'social_post' && a.form) return pieceTypeLabel(a.form);
  return KIND_LABEL[a.kind] ?? a.kind;
}

/** Every asset carrying the insight, deduped (insight_id first, then link edges), excluding the insight and its source article. */
function carriedAssets(insight: Insight, assets: InsightAssets): Carried[] {
  const seen = new Set<string>([`insight:${insight.id}`]);
  if (insight.source_post_id) seen.add(`article:${insight.source_post_id}`);
  const out: Carried[] = [];
  const add = (a: ResolvedAsset, via: Carried['via'], direction?: string | null) => {
    const key = `${a.kind}:${a.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...a, via, direction });
  };
  assets.pieces.forEach((a) => add(a, 'insight_id'));
  assets.socialPosts.forEach((a) => add(a, 'insight_id'));
  for (const l of assets.links) {
    add(l.from, 'link', l.link.direction);
    add(l.to, 'link', l.link.direction);
  }
  return out;
}

function AssetRow({ a }: { a: Carried }) {
  return (
    <div className={s.assetRow}>
      <span className={s.tag}>{typeLabel(a)}</span>
      {a.href ? (
        a.kind === 'external'
          ? <a className={s.assetTitle} href={a.href} target="_blank" rel="noreferrer">{a.title}</a>
          : <Link className={s.assetTitle} href={a.href}>{a.title}</Link>
      ) : <span className={s.assetTitle}>{a.title}</span>}
      {a.platforms.length > 0 && <span className={s.muted}>{a.platforms.join(', ')}</span>}
      {a.status && <span className={`${admin.badge} ${a.status === 'published' ? admin.badgeSuccess : admin.badgeNeutral}`}>{a.status}</span>}
      {a.via === 'link' && <span className={s.muted}>linked{a.direction ? ` (${a.direction})` : ''}</span>}
    </div>
  );
}

export default function InsightDetail({ id }: { id: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [assets, setAssets] = useState<InsightAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getInsight(id);
      setInsight(r.insight);
      setAssets(r.assets);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the insight');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const sourceForm = insight ? sourceFormForInsight(insight) : null;
  const groups = useMemo(() => {
    if (!insight || !assets) return null;
    const all = carriedAssets(insight, assets);
    const g = { longer: [] as Carried[], same: [] as Carried[], shorter: [] as Carried[], other: [] as Carried[] };
    for (const a of all) {
      const rel = formRelation(sourceForm, a.form);
      (rel ? g[rel] : g.other).push(a);
    }
    return { all, ...g };
  }, [insight, assets, sourceForm]);

  async function toggleArchive() {
    if (!insight) return;
    setBusy(true);
    try {
      setInsight(insight.status === 'active' ? await archiveInsight(insight.id) : await updateInsight(insight.id, { status: 'active' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  if (error && !insight) {
    return (
      <div>
        <p className={s.error} role="alert">{error}</p>
        <Link href="/admin/studio/insights" className={admin.backLink}>Back to insights</Link>
      </div>
    );
  }
  if (!insight || !groups || !assets) return <p className={s.muted}>Loading…</p>;

  const source = assets.source;
  const section = (title: string, list: Carried[]) =>
    list.length > 0 && (
      <div className={s.group}>
        <h3 className={s.groupTitle}>{title} ({list.length})</h3>
        {list.map((a) => <AssetRow key={`${a.kind}:${a.id}`} a={a} />)}
      </div>
    );

  return (
    <div>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href="/admin/studio/insights" className={s.muted}>← All insights</Link>
      </p>

      <div className={s.panel}>
        {editing ? (
          <InsightForm
            initial={insight}
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              setInsight(await updateInsight(insight.id, input));
              setEditing(false);
            }}
          />
        ) : (
          <>
            <p className={s.line} style={{ fontSize: '1.125rem', fontWeight: 600 }}>{insight.line}</p>
            <div className={s.meta}>
              <span className={`${s.tag} ${s.tagPrimary}`}>{SOURCE_KIND_LABELS[insight.source_kind] ?? insight.source_kind}</span>
              {insight.pillar && <span className={s.tag}>{insight.pillar}</span>}
              {insight.cluster && <span className={s.tag}>Cluster {insight.cluster}</span>}
              {insight.status === 'archived' && <span className={`${admin.badge} ${admin.badgeWarning}`}>archived</span>}
              {insight.tags.map((t) => <span key={t}>#{t}</span>)}
            </div>
            <dl style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', display: 'grid', gap: '0.375rem' }}>
              <div>
                <dt className={s.muted} style={{ display: 'inline' }}>Source: </dt>
                <dd style={{ display: 'inline', margin: 0 }}>
                  {source ? <Link href={source.href ?? '#'}>{source.title}</Link> : null}
                  {source && insight.source_ref ? ' · ' : null}
                  {insight.source_ref ?? (source ? null : 'not recorded')}
                </dd>
              </div>
              {insight.claim && (
                <div>
                  <dt className={s.muted} style={{ display: 'inline' }}>Claim: </dt>
                  <dd style={{ display: 'inline', margin: 0 }}>{insight.claim}{insight.evidence_tier ? ` (tier ${insight.evidence_tier})` : ''}</dd>
                </div>
              )}
              {insight.notes && (
                <div>
                  <dt className={s.muted} style={{ display: 'inline' }}>Notes: </dt>
                  <dd style={{ display: 'inline', margin: 0, whiteSpace: 'pre-wrap' }}>{insight.notes}</dd>
                </div>
              )}
            </dl>
            <div className={s.actions}>
              <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={() => setEditing(true)}>Edit</button>
              <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={toggleArchive} disabled={busy}>
                {insight.status === 'active' ? 'Archive' : 'Restore'}
              </button>
              <MakeFromThis source={{ kind: 'insight', id: insight.id }} insightId={insight.id} sourceForm={sourceForm ?? undefined} onMade={() => load()} />
            </div>
          </>
        )}
        {error && <p className={s.error} role="alert">{error}</p>}
      </div>

      <div className={s.panel}>
        <h2 className={s.panelTitle}>Assets carrying this insight ({groups.all.length})</h2>
        {groups.all.length === 0 && <p className={s.muted}>Nothing carries it yet. Make something from it, or attach it to a piece or post from their pages.</p>}
        {sourceForm ? (
          <>
            {section('Longer than the source', groups.longer)}
            {section('Same length', groups.same)}
            {section('Shorter', groups.shorter)}
            {section('Form unknown', groups.other)}
          </>
        ) : (
          section('Carrying this insight (source form unknown)', groups.all)
        )}
      </div>
    </div>
  );
}
