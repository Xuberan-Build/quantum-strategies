'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Platform, PostStatus } from '@/lib/social/types';
import { errorMessage, socialApi, type PostWithTargets } from './api';
import CalendarView from './CalendarView';
import PostCard, { type CardVariant } from './PostCard';
import { ALL_PLATFORMS, formatDayHeading, localDateKey, platformColor, platformLabel } from './ui';
import s from './social.module.css';

export type QueueTab = 'queue' | 'calendar' | 'drafts' | 'published' | 'failed';

const TABS: { id: QueueTab; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Needs action' },
];

const TAB_STATUSES: Record<Exclude<QueueTab, 'calendar'>, PostStatus[]> = {
  queue: ['scheduled', 'publishing'],
  drafts: ['draft'],
  published: ['published', 'partial'],
  failed: ['failed', 'partial', 'publishing', 'published'],
};

const VARIANT: Record<Exclude<QueueTab, 'calendar'>, CardVariant> = {
  queue: 'queue',
  drafts: 'draft',
  published: 'published',
  failed: 'failed',
};

const hasProblem = (p: PostWithTargets) => p.targets.some((t) => t.status === 'failed' || t.status === 'needs_action');

function sortPosts(tab: QueueTab, posts: PostWithTargets[]) {
  const key = (p: PostWithTargets) => p.scheduled_at ?? p.updated_at;
  const sorted = [...posts].sort((a, b) => key(a).localeCompare(key(b)));
  return tab === 'queue' ? sorted : sorted.reverse();
}

export default function QueueView({ initialTab, initialPlatform }: { initialTab: QueueTab; initialPlatform: Platform | '' }) {
  const [tab, setTab] = useState<QueueTab>(initialTab);
  const [platform, setPlatform] = useState<Platform | ''>(initialPlatform);
  const [posts, setPosts] = useState<PostWithTargets[]>([]);
  const [loading, setLoading] = useState(initialTab !== 'calendar');
  const [err, setErr] = useState<string | null>(null);
  const [problemCount, setProblemCount] = useState(0);
  const [reload, setReload] = useState(0);

  // Keep tab + channel in the URL so the view survives reloads and can be linked.
  useEffect(() => {
    const q = new URLSearchParams();
    if (tab !== 'queue') q.set('tab', tab);
    if (platform) q.set('platform', platform);
    const qs = q.toString();
    window.history.replaceState(null, '', `/admin/social${qs ? `?${qs}` : ''}`);
  }, [tab, platform]);

  useEffect(() => {
    if (tab === 'calendar') return;
    let alive = true;
    (async () => {
      try {
        const res = await socialApi.listPosts({ status: TAB_STATUSES[tab], platform });
        if (!alive) return;
        const list = tab === 'failed' ? res.posts.filter(hasProblem) : res.posts;
        setPosts(sortPosts(tab, list));
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
  }, [tab, platform, reload]);

  // Badge on the "Needs action" tab.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await socialApi.listPosts({ status: TAB_STATUSES.failed });
        if (alive) setProblemCount(res.posts.filter(hasProblem).length);
      } catch {
        /* the badge is optional */
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReload((n) => n + 1);
  }, []);

  const switchTab = (t: QueueTab) => {
    if (t === tab) return;
    setPosts([]);
    setLoading(t !== 'calendar');
    setTab(t);
  };

  const switchPlatform = (p: Platform | '') => {
    if (p === platform) return;
    setLoading(tab !== 'calendar');
    setPlatform(p);
  };

  // Client-side guard in case the API ignores the platform filter.
  const visible = useMemo(
    () => (platform ? posts.filter((p) => p.targets.some((t) => t.platform === platform)) : posts),
    [posts, platform],
  );

  const groups = useMemo(() => {
    if (tab !== 'queue') return null;
    const m = new Map<string, PostWithTargets[]>();
    for (const p of visible) {
      const k = p.scheduled_at ? localDateKey(new Date(p.scheduled_at)) : 'unscheduled';
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return Array.from(m.entries());
  }, [tab, visible]);

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Studio Hub
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>Publisher</h1>
          <p className={styles.pageDescription}>Schedule and publish to Instagram, TikTok, YouTube and X from one queue.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/admin/social/winners" className={`${styles.btn} ${styles.btnSecondary}`}>
            Winners
          </Link>
          <Link href="/admin/social/accounts" className={`${styles.btn} ${styles.btnSecondary}`}>
            Accounts
          </Link>
          <Link href="/admin/social/compose" className={`${styles.btn} ${styles.btnPrimary}`}>
            New post
          </Link>
        </div>
      </header>

      <div className={s.tabs} role="tablist" aria-label="Publisher views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="publisher-panel"
            className={`${s.tab} ${tab === t.id ? s.tabActive : ''}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
            {t.id === 'failed' && problemCount > 0 && <span className={s.count} aria-label={`${problemCount} need action`}>{problemCount}</span>}
          </button>
        ))}
      </div>

      <div className={s.toolbar} role="group" aria-label="Filter by channel">
        <button type="button" aria-pressed={!platform} className={`${s.chipBtn} ${!platform ? s.chipBtnActive : ''}`} onClick={() => switchPlatform('')}>
          All channels
        </button>
        {ALL_PLATFORMS.filter((p) => p !== 'threads').map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={platform === p}
            className={`${s.chipBtn} ${platform === p ? s.chipBtnActive : ''}`}
            onClick={() => switchPlatform(p)}
          >
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: platformColor(p), display: 'inline-block' }} />
            {platformLabel(p)}
          </button>
        ))}
        <span className={s.spacer} />
        {tab !== 'calendar' && (
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </div>

      <div id="publisher-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'calendar' ? (
          <CalendarView platform={platform} />
        ) : (
          <>
            {err && <div className={styles.formError} role="alert">{err}</div>}
            {!loading && !err && visible.length === 0 && <EmptyState tab={tab} />}
            {loading && visible.length === 0 && <p className={s.muted}>Loading…</p>}
            {groups
              ? groups.map(([day, list]) => (
                  <section key={day} aria-label={day === 'unscheduled' ? 'Unscheduled' : formatDayHeading(day)}>
                    <h2 className={s.dayHeading}>{day === 'unscheduled' ? 'Unscheduled' : formatDayHeading(day)}</h2>
                    <div className={s.list}>
                      {list.map((p) => (
                        <PostCard key={p.id} post={p} variant="queue" onChanged={refresh} />
                      ))}
                    </div>
                  </section>
                ))
              : (
                  <div className={s.list}>
                    {visible.map((p) => (
                      <PostCard key={p.id} post={p} variant={VARIANT[tab]} onChanged={refresh} />
                    ))}
                  </div>
                )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: QueueTab }) {
  const text: Record<QueueTab, string> = {
    queue: 'Nothing scheduled. Write a post and pick a time.',
    calendar: '',
    drafts: 'No drafts.',
    published: 'Nothing published yet.',
    failed: 'All clear. Failed posts and TikTok drafts waiting in the inbox show up here.',
  };
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyTitle}>{text[tab]}</p>
      {(tab === 'queue' || tab === 'drafts') && (
        <Link href="/admin/social/compose" className={`${styles.btn} ${styles.btnPrimary}`}>
          New post
        </Link>
      )}
    </div>
  );
}
