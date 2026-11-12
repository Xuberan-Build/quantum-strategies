'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import s from '@/components/admin/social/social.module.css';
import { errorMessage, formatName, pieceHref, winnersApi, type PieceType, type Promotion } from './api';
import w from './winners.module.css';

type Platform = 'reddit' | 'x';

/** Longer forms offered per source (mirrors suggestFormats in the lib; kept here so the client bundle stays small). */
const FORMATS: Record<Platform, Record<string, PieceType[]>> = {
  reddit: { post: ['blog', 'youtube_long'], answer: ['blog', 'youtube_long', 'x_article'] },
  x: { post: ['reddit_post', 'blog', 'x_article', 'youtube_long'], answer: ['reddit_post', 'blog', 'x_article', 'youtube_long'] },
};

const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

export default function ExternalWinnerForm({ onAdded }: { onAdded: () => void }) {
  const [platform, setPlatform] = useState<Platform>('reddit');
  const [kind, setKind] = useState<'post' | 'answer'>('post');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [upvotes, setUpvotes] = useState('');
  const [comments, setComments] = useState('');
  const [typical, setTypical] = useState('');
  const [text, setText] = useState('');
  const [format, setFormat] = useState<PieceType>('blog');
  const [busy, setBusy] = useState<'save' | 'make' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Promotion | null>(null);
  const [made, setMade] = useState<{ id: string; title: string | null; warnings: string[] } | null>(null);

  const options = FORMATS[platform][kind];
  const value = platform === 'reddit' ? num(upvotes) + num(comments) : num(comments);
  const median = typical.trim() === '' ? null : Number(typical);
  const multiple = median && median > 0 ? Math.round((value / median) * 10) / 10 : null;

  const changePlatform = (p: Platform) => {
    setPlatform(p);
    setFormat(FORMATS[p][kind][0]);
  };
  const changeKind = (k: 'post' | 'answer') => {
    setKind(k);
    setFormat(FORMATS[platform][k][0]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSaved(null);
    setMade(null);
    if (!/^https?:\/\/\S+$/i.test(url.trim())) return setErr('Paste the full https:// link to the post.');
    if (!Number.isFinite(value) || (median !== null && !Number.isFinite(median))) return setErr('The numbers need to be numbers.');
    setBusy('save');
    try {
      const res = await winnersApi.addExternal({
        url: url.trim(),
        platform,
        metric: platform === 'reddit' ? 'upvotes_plus_comments' : 'replies',
        value,
        channel_median: median,
        title: title.trim() || undefined,
        text: text.trim() || undefined,
        format,
        source_format: kind,
      });
      setSaved(res.promotion);
      onAdded();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(null);
    }
  };

  const makeNow = async () => {
    if (!saved) return;
    setBusy('make');
    setErr(null);
    try {
      const res = await winnersApi.accept(saved.id);
      setMade({ id: res.piece.id, title: res.piece.title, warnings: res.warnings });
      setSaved(null);
      setUrl('');
      setTitle('');
      setUpvotes('');
      setComments('');
      setTypical('');
      setText('');
      onAdded();
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(null);
    }
  };

  return (
    <form className={w.form} onSubmit={submit}>
      <div>
        <label className={s.label} htmlFor="ext-platform">Where</label>
        <select id="ext-platform" className={s.input} value={platform} onChange={(e) => changePlatform(e.target.value as Platform)}>
          <option value="reddit">Reddit</option>
          <option value="x">X (posted by hand)</option>
        </select>
      </div>
      <div>
        <label className={s.label} htmlFor="ext-kind">What it was</label>
        <select id="ext-kind" className={s.input} value={kind} onChange={(e) => changeKind(e.target.value as 'post' | 'answer')}>
          <option value="post">A post</option>
          <option value="answer">{platform === 'reddit' ? 'A comment / answer' : 'A reply'}</option>
        </select>
      </div>
      <div className={w.full}>
        <label className={s.label} htmlFor="ext-url">Link</label>
        <input id="ext-url" className={s.input} type="url" required placeholder="https://www.reddit.com/r/…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className={w.full}>
        <label className={s.label} htmlFor="ext-title">Title</label>
        <input id="ext-title" className={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The post title or its first line" />
      </div>
      {platform === 'reddit' && (
        <div>
          <label className={s.label} htmlFor="ext-up">Upvotes</label>
          <input id="ext-up" className={s.input} inputMode="numeric" value={upvotes} onChange={(e) => setUpvotes(e.target.value)} />
        </div>
      )}
      <div>
        <label className={s.label} htmlFor="ext-comments">{platform === 'reddit' ? 'Comments' : 'Replies'}</label>
        <input id="ext-comments" className={s.input} inputMode="numeric" value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>
      <div>
        <label className={s.label} htmlFor="ext-typical">{platform === 'reddit' ? "The sub's typical score" : 'Your typical replies'}</label>
        <input
          id="ext-typical"
          className={s.input}
          inputMode="numeric"
          value={typical}
          onChange={(e) => setTypical(e.target.value)}
          placeholder={platform === 'reddit' ? 'Upvotes + comments on a normal post' : 'Replies on a normal post'}
        />
      </div>
      <div>
        <label className={s.label} htmlFor="ext-format">Make it into</label>
        <select id="ext-format" className={s.input} value={format} onChange={(e) => setFormat(e.target.value as PieceType)}>
          {options.map((f) => (
            <option key={f} value={f}>{formatName(f)}</option>
          ))}
        </select>
      </div>
      <div className={w.full}>
        <label className={s.label} htmlFor="ext-text">The post text</label>
        <textarea
          id="ext-text"
          className={`${s.input} ${w.textarea}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the whole post. The generator reads it, since our tools can't open Reddit."
        />
      </div>
      <div className={`${w.full} ${w.row}`}>
        <span className={s.muted}>
          {value > 0 ? `${value} ${platform === 'reddit' ? 'upvotes + comments' : 'replies'}` : 'Add the numbers'}
          {multiple !== null && ` · x${multiple} the typical${multiple >= 3 ? ' (a winner)' : ' (under 3x, log it anyway if it felt alive)'}`}
        </span>
        <span className={w.buttons}>
          {saved && saved.status === 'proposed' && (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={makeNow} disabled={!!busy}>
              {busy === 'make' ? 'Writing… (up to a few minutes)' : `Make the ${formatName(saved.proposed_format)} now`}
            </button>
          )}
          <button type="submit" className={`${styles.btn} ${saved ? styles.btnSecondary : styles.btnPrimary}`} disabled={!!busy}>
            {busy === 'save' ? 'Saving…' : 'Log the winner'}
          </button>
        </span>
      </div>
      {(err || saved || made) && (
        <p className={`${w.full} ${err ? w.err : made?.warnings.length ? w.warn : w.ok}`} role="status" style={{ margin: 0 }}>
          {err}
          {!err && saved && (saved.status === 'proposed' ? 'Logged. It is in Proposed below.' : `Already logged (${saved.status}).`)}
          {!err && made && (
            <>
              Made &quot;{made.title ?? "the piece"}&quot;. {made.warnings.join(' ')} <Link href={pieceHref(made.id)}>Open the piece</Link>
            </>
          )}
        </p>
      )}
    </form>
  );
}
