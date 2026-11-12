'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import s from '@/components/admin/social/social.module.css';
import { platformLabel } from '@/components/admin/social/ui';
import { errorMessage, formatName, metricName, pieceHref, winnersApi, type PromotionStatus, type PromotionWithPiece } from './api';
import w from './winners.module.css';

const TABS: { id: PromotionStatus; label: string }[] = [
  { id: 'proposed', label: 'Proposed' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'done', label: 'Done' },
  { id: 'dismissed', label: 'Dismissed' },
];

function sourceLabel(p: PromotionWithPiece) {
  if (p.source_kind === 'external') return 'Logged by hand';
  if (p.source_kind === 'social_target') return 'Publisher post';
  return p.source_kind.replace('_', ' ');
}

export default function PromotionsList({ reload, onChanged }: { reload: number; onChanged: () => void }) {
  const [tab, setTab] = useState<PromotionStatus>('proposed');
  const [items, setItems] = useState<PromotionWithPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; text: string; kind: 'ok' | 'warn' | 'err'; href?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await winnersApi.promotions(tab);
        if (!alive) return;
        setItems(res.promotions);
        setErr(null);
      } catch (e) {
        if (alive) setErr(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, reload]);

  const act = async (p: PromotionWithPiece, action: 'accept' | 'dismiss' | 'done') => {
    setBusy(`${p.id}:${action}`);
    setNotice(null);
    try {
      if (action === 'accept') {
        const res = await winnersApi.accept(p.id);
        setNotice({
          id: p.id,
          kind: res.warnings.length ? 'warn' : 'ok',
          text: `Made "${res.piece.title ?? "the piece"}". ${res.warnings.join(' ')}`,
          href: pieceHref(res.piece.id),
        });
      } else if (action === 'dismiss') {
        await winnersApi.dismiss(p.id);
      } else {
        await winnersApi.markDone(p.id);
      }
      onChanged();
    } catch (e) {
      setNotice({ id: p.id, kind: 'err', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className={s.tabs} role="tablist" aria-label="Promotion status">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${s.tab} ${tab === t.id ? s.tabActive : ''}`}
            onClick={() => {
              if (t.id === tab) return;
              setLoading(true);
              setItems([]);
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className={`${s.banner} ${s.bannerError}`}>{err}</div>}
      {notice && (
        <p className={w[notice.kind]} role="status" style={{ margin: '0 0 0.75rem' }}>
          {notice.text} {notice.href && <Link href={notice.href}>Open the piece</Link>}
        </p>
      )}
      {loading && <p className={s.muted}>Loading…</p>}
      {!loading && !err && items.length === 0 && <div className={w.notice}>Nothing {tab} yet.</div>}

      <div className={w.cards}>
        {items.map((p) => (
          <article key={p.id} className={w.card}>
            <div className={w.cardTop}>
              <strong style={{ color: 'var(--admin-text)' }}>{formatName(p.proposed_format)}</strong>
              <span aria-hidden="true">·</span>
              <span>{p.platform ? platformLabel(p.platform) : 'Unknown channel'}</span>
              <span>{sourceLabel(p)}</span>
              {p.multiple != null && (
                <span className={w.multiple} style={{ fontSize: '0.875rem' }}>
                  x{p.multiple} {metricName(p.metric)}
                </span>
              )}
              {p.value != null && p.multiple == null && <span>{p.value} {metricName(p.metric)}</span>}
              <span>{new Date(p.created_at).toLocaleDateString()}</span>
              {p.source_kind === 'external' && /^https?:\/\//.test(p.source_id) && (
                <a href={p.source_id} target="_blank" rel="noreferrer">Open source ↗</a>
              )}
            </div>
            {p.proposed_title && <p className={w.cardTitle}>{p.proposed_title}</p>}
            {p.notes && <p className={w.cardText}>{p.notes}</p>}
            <div className={w.buttons}>
              {p.piece_id && (
                <Link href={pieceHref(p.piece_id)} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                  Open {p.piece?.title ? `"${p.piece.title}"` : 'the piece'}
                  {p.piece?.status ? ` (${p.piece.status})` : ''}
                </Link>
              )}
              {p.status === 'proposed' && (
                <>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                    disabled={!!busy}
                    onClick={() => act(p, 'accept')}
                  >
                    {busy === `${p.id}:accept` ? 'Writing… (up to a few minutes)' : `Make the ${formatName(p.proposed_format)}`}
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    disabled={!!busy}
                    onClick={() => act(p, 'dismiss')}
                  >
                    {busy === `${p.id}:dismiss` ? 'Dismissing…' : 'Dismiss'}
                  </button>
                </>
              )}
              {p.status === 'accepted' && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                  disabled={!!busy}
                  onClick={() => act(p, 'done')}
                  title="Moves here on its own once the piece is published"
                >
                  {busy === `${p.id}:done` ? 'Saving…' : 'Mark done'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
