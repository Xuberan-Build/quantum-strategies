'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/admin/admin-layout.module.css';
import {
  SECTION_NAMES,
  type PortraitFact,
  type PortraitSection,
  type SectionNameType,
} from '@/lib/portraits/schema';

// ---------------------------------------------------------------------------
// Types passed down from the server component
// ---------------------------------------------------------------------------

export interface PortraitData {
  user_id: string;
  sections: Partial<Record<SectionNameType, PortraitSection | null>>;
  opt_out: boolean;
  schema_version: number | null;
  last_extracted_at: string | null;
  last_reviewed_at: string | null;
  products_completed: string[];
  created_at: string | null;
  updated_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  briefing_id: string | null;
  direction: 'read' | 'write' | 'reset' | 'override';
  section: string;
  field_path: string | null;
  old_value: unknown;
  new_value: unknown;
  actor_id: string | null;
  created_at: string;
}

export interface BriefingRow {
  id: string;
  product_slug: string;
  generated_at: string;
  extraction_status: 'pending' | 'completed' | 'failed' | 'skipped';
  // Joined from portrait_update_queue.attempts (the source of truth).
  // 0 when no queue row exists (e.g. extraction_status = 'skipped').
  attempts: number;
  extraction_error: string | null;
  extracted_at: string | null;
}

interface PortraitInspectorProps {
  portrait: PortraitData;
  userEmail: string;
  auditLog: AuditLogEntry[];
  briefings: BriefingRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function shortJson(value: unknown, max = 80): string {
  try {
    const s = JSON.stringify(value);
    if (!s) return '—';
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return '—';
  }
}

type AuditDirectionFilter = 'all' | 'read' | 'write' | 'reset' | 'override';
type AuditSectionFilter = 'all' | SectionNameType;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PortraitInspector({
  portrait,
  userEmail,
  auditLog,
  briefings,
}: PortraitInspectorProps) {
  const router = useRouter();

  // Audit filters
  const [directionFilter, setDirectionFilter] = useState<AuditDirectionFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<AuditSectionFilter>('all');

  // Section-level local state for the override form. Initialised from current.
  // Keyed by section. The textarea holds raw JSON; on save we parse + send.
  const [overrideJson, setOverrideJson] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const name of SECTION_NAMES) {
      const current = portrait.sections[name]?.current;
      init[name] = current ? JSON.stringify(current, null, 2) : '';
    }
    return init;
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(
    null
  );

  const filteredAudit = useMemo(() => {
    return auditLog.filter((e) => {
      if (directionFilter !== 'all' && e.direction !== directionFilter) return false;
      if (sectionFilter !== 'all' && e.section !== sectionFilter) return false;
      return true;
    });
  }, [auditLog, directionFilter, sectionFilter]);

  // -------------------------------------------------------------------------
  // Action handlers — all POST/PATCH through the admin portrait API.
  // -------------------------------------------------------------------------

  const callPatch = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/portraits/${encodeURIComponent(portrait.user_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed (${res.status})`);
      }
      setMessage({ kind: 'success', text: `${label} succeeded.` });
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ kind: 'error', text: `${label} failed: ${text}` });
    } finally {
      setBusy(null);
    }
  };

  const saveOverride = async (section: SectionNameType) => {
    const raw = overrideJson[section]?.trim() ?? '';

    let parsed: PortraitFact | null = null;
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw) as PortraitFact;
      } catch (err) {
        const text = err instanceof Error ? err.message : 'Invalid JSON';
        setMessage({ kind: 'error', text: `${section}: ${text}` });
        return;
      }
    }

    await callPatch(
      { section, current: parsed },
      `Override ${section}.current`
    );
  };

  const clearSection = async (section: SectionNameType) => {
    if (!confirm(`Hard-clear ${section}? This wipes both current and prior. This is an admin override.`)) {
      return;
    }
    await callPatch({ section, clear: true }, `Clear ${section}`);
  };

  const triggerReExtract = async (briefingId: string) => {
    setBusy(`extract:${briefingId}`);
    setMessage(null);
    try {
      const res = await fetch('/api/portraits/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefingId, force: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        skipped?: string;
        status?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`);
      }
      const tail =
        data.skipped ? `skipped: ${data.skipped}` : data.status ? `status: ${data.status}` : 'queued';
      setMessage({ kind: 'success', text: `Re-extract triggered (${tail}).` });
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ kind: 'error', text: `Re-extract failed: ${text}` });
    } finally {
      setBusy(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Status banner */}
      {message && (
        <div
          className={styles.card}
          style={{
            padding: '0.75rem 1rem',
            borderLeft: `4px solid ${
              message.kind === 'success'
                ? 'var(--admin-success)'
                : message.kind === 'error'
                  ? 'var(--admin-danger)'
                  : 'var(--admin-text-muted)'
            }`,
            fontSize: '0.875rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Context header */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Portrait overview</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            padding: '1rem',
            fontSize: '0.8125rem',
          }}
        >
          <Field label="User email" value={userEmail} />
          <Field label="User id" value={portrait.user_id} mono />
          <Field label="Opt-out" value={portrait.opt_out ? 'yes' : 'no'} />
          <Field label="Schema version" value={portrait.schema_version?.toString() ?? '—'} />
          <Field label="Last extracted" value={formatDate(portrait.last_extracted_at)} mono />
          <Field label="Last reviewed" value={formatDate(portrait.last_reviewed_at)} mono />
          <Field label="Portrait created" value={formatDate(portrait.created_at)} mono />
          <Field label="Portrait updated" value={formatDate(portrait.updated_at)} mono />
          <Field
            label="Products completed"
            value={
              portrait.products_completed.length > 0 ? portrait.products_completed.join(', ') : '—'
            }
            mono
          />
        </div>
      </div>

      {/* Sections */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Sections</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
          {SECTION_NAMES.map((name) => (
            <SectionPanel
              key={name}
              name={name}
              section={portrait.sections[name] ?? null}
              overrideJson={overrideJson[name] ?? ''}
              onOverrideChange={(value) =>
                setOverrideJson((prev) => ({ ...prev, [name]: value }))
              }
              onSave={() => saveOverride(name)}
              onClear={() => clearSection(name)}
              busy={busy}
            />
          ))}
        </div>
      </div>

      {/* Briefings + re-extract */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Briefings
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.8125rem',
                color: 'var(--admin-text-muted)',
                fontWeight: 400,
              }}
            >
              {briefings.length}
            </span>
          </h2>
        </div>
        {briefings.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No briefings yet</div>
            <div className={styles.emptyDescription}>
              The user has not generated any product briefings.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Briefing id</th>
                  <th>Product</th>
                  <th>Generated</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Attempts</th>
                  <th>Extracted</th>
                  <th>Error</th>
                  <th style={{ width: 130 }} />
                </tr>
              </thead>
              <tbody>
                {briefings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{b.id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{b.product_slug}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {formatDate(b.generated_at)}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          b.extraction_status === 'completed'
                            ? styles.badgeSuccess
                            : b.extraction_status === 'failed'
                              ? styles.badgeDanger
                              : b.extraction_status === 'skipped'
                                ? styles.badgeWarning
                                : styles.badgeNeutral
                        }`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {b.extraction_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {b.attempts}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {formatDate(b.extracted_at)}
                    </td>
                    <td
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--admin-text-muted)',
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {b.extraction_error || ''}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                        onClick={() => triggerReExtract(b.id)}
                        disabled={busy !== null}
                      >
                        {busy === `extract:${b.id}` ? 'Working…' : 'Re-extract'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Audit log
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.8125rem',
                color: 'var(--admin-text-muted)',
                fontWeight: 400,
              }}
            >
              {filteredAudit.length} of {auditLog.length}
            </span>
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '180px 180px 1fr',
            gap: '1rem',
            padding: '1rem',
            alignItems: 'end',
          }}
        >
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Direction</label>
            <select
              className={styles.formInput}
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as AuditDirectionFilter)}
            >
              <option value="all">All</option>
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="reset">reset</option>
              <option value="override">override</option>
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Section</label>
            <select
              className={styles.formInput}
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as AuditSectionFilter)}
            >
              <option value="all">All</option>
              {SECTION_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredAudit.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No audit entries match</div>
            <div className={styles.emptyDescription}>
              {auditLog.length === 0
                ? 'No portrait_audit_log entries for this user yet.'
                : 'Try clearing or expanding the filters.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Direction</th>
                  <th>Section</th>
                  <th>Field path</th>
                  <th>Briefing</th>
                  <th>Actor</th>
                  <th>Old → New</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {formatDate(e.created_at)}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          e.direction === 'override'
                            ? styles.badgeWarning
                            : e.direction === 'write'
                              ? styles.badgeSuccess
                              : e.direction === 'reset'
                                ? styles.badgeDanger
                                : styles.badgeNeutral
                        }`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {e.direction}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{e.section}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {e.field_path || '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {e.briefing_id ? e.briefing_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {e.actor_id ? e.actor_id.slice(0, 8) + '…' : 'system'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: 480 }}>
                      <span style={{ color: 'var(--admin-text-muted)' }}>{shortJson(e.old_value)}</span>
                      {' → '}
                      {shortJson(e.new_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--admin-text-muted)',
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: mono ? 'monospace' : undefined, fontSize: '0.8125rem' }}>{value}</div>
    </div>
  );
}

function SectionPanel({
  name,
  section,
  overrideJson,
  onOverrideChange,
  onSave,
  onClear,
  busy,
}: {
  name: SectionNameType;
  section: PortraitSection | null;
  overrideJson: string;
  onOverrideChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  busy: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const current = section?.current ?? null;
  const prior = section?.prior ?? [];
  const transitions = section?.transitions ?? [];

  const saveLabel = `Override ${name}.current`;
  const clearLabel = `Clear ${name}`;
  const isBusy = busy === saveLabel || busy === clearLabel;

  return (
    <div
      style={{
        border: '1px solid var(--admin-border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <strong style={{ fontFamily: 'monospace', textTransform: 'uppercase', fontSize: '0.8125rem' }}>
            {name}
          </strong>
          <span
            className={`${styles.badge} ${current ? styles.badgeSuccess : styles.badgeNeutral}`}
            style={{ fontSize: '0.65rem' }}
          >
            {current ? 'has current' : 'empty'}
          </span>
          {prior.length > 0 && (
            <span
              className={`${styles.badge} ${styles.badgeNeutral}`}
              style={{ fontSize: '0.65rem' }}
            >
              {prior.length} prior
            </span>
          )}
          {transitions.length > 0 && (
            <span
              className={`${styles.badge} ${styles.badgeNeutral}`}
              style={{ fontSize: '0.65rem' }}
            >
              {transitions.length} transitions
            </span>
          )}
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Collapse' : 'Expand JSON'}
        </button>
      </div>

      {/* Summary line for the current fact */}
      {current && !expanded && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--admin-text-muted)',
            marginBottom: '0.5rem',
          }}
        >
          {current.summary || current.revealed || current.stated || '(no human summary)'}
          {' · '}
          <span style={{ fontFamily: 'monospace' }}>
            confidence {current.confidence.toFixed(2)} · {current.source_product}
          </span>
        </div>
      )}

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <JsonBlock title="current" value={current} />
          <JsonBlock title={`prior[] (${prior.length})`} value={prior} />
          <JsonBlock title={`transitions[] (${transitions.length})`} value={transitions} />
        </div>
      )}

      <div style={{ marginTop: '0.75rem' }}>
        <label
          className={styles.formLabel}
          style={{ display: 'block', marginBottom: '0.25rem' }}
        >
          Override current (raw PortraitFact JSON; empty = clear current only)
        </label>
        <textarea
          className={styles.formInput}
          style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            minHeight: 120,
            resize: 'vertical',
            width: '100%',
          }}
          value={overrideJson}
          onChange={(e) => onOverrideChange(e.target.value)}
          placeholder='{"summary":"…","evidence":["…"],"confidence":0.9,"source_product":"…","source_briefing_id":"…","set_at":"…"}'
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
            onClick={onSave}
            disabled={busy !== null}
          >
            {busy === saveLabel ? 'Saving…' : 'Save override'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
            onClick={onClear}
            disabled={busy !== null}
          >
            {busy === clearLabel ? 'Clearing…' : 'Hard-clear section'}
          </button>
          {isBusy && (
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', alignSelf: 'center' }}>
              Working…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div
        style={{
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--admin-text-muted)',
          marginBottom: '0.25rem',
        }}
      >
        {title}
      </div>
      <pre
        style={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          background: 'var(--admin-bg-subtle, rgba(0,0,0,0.04))',
          padding: '0.5rem',
          borderRadius: 4,
          overflow: 'auto',
          maxHeight: 280,
          margin: 0,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
