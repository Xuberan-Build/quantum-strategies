'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Platform, SocialAccount } from '@/lib/social/types';
import { errorMessage, socialApi, type PlatformInfo } from './api';
import { AccountAvatar, Banner, formatDateTime, platformColor, platformLabel, StatusChip, timeUntil } from './ui';
import s from './social.module.css';

const SETUP_NOTES: Partial<Record<Platform, string>> = {
  youtube:
    'Google Cloud console: enable YouTube Data API v3, create an OAuth client (Web application), add the redirect URI below. While the app is in testing, add your Google account as a test user.',
  instagram:
    'Meta for Developers: create an app with the Instagram API (Instagram Login), add the redirect URI below, and use a Business or Creator account. Publishing needs the content publish permission.',
  tiktok:
    'TikTok for Developers: create an app with Login Kit and the Content Posting API, add the redirect URI below. Until the app passes audit, direct posts are private only; inbox drafts work.',
  x: 'X Developer Portal: enable OAuth 2.0 (confidential client, read and write), add the redirect URI below as the callback. Scopes include offline.access for refresh tokens.',
  threads: 'Meta for Developers: create an app with the Threads API use case and add the redirect URI below.',
};

function expiryText(a: SocialAccount): { text: string; warn: boolean } | null {
  if (!a.token_expires_at) return null;
  const ms = new Date(a.token_expires_at).getTime() - Date.now();
  return {
    text: ms < 0 ? `Token expired ${timeUntil(a.token_expires_at)}` : `Token expires ${timeUntil(a.token_expires_at)}`,
    warn: ms < 3 * 86_400_000,
  };
}

function PlatformCard({
  info,
  accounts,
  oauthBase,
  onDisconnect,
  busyId,
}: {
  info: PlatformInfo;
  accounts: SocialAccount[];
  oauthBase: string;
  onDisconnect: (a: SocialAccount) => void;
  busyId: string | null;
}) {
  const redirectUri = `${oauthBase}/api/admin/social/oauth/${info.platform}/callback`;
  return (
    <section className={styles.card} style={{ borderTop: `4px solid ${platformColor(info.platform)}`, padding: '1.25rem' }} aria-labelledby={`pf-${info.platform}`}>
      <div className={styles.cardHeader} style={{ marginBottom: '0.75rem' }}>
        <h2 id={`pf-${info.platform}`} className={styles.cardTitle}>
          {info.label || platformLabel(info.platform)}
        </h2>
        {info.configured ? (
          <a href={socialApi.connectUrl(info.platform)} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}>
            {accounts.length ? 'Connect another' : 'Connect'}
          </a>
        ) : (
          <span className={`${styles.badge} ${styles.badgeWarning}`}>Not configured</span>
        )}
      </div>

      <p className={s.muted} style={{ margin: '0 0 0.5rem' }}>
        Formats: {info.formats.length ? info.formats.join(', ').replace(/_/g, ' ') : 'none'}
      </p>

      {!info.configured && (
        <div style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
          <p style={{ margin: '0 0 0.375rem' }}>Set these environment variables, then redeploy:</p>
          <ul className={s.envList}>
            {info.requiredEnv.map((k) => (
              <li key={k}>
                <code>{k}</code>
              </li>
            ))}
          </ul>
          {SETUP_NOTES[info.platform] && <p className={s.muted} style={{ margin: '0.5rem 0 0.375rem' }}>{SETUP_NOTES[info.platform]}</p>}
          <p style={{ margin: 0 }}>
            Redirect URI: <span className={s.code}>{redirectUri}</span>
          </p>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className={s.muted} style={{ margin: 0 }}>No accounts connected.</p>
      ) : (
        accounts.map((a) => {
          const exp = expiryText(a);
          return (
            <div key={a.id} className={s.accountRow}>
              <AccountAvatar platform={a.platform} avatarUrl={a.avatar_url} name={a.display_name ?? a.handle} size={40} />
              <div className={s.accountMeta}>
                <strong>{a.display_name ?? a.handle ?? a.external_id}</strong>
                {a.handle && <span className={s.muted}>@{a.handle.replace(/^@/, '')} </span>}
                <StatusChip status={a.status} />
                {exp && (
                  <div style={{ color: exp.warn ? 'var(--admin-warning-hover)' : 'var(--admin-text-muted)' }}>
                    {exp.text} ({formatDateTime(a.token_expires_at)})
                  </div>
                )}
                {a.last_error && <div style={{ color: 'var(--admin-danger)' }}>{a.last_error}</div>}
                {a.status !== 'connected' && info.configured && (
                  <a href={socialApi.connectUrl(info.platform)} style={{ fontSize: '0.8125rem' }}>
                    Reconnect
                  </a>
                )}
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                onClick={() => onDisconnect(a)}
                disabled={busyId === a.id}
                aria-label={`Disconnect ${platformLabel(a.platform)} ${a.handle ?? a.display_name ?? ''}`}
              >
                {busyId === a.id ? '…' : 'Disconnect'}
              </button>
            </div>
          );
        })
      )}
      {info.configured && <p className={s.muted} style={{ margin: '0.75rem 0 0', fontSize: '0.75rem' }}>Redirect URI: {redirectUri}</p>}
    </section>
  );
}

export default function AccountsView({ connected, error, oauthBase }: { connected?: string; error?: string; oauthBase: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    connected ? { kind: 'success', text: `${platformLabel(connected)} connected.` } : error ? { kind: 'error', text: error } : null,
  );
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (connected || error) window.history.replaceState(null, '', '/admin/social/accounts');
  }, [connected, error]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await socialApi.accounts();
        if (!alive) return;
        setAccounts(res.accounts);
        setPlatforms(res.platforms);
        setLoadErr(null);
      } catch (e) {
        if (alive) setLoadErr(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const disconnect = useCallback(async (a: SocialAccount) => {
    if (!confirm(`Disconnect ${platformLabel(a.platform)} ${a.handle ?? a.display_name ?? ''}? Scheduled posts to it will fail until you reconnect.`)) return;
    setBusyId(a.id);
    try {
      await socialApi.disconnect(a.id);
      setBanner({ kind: 'success', text: `${platformLabel(a.platform)} account disconnected.` });
      setReload((n) => n + 1);
    } catch (e) {
      setBanner({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/social" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Publisher
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>Accounts</h1>
          <p className={styles.pageDescription}>Connect the channels the publisher posts to. Tokens are stored encrypted and never leave the server.</p>
        </div>
        <Link href="/admin/social/compose" className={`${styles.btn} ${styles.btnPrimary}`}>
          New post
        </Link>
      </header>

      {banner && (
        <Banner kind={banner.kind} onClose={() => setBanner(null)}>
          {banner.text}
        </Banner>
      )}
      {loadErr && <Banner kind="error">{loadErr}</Banner>}
      {loading && <p className={s.muted}>Loading accounts…</p>}

      <div className={s.accountsGrid}>
        {platforms.map((p) => (
          <PlatformCard
            key={p.platform}
            info={p}
            accounts={accounts.filter((a) => a.platform === p.platform && a.status !== 'disconnected')}
            oauthBase={oauthBase}
            onDisconnect={disconnect}
            busyId={busyId}
          />
        ))}
      </div>
    </div>
  );
}
