'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import s from '@/components/admin/social/social.module.css';
import { platformLabel } from '@/components/admin/social/ui';
import { FORMAT_LABELS, type Format } from '@/lib/social/types';
import { errorMessage, metricName, winnersApi, type ThinGroup, type WinnersResult } from './api';
import ExternalWinnerForm from './ExternalWinnerForm';
import PromotionsList from './PromotionsList';
import WinnerCard from './WinnerCard';
import w from './winners.module.css';

const DAY_OPTIONS = [7, 14, 30];

function thinLine(g: ThinGroup) {
  const channel = `${platformLabel(g.platform)} ${(FORMAT_LABELS[g.format as Format] ?? g.format).toLowerCase()}`;
  if (g.reason === 'no_metric') return `${channel}: no ${g.metric ? metricName(g.metric) : 'numbers'} synced yet.`;
  if (g.reason === 'median_zero') return `${channel}: the typical post scores 0 ${metricName(g.metric)}, so 3x means nothing yet.`;
  return `${channel}: ${g.count} published with numbers, needs 5 before a median means anything.`;
}

export default function WinnersView() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<WinnersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await winnersApi.winners(days);
        if (!alive) return;
        setData(res);
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
  }, [days, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  const winners = data?.winners ?? [];
  const thin = data?.thinGroups ?? [];
  const noHistory = !!data && data.medians.length === 0;

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/social" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Publisher
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>Winners</h1>
          <p className={styles.pageDescription}>Posts that beat their channel&apos;s typical number by 3x, ready to go longer.</p>
        </div>
      </header>

      <p className={w.loop}>
        Friday loop: read the week&apos;s numbers per channel, move each winner across (Reddit to X, X to Reel hooks), make any 3x
        winner into a longer piece below, then approve next week&apos;s social pack. Log Reddit winners by hand: our tools can&apos;t read Reddit.
      </p>

      <section className={w.block} aria-labelledby="winners-h">
        <div className={w.blockHead}>
          <h2 id="winners-h" className={w.blockTitle}>
            {days === 7 ? "This week's winners" : `Winners, last ${days} days`}
          </h2>
          <div className={s.toolbar} role="group" aria-label="Window" style={{ margin: 0 }}>
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                className={`${s.chipBtn} ${days === d ? s.chipBtnActive : ''}`}
                onClick={() => {
                  if (d === days) return;
                  setLoading(true);
                  setDays(d);
                }}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {err && <div className={`${s.banner} ${s.bannerError}`}>{err}</div>}
        {loading && <p className={s.muted}>Reading the numbers…</p>}

        {!loading && !err && noHistory && (
          <div className={w.notice}>
            Not enough history yet. Nothing has been published through the publisher with numbers in the last {data?.baselineDays} days,
            so there is no typical post to beat. Winners show up here once each channel has 5 published posts with synced numbers.
            Until then, log Reddit and hand-posted X winners below.
          </div>
        )}

        {!loading && !err && !noHistory && winners.length === 0 && (
          <div className={w.notice}>No post beat its channel by {data?.multiple ?? 3}x in the last {days} days.</div>
        )}

        {winners.length > 0 && (
          <div className={w.cards}>
            {winners.map((winner) => (
              <WinnerCard key={winner.target_id} winner={winner} onChanged={refresh} />
            ))}
          </div>
        )}

        {!loading && thin.length > 0 && (
          <div className={w.notice} style={{ marginTop: '0.75rem' }}>
            <strong>Not enough history yet</strong> on these channels, so they can&apos;t flag winners:
            <ul className={w.thinList}>
              {thin.map((g) => (
                <li key={`${g.platform}:${g.format}`}>{thinLine(g)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={w.block} aria-labelledby="external-h">
        <div className={w.blockHead}>
          <h2 id="external-h" className={w.blockTitle}>Log a Reddit winner</h2>
          <span className={s.muted}>Upvotes plus comments against the sub&apos;s typical post.</span>
        </div>
        <ExternalWinnerForm onAdded={refresh} />
      </section>

      <section className={w.block} aria-labelledby="promotions-h">
        <div className={w.blockHead}>
          <h2 id="promotions-h" className={w.blockTitle}>Promotions</h2>
          <span className={s.muted}>Accepted pieces open in the social calendar; they move to Done when published.</span>
        </div>
        <PromotionsList reload={reload} onChanged={refresh} />
      </section>
    </div>
  );
}
