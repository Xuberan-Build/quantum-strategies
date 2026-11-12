'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';
import type { AssetRef, PieceType } from '@/lib/content/any-to-any/types';

type Targets = {
  form: PieceType | 'article';
  longer: PieceType[];
  same: PieceType[];
  shorter: PieceType[];
  labels: Record<string, string>;
};

type ResearchUsed = {
  topic: { id: string; title: string; matchedBy: string; reason: string } | null;
  sources: number;
  firstHand: number;
  questions: number;
  links: number;
  gaps: string[];
  long: boolean;
};

type Made = {
  piece: { id: string; title: string | null; piece_type: PieceType };
  linkId: string | null;
  warnings: string[];
  research?: ResearchUsed | null;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the in-app research step pulled in, plus the handoff to the full agent pipeline for long forms. */
function ResearchUsedBox({ research, pieceId }: { research: ResearchUsed; pieceId: string }) {
  const [copied, setCopied] = useState(false);
  const command = `/content-run piece:${pieceId}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div
      role="group"
      aria-label="Research used"
      style={{ border: '1px solid var(--admin-border)', borderRadius: '0.375rem', padding: '0.5rem 0.625rem', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <strong style={{ fontSize: '0.8125rem' }}>Research used</strong>
      <span>
        {research.topic ? (
          <>
            Topic: {research.topic.title} <code style={{ fontSize: '0.75rem' }}>{research.topic.id}</code>
            <span style={{ color: 'var(--admin-text-muted)' }}> ({research.topic.matchedBy === 'asset' ? 'the source is one of its assets' : research.topic.reason})</span>
          </>
        ) : (
          'No topic match'
        )}
      </span>
      <span>
        {plural(research.sources, 'source')} · {plural(research.firstHand, 'first-hand item')} · {plural(research.questions, 'audience question')} · {plural(research.links, 'internal link')}
      </span>
      {research.gaps.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--admin-text-muted)' }}>
          {research.gaps.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}
      {research.long && (
        <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--admin-border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ fontSize: '0.8125rem' }}>Run the full research pipeline</strong>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--admin-border)', borderRadius: 4, userSelect: 'all', overflowWrap: 'anywhere' }}>{command}</code>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => void copy()} aria-label={`Copy ${command}`}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <span style={{ color: 'var(--admin-text-muted)' }}>Runs the brief, first-hand and QA agents in Claude Code with your approvals.</span>
        </div>
      )}
    </div>
  );
}

const GROUPS: { key: 'longer' | 'same' | 'shorter'; label: string }[] = [
  { key: 'longer', label: 'Longer' },
  { key: 'same', label: 'Same length' },
  { key: 'shorter', label: 'Shorter' },
];

/**
 * "Make from this": turn this asset into another form (longer, same length or shorter).
 * Posts to /api/admin/content/make and links to the new draft piece.
 */
export default function MakeFromThis({
  source,
  insightId,
  sourceForm,
  onMade,
}: {
  source: AssetRef;
  insightId?: string | null;
  sourceForm?: PieceType | 'article';
  onMade?: (pieceId: string) => void;
}) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const ctxId = `${uid}-ctx`;
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState<PieceType | null>(null);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<Made | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  const external = source.kind === 'external';
  const needsContext = external && !extra.trim();

  const loadTargets = useCallback(async () => {
    setLoadError(null);
    const q = sourceForm
      ? `form=${encodeURIComponent(sourceForm)}`
      : `kind=${encodeURIComponent(source.kind)}&id=${encodeURIComponent(source.id)}`;
    try {
      const res = await fetch(`/api/admin/content/make/targets?${q}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setTargets(j as Targets);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [source.kind, source.id, sourceForm]);

  useEffect(() => {
    if (open && !targets && !loadError) void loadTargets();
  }, [open, targets, loadError, loadTargets]);

  useEffect(() => {
    if (open && targets) firstOptionRef.current?.focus();
  }, [open, targets]);

  function close() {
    if (busy) return;
    setOpen(false);
    toggleRef.current?.focus();
  }

  async function make() {
    if (!target || needsContext) return;
    setBusy(true);
    setError(null);
    setMade(null);
    try {
      const res = await fetch('/api/admin/content/make', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          target,
          insightId: insightId ?? undefined,
          extraContext: extra.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMade(j as Made);
      onMade?.((j as Made).piece.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const label = (t: string) => targets?.labels[t] ?? t;
  const firstTarget = targets ? [...targets.longer, ...targets.same, ...targets.shorter][0] : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <button
        ref={toggleRef}
        type="button"
        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Make from this {open ? '▴' : '▾'}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Make another form from this asset"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
          style={{
            width: '100%',
            maxWidth: 520,
            boxSizing: 'border-box',
            border: '1px solid var(--admin-border)',
            borderRadius: '0.5rem',
            background: 'var(--admin-surface)',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {!targets && !loadError && <p style={{ margin: 0, fontSize: '0.8125rem' }} aria-live="polite">Loading forms…</p>}
          {loadError && (
            <div className={styles.formError} role="alert">
              Could not load forms: {loadError}{' '}
              <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => setLoadError(null)}>
                Retry
              </button>
            </div>
          )}

          {targets &&
            GROUPS.map((g) => {
              const items = targets[g.key];
              if (!items.length) return null;
              return (
                <fieldset key={g.key} style={{ border: 'none', margin: 0, padding: 0 }}>
                  <legend className={styles.formLabel} style={{ marginBottom: 4 }}>
                    {g.label}
                  </legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((t) => {
                      const isFirst = t === firstTarget;
                      const selected = target === t;
                      return (
                        <button
                          key={t}
                          ref={isFirst ? firstOptionRef : undefined}
                          type="button"
                          aria-pressed={selected}
                          disabled={busy}
                          className={`${styles.btn} ${selected ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSmall}`}
                          onClick={() => setTarget(t)}
                        >
                          {label(t)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

          {targets && (
            <div className={styles.formGroup} style={{ margin: 0 }}>
              <label htmlFor={ctxId} className={styles.formLabel}>
                {external ? 'Paste the source text (required: we cannot fetch it)' : 'Extra context (optional)'}
              </label>
              <textarea
                id={ctxId}
                className={styles.formTextarea}
                rows={external ? 6 : 3}
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={extra}
                disabled={busy}
                required={external}
                aria-required={external}
                placeholder={external ? 'The post or comment text, plus anything about how it did' : 'What to focus on, the sub, the hook, a story to use…'}
                onChange={(e) => setExtra(e.target.value)}
              />
            </div>
          )}

          {targets && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                disabled={!target || busy || needsContext}
                onClick={() => void make()}
              >
                {busy ? 'Making…' : target ? `Make ${label(target)}` : 'Pick a form'}
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} disabled={busy} onClick={close}>
                Close
              </button>
            </div>
          )}

          <div aria-live="polite" style={{ fontSize: '0.8125rem' }}>
            {busy && target && (
              <p style={{ margin: 0, color: 'var(--admin-text-muted)' }}>
                Writing the {label(target)} draft. {target === 'youtube_long' || target === 'short' ? 'Scripts are validated and repaired, so this can take a few minutes.' : 'This usually takes under a minute.'}
              </p>
            )}
            {made && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>
                  Draft saved:{' '}
                  <Link href={`/admin/studio/social-calendar/${made.piece.id}`}>
                    {made.piece.title ?? label(made.piece.piece_type)} ↗
                  </Link>
                  {!made.linkId && <span style={{ color: 'var(--admin-text-muted)' }}> (not linked in the asset graph)</span>}
                </span>
                {made.research && <ResearchUsedBox research={made.research} pieceId={made.piece.id} />}
                {made.warnings.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#b45309' }}>
                    {made.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {error && (
            <div className={styles.formError} role="alert">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
