'use client';

import type { Platform, PostStatus, TargetStatus } from '@/lib/social/types';
import { PLATFORM_LABELS } from '@/lib/social/types';
import s from './social.module.css';

export const PLATFORM_COLORS: Record<Platform, string> = {
  youtube: '#ef4444',
  instagram: '#ec4899',
  tiktok: '#14b8a6',
  x: '#334155',
  threads: '#111827',
};

const PLATFORM_GLYPH: Record<Platform, string> = {
  youtube: 'YT',
  instagram: 'IG',
  tiktok: 'TT',
  x: 'X',
  threads: '@',
};

export const ALL_PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'x', 'threads'];

export function platformColor(p: Platform | string): string {
  return PLATFORM_COLORS[p as Platform] ?? '#94a3b8';
}

export function platformLabel(p: Platform | string): string {
  return PLATFORM_LABELS[p as Platform] ?? p;
}

/** Account avatar with a small platform badge in the corner. Falls back to initials. */
export function AccountAvatar({
  platform,
  avatarUrl,
  name,
  size = 32,
}: {
  platform: Platform;
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
}) {
  const dot = Math.max(12, Math.round(size * 0.45));
  const initials = (name ?? platformLabel(platform)).replace(/^@/, '').slice(0, 2).toUpperCase();
  return (
    <span className={s.avatarWrap} style={{ width: size, height: size }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatars from arbitrary platform CDNs
        <img src={avatarUrl} alt="" className={s.avatar} width={size} height={size} style={{ width: size, height: size }} />
      ) : (
        <span
          className={s.avatar}
          aria-hidden="true"
          style={{ width: size, height: size, background: platformColor(platform), fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      )}
      <span
        className={s.platformDot}
        aria-hidden="true"
        style={{ width: dot, height: dot, background: platformColor(platform), fontSize: dot * 0.42 }}
      >
        {PLATFORM_GLYPH[platform] ?? '?'}
      </span>
    </span>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label?: string }> = {
  draft: { bg: '#f1f5f9', fg: '#475569' },
  scheduled: { bg: '#e0e7ff', fg: '#3730a3' },
  pending: { bg: '#e0e7ff', fg: '#3730a3', label: 'queued' },
  publishing: { bg: '#fef3c7', fg: '#92400e' },
  processing: { bg: '#fef3c7', fg: '#92400e' },
  published: { bg: '#d1fae5', fg: '#065f46' },
  partial: { bg: '#ffedd5', fg: '#9a3412' },
  failed: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#f1f5f9', fg: '#64748b' },
  needs_action: { bg: '#fef3c7', fg: '#92400e', label: 'needs action' },
};

export function StatusChip({ status }: { status: PostStatus | TargetStatus | string }) {
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span className={s.chip} style={{ background: st.bg, color: st.fg }}>
      {st.label ?? status.replace(/_/g, ' ')}
    </span>
  );
}

/* ---------- Dates (all in the browser's local time) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD for a Date. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Value for <input type="datetime-local"> from an ISO string (local time). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${localDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO (UTC) from a datetime-local value, interpreted in the browser's time zone. */
export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatDayHeading(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = localDateKey(new Date());
  const tomorrow = localDateKey(new Date(Date.now() + 86_400_000));
  const label = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  if (key === today) return `Today · ${label}`;
  if (key === tomorrow) return `Tomorrow · ${label}`;
  return label;
}

export function timeUntil(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const days = Math.round(abs / 86_400_000);
  const hours = Math.round(abs / 3_600_000);
  const unit = abs >= 86_400_000 ? `${days} day${days === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`;
  return ms >= 0 ? `in ${unit}` : `${unit} ago`;
}

/** Next top of the hour, at least 10 minutes out. */
export function nextTopOfHour(from = new Date()): Date {
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getTime() - from.getTime() < 10 * 60_000) d.setHours(d.getHours() + 1);
  return d;
}

export function Banner({ kind, children, onClose }: { kind: 'success' | 'error' | 'info'; children: React.ReactNode; onClose?: () => void }) {
  const cls = kind === 'success' ? s.bannerSuccess : kind === 'error' ? s.bannerError : s.bannerInfo;
  return (
    <div className={`${s.banner} ${cls}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className={s.linkBtn} style={{ color: 'inherit' }} onClick={onClose} aria-label="Dismiss">
          Dismiss
        </button>
      )}
    </div>
  );
}
