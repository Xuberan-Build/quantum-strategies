'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Platform } from '@/lib/social/types';
import { monthGrid } from '@/lib/content/calendar';
import { errorMessage, socialApi, type PostWithTargets } from './api';
import { formatTime, localDateKey, platformColor, platformLabel } from './ui';
import s from './social.module.css';

type Mode = 'week' | 'month';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function keyToDate(key: string, hour = 0): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function weekDays(anchor: Date): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => localDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

function PostChip({ post }: { post: PostWithTargets }) {
  const platforms = Array.from(new Set(post.targets.map((t) => t.platform))) as Platform[];
  const color = platforms[0] ? platformColor(platforms[0]) : '#94a3b8';
  const label = post.title || post.caption.slice(0, 60) || '(no caption)';
  return (
    <Link
      href={`/admin/social/compose?post=${post.id}`}
      className={s.calChip}
      style={{
        borderLeftColor: color,
        background: `${color}14`,
        textDecorationLine: post.status === 'cancelled' ? 'line-through' : undefined,
        opacity: post.status === 'draft' ? 0.75 : 1,
      }}
      title={`${formatTime(post.scheduled_at)} · ${platforms.map(platformLabel).join(', ')} · ${post.status}\n${label}`}
    >
      <span style={{ fontWeight: 600 }}>{formatTime(post.scheduled_at)}</span>{' '}
      {platforms.map((p) => (
        <span
          key={p}
          aria-label={platformLabel(p)}
          style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: platformColor(p), marginRight: 2 }}
        />
      ))}{' '}
      {post.status !== 'scheduled' && <span style={{ color: 'var(--admin-text-muted)' }}>[{post.status}] </span>}
      {label}
    </Link>
  );
}

const noopSubscribe = () => () => {};

export default function CalendarView({ platform }: { platform: Platform | '' }) {
  const router = useRouter();
  // Dates depend on the browser's time zone, so the grid only renders on the client (avoids hydration mismatches).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [posts, setPosts] = useState<PostWithTargets[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const days = useMemo(() => {
    if (mode === 'week') return weekDays(anchor);
    return monthGrid(anchor.getFullYear(), anchor.getMonth() + 1).flat();
  }, [mode, anchor]);

  const fromIso = keyToDate(days[0]).toISOString();
  const toIso = new Date(keyToDate(days[days.length - 1]).getTime() + 86_400_000 - 1).toISOString();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await socialApi.listPosts({
          from: fromIso,
          to: toIso,
          status: ['draft', 'scheduled', 'publishing', 'published', 'partial', 'failed'],
          platform,
        });
        if (!alive) return;
        setPosts(res.posts.filter((p) => p.scheduled_at));
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
  }, [fromIso, toIso, platform]);

  const byDay = useMemo(() => {
    const m = new Map<string, PostWithTargets[]>();
    for (const p of posts) {
      const k = localDateKey(new Date(p.scheduled_at as string));
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    for (const list of m.values()) list.sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
    return m;
  }, [posts]);

  const today = localDateKey(new Date());

  function shift(by: number) {
    setLoading(true);
    const d = new Date(anchor);
    if (mode === 'week') d.setDate(d.getDate() + 7 * by);
    else d.setMonth(d.getMonth() + by, 1);
    setAnchor(d);
  }

  function composeAt(key: string, hour: number) {
    let at = keyToDate(key, hour);
    if (at.getTime() < Date.now()) {
      // past slot today: nudge to the next top of the hour
      at = new Date();
      at.setMinutes(0, 0, 0);
      at.setHours(at.getHours() + 1);
    }
    router.push(`/admin/social/compose?at=${encodeURIComponent(at.toISOString())}`);
  }

  if (!mounted) return <p className={s.muted}>Loading calendar…</p>;

  const title =
    mode === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : `${keyToDate(days[0]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${keyToDate(days[6]).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div>
      <div className={s.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => shift(-1)} aria-label={`Previous ${mode}`}>
          ←
        </button>
        <strong style={{ minWidth: '11rem', textAlign: 'center' }} aria-live="polite">{title}</strong>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => shift(1)} aria-label={`Next ${mode}`}>
          →
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          onClick={() => {
            setLoading(true);
            setAnchor(new Date());
          }}
        >
          Today
        </button>
        <span className={s.spacer} />
        <div role="group" aria-label="Calendar view" style={{ display: 'flex', gap: 4 }}>
          {(['week', 'month'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              className={`${s.chipBtn} ${mode === m ? s.chipBtnActive : ''}`}
              onClick={() => {
                if (m === mode) return;
                setLoading(true);
                setMode(m);
              }}
            >
              {m === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {err && <div className={styles.formError} role="alert">{err}</div>}
      <p className={s.muted} style={{ margin: '0 0 0.5rem' }}>
        {loading ? 'Loading…' : `${posts.length} post${posts.length === 1 ? '' : 's'} in view.`} Click an empty slot to compose at that time. Times are your local time.
      </p>

      <div className={s.calWrap}>
        {mode === 'month' ? (
          <div className={s.monthGrid}>
            {WEEKDAYS.map((d) => (
              <div key={d} className={s.calHead}>{d}</div>
            ))}
            {days.map((day) => {
              const inMonth = Number(day.slice(5, 7)) === anchor.getMonth() + 1;
              const list = byDay.get(day) ?? [];
              return (
                <div key={day} className={`${s.calDay} ${inMonth ? '' : s.calDayOut} ${day === today ? s.calToday : ''}`}>
                  <div className={s.calDayNum}>{Number(day.slice(8))}</div>
                  {list.map((p) => (
                    <PostChip key={p.id} post={p} />
                  ))}
                  <button
                    type="button"
                    className={s.slot}
                    onClick={() => composeAt(day, 9)}
                    aria-label={`New post on ${keyToDate(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                  >
                    + New
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={s.weekGrid}>
            <div className={s.calHead} />
            {days.map((day, i) => (
              <div key={day} className={`${s.calHead} ${day === today ? s.calToday : ''}`}>
                {WEEKDAYS[i]} {Number(day.slice(8))}
              </div>
            ))}
            {HOURS.map((h) => (
              <WeekRow key={h} hour={h} days={days} byDay={byDay} today={today} onCompose={composeAt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekRow({
  hour,
  days,
  byDay,
  today,
  onCompose,
}: {
  hour: number;
  days: string[];
  byDay: Map<string, PostWithTargets[]>;
  today: string;
  onCompose: (day: string, hour: number) => void;
}) {
  const label = new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' });
  return (
    <>
      <div className={s.hourLabel}>{label}</div>
      {days.map((day) => {
        const list = (byDay.get(day) ?? []).filter((p) => new Date(p.scheduled_at as string).getHours() === hour);
        return (
          <div key={day} className={`${s.hourCell} ${day === today ? s.calToday : ''}`}>
            {list.map((p) => (
              <PostChip key={p.id} post={p} />
            ))}
            <button
              type="button"
              className={s.slot}
              onClick={() => onCompose(day, hour)}
              aria-label={`New post ${keyToDate(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} at ${label}`}
            >
              +
            </button>
          </div>
        );
      })}
    </>
  );
}
