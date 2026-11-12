'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import { FORMAT_LABELS } from '@/lib/social/types';
import { errorMessage, socialApi, type PostWithTargets, type TargetWithAccount } from './api';
import { AccountAvatar, StatusChip, formatDateTime, formatTime, platformLabel } from './ui';
import MakeFromThis from '@/components/admin/content/MakeFromThis';
import s from './social.module.css';

export type CardVariant = 'queue' | 'draft' | 'published' | 'failed';

const METRIC_LABELS: [string, string][] = [
  ['views', 'views'],
  ['plays', 'plays'],
  ['impressions', 'impressions'],
  ['likes', 'likes'],
  ['comments', 'comments'],
  ['shares', 'shares'],
  ['saves', 'saves'],
];

function MediaThumb({ post }: { post: PostWithTargets }) {
  const first = post.media?.[0];
  return (
    <div className={s.thumb} aria-hidden="true">
      {!first && <span>Text</span>}
      {first?.type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads in Supabase storage
        <img src={first.thumbnailUrl ?? first.url} alt="" loading="lazy" />
      )}
      {first?.type === 'video' &&
        (first.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads in Supabase storage
          <img src={first.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <video src={`${first.url}#t=0.5`} muted preload="metadata" playsInline />
        ))}
      {first?.type === 'video' && <span className={s.thumbBadge}>▶</span>}
      {post.media.length > 1 && <span className={s.thumbBadge}>+{post.media.length - 1}</span>}
    </div>
  );
}

function Metrics({ metrics }: { metrics: Record<string, number> }) {
  const shown = METRIC_LABELS.filter(([k]) => typeof metrics?.[k] === 'number');
  if (!shown.length) return null;
  return (
    <span className={s.metrics}>
      {shown.map(([k, label]) => (
        <span key={k}>
          {metrics[k].toLocaleString()} {label}
        </span>
      ))}
    </span>
  );
}

function TargetChip({ t }: { t: TargetWithAccount }) {
  const name = t.account?.handle ?? t.account?.display_name ?? platformLabel(t.platform);
  return (
    <span className={s.targetRow} title={`${platformLabel(t.platform)} · ${FORMAT_LABELS[t.format] ?? t.format}`}>
      <AccountAvatar platform={t.platform} avatarUrl={t.account?.avatar_url} name={name} size={22} />
      <span>{name}</span>
      <span className={s.muted} style={{ fontSize: '0.6875rem' }}>{FORMAT_LABELS[t.format] ?? t.format}</span>
      <StatusChip status={t.status} />
    </span>
  );
}

export default function PostCard({
  post,
  variant,
  onChanged,
}: {
  post: PostWithTargets;
  variant: CardVariant;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const publishNow = () => {
    if (!confirm('Publish this post to every selected channel now?')) return;
    void run('publish', () => socialApi.publishNow(post.id));
  };
  const cancel = () => {
    const isDraft = post.status === 'draft';
    if (!confirm(isDraft ? 'Delete this draft?' : 'Cancel this scheduled post? It will not be published.')) return;
    void run('cancel', () => socialApi.deletePost(post.id));
  };

  const editable = !['published', 'publishing', 'cancelled'].includes(post.status);
  const problems = post.targets.filter((t) => t.status === 'failed' || t.status === 'needs_action');
  const when = post.status === 'published' || variant === 'published'
    ? post.targets.find((t) => t.published_at)?.published_at ?? post.scheduled_at
    : post.scheduled_at;

  return (
    <article className={s.postCard} aria-label={post.title ?? (post.caption.slice(0, 60) || 'Post')}>
      <MediaThumb post={post} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={s.postTime}>
            {when ? (variant === 'queue' ? formatTime(when) : formatDateTime(when)) : 'No time set'}
          </span>
          <StatusChip status={post.status} />
          {post.piece_id && (
            <Link href={`/admin/studio/social-calendar/${post.piece_id}`} className={s.muted} style={{ fontSize: '0.75rem' }}>
              from calendar piece
            </Link>
          )}
        </div>
        {post.title && <div className={s.postTitle}>{post.title}</div>}
        <p className={s.caption}>{post.caption || <em>No caption</em>}</p>
        <div className={s.targets}>
          {post.targets.map((t) => (
            <TargetChip key={t.id} t={t} />
          ))}
          {!post.targets.length && <span className={s.muted}>No channels selected</span>}
        </div>

        {variant === 'published' && (
          <div className={s.targetDetail}>
            {post.targets
              .filter((t) => t.status === 'published')
              .map((t) => (
                <div key={t.id} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem', alignItems: 'center' }}>
                  <strong>{platformLabel(t.platform)}</strong>
                  {t.external_url ? (
                    <a href={t.external_url} target="_blank" rel="noopener noreferrer">
                      View post ↗
                    </a>
                  ) : (
                    <span className={s.muted}>no link</span>
                  )}
                  <Metrics metrics={t.metrics} />
                  {t.metrics_synced_at && <span className={s.muted} style={{ fontSize: '0.6875rem' }}>synced {formatDateTime(t.metrics_synced_at)}</span>}
                </div>
              ))}
          </div>
        )}

        {problems.length > 0 && (variant === 'failed' || variant === 'published' || variant === 'queue') && (
          <div className={s.targetDetail}>
            {problems.map((t) => (
              <div key={t.id} className={`${s.targetError} ${t.status === 'needs_action' ? s.targetAction : ''}`}>
                <strong>{platformLabel(t.platform)}:</strong>
                <span style={{ flex: 1, minWidth: 160 }}>
                  {t.status === 'needs_action'
                    ? t.platform === 'tiktok'
                      ? `Open the TikTok app inbox to finish posting this draft.${t.error ? ` ${t.error}` : ''}`
                      : t.error ?? 'Needs action in the app.'
                    : t.error ?? 'Failed with no error message.'}
                  {t.attempts > 0 && <span className={s.muted}> ({t.attempts} attempt{t.attempts === 1 ? '' : 's'})</span>}
                </span>
                {t.status === 'failed' && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                    disabled={busy !== null}
                    onClick={() => void run(`retry-${t.id}`, () => socialApi.retryTarget(t.id))}
                  >
                    {busy === `retry-${t.id}` ? 'Retrying…' : 'Retry'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {err && <div className={styles.formError} role="alert" style={{ marginTop: 6 }}>{err}</div>}
        {post.status !== 'cancelled' && (
          <div style={{ marginTop: 8 }}>
            {/* The server resolves the post's form and insight (social_posts.insight_id or its piece's). */}
            <MakeFromThis source={{ kind: 'social_post', id: post.id }} />
          </div>
        )}
      </div>

      <div className={s.actions}>
        {editable && (
          <Link href={`/admin/social/compose?post=${post.id}`} className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
            Edit
          </Link>
        )}
        {(post.status === 'scheduled' || post.status === 'draft') && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} disabled={busy !== null} onClick={publishNow}>
            {busy === 'publish' ? 'Publishing…' : 'Publish now'}
          </button>
        )}
        {(post.status === 'scheduled' || post.status === 'draft') && (
          <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`} disabled={busy !== null} onClick={cancel}>
            {busy === 'cancel' ? '…' : post.status === 'draft' ? 'Delete' : 'Cancel'}
          </button>
        )}
      </div>
    </article>
  );
}
