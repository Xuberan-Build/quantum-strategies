'use client';

import { useId, useState } from 'react';
import type { BrainFeedbackRow, FeedbackAnchor, FeedbackKind, FeedbackStatus } from '@/lib/brain/feedback';
import { formatDateTime } from '@/lib/brain/viz';
import styles from './feedback.module.css';

export const KIND_LABEL: Record<FeedbackKind, string> = {
  agree: 'Agree',
  change: 'Change',
  question: 'Question',
  idea: 'Idea',
};

const KINDS: FeedbackKind[] = ['agree', 'change', 'question', 'idea'];

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  open: 'Open',
  answered: 'Answered',
  applied: 'Applied',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export type FeedbackTargetRef =
  | { target_type: 'deck'; target_id: string }
  | { target_type: 'slide'; target_id: string; slide_id: string }
  | { target_type: 'doc'; target_id: string; anchor: FeedbackAnchor }
  | { target_type: 'node'; target_id: string };

interface ComposerProps {
  target: FeedbackTargetRef;
  onSaved: (row: BrainFeedbackRow) => void;
  /** Label for what the note is about, e.g. "Slide 3" or a quoted selection. */
  context?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

export function FeedbackComposer({ target, onSaved, context, autoFocus, onCancel }: ComposerProps) {
  const [kind, setKind] = useState<FeedbackKind>('change');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/brain/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...target, kind, body }),
      });
      const json = (await res.json().catch(() => ({}))) as { row?: BrainFeedbackRow; error?: string };
      if (!res.ok || !json.row) throw new Error(json.error || `Save failed (${res.status})`);
      onSaved(json.row);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.composer} onSubmit={submit} aria-label="Leave feedback">
      {context && <div className={styles.composerContext}>{context}</div>}
      <div className={styles.kindRow} role="radiogroup" aria-label="Feedback type">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            className={`${styles.kind} ${styles[`kind_${k}`]} ${kind === k ? styles.kindActive : ''}`}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-body`} className={styles.srOnly}>
        Note
      </label>
      <textarea
        id={`${id}-body`}
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What should change, what lands, what is unclear…"
        rows={3}
        maxLength={4000}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
          if (e.key === 'Escape' && onCancel) {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.composerActions}>
        <span className={styles.hint}>⌘↵ to save</span>
        {onCancel && (
          <button type="button" className={styles.ghost} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.save} disabled={saving || !body.trim()}>
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </form>
  );
}

interface ThreadProps {
  rows: BrainFeedbackRow[];
  /** Called with the updated row after Resolve or Reopen. */
  onUpdated?: (row: BrainFeedbackRow) => void;
  /** Called with the id after a note is deleted. */
  onDeleted?: (id: string) => void;
  emptyText?: string;
  /** Shown on doc comments whose anchor was re-found by quote or heading, not exactly. */
  driftNote?: (row: BrainFeedbackRow) => string | null;
  compact?: boolean;
  /** Show whether each note has been pulled into the brain (synced_to_brain_at). */
  showSync?: boolean;
  /** Optional context line per note, e.g. "Slide 3 · Title" in an all-notes view. */
  noteContext?: (row: BrainFeedbackRow) => React.ReactNode;
}

/** "Logged to brain" once pull-feedback.ts has written the note to brain/feedback/inbox and set synced_to_brain_at. */
export function SyncStatus({ row }: { row: Pick<BrainFeedbackRow, 'synced_to_brain_at'> }) {
  const synced = Boolean(row.synced_to_brain_at);
  return (
    <span
      className={`${styles.syncChip} ${synced ? styles.sync_logged : styles.sync_waiting}`}
      title={synced ? `Pulled into brain/feedback ${formatDateTime(row.synced_to_brain_at!)}` : 'Not pulled into the brain yet. It goes on the next brain tick.'}
    >
      {synced ? 'Logged to brain' : 'Waiting for sync'}
    </span>
  );
}

const CLOSED: FeedbackStatus[] = ['resolved', 'dismissed'];

function NoteActions({
  row,
  onUpdated,
  onDeleted,
}: {
  row: BrainFeedbackRow;
  onUpdated?: (row: BrainFeedbackRow) => void;
  onDeleted?: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = CLOSED.includes(row.status);

  async function setStatus(status: FeedbackStatus) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brain/feedback/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => ({}))) as { row?: BrainFeedbackRow; error?: string };
      if (!res.ok || !json.row) throw new Error(json.error || `Update failed (${res.status})`);
      onUpdated?.(json.row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brain/feedback/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || `Delete failed (${res.status})`);
      }
      onDeleted?.(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.noteActions}>
      {onUpdated && (
        <button type="button" className={styles.ghost} disabled={busy} onClick={() => setStatus(closed ? 'open' : 'resolved')}>
          {closed ? 'Reopen' : 'Resolve'}
        </button>
      )}
      {onDeleted &&
        (confirming ? (
          <>
            <span className={styles.hint}>Delete this note?</span>
            <button type="button" className={styles.danger} disabled={busy} onClick={remove}>
              {busy ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" className={styles.ghost} disabled={busy} onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className={styles.ghost} disabled={busy} onClick={() => setConfirming(true)}>
            Delete
          </button>
        ))}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FeedbackThread({ rows, emptyText, driftNote, compact, onUpdated, onDeleted, showSync, noteContext }: ThreadProps) {
  if (!rows.length) return emptyText ? <p className={styles.empty}>{emptyText}</p> : null;
  return (
    <ul className={`${styles.thread} ${compact ? styles.threadCompact : ''}`}>
      {rows.map((row) => {
        const drift = driftNote?.(row);
        const context = noteContext?.(row);
        return (
          <li key={row.id} className={`${styles.note} ${CLOSED.includes(row.status) ? styles.noteClosed : ''}`}>
            {context && <div className={styles.noteContext}>{context}</div>}
            <div className={styles.noteHead}>
              <span className={`${styles.kindChip} ${styles[`kind_${row.kind}`]}`}>{KIND_LABEL[row.kind]}</span>
              <span className={`${styles.statusChip} ${styles[`status_${row.status}`]}`}>{STATUS_LABEL[row.status]}</span>
              {showSync && <SyncStatus row={row} />}
              <time className={styles.time} dateTime={row.created_at}>
                {formatDateTime(row.created_at)}
              </time>
            </div>
            {row.anchor?.quote && <blockquote className={styles.quoted}>{row.anchor.quote}</blockquote>}
            <p className={styles.body}>{row.body}</p>
            {drift && <p className={styles.drift}>{drift}</p>}
            {row.reply && (
              <div className={styles.reply}>
                <div className={styles.replyHead}>
                  Claude{row.replied_at ? ` · ${formatDateTime(row.replied_at)}` : ''}
                </div>
                <p className={styles.body}>{row.reply}</p>
              </div>
            )}
            {(onUpdated || onDeleted) && <NoteActions row={row} onUpdated={onUpdated} onDeleted={onDeleted} />}
          </li>
        );
      })}
    </ul>
  );
}
