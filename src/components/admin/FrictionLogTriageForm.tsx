'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';
import {
  FRICTION_STATUSES,
  type FrictionLogListRow,
  type FrictionStatus,
} from './FrictionLogList';

interface FrictionLogTriageFormProps {
  row: FrictionLogListRow;
  reporterEmail?: string | null;
  triagedByEmail?: string | null;
}

const STATUS_LABELS: Record<FrictionStatus, string> = {
  new: 'New',
  triaged: 'Triaged',
  resolved: 'Resolved',
  wont_fix: "Won't fix",
};

const REASON_LABELS: Record<string, string> = {
  tedious: 'Too tedious',
  unclear: 'Unclear',
  other: 'Other',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function FrictionLogTriageForm({
  row,
  reporterEmail,
  triagedByEmail,
}: FrictionLogTriageFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<FrictionStatus>(row.status);
  const [triageNote, setTriageNote] = useState<string>(row.triage_note ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const handleSave = async () => {
    setSaving(true);
    setFeedback({ type: 'idle', message: '' });
    try {
      const res = await fetch(`/api/admin/friction-log/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          triage_note: triageNote.trim().length > 0 ? triageNote.trim() : null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result?.error || `Failed to save (${res.status})`);
      }
      setFeedback({ type: 'success', message: 'Saved' });
      router.refresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}
    >
      {/* Main column — read-only details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>
            Context
          </h3>

          <DetailRow label="Product slug" value={row.product_slug} mono />
          <DetailRow
            label="Step index"
            value={row.step_index === null ? '—' : String(row.step_index)}
          />
          <DetailRow label="Reason" value={REASON_LABELS[row.reason] ?? row.reason} />
          <DetailRow label="Reporter" value={reporterEmail ?? row.user_id ?? '—'} mono={!reporterEmail} />
          <DetailRow
            label="Session"
            value={row.product_session_id ?? '—'}
            mono
          />
          <DetailRow label="Created" value={formatDate(row.created_at)} />
          <DetailRow label="Updated" value={formatDate(row.updated_at)} />
          {row.triaged_at && (
            <DetailRow label="Triaged at" value={formatDate(row.triaged_at)} />
          )}
          {(triagedByEmail || row.triaged_by) && (
            <DetailRow
              label="Triaged by"
              value={triagedByEmail ?? row.triaged_by ?? '—'}
              mono={!triagedByEmail}
            />
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>
            User note
          </h3>
          {row.note ? (
            <p
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem',
                color: 'var(--admin-text)',
                margin: 0,
              }}
            >
              {row.note}
            </p>
          ) : (
            <p
              style={{
                fontStyle: 'italic',
                color: 'var(--admin-text-muted)',
                fontSize: '0.875rem',
                margin: 0,
              }}
            >
              The user did not leave a note.
            </p>
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>
            Response excerpt
          </h3>
          {row.response_excerpt ? (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
                color: 'var(--admin-text)',
                margin: 0,
                background: 'var(--admin-bg)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--admin-border)',
              }}
            >
              {row.response_excerpt}
            </pre>
          ) : (
            <p
              style={{
                fontStyle: 'italic',
                color: 'var(--admin-text-muted)',
                fontSize: '0.875rem',
                margin: 0,
              }}
            >
              No in-progress response was captured.
            </p>
          )}
        </div>
      </div>

      {/* Sidebar — triage controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '2rem' }}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>
            Triage
          </h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status</label>
            <select
              className={styles.formInput}
              value={status}
              onChange={(e) => setStatus(e.target.value as FrictionStatus)}
            >
              {FRICTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Triage note</label>
            <textarea
              className={`${styles.formInput} ${styles.formTextarea}`}
              value={triageNote}
              onChange={(e) => setTriageNote(e.target.value)}
              placeholder="What did you do about this? (e.g. updated question wording, edited prompt)"
              rows={5}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <Link
              href="/admin/friction-log"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ width: '100%' }}
            >
              Back to list
            </Link>
          </div>

          {feedback.type !== 'idle' && (
            <div
              style={{
                marginTop: '0.75rem',
                fontSize: '0.8125rem',
                color:
                  feedback.type === 'success'
                    ? 'var(--admin-success)'
                    : 'var(--admin-danger)',
              }}
            >
              {feedback.message}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '0.75rem' }}>
            Quick links
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link
              href={`/admin/question-pool?product=${encodeURIComponent(row.product_slug)}`}
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ width: '100%' }}
            >
              Open question pool
            </Link>
            <Link
              href={`/admin/products`}
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ width: '100%' }}
            >
              Open products
            </Link>
          </div>
          <p className={styles.formHint} style={{ marginTop: '0.5rem' }}>
            Use the question pool to edit or replace the offending step prompt.
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: '0.75rem',
        padding: '0.4rem 0',
        borderBottom: '1px solid var(--admin-border)',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ color: 'var(--admin-text-muted)' }}>{label}</div>
      <div
        style={{
          color: 'var(--admin-text)',
          fontFamily: mono ? 'monospace' : undefined,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </div>
  );
}
