'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '@/app/admin/admin-layout.module.css';
import { locateExcerpt, pieceTypeColor, pieceTypeLabel, PIECE_STATUSES } from '@/lib/content/calendar';

type Piece = {
  id: string;
  title: string | null;
  body: string | null;
  piece_type: string;
  status: string;
  scheduled_for: string | null;
  source_excerpt: string | null;
  notes: string | null;
  platform_meta: Record<string, any> | null;
  version_history: unknown[] | null;
};

type Sibling = { id: string; title: string | null; piece_type: string; scheduled_for: string | null; status: string };

const META_FIELDS: { key: string; label: string; types?: string[] }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'caption', label: 'Caption', types: ['short', 'ig_carousel', 'ig_lettering', 'social_ig'] },
  { key: 'cta', label: 'CTA' },
  { key: 'subreddit', label: 'Subreddit', types: ['reddit'] },
  { key: 'thread_search', label: 'Thread search', types: ['reddit'] },
];

function words(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export default function PieceEditor({ piece, sourceBody, siblings }: { piece: Piece; sourceBody: string; siblings: Sibling[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(piece.title ?? '');
  const [body, setBody] = useState(piece.body ?? '');
  const [status, setStatus] = useState(piece.status);
  const [date, setDate] = useState(piece.scheduled_for ?? '');
  const [notes, setNotes] = useState(piece.notes ?? '');
  const [meta, setMeta] = useState<Record<string, any>>(piece.platform_meta ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const markRef = useRef<HTMLElement>(null);

  const located = useMemo(() => locateExcerpt(sourceBody, piece.source_excerpt), [sourceBody, piece.source_excerpt]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const dirty =
    title !== (piece.title ?? '') ||
    body !== (piece.body ?? '') ||
    status !== piece.status ||
    date !== (piece.scheduled_for ?? '') ||
    notes !== (piece.notes ?? '') ||
    JSON.stringify(meta) !== JSON.stringify(piece.platform_meta ?? {});

  async function save(nextStatus?: string) {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/studio/pieces/${piece.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        status: nextStatus ?? status,
        scheduled_for: date || null,
        notes: notes || null,
        platform_meta: meta,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(`Save failed: ${j.error ?? res.status}`);
      return;
    }
    if (nextStatus) setStatus(nextStatus);
    setMsg('Saved');
    router.refresh();
  }

  const blocks = body.split(/\n---\n/);
  const gaps = (body.match(/\[AUSTIN:[^\]]*\]/g) ?? []).length;
  const dashes = (body.match(/—/g) ?? []).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
      {/* Source */}
      <section className={styles.card} style={{ position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 8rem)', overflowY: 'auto' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Source article</h2>
        </div>
        {!sourceBody && <p className={styles.emptyDescription}>No source article linked.</p>}
        {sourceBody && !located && piece.source_excerpt && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            The excerpt below wasn&apos;t found verbatim in the article, so nothing is highlighted:
            <br />
            <em>{piece.source_excerpt}</em>
          </p>
        )}
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.65 }}>
          {located ? (
            <>
              {located.before}
              <mark ref={markRef} style={{ background: 'rgba(250, 204, 21, 0.35)', color: 'inherit', padding: '0 2px' }}>
                {located.match}
              </mark>
              {located.after}
            </>
          ) : (
            sourceBody
          )}
        </div>
      </section>

      {/* Piece */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className={styles.card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'end' }}>
            <div className={styles.formGroup} style={{ margin: 0 }}>
              <label className={styles.formLabel}>Title</label>
              <input className={styles.formInput} style={{ width: '100%', boxSizing: 'border-box' }} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ margin: 0 }}>
              <label className={styles.formLabel}>Publish date</label>
              <input type="date" className={styles.formInput} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className={styles.formGroup} style={{ margin: 0 }}>
              <label className={styles.formLabel}>Status</label>
              <select className={styles.formInput} value={status} onChange={(e) => setStatus(e.target.value)}>
                {PIECE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            {META_FIELDS.filter((f) => !f.types || f.types.includes(piece.piece_type)).map((f) => (
              <div key={f.key} className={styles.formGroup} style={{ margin: 0 }}>
                <label className={styles.formLabel}>
                  {f.label}
                  {f.key === 'hook' && meta.hook_score != null && (
                    <span style={{ marginLeft: 6, color: 'var(--admin-text-muted)', fontWeight: 400 }}>
                      score {meta.hook_score}/10{meta.hook_type ? ` · ${meta.hook_type}` : ''}
                    </span>
                  )}
                </label>
                <textarea
                  className={styles.formTextarea}
                  rows={f.key === 'caption' ? 4 : 3}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={meta[f.key] ?? ''}
                  onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className={styles.cardTitle}>Copy</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              {words(body)} words
              {blocks.length > 1 && ` · ${blocks.length} ${piece.piece_type === 'ig_carousel' ? 'slides' : 'parts'}`}
              {gaps > 0 && <span style={{ color: '#f59e0b' }}> · {gaps} [AUSTIN] gap{gaps > 1 ? 's' : ''}</span>}
              {dashes > 0 && <span style={{ color: '#ef4444' }}> · {dashes} em dash{dashes > 1 ? 'es' : ''}</span>}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', margin: '0 0 0.5rem' }}>
            Separate slides or thread posts with a line containing only <code>---</code>.
          </p>
          <textarea
            className={styles.formTextarea}
            style={{ width: '100%', boxSizing: 'border-box', minHeight: '28rem', fontFamily: 'inherit', fontSize: '0.9375rem', lineHeight: 1.6 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
            <label className={styles.formLabel}>Notes</label>
            <textarea className={styles.formTextarea} style={{ width: '100%', boxSizing: 'border-box' }} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving || !dirty} onClick={() => save()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {status !== 'approved' && (
              <button className={`${styles.btn} ${styles.btnSuccess}`} disabled={saving} onClick={() => save('approved')}>
                Save and approve
              </button>
            )}
            {msg && <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{msg}</span>}
          </div>
        </div>

        {siblings.length > 1 && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Other pieces from this article</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/studio/social-calendar/${s.id}`}
                  style={{
                    fontSize: '0.8125rem',
                    textDecoration: 'none',
                    color: 'var(--admin-text)',
                    fontWeight: s.id === piece.id ? 700 : 400,
                    borderLeft: `3px solid ${pieceTypeColor(s.piece_type)}`,
                    paddingLeft: 8,
                  }}
                >
                  {s.scheduled_for ?? 'unscheduled'} · {pieceTypeLabel(s.piece_type)} · {s.title ?? '(untitled)'}
                  {s.status !== 'draft' && <span style={{ color: 'var(--admin-text-muted)' }}> · {s.status}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
