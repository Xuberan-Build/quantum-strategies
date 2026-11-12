'use client';

import Link from 'next/link';
import AssetGraphPanel from '@/components/admin/content/AssetGraphPanel';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Format, SocialAccount, TargetOptions } from '@/lib/social/types';
import { FORMAT_LABELS } from '@/lib/social/types';
import {
  ApiError,
  errorMessage,
  socialApi,
  type PieceSummary,
  type PlatformInfo,
  type PostInput,
  type PostWithTargets,
  type TargetInput,
} from './api';
import { CAPTION_LIMITS, countChars, defaultFormat, defaultOptions, mediaShapes, splitIntoParts, type TargetState } from './composer-logic';
import MediaUploader, { mediaItemFromSaved, type MediaItem } from './MediaUploader';
import TargetOptionsEditor, { Counter } from './TargetOptionsEditor';
import { AccountAvatar, Banner, isoToLocalInput, localInputToIso, nextTopOfHour, platformLabel, StatusChip } from './ui';
import s from './social.module.css';

interface Props {
  postId?: string;
  pieceId?: string;
  at?: string;
}

type Action = 'draft' | 'schedule' | 'publish';

function accountName(a: Pick<SocialAccount, 'handle' | 'display_name' | 'platform'>) {
  return a.handle ? (a.handle.startsWith('@') ? a.handle : `@${a.handle}`) : a.display_name ?? platformLabel(a.platform);
}

export default function Composer({ postId, pieceId, at }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [existing, setExisting] = useState<PostWithTargets | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, TargetState>>({});
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [tags, setTags] = useState('');
  const [linkedPiece, setLinkedPiece] = useState<string | null>(pieceId ?? null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [when, setWhen] = useState(() => isoToLocalInput(at));
  const [captionTab, setCaptionTab] = useState<string>('shared');

  const [busy, setBusy] = useState<Action | null>(null);
  const [postErrors, setPostErrors] = useState<string[]>([]);
  const [targetErrors, setTargetErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const [pieceQuery, setPieceQuery] = useState('');
  const [pieceResults, setPieceResults] = useState<PieceSummary[] | null>(null);

  function applyPiece(p: PieceSummary) {
    setLinkedPiece(p.id);
    if (p.title) setTitle(p.title);
    if (p.body) setCaption(p.body);
    if (p.scheduled_for && !at && !postId) {
      const d = new Date(`${p.scheduled_for.slice(0, 10)}T09:00`);
      if (d.getTime() > Date.now()) setWhen(isoToLocalInput(d.toISOString()));
    }
    setNotice(`Imported "${p.title ?? 'piece'}" from the content calendar.`);
  }

  // Initial load: accounts + platforms, then the post being edited or the calendar piece being imported.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const acc = await socialApi.accounts();
        if (!alive) return;
        setAccounts(acc.accounts);
        setPlatforms(acc.platforms);

        if (postId) {
          const { post } = await socialApi.getPost(postId);
          if (!alive) return;
          setExisting(post);
          setTitle(post.title ?? '');
          setCaption(post.caption ?? '');
          setLink(post.link ?? '');
          setFirstComment(post.first_comment ?? '');
          setTags((post.tags ?? []).join(', '));
          setLinkedPiece(post.piece_id);
          setMedia((post.media ?? []).map(mediaItemFromSaved));
          setWhen(isoToLocalInput(post.scheduled_at));
          setSelected(post.targets.filter((t) => t.status !== 'cancelled').map((t) => t.account_id));
          const ts: Record<string, TargetState> = {};
          for (const t of post.targets) {
            ts[t.account_id] = {
              format: t.format,
              captionOverride: t.caption_override,
              options: { ...defaultOptions(t.platform), ...(t.options ?? {}) },
            };
          }
          setTargets(ts);
        } else if (pieceId) {
          const res = await socialApi.pieces({ id: pieceId, q: '' });
          if (!alive) return;
          const p = res.pieces.find((x) => x.id === pieceId);
          if (p) applyPiece(p);
          else setNotice('That calendar piece was not found. Search for it in "Import from calendar".');
        }
      } catch (e) {
        if (alive) setLoadError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per post/piece
  }, [postId, pieceId]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const formatsFor = (platform: string): Format[] => platforms.find((p) => p.platform === platform)?.formats ?? [];
  const doneMedia = media.filter((m) => m.status === 'done' && m.media).map((m) => m.media!);
  const shapes = mediaShapes(media.map((m) => m.media ?? { type: m.type }));
  const uploading = media.some((m) => m.status === 'uploading');
  const uploadErrors = media.some((m) => m.status === 'error');

  const selectedAccounts = selected.map((id) => accountById.get(id)).filter((a): a is SocialAccount => !!a);

  function stateFor(a: SocialAccount): TargetState {
    return targets[a.id] ?? { format: null, captionOverride: null, options: defaultOptions(a.platform) };
  }
  function formatFor(a: SocialAccount): Format {
    return stateFor(a).format ?? defaultFormat(a.platform, formatsFor(a.platform), shapes);
  }
  function captionFor(a: SocialAccount): string {
    return stateFor(a).captionOverride ?? caption;
  }
  function patchTarget(a: SocialAccount, patch: Partial<TargetState>) {
    setTargets((prev) => {
      const cur = prev[a.id] ?? { format: null, captionOverride: null, options: defaultOptions(a.platform) };
      return { ...prev, [a.id]: { ...cur, ...patch } };
    });
  }
  function patchOptions(a: SocialAccount, patch: Partial<TargetOptions>) {
    const cur = stateFor(a);
    patchTarget(a, { options: { ...cur.options, ...patch } });
  }

  function toggleAccount(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (captionTab === id) setCaptionTab('shared');
  }

  function buildPayload(status: PostInput['status'], scheduledAt: string | null): PostInput {
    const tgt: TargetInput[] = selectedAccounts.map((a) => {
      const st = stateFor(a);
      const format = formatFor(a);
      const options: TargetOptions = { ...st.options };
      if (format === 'thread' && !options.threadParts?.length) {
        options.threadParts = splitIntoParts(captionFor(a), a.platform === 'threads' ? 500 : 280);
      }
      if (format !== 'thread') delete options.threadParts;
      if (format !== 'trial_reel') delete options.trialGraduation;
      return { account_id: a.id, format, caption_override: st.captionOverride, options };
    });
    return {
      title: title.trim() || null,
      caption,
      media: doneMedia,
      link: link.trim() || null,
      first_comment: firstComment.trim() || null,
      tags: tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      piece_id: linkedPiece,
      scheduled_at: scheduledAt,
      status,
      targets: tgt,
    };
  }

  async function submit(action: Action) {
    setPostErrors([]);
    setTargetErrors({});
    setNotice(null);
    if (uploading) return setPostErrors(['Wait for uploads to finish.']);
    if (action !== 'draft' && !selectedAccounts.length) return setPostErrors(['Pick at least one channel.']);
    let scheduledAt = localInputToIso(when);
    if (action === 'schedule') {
      if (!scheduledAt) return setPostErrors(['Pick a date and time to schedule.']);
      if (new Date(scheduledAt).getTime() < Date.now() - 60_000) return setPostErrors(['That time is in the past. Pick a future time or use Publish now.']);
    }
    if (action === 'publish') {
      if (!confirm(`Publish now to ${selectedAccounts.length} channel${selectedAccounts.length === 1 ? '' : 's'}?`)) return;
      scheduledAt = new Date().toISOString();
    }

    setBusy(action);
    try {
      const payload = buildPayload(action === 'draft' ? 'draft' : 'scheduled', scheduledAt);
      const id = existing?.id;
      const { post } = id ? await socialApi.updatePost(id, payload) : await socialApi.createPost(payload);
      if (action === 'publish') await socialApi.publishNow(post.id);
      const tab = action === 'draft' ? 'drafts' : action === 'publish' ? 'published' : 'queue';
      router.push(`/admin/social${tab === 'queue' ? '' : `?tab=${tab}`}`);
    } catch (e) {
      if (e instanceof ApiError) {
        const { _post, ...perAccount } = e.errors;
        setTargetErrors(perAccount);
        const unknownAccounts = Object.keys(perAccount).filter((k) => !selected.includes(k));
        setPostErrors([
          e.message,
          ...(_post ?? []),
          ...unknownAccounts.flatMap((k) => perAccount[k].map((m) => `${k}: ${m}`)),
        ]);
      } else {
        setPostErrors([errorMessage(e)]);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(null);
    }
  }

  async function searchPieces() {
    try {
      const res = await socialApi.pieces({ q: pieceQuery.trim() });
      setPieceResults(res.pieces);
    } catch (e) {
      setPieceResults([]);
      setNotice(errorMessage(e));
    }
  }

  if (loading) return <p className={s.muted}>Loading composer…</p>;
  if (loadError) return <Banner kind="error">{loadError}</Banner>;

  const connected = accounts.filter((a) => a.status === 'connected' || selected.includes(a.id));
  const unavailable = accounts.filter((a) => a.status !== 'connected' && !selected.includes(a.id));
  const tabAccount = captionTab === 'shared' ? null : accountById.get(captionTab) ?? null;
  const readOnly = existing?.status === 'published';
  const xWithVideo = selectedAccounts.some((a) => a.platform === 'x') && doneMedia.some((m) => m.type === 'video');
  const instagramCarousel = selectedAccounts.some((a) => a.platform === 'instagram' && formatFor(a) === 'carousel');

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/social" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Publisher
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>
            {existing ? 'Edit post' : 'New post'} {existing && <StatusChip status={existing.status} />}
          </h1>
        </div>
      </header>
      {existing && (
        <div style={{ marginBottom: '1rem' }}>
          <AssetGraphPanel asset={{ kind: 'social_post', id: existing.id }} title="Made from / made into" />
        </div>
      )}

      {readOnly && <Banner kind="info">This post is already published. Edits cannot be saved.</Banner>}
      {notice && <Banner kind="info" onClose={() => setNotice(null)}>{notice}</Banner>}
      {postErrors.length > 0 && (
        <div role="alert">
          <ul className={s.fieldErrors} style={{ marginBottom: '1rem' }}>
            {postErrors.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={s.composer}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          {/* Channels */}
          <section className={s.section} aria-labelledby="ch-title">
            <div className={s.labelRow}>
              <h2 id="ch-title" className={s.sectionTitle}>Channels</h2>
              <Link href="/admin/social/accounts" className={s.muted}>Manage accounts</Link>
            </div>
            {!accounts.length && (
              <p className={s.muted} style={{ margin: 0 }}>
                No accounts connected yet. <Link href="/admin/social/accounts">Connect one</Link>.
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} role="group" aria-label="Accounts to post to">
              {connected.map((a) => {
                const on = selected.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    title={`${platformLabel(a.platform)} · ${accountName(a)}`}
                    aria-label={`${platformLabel(a.platform)} ${accountName(a)}`}
                    className={`${s.avatarToggle} ${on ? s.avatarToggleOn : ''}`}
                    onClick={() => toggleAccount(a.id)}
                  >
                    <AccountAvatar platform={a.platform} avatarUrl={a.avatar_url} name={a.display_name ?? a.handle} size={40} />
                  </button>
                );
              })}
            </div>
            {selectedAccounts.length > 0 && (
              <p className={s.muted} style={{ margin: 0 }}>
                Posting to {selectedAccounts.map((a) => `${platformLabel(a.platform)} ${accountName(a)}`).join(', ')}
              </p>
            )}
            {unavailable.length > 0 && (
              <p className={s.muted} style={{ margin: 0 }}>
                Unavailable: {unavailable.map((a) => `${platformLabel(a.platform)} ${accountName(a)} (${a.status})`).join(', ')}.{' '}
                <Link href="/admin/social/accounts">Reconnect</Link>
              </p>
            )}
          </section>

          {/* Caption */}
          <section className={s.section} aria-labelledby="cap-title">
            <h2 id="cap-title" className={s.sectionTitle}>Post</h2>
            <div>
              <label className={s.label} htmlFor="post-title">Title (internal, also the YouTube title default)</label>
              <input id="post-title" className={s.input} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className={s.tabs} role="tablist" aria-label="Caption per channel" style={{ marginBottom: 0 }}>
              <button
                type="button"
                role="tab"
                aria-selected={captionTab === 'shared'}
                className={`${s.tab} ${captionTab === 'shared' ? s.tabActive : ''}`}
                onClick={() => setCaptionTab('shared')}
              >
                Shared caption
              </button>
              {selectedAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={captionTab === a.id}
                  className={`${s.tab} ${captionTab === a.id ? s.tabActive : ''}`}
                  onClick={() => setCaptionTab(a.id)}
                >
                  <AccountAvatar platform={a.platform} avatarUrl={a.avatar_url} name={a.display_name ?? a.handle} size={18} />
                  {platformLabel(a.platform)}
                  {stateFor(a).captionOverride != null && <span aria-label="customised">•</span>}
                </button>
              ))}
            </div>

            {!tabAccount ? (
              <div role="tabpanel">
                <label className={s.label} htmlFor="caption">Caption</label>
                <textarea id="caption" className={s.input} rows={8} value={caption} onChange={(e) => setCaption(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 4 }}>
                  {selectedAccounts
                    .filter((a) => stateFor(a).captionOverride == null && formatFor(a) !== 'thread')
                    .map((a) => (
                      <Counter
                        key={a.id}
                        label={a.platform === 'youtube' ? 'YouTube description' : platformLabel(a.platform)}
                        value={countChars(a.platform, caption) + (a.platform === 'x' && link.trim() && !(stateFor(a).options.linkInReply ?? true) ? 24 : 0)}
                        limit={CAPTION_LIMITS[a.platform]}
                      />
                    ))}
                  {!selectedAccounts.length && <span className={s.counter}>{[...caption].length} characters</span>}
                </div>
              </div>
            ) : (
              <div role="tabpanel">
                {stateFor(tabAccount).captionOverride == null ? (
                  <div className={s.muted}>
                    {platformLabel(tabAccount.platform)} uses the shared caption.{' '}
                    <button type="button" className={s.linkBtn} onClick={() => patchTarget(tabAccount, { captionOverride: caption })}>
                      Customise for {platformLabel(tabAccount.platform)}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={s.labelRow}>
                      <label className={s.label} htmlFor="caption-override">
                        {tabAccount.platform === 'youtube' ? 'YouTube description' : `${platformLabel(tabAccount.platform)} caption`}
                      </label>
                      <button type="button" className={s.linkBtn} onClick={() => patchTarget(tabAccount, { captionOverride: null })}>
                        Reset to shared
                      </button>
                    </div>
                    <textarea
                      id="caption-override"
                      className={s.input}
                      rows={8}
                      value={stateFor(tabAccount).captionOverride ?? ''}
                      onChange={(e) => patchTarget(tabAccount, { captionOverride: e.target.value })}
                    />
                    {formatFor(tabAccount) !== 'thread' && (
                      <Counter value={countChars(tabAccount.platform, captionFor(tabAccount))} limit={CAPTION_LIMITS[tabAccount.platform]} />
                    )}
                  </>
                )}
              </div>
            )}

            <div className={s.optionGrid}>
              <div>
                <label className={s.label} htmlFor="link">Link</label>
                <input id="link" type="url" className={s.input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <label className={s.label} htmlFor="tags">Tags (comma separated)</label>
                <input id="tags" className={s.input} value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={s.label} htmlFor="first-comment">First comment</label>
              <textarea id="first-comment" className={s.input} rows={2} value={firstComment} onChange={(e) => setFirstComment(e.target.value)} />
            </div>
          </section>

          {/* Media */}
          <section className={s.section} aria-labelledby="media-title">
            <h2 id="media-title" className={s.sectionTitle}>Media</h2>
            <MediaUploader items={media} onChange={setMedia} />
            {uploadErrors && <p className={styles.formError} style={{ margin: 0 }}>Some uploads failed. Remove them and try again.</p>}
            {instagramCarousel && (doneMedia.length < 2 || doneMedia.length > 20) && (
              <p className={styles.formError} style={{ margin: 0 }}>Instagram carousels need 2 to 20 items.</p>
            )}
            {xWithVideo && (
              <p className={styles.formError} style={{ margin: 0 }}>X is images only (memes, GIFs). Untick X for this post or remove the video.</p>
            )}
          </section>

          {/* Per-channel settings */}
          {selectedAccounts.length > 0 && (
            <section className={s.section} aria-labelledby="opt-title">
              <h2 id="opt-title" className={s.sectionTitle}>Channel settings</h2>
              {selectedAccounts.map((a) => {
                const errs = targetErrors[a.id] ?? [];
                const format = formatFor(a);
                return (
                  <div key={a.id} className={s.targetCard} style={errs.length ? { borderColor: 'var(--admin-danger)' } : undefined}>
                    <div className={s.targetHead}>
                      <AccountAvatar platform={a.platform} avatarUrl={a.avatar_url} name={a.display_name ?? a.handle} size={28} />
                      <strong style={{ fontSize: '0.875rem' }}>{platformLabel(a.platform)}</strong>
                      <span className={s.muted}>{accountName(a)}</span>
                      <span className={s.spacer} />
                      <span className={s.muted}>
                        {FORMAT_LABELS[format] ?? format}
                        {stateFor(a).format == null && ' (auto)'}
                      </span>
                    </div>
                    {errs.length > 0 && (
                      <ul className={s.fieldErrors} role="alert">
                        {errs.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                    <TargetOptionsEditor
                      platform={a.platform}
                      format={format}
                      formats={formatsFor(a.platform)}
                      options={stateFor(a).options}
                      caption={captionFor(a)}
                      postTitle={title}
                      hasLink={!!link.trim()}
                      onFormat={(f) => patchTarget(a, { format: f })}
                      onOptions={(p) => patchOptions(a, p)}
                    />
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* Sidebar: schedule + actions + import */}
        <aside className={s.side}>
          <section className={s.section} aria-labelledby="when-title">
            <h2 id="when-title" className={s.sectionTitle}>When</h2>
            <div>
              <label className={s.label} htmlFor="when">Date and time (your local time)</label>
              <input id="when" type="datetime-local" className={s.input} value={when} onChange={(e) => setWhen(e.target.value)} />
              <p className={s.muted} style={{ margin: '4px 0 0' }}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className={s.chipBtn} onClick={() => setWhen(isoToLocalInput(nextTopOfHour().toISOString()))}>
                Next free slot
              </button>
              <button
                type="button"
                className={s.chipBtn}
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(9, 0, 0, 0);
                  setWhen(isoToLocalInput(d.toISOString()));
                }}
              >
                Tomorrow 9am
              </button>
              {when && (
                <button type="button" className={s.chipBtn} onClick={() => setWhen('')}>
                  Clear
                </button>
              )}
            </div>
            <div className={s.actionsBar}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} disabled={!!busy || readOnly} onClick={() => void submit('draft')}>
                {busy === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!!busy || readOnly || !when} onClick={() => void submit('schedule')}>
                {busy === 'schedule' ? 'Scheduling…' : existing?.status === 'scheduled' ? 'Update schedule' : 'Schedule'}
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnSuccess}`} disabled={!!busy || readOnly} onClick={() => void submit('publish')}>
                {busy === 'publish' ? 'Publishing…' : 'Publish now'}
              </button>
            </div>
            {uploading && <p className={s.muted} style={{ margin: 0 }}>Uploads in progress…</p>}
          </section>

          <section className={s.section} aria-labelledby="import-title">
            <h2 id="import-title" className={s.sectionTitle}>Import from calendar</h2>
            {linkedPiece && (
              <p className={s.muted} style={{ margin: 0 }}>
                Linked to <Link href={`/admin/studio/social-calendar/${linkedPiece}`}>calendar piece</Link>.{' '}
                <button type="button" className={s.linkBtn} onClick={() => setLinkedPiece(null)}>
                  Unlink
                </button>
              </p>
            )}
            <form
              style={{ display: 'flex', gap: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                void searchPieces();
              }}
            >
              <label htmlFor="piece-q" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                Search calendar pieces
              </label>
              <input id="piece-q" className={s.input} placeholder="Search pieces" value={pieceQuery} onChange={(e) => setPieceQuery(e.target.value)} />
              <button type="submit" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                Search
              </button>
            </form>
            {pieceResults && (
              <div className={s.pieceResults}>
                {!pieceResults.length && <span className={s.muted}>No pieces found.</span>}
                {pieceResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={s.pieceResult}
                    onClick={() => {
                      if ((caption || title) && !confirm('Replace the current title and caption with this piece?')) return;
                      applyPiece(p);
                      setPieceResults(null);
                    }}
                  >
                    <strong>{p.title ?? '(untitled)'}</strong>
                    <br />
                    <span className={s.muted}>
                      {p.piece_type} · {p.status}
                      {p.scheduled_for ? ` · ${p.scheduled_for.slice(0, 10)}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
