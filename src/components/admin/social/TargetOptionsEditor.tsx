'use client';

import { useId } from 'react';
import type { Format, Platform, TargetOptions } from '@/lib/social/types';
import { FORMAT_LABELS } from '@/lib/social/types';
import { countChars, splitIntoParts, YT_TITLE_LIMIT } from './composer-logic';
import s from './social.module.css';

interface Props {
  platform: Platform;
  format: Format;
  formats: Format[];
  options: TargetOptions;
  caption: string;
  postTitle: string;
  hasLink: boolean;
  onFormat: (f: Format) => void;
  onOptions: (patch: Partial<TargetOptions>) => void;
}

export function Counter({ value, limit, label }: { value: number; limit: number; label?: string }) {
  const over = value > limit;
  return (
    <span className={`${s.counter} ${over ? s.counterOver : ''}`} aria-live={over ? 'polite' : undefined}>
      {label ? `${label} ` : ''}
      {value}/{limit}
      {over && ' (too long)'}
    </span>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={s.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function FormatPicker({ id, format, formats, onFormat }: { id: string; format: Format; formats: Format[]; onFormat: (f: Format) => void }) {
  const list = formats.includes(format) ? formats : [format, ...formats];
  return (
    <div>
      <label className={s.label} htmlFor={id}>Format</label>
      <select id={id} className={s.input} value={format} onChange={(e) => onFormat(e.target.value as Format)}>
        {list.map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABELS[f] ?? f}
          </option>
        ))}
      </select>
    </div>
  );
}

function InstagramOptions({ id, format, formats, options, onFormat, onOptions }: Props & { id: string }) {
  const isReel = format === 'reel' || format === 'trial_reel';
  const canTrial = formats.includes('trial_reel');
  return (
    <>
      {isReel && canTrial && (
        <div className={s.trialBox}>
          <label className={s.check} style={{ fontSize: '0.9375rem' }}>
            <input
              type="checkbox"
              checked={format === 'trial_reel'}
              onChange={(e) => onFormat(e.target.checked ? 'trial_reel' : 'reel')}
            />
            <strong>Post as Trial Reel</strong>
          </label>
          <span className={s.muted}>Shown to non-followers first, so a test does not touch your follower feed.</span>
          {format === 'trial_reel' && (
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend className={s.label}>When it should reach your followers</legend>
              <div className={s.radioRow}>
                <label>
                  <input
                    type="radio"
                    name={`${id}-grad`}
                    checked={(options.trialGraduation ?? 'MANUAL') === 'MANUAL'}
                    onChange={() => onOptions({ trialGraduation: 'MANUAL' })}
                  />
                  Manual (I graduate it in the app)
                </label>
                <label>
                  <input
                    type="radio"
                    name={`${id}-grad`}
                    checked={options.trialGraduation === 'SS_PERFORMANCE'}
                    onChange={() => onOptions({ trialGraduation: 'SS_PERFORMANCE' })}
                  />
                  Auto if it performs well
                </label>
              </div>
            </fieldset>
          )}
        </div>
      )}
      <div className={s.optionGrid}>
        <FormatPicker id={`${id}-format`} format={format} formats={formats} onFormat={onFormat} />
        {isReel && (
          <>
            <div>
              <label className={s.label} htmlFor={`${id}-cover`}>Cover image URL (optional)</label>
              <input
                id={`${id}-cover`}
                className={s.input}
                type="url"
                value={options.coverUrl ?? ''}
                onChange={(e) => onOptions({ coverUrl: e.target.value || undefined })}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className={s.label} htmlFor={`${id}-thumb`}>Cover frame at (seconds)</label>
              <input
                id={`${id}-thumb`}
                className={s.input}
                type="number"
                min={0}
                step={0.1}
                value={options.thumbOffsetMs != null ? options.thumbOffsetMs / 1000 : ''}
                onChange={(e) => onOptions({ thumbOffsetMs: e.target.value === '' ? undefined : Math.round(Number(e.target.value) * 1000) })}
              />
            </div>
          </>
        )}
      </div>
      {format === 'reel' && (
        <Check checked={options.shareToFeed ?? true} onChange={(v) => onOptions({ shareToFeed: v })}>
          Also share to the main feed
        </Check>
      )}
    </>
  );
}

function YouTubeOptions({ id, format, formats, options, postTitle, onFormat, onOptions }: Props & { id: string }) {
  const title = options.ytTitle ?? '';
  return (
    <>
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend className={s.label}>Type</legend>
        <div className={s.radioRow}>
          {(['video', 'short'] as Format[]).filter((f) => formats.includes(f) || f === format).map((f) => (
            <label key={f}>
              <input type="radio" name={`${id}-type`} checked={format === f} onChange={() => onFormat(f)} />
              {f === 'short' ? 'Short (vertical, up to 3 min)' : 'Video'}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <div className={s.labelRow}>
          <label className={s.label} htmlFor={`${id}-title`}>Title</label>
          <Counter value={[...(title || postTitle)].length} limit={YT_TITLE_LIMIT} />
        </div>
        <input
          id={`${id}-title`}
          className={s.input}
          value={title}
          placeholder={postTitle || 'Video title'}
          onChange={(e) => onOptions({ ytTitle: e.target.value || undefined })}
        />
        <p className={s.muted} style={{ margin: '4px 0 0' }}>
          The description is this channel&apos;s caption (5000 max). Customise it in the caption tabs.
        </p>
      </div>
      <div className={s.optionGrid}>
        <div>
          <label className={s.label} htmlFor={`${id}-tags`}>Tags (comma separated)</label>
          <input
            id={`${id}-tags`}
            className={s.input}
            value={(options.ytTags ?? []).join(', ')}
            onChange={(e) =>
              onOptions({ ytTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
            }
          />
        </div>
        <div>
          <label className={s.label} htmlFor={`${id}-privacy`}>Privacy</label>
          <select
            id={`${id}-privacy`}
            className={s.input}
            value={options.ytPrivacy ?? 'public'}
            onChange={(e) => onOptions({ ytPrivacy: e.target.value as TargetOptions['ytPrivacy'] })}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
      <Check checked={options.ytMadeForKids ?? false} onChange={(v) => onOptions({ ytMadeForKids: v })}>
        Made for kids
      </Check>
    </>
  );
}

function TikTokOptions({ id, format, formats, options, onFormat, onOptions }: Props & { id: string }) {
  return (
    <>
      <div className={s.optionGrid}>
        <FormatPicker id={`${id}-format`} format={format} formats={formats} onFormat={onFormat} />
        <div>
          <label className={s.label} htmlFor={`${id}-privacy`}>Who can view</label>
          <select
            id={`${id}-privacy`}
            className={s.input}
            value={options.ttPrivacy ?? 'PUBLIC_TO_EVERYONE'}
            onChange={(e) => onOptions({ ttPrivacy: e.target.value as TargetOptions['ttPrivacy'] })}
          >
            <option value="PUBLIC_TO_EVERYONE">Everyone</option>
            <option value="FOLLOWER_OF_CREATOR">Followers</option>
            <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
            <option value="SELF_ONLY">Only me</option>
          </select>
        </div>
      </div>
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend className={s.label}>How to post</legend>
        <div className={s.radioRow}>
          <label>
            <input type="radio" name={`${id}-mode`} checked={(options.ttMode ?? 'direct') === 'direct'} onChange={() => onOptions({ ttMode: 'direct' })} />
            Post directly
          </label>
          <label>
            <input type="radio" name={`${id}-mode`} checked={options.ttMode === 'draft'} onChange={() => onOptions({ ttMode: 'draft' })} />
            Send to TikTok inbox (finish in the app: sounds, text)
          </label>
        </div>
      </fieldset>
      <div className={s.radioRow}>
        <Check checked={options.ttDisableComment ?? false} onChange={(v) => onOptions({ ttDisableComment: v })}>Disable comments</Check>
        <Check checked={options.ttDisableDuet ?? false} onChange={(v) => onOptions({ ttDisableDuet: v })}>Disable duet</Check>
        <Check checked={options.ttDisableStitch ?? false} onChange={(v) => onOptions({ ttDisableStitch: v })}>Disable stitch</Check>
        <Check checked={options.ttBrandedContent ?? false} onChange={(v) => onOptions({ ttBrandedContent: v })}>Branded content</Check>
      </div>
    </>
  );
}

function ThreadEditor({ id, platform, options, caption, onOptions }: Props & { id: string }) {
  const limit = platform === 'threads' ? 500 : 280;
  const parts = options.threadParts?.length ? options.threadParts : splitIntoParts(caption, limit);
  const set = (next: string[]) => onOptions({ threadParts: next });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div className={s.labelRow}>
        <span className={s.label}>Thread ({parts.length} post{parts.length === 1 ? '' : 's'})</span>
        <button type="button" className={s.linkBtn} onClick={() => set(splitIntoParts(caption, limit))}>
          Re-split from caption
        </button>
      </div>
      {parts.map((p, i) => (
        <div key={i}>
          <div className={s.labelRow}>
            <label className={s.label} htmlFor={`${id}-part-${i}`}>Post {i + 1}</label>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Counter value={countChars(platform, p)} limit={limit} />
              {parts.length > 1 && (
                <button type="button" className={s.iconBtn} aria-label={`Remove post ${i + 1}`} onClick={() => set(parts.filter((_, j) => j !== i))}>
                  ✕
                </button>
              )}
            </span>
          </div>
          <textarea
            id={`${id}-part-${i}`}
            className={s.input}
            rows={3}
            value={p}
            onChange={(e) => set(parts.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </div>
      ))}
      <div>
        <button type="button" className={s.iconBtn} onClick={() => set([...parts, ''])}>
          + Add post
        </button>
      </div>
    </div>
  );
}

function XOptions(props: Props & { id: string }) {
  const { id, format, formats, options, hasLink, onFormat, onOptions } = props;
  return (
    <>
      <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend className={s.label}>Type</legend>
        <div className={s.radioRow}>
          {(['tweet', 'thread'] as Format[]).filter((f) => formats.includes(f) || f === format).map((f) => (
            <label key={f}>
              <input type="radio" name={`${id}-type`} checked={format === f} onChange={() => onFormat(f)} />
              {f === 'thread' ? 'Thread' : 'Single post'}
            </label>
          ))}
        </div>
      </fieldset>
      {format === 'thread' && <ThreadEditor {...props} />}
      {props.platform === 'x' && (
        <Check checked={options.linkInReply ?? true} onChange={(v) => onOptions({ linkInReply: v })}>
          Put the link in the first reply{hasLink ? '' : ' (when a link is set)'}
        </Check>
      )}
    </>
  );
}

export default function TargetOptionsEditor(props: Props) {
  const id = useId();
  switch (props.platform) {
    case 'instagram':
      return <InstagramOptions {...props} id={id} />;
    case 'youtube':
      return <YouTubeOptions {...props} id={id} />;
    case 'tiktok':
      return <TikTokOptions {...props} id={id} />;
    case 'x':
    case 'threads':
      return <XOptions {...props} id={id} />;
    default:
      return <FormatPicker id={`${id}-format`} format={props.format} formats={props.formats} onFormat={props.onFormat} />;
  }
}
