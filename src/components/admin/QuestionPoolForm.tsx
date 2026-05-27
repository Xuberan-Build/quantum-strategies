'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

const AUDIENCE_TRACKS = ['operator', 'side_builder', 'inside_player', 'almost_builder', 'seeker', 'all'] as const;
const RITES = ['perception', 'orientation', 'declaration'] as const;
const QUESTION_ROLES = ['anchor', 'followup', 'variant'] as const;
const EXPERIENCE_LEVELS = [1, 2, 3] as const;

type AudienceTrack = (typeof AUDIENCE_TRACKS)[number];
type Rite = (typeof RITES)[number];
type QuestionRole = (typeof QUESTION_ROLES)[number];

export interface QuestionPoolRow {
  id: string;
  product_slug: string;
  step_index: number;
  domain: string;
  rite: Rite;
  question_role: QuestionRole;
  experience_level: number;
  audience_tracks: string[];
  prompt_text: string;
  prompt_variants: Record<string, string> | null;
  followup_text: string | null;
  unlocks: string[] | null;
  blocks: string[] | null;
  signals_extracted: string[] | null;
  active: boolean;
}

interface QuestionPoolFormProps {
  mode: 'create' | 'edit';
  initial?: QuestionPoolRow;
  productSlugs: string[];
}

const EMPTY: QuestionPoolRow = {
  id: '',
  product_slug: '',
  step_index: 1,
  domain: '',
  rite: 'perception',
  question_role: 'anchor',
  experience_level: 2,
  audience_tracks: ['all'],
  prompt_text: '',
  prompt_variants: null,
  followup_text: null,
  unlocks: null,
  blocks: null,
  signals_extracted: null,
  active: true,
};

function arrayToCsv(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

function csvToArray(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function QuestionPoolForm({ mode, initial, productSlugs }: QuestionPoolFormProps) {
  const router = useRouter();
  const [row, setRow] = useState<QuestionPoolRow>(initial ?? EMPTY);
  const [unlocksInput, setUnlocksInput] = useState(arrayToCsv(initial?.unlocks));
  const [blocksInput, setBlocksInput] = useState(arrayToCsv(initial?.blocks));
  const [signalsInput, setSignalsInput] = useState(arrayToCsv(initial?.signals_extracted));
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Per-track prompt variants (excludes 'all' which uses prompt_text)
  const trackVariantKeys = AUDIENCE_TRACKS.filter((t) => t !== 'all');

  const set = <K extends keyof QuestionPoolRow>(field: K, value: QuestionPoolRow[K]) =>
    setRow((prev) => ({ ...prev, [field]: value }));

  const toggleTrack = (track: AudienceTrack) => {
    const current = new Set(row.audience_tracks);
    if (current.has(track)) {
      current.delete(track);
    } else {
      current.add(track);
    }
    const next = Array.from(current);
    set('audience_tracks', next.length > 0 ? next : ['all']);
  };

  const setVariant = (track: string, value: string) => {
    const next = { ...(row.prompt_variants ?? {}) };
    if (value.trim().length === 0) {
      delete next[track];
    } else {
      next[track] = value;
    }
    set('prompt_variants', Object.keys(next).length === 0 ? null : next);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (mode === 'create') {
      if (!row.id.trim()) e.id = 'ID is required';
      else if (!/^[a-zA-Z0-9._-]+$/.test(row.id))
        e.id = 'ID may only contain letters, numbers, dots, underscores, and hyphens';
    }
    if (!row.product_slug.trim()) e.product_slug = 'Product slug is required';
    if (!Number.isInteger(row.step_index) || row.step_index < 1)
      e.step_index = 'Step index must be a positive integer';
    if (!row.domain.trim()) e.domain = 'Domain is required';
    if (!row.prompt_text.trim()) e.prompt_text = 'Prompt text is required';
    if (row.audience_tracks.length === 0)
      e.audience_tracks = 'At least one audience track is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      setStatus({ type: 'error', message: 'Please fix the validation errors above' });
      return;
    }

    setSaving(true);
    setStatus({ type: 'idle', message: '' });

    const payload = {
      ...row,
      unlocks: csvToArray(unlocksInput),
      blocks: csvToArray(blocksInput),
      signals_extracted: csvToArray(signalsInput),
    };

    try {
      let res: Response;
      if (mode === 'create') {
        res = await fetch('/api/admin/question-pool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // PATCH excludes id (id comes from the URL path)
        const patchPayload: Partial<QuestionPoolRow> = { ...payload };
        delete (patchPayload as { id?: string }).id;
        res = await fetch(`/api/admin/question-pool/${encodeURIComponent(row.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload),
        });
      }

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || `Failed to save (${res.status})`);
      }

      setStatus({
        type: 'success',
        message: mode === 'create' ? 'Question created' : 'Saved',
      });

      // Navigate back to list view
      router.push('/admin/question-pool');
      router.refresh();
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm(`Disable question "${row.id}"? This sets active=false (the row is not deleted).`)) return;
    setDisabling(true);
    try {
      const res = await fetch(`/api/admin/question-pool/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to disable');
      }
      router.push('/admin/question-pool');
      router.refresh();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Disable failed' });
      setDisabling(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
      {/* Main column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Identity */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Identity</h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>ID</label>
            <input
              type="text"
              className={styles.formInput}
              value={row.id}
              onChange={(e) => set('id', e.target.value)}
              disabled={mode === 'edit'}
              placeholder="sig.aware.step1.anchor"
              style={{ fontFamily: 'monospace' }}
            />
            {errors.id ? (
              <p className={styles.formError}>{errors.id}</p>
            ) : (
              <p className={styles.formHint}>
                Format suggestion: <code>&lt;product&gt;.&lt;step&gt;.&lt;role&gt;.&lt;n&gt;</code>
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Product slug</label>
              {productSlugs.length > 0 ? (
                <>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={row.product_slug}
                    onChange={(e) => set('product_slug', e.target.value)}
                    placeholder="perception-rite-scan-1"
                    list="product-slug-list"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <datalist id="product-slug-list">
                    {productSlugs.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              ) : (
                <input
                  type="text"
                  className={styles.formInput}
                  value={row.product_slug}
                  onChange={(e) => set('product_slug', e.target.value)}
                  placeholder="perception-rite-scan-1"
                  style={{ fontFamily: 'monospace' }}
                />
              )}
              {errors.product_slug && <p className={styles.formError}>{errors.product_slug}</p>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Step index</label>
              <input
                type="number"
                min={1}
                className={styles.formInput}
                value={row.step_index}
                onChange={(e) => set('step_index', Number(e.target.value))}
              />
              {errors.step_index && <p className={styles.formError}>{errors.step_index}</p>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>Domain</label>
              <input
                type="text"
                className={styles.formInput}
                value={row.domain}
                onChange={(e) => set('domain', e.target.value)}
                placeholder="signal_awareness"
                style={{ fontFamily: 'monospace' }}
              />
              {errors.domain && <p className={styles.formError}>{errors.domain}</p>}
            </div>

            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>Rite</label>
              <select
                className={styles.formInput}
                value={row.rite}
                onChange={(e) => set('rite', e.target.value as Rite)}
              >
                {RITES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>Question role</label>
              <select
                className={styles.formInput}
                value={row.question_role}
                onChange={(e) => set('question_role', e.target.value as QuestionRole)}
              >
                {QUESTION_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Prompt text */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Prompt</h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Prompt text (default)</label>
            <textarea
              className={`${styles.formInput} ${styles.formTextarea}`}
              value={row.prompt_text}
              onChange={(e) => set('prompt_text', e.target.value)}
              placeholder="What signal are you sending right now?"
              rows={4}
            />
            {errors.prompt_text ? (
              <p className={styles.formError}>{errors.prompt_text}</p>
            ) : (
              <p className={styles.formHint}>Shown to anyone in the &quot;all&quot; audience track when no variant matches.</p>
            )}
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Follow-up text (optional)</label>
            <textarea
              className={`${styles.formInput} ${styles.formTextarea}`}
              value={row.followup_text ?? ''}
              onChange={(e) => set('followup_text', e.target.value.length === 0 ? null : e.target.value)}
              placeholder="Optional follow-up prompt or clarification"
              rows={3}
            />
          </div>
        </div>

        {/* Per-track variants */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '0.5rem' }}>Prompt variants by audience track</h3>
          <p className={styles.formHint} style={{ marginTop: 0, marginBottom: '1rem' }}>
            Leave blank to fall back to the default prompt text. Stored as <code>prompt_variants</code> JSON.
          </p>

          {trackVariantKeys.map((track) => {
            const value = row.prompt_variants?.[track] ?? '';
            return (
              <div key={track} className={styles.formGroup}>
                <label className={styles.formLabel} style={{ fontFamily: 'monospace' }}>{track}</label>
                <textarea
                  className={`${styles.formInput} ${styles.formTextarea}`}
                  value={value}
                  onChange={(e) => setVariant(track, e.target.value)}
                  placeholder={`Variant for ${track}…`}
                  rows={3}
                />
              </div>
            );
          })}
        </div>

        {/* Tags / arrays */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Effects</h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Unlocks</label>
            <input
              type="text"
              className={styles.formInput}
              value={unlocksInput}
              onChange={(e) => setUnlocksInput(e.target.value)}
              placeholder="signal_named, audience_clarity"
              style={{ fontFamily: 'monospace' }}
            />
            <p className={styles.formHint}>Comma-separated keys</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Blocks</label>
            <input
              type="text"
              className={styles.formInput}
              value={blocksInput}
              onChange={(e) => setBlocksInput(e.target.value)}
              placeholder="too_early_to_ask"
              style={{ fontFamily: 'monospace' }}
            />
            <p className={styles.formHint}>Comma-separated keys</p>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Signals extracted</label>
            <input
              type="text"
              className={styles.formInput}
              value={signalsInput}
              onChange={(e) => setSignalsInput(e.target.value)}
              placeholder="naming, posture, value_axis"
              style={{ fontFamily: 'monospace' }}
            />
            <p className={styles.formHint}>Comma-separated signals this prompt is designed to surface</p>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '2rem' }}>
        {/* Save / Cancel */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>
            {mode === 'create' ? 'Create' : 'Save'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || disabling}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Create question' : 'Save changes'}
            </button>
            <Link
              href="/admin/question-pool"
              className={`${styles.btn} ${styles.btnSecondary}`}
              style={{ width: '100%' }}
            >
              Cancel
            </Link>
          </div>
          {status.type !== 'idle' && (
            <div
              style={{
                marginTop: '0.75rem',
                fontSize: '0.8125rem',
                color: status.type === 'success' ? 'var(--admin-success)' : 'var(--admin-danger)',
              }}
            >
              {status.message}
            </div>
          )}
        </div>

        {/* Audience */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Audience tracks</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {AUDIENCE_TRACKS.map((track) => {
              const checked = row.audience_tracks.includes(track);
              return (
                <button
                  key={track}
                  type="button"
                  onClick={() => toggleTrack(track)}
                  className={`${styles.badge} ${checked ? styles.badgeSuccess : styles.badgeNeutral}`}
                  style={{
                    cursor: 'pointer',
                    border: 'none',
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                  }}
                >
                  {track}
                </button>
              );
            })}
          </div>
          {errors.audience_tracks && <p className={styles.formError}>{errors.audience_tracks}</p>}
        </div>

        {/* Meta */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Meta</h3>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Experience level</label>
            <select
              className={styles.formInput}
              value={row.experience_level}
              onChange={(e) => set('experience_level', Number(e.target.value))}
            >
              {EXPERIENCE_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.toggle} style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={row.active}
                onChange={(e) => set('active', e.target.checked)}
              />
              <span className={styles.toggleSlider} />
              <span className={styles.toggleLabel}>Active</span>
            </label>
          </div>
        </div>

        {/* Danger zone */}
        {mode === 'edit' && row.active && (
          <div className={styles.card} style={{ borderColor: '#fca5a5' }}>
            <h3
              className={styles.cardTitle}
              style={{ marginBottom: '0.75rem', color: 'var(--admin-danger)' }}
            >
              Danger Zone
            </h3>
            <button
              type="button"
              onClick={handleDisable}
              disabled={saving || disabling}
              className={`${styles.btn} ${styles.btnDanger}`}
              style={{ width: '100%' }}
            >
              {disabling ? 'Disabling…' : 'Disable question'}
            </button>
            <p className={styles.formHint} style={{ marginTop: '0.5rem' }}>
              Sets <code>active=false</code>. Row is not deleted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
