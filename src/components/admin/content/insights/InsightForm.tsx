'use client';

import { useState } from 'react';
import type { Insight, InsightSourceKind } from '@/lib/content/any-to-any/types';
import admin from '@/app/admin/admin-layout.module.css';
import s from './insights.module.css';
import { CLUSTERS, PILLARS, SOURCE_KIND_LABELS, type InsightInput } from './api';

const KINDS = Object.keys(SOURCE_KIND_LABELS) as InsightSourceKind[];

/** Create or edit one insight. `onSubmit` gets the cleaned input. */
export default function InsightForm({
  initial,
  submitLabel = 'Save insight',
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Insight>;
  submitLabel?: string;
  onSubmit: (input: InsightInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [line, setLine] = useState(initial?.line ?? '');
  const [sourceKind, setSourceKind] = useState<InsightSourceKind>(initial?.source_kind ?? 'other');
  const [sourceRef, setSourceRef] = useState(initial?.source_ref ?? '');
  const [claim, setClaim] = useState(initial?.claim ?? '');
  const [evidenceTier, setEvidenceTier] = useState(initial?.evidence_tier ?? '');
  const [pillar, setPillar] = useState(initial?.pillar ?? '');
  const [cluster, setCluster] = useState(initial?.cluster ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!line.trim()) return setError('The line is required');
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        line: line.trim(),
        source_kind: sourceKind,
        source_ref: sourceRef.trim() || null,
        claim: claim.trim() || null,
        evidence_tier: evidenceTier.trim() || null,
        pillar: pillar || null,
        cluster: cluster || null,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className={s.field}>
        Line (one sentence, Austin&apos;s words)
        <textarea className={`${admin.formInput} ${admin.formTextarea}`} style={{ minHeight: '4.5rem' }} value={line} onChange={(e) => setLine(e.target.value)} maxLength={600} required />
      </label>
      <div className={s.grid2} style={{ marginTop: '0.75rem' }}>
        <label className={s.field}>
          Source kind
          <select className={s.select} value={sourceKind} onChange={(e) => setSourceKind(e.target.value as InsightSourceKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{SOURCE_KIND_LABELS[k]}</option>)}
          </select>
        </label>
        <label className={s.field}>
          Source (section, url, or file + timestamp)
          <input className={admin.formInput} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} maxLength={500} />
        </label>
        <label className={s.field}>
          Pillar
          <select className={s.select} value={pillar} onChange={(e) => setPillar(e.target.value)}>
            <option value="">None</option>
            {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className={s.field}>
          Problem cluster
          <select className={s.select} value={cluster} onChange={(e) => setCluster(e.target.value)}>
            <option value="">None</option>
            {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className={s.grid2} style={{ marginTop: '0.75rem' }}>
        <label className={s.field}>
          Claim and its source (if it states a fact)
          <input className={admin.formInput} value={claim} onChange={(e) => setClaim(e.target.value)} maxLength={1500} />
        </label>
        <label className={s.field}>
          Evidence tier
          <input className={admin.formInput} value={evidenceTier} onChange={(e) => setEvidenceTier(e.target.value)} maxLength={40} />
        </label>
        <label className={s.field}>
          Tags (comma separated)
          <input className={admin.formInput} value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
      </div>
      <label className={s.field} style={{ marginTop: '0.75rem' }}>
        Notes
        <textarea className={admin.formInput} style={{ minHeight: '3rem' }} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      </label>
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className={s.actions}>
        <button type="submit" className={`${admin.btn} ${admin.btnPrimary} ${admin.btnSmall}`} disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className={`${admin.btn} ${admin.btnSecondary} ${admin.btnSmall}`} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
