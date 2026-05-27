'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SECTION_NAMES,
  type PortraitSection,
  type SectionNameType,
} from '@/lib/portraits/schema';
import type { AuditEntry, PortraitRow } from '@/app/dashboard/profile/portrait/page';
import styles from './portrait.module.css';

// ---------------------------------------------------------------------------
// Plain-language headers — never the technical names from the schema.
// ---------------------------------------------------------------------------
const SECTION_HEADERS: Record<SectionNameType, string> = {
  identity: 'Who you are',
  values: 'What matters to you',
  energy: 'How you operate at your best',
  activity: "What you're doing now",
  results: "What's working",
  path: "Where you're heading",
};

// Human-friendly slug renderer for product names that appear in cards & audit
function humanizeSlug(slug: string | null | undefined): string {
  if (!slug) return 'a product';
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? '' : 's'} ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
  const yr = Math.floor(day / 365);
  return `${yr} year${yr === 1 ? '' : 's'} ago`;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function confidenceDots(value: number): number {
  // 5 dots, abstract scale; never expose the raw 0-1 number.
  const clamped = Math.max(0, Math.min(1, value));
  return Math.max(1, Math.round(clamped * 5));
}

interface PortraitViewProps {
  portrait: PortraitRow | null;
  audit: AuditEntry[];
  initialOptOut: boolean;
}

export default function PortraitView({ portrait, audit, initialOptOut }: PortraitViewProps) {
  const router = useRouter();
  const [optOut, setOptOut] = useState(initialOptOut || portrait?.opt_out || false);
  const [confirmedThisSession, setConfirmedThisSession] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialogSection, setConfirmDialogSection] = useState<SectionNameType | null>(null);

  const hasAnySection = useMemo(() => {
    if (!portrait) return false;
    return SECTION_NAMES.some((name) => {
      const sec = portrait.sections[name];
      return !!(sec && (sec.current || (sec.prior && sec.prior.length > 0)));
    });
  }, [portrait]);

  async function handleConfirm() {
    setBusy('confirm');
    setError(null);
    try {
      const res = await fetch('/api/portrait/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_reviewed_at: 'now' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not confirm');
      }
      setConfirmedThisSession(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleOptOut() {
    const next = !optOut;
    setBusy('opt');
    setError(null);
    try {
      const res = await fetch('/api/portrait/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opt_out: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update preference');
      }
      setOptOut(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  async function handleReset(section: SectionNameType) {
    setBusy(`reset:${section}`);
    setError(null);
    try {
      const res = await fetch('/api/portrait/me/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not refresh');
      }
      setConfirmDialogSection(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  const lastUpdated = portrait?.updated_at ?? portrait?.last_extracted_at ?? null;
  const lastReviewed = portrait?.last_reviewed_at ?? null;

  return (
    <div className={styles.wrap}>
      <TopBar
        lastUpdated={lastUpdated}
        lastReviewed={lastReviewed}
        confirmedThisSession={confirmedThisSession}
        optOut={optOut}
        onConfirm={handleConfirm}
        onToggleOptOut={handleToggleOptOut}
        busy={busy}
      />

      {error && <div className={styles.errorBanner}>{error}</div>}

      {optOut && (
        <div className={styles.optOutNotice}>
          Your portrait is paused. Nothing is being added, read, or used to shape
          your briefings. Your existing sections are kept here, muted, until you
          turn the portrait back on.
        </div>
      )}

      {!portrait || !hasAnySection ? (
        <div className={styles.emptyPortrait}>
          <p>Nothing here yet — this will fill in as you complete more products.</p>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {SECTION_NAMES.map((name) => (
            <SectionCard
              key={name}
              section={name}
              data={portrait.sections[name] ?? null}
              muted={optOut}
              onRequestReset={() => setConfirmDialogSection(name)}
              isResetting={busy === `reset:${name}`}
            />
          ))}
        </div>
      )}

      <AuditView audit={audit} />

      {confirmDialogSection && (
        <ConfirmDialog
          section={confirmDialogSection}
          onCancel={() => setConfirmDialogSection(null)}
          onConfirm={() => handleReset(confirmDialogSection)}
          busy={busy === `reset:${confirmDialogSection}`}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Top bar
// ===========================================================================

function TopBar({
  lastUpdated,
  lastReviewed,
  confirmedThisSession,
  optOut,
  onConfirm,
  onToggleOptOut,
  busy,
}: {
  lastUpdated: string | null;
  lastReviewed: string | null;
  confirmedThisSession: boolean;
  optOut: boolean;
  onConfirm: () => void;
  onToggleOptOut: () => void;
  busy: string | null;
}) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topBarMeta}>
        <span className={styles.topBarLabel}>Last updated</span>
        <span className={styles.topBarValue}>
          {lastUpdated ? timeAgo(lastUpdated) : 'Not yet'}
        </span>
        {lastReviewed && (
          <span className={styles.cardMeta}>
            You last confirmed this {timeAgo(lastReviewed)}.
          </span>
        )}
      </div>

      <div className={styles.topBarActions}>
        {confirmedThisSession ? (
          <span className={styles.confirmedBadge}>Confirmed today</span>
        ) : (
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={busy === 'confirm' || optOut}
          >
            {busy === 'confirm' ? 'Saving…' : 'This is still me'}
          </button>
        )}

        <label className={styles.optOutToggle}>
          <span>Pause portrait</span>
          <button
            type="button"
            role="switch"
            aria-checked={optOut}
            className={`${styles.switch} ${optOut ? styles.switchOn : ''}`}
            onClick={onToggleOptOut}
            disabled={busy === 'opt'}
          >
            <span className={styles.switchKnob} />
          </button>
        </label>
      </div>
    </div>
  );
}

// ===========================================================================
// Section card
// ===========================================================================

function SectionCard({
  section,
  data,
  muted,
  onRequestReset,
  isResetting,
}: {
  section: SectionNameType;
  data: PortraitSection | null;
  muted: boolean;
  onRequestReset: () => void;
  isResetting: boolean;
}) {
  const current = data?.current ?? null;
  const prior = data?.prior ?? [];
  const transitions = data?.transitions ?? [];
  const header = SECTION_HEADERS[section];

  return (
    <article className={`${styles.card} ${muted ? styles.cardMuted : ''}`}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{header}</h2>
          {current?.set_at && (
            <p className={styles.cardMeta}>
              Set {timeAgo(current.set_at)}
              {current.source_product ? ` via ${humanizeSlug(current.source_product)}` : ''}
            </p>
          )}
        </div>
        {current && (
          <ConfidenceIndicator value={current.confidence} />
        )}
      </header>

      {current ? (
        <>
          {current.summary && <p className={styles.summary}>{current.summary}</p>}

          {current.stated && current.revealed && current.stated !== current.revealed && (
            <>
              <div className={styles.factRow}>
                <span className={styles.factLabel}>What you&apos;ve said</span>
                <span className={styles.factValue}>{current.stated}</span>
              </div>
              <div className={styles.factRow}>
                <span className={styles.factLabel}>What we&apos;re hearing underneath</span>
                <span className={styles.factValue}>{current.revealed}</span>
              </div>
            </>
          )}

          {current.stated && !current.summary && !current.revealed && (
            <p className={styles.summary}>{current.stated}</p>
          )}
        </>
      ) : (
        <p className={styles.emptyText}>
          This section is open — it&apos;ll take shape as you complete more products.
        </p>
      )}

      {transitions.length > 0 && (
        <ul className={styles.transitionsList}>
          {transitions.map((t, idx) => (
            <li key={idx} className={styles.transitionItem}>
              <span className={styles.transitionFromTo}>
                You moved from {t.from.summary || t.from.stated || 'where you were'}
                {' '}to {t.to.summary || t.to.stated || 'where you are now'}
              </span>
              {' — '}
              {shortDate(t.detected_at)}. Good signal, good direction.
            </li>
          ))}
        </ul>
      )}

      {current && current.evidence.length > 0 && (
        <details className={styles.disclosure}>
          <summary className={styles.disclosureSummary}>Evidence</summary>
          <div className={styles.disclosureBody}>
            {current.evidence.map((quote, idx) => (
              <blockquote key={idx} className={styles.evidenceQuote}>
                &ldquo;{quote}&rdquo;
              </blockquote>
            ))}
          </div>
        </details>
      )}

      {prior.length > 0 && (
        <details className={styles.disclosure}>
          <summary className={styles.disclosureSummary}>
            Prior ({prior.length})
          </summary>
          <div className={styles.disclosureBody}>
            <ul className={styles.priorList}>
              {prior.map((fact, idx) => (
                <li key={idx} className={styles.priorItem}>
                  {fact.summary || fact.stated || fact.revealed || 'A previous version of this section'}
                  <div className={styles.priorMeta}>
                    {fact.source_product ? `From ${humanizeSlug(fact.source_product)}` : ''}
                    {fact.set_at ? ` · ${shortDate(fact.set_at)}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      <div className={styles.cardFooter}>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRequestReset}
          disabled={muted || isResetting || !current}
          title={muted ? 'Resume your portrait to refresh sections' : 'Clear and rebuild this section'}
        >
          {isResetting ? 'Refreshing…' : 'Refresh this section'}
        </button>
      </div>
    </article>
  );
}

// ===========================================================================
// Confidence indicator — abstract dot scale, never a percentage
// ===========================================================================

function ConfidenceIndicator({ value }: { value: number }) {
  const lit = confidenceDots(value);
  return (
    <div className={styles.confidenceWrap}>
      <span className={styles.confidenceLabel}>Signal</span>
      <span className={styles.confidenceDots} aria-label={`signal strength ${lit} of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`${styles.confidenceDot} ${i < lit ? styles.confidenceDotOn : ''}`}
          />
        ))}
      </span>
    </div>
  );
}

// ===========================================================================
// Audit transparency view
// ===========================================================================

function AuditView({ audit }: { audit: AuditEntry[] }) {
  return (
    <details className={styles.auditSection}>
      <summary className={styles.auditSummary}>How your picture has been used</summary>
      <div className={styles.auditBody}>
        {audit.length === 0 ? (
          <p className={styles.emptyText}>Nothing has used your picture yet.</p>
        ) : (
          <ul className={styles.auditList}>
            {audit.map((entry) => (
              <li key={entry.id} className={styles.auditItem}>
                <span className={styles.auditItemText}>{describeAudit(entry)}</span>
                <span className={styles.auditItemTime}>{timeAgo(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function describeAudit(entry: AuditEntry): string {
  const sectionLabel = SECTION_HEADERS[entry.section] ?? entry.section;
  const productLabel = humanizeSlug(entry.product_slug);

  switch (entry.direction) {
    case 'read':
      return `Used your ${sectionLabel.toLowerCase()} in your ${productLabel} briefing.`;
    case 'write':
      return `Updated your ${sectionLabel.toLowerCase()} after your ${productLabel} briefing.`;
    case 'reset':
      return `You refreshed your ${sectionLabel.toLowerCase()}.`;
    case 'override':
      return `Your ${sectionLabel.toLowerCase()} was edited by a team member.`;
    default:
      return `Your ${sectionLabel.toLowerCase()} was touched.`;
  }
}

// ===========================================================================
// Confirm dialog
// ===========================================================================

function ConfirmDialog({
  section,
  onCancel,
  onConfirm,
  busy,
}: {
  section: SectionNameType;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const label = SECTION_HEADERS[section];
  return (
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="portrait-confirm-title"
      onClick={onCancel}
    >
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h3 id="portrait-confirm-title" className={styles.modalTitle}>
          Refresh &ldquo;{label}&rdquo;?
        </h3>
        <p className={styles.modalText}>
          The current entry will be moved into your history and this section will
          start fresh on your next briefing. Nothing is permanently lost — your
          prior version stays visible to you.
        </p>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalCancel}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalConfirm}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Refreshing…' : 'Refresh section'}
          </button>
        </div>
      </div>
    </div>
  );
}

