'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import { FORMAT_LABELS, type Format } from '@/lib/social/types';
import { platformColor, platformLabel } from '@/components/admin/social/ui';
import { errorMessage, formatName, makeLabel, metricName, pieceHref, winnersApi, type PieceType, type Winner } from './api';
import w from './winners.module.css';

function snippet(text: string, max = 280) {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export default function WinnerCard({ winner, onChanged }: { winner: Winner; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string; href?: string } | null>(null);

  const existing = new Map(winner.promotions.map((p) => [p.proposed_format, p]));
  const account = winner.account?.handle ? `@${winner.account.handle.replace(/^@/, '')}` : winner.account?.display_name ?? '';
  const formatLabel = FORMAT_LABELS[winner.format as Format] ?? winner.format;

  const make = async (format: PieceType) => {
    setBusy(format);
    setMsg(null);
    try {
      const { promotion } = await winnersApi.proposeFromTarget(winner.target_id, format);
      if (promotion.status !== 'proposed') {
        setMsg({ kind: 'warn', text: `Already ${promotion.status}.`, href: promotion.piece_id ? pieceHref(promotion.piece_id) : undefined });
      } else {
        const res = await winnersApi.accept(promotion.id);
        setMsg({
          kind: res.warnings.length ? 'warn' : 'ok',
          text: `Made "${res.piece.title ?? "the piece"}".${res.warnings.length ? ` ${res.warnings.join(' ')}` : ''}`,
          href: pieceHref(res.piece.id),
        });
      }
      onChanged();
    } catch (e) {
      setMsg({ kind: 'err', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const proposeOnly = async (format: PieceType) => {
    setBusy('propose');
    setMsg(null);
    try {
      const { created, promotion } = await winnersApi.proposeFromTarget(winner.target_id, format);
      setMsg({ kind: 'ok', text: created ? `Proposed as a ${formatName(format)}.` : `Already in the list (${promotion.status}).` });
      onChanged();
    } catch (e) {
      setMsg({ kind: 'err', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const top = winner.suggestions.find((f) => !existing.has(f));

  return (
    <article className={w.card}>
      <div className={w.cardTop}>
        <span className={w.multiple}>
          x{winner.multiple} {metricName(winner.metric)}
        </span>
        <span>
          {winner.value} vs median {winner.median}
        </span>
        <span aria-hidden="true">·</span>
        <span style={{ color: platformColor(winner.platform), fontWeight: 600 }}>{platformLabel(winner.platform)}</span>
        <span>{formatLabel}</span>
        {account && <span>{account}</span>}
        {winner.published_at && <span>{new Date(winner.published_at).toLocaleDateString()}</span>}
        {winner.external_url && (
          <a href={winner.external_url} target="_blank" rel="noreferrer">
            Open post ↗
          </a>
        )}
      </div>
      {winner.title && <p className={w.cardTitle}>{winner.title}</p>}
      {winner.caption && <p className={w.cardText}>{snippet(winner.caption)}</p>}

      <div className={w.buttons}>
        {winner.suggestions.length === 0 && <span className={w.warn}>Already the longest form; move it across instead.</span>}
        {winner.suggestions.map((f) => {
          const p = existing.get(f);
          if (p?.piece_id) {
            return (
              <Link key={f} href={pieceHref(p.piece_id)} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                Open {formatName(f)} ({p.status})
              </Link>
            );
          }
          if (p && p.status === 'dismissed') {
            return (
              <span key={f} className={styles.badge + ' ' + styles.badgeNeutral}>
                {formatName(f)} dismissed
              </span>
            );
          }
          return (
            <button
              key={f}
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
              disabled={!!busy}
              onClick={() => make(f)}
            >
              {busy === f ? 'Writing… (up to a few minutes)' : makeLabel(f)}
            </button>
          );
        })}
        {top && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
            disabled={!!busy}
            onClick={() => proposeOnly(top)}
            title={`Adds a proposed ${formatName(top)} to the list below for later`}
          >
            {busy === 'propose' ? 'Proposing…' : `Propose only (${formatName(top)})`}
          </button>
        )}
      </div>

      {msg && (
        <p className={w[msg.kind]} role="status" style={{ margin: 0 }}>
          {msg.text}{' '}
          {msg.href && <Link href={msg.href}>Open the piece</Link>}
        </p>
      )}
    </article>
  );
}
