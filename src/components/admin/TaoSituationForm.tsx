'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

const FATES = ['Fear', 'Authority', 'Trust', 'Ego'] as const;
const CORE_STATES = ['Being', 'Inner Peace', 'Love', 'OKness', 'Oneness'] as const;
const TIERS = [1, 2, 3] as const;

const LAYER_KEYS = [
  'layer_identity',
  'layer_submodality',
  'layer_language',
  'layer_fate_bte',
  'layer_variance',
  'layer_personalization',
  'layer_protocol',
] as const;

type LayerKey = (typeof LAYER_KEYS)[number];

export interface TaoSituationFormRow {
  id: string;
  domain_id: string;
  domain_name: string;
  name: string;
  tier: number;
  fate: string | null;
  core_state: string | null;
  being_name: string | null;
  re_entry_phrase: string | null;
  variant_count: number | null;
  layer_identity: Record<string, unknown> | null;
  layer_submodality: Record<string, unknown> | null;
  layer_language: Record<string, unknown> | null;
  layer_fate_bte: Record<string, unknown> | null;
  layer_variance: Record<string, unknown> | null;
  layer_personalization: Record<string, unknown> | null;
  layer_protocol: Record<string, unknown> | null;
  research_source: string | null;
  research_finding: string | null;
  source_version: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

interface TaoSituationFormProps {
  initial: TaoSituationFormRow;
}

const LAYER_LABELS: Record<LayerKey, { title: string; subtitle: string }> = {
  layer_identity: { title: 'L1 · Identity', subtitle: 'Being name, archetype anchors, identity frame' },
  layer_submodality: { title: 'L2 · Submodality', subtitle: 'Breath / arousal / facial / body somatic markers' },
  layer_language: { title: 'L3 · Language', subtitle: 'Re-entry phrase, verbal scaffolding' },
  layer_fate_bte: { title: 'L4 · Fate / BTE', subtitle: 'Confirming/conflicting signals, levers' },
  layer_variance: { title: 'L5 · Variance', subtitle: 'Across-person variation patterns' },
  layer_personalization: { title: 'L6 · Personalization', subtitle: 'Per-user adjustments / chart hooks' },
  layer_protocol: { title: 'L7 · Protocol', subtitle: 'Step-by-step intervention sequence' },
};

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

interface LayerEditState {
  text: string;
  error: string | null;
}

export default function TaoSituationForm({ initial }: TaoSituationFormProps) {
  const router = useRouter();

  // Scalar fields that ARE editable through the admin.
  const [name, setName] = useState(initial.name);
  const [tier, setTier] = useState<number>(initial.tier);
  const [fate, setFate] = useState<string>(initial.fate ?? '');
  const [coreState, setCoreState] = useState<string>(initial.core_state ?? '');
  const [beingName, setBeingName] = useState(initial.being_name ?? '');
  const [reEntryPhrase, setReEntryPhrase] = useState(initial.re_entry_phrase ?? '');
  const [variantCount, setVariantCount] = useState<number>(initial.variant_count ?? 0);
  const [researchSource, setResearchSource] = useState(initial.research_source ?? '');
  const [researchFinding, setResearchFinding] = useState(initial.research_finding ?? '');
  const [active, setActive] = useState(initial.active);

  // JSONB layer editors (raw JSON textarea, validated on save).
  const initialLayerState: Record<LayerKey, LayerEditState> = LAYER_KEYS.reduce(
    (acc, k) => {
      acc[k] = { text: safeStringify(initial[k]), error: null };
      return acc;
    },
    {} as Record<LayerKey, LayerEditState>
  );
  const [layers, setLayers] = useState<Record<LayerKey, LayerEditState>>(initialLayerState);

  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const updateLayer = (key: LayerKey, text: string) => {
    setLayers((prev) => ({ ...prev, [key]: { text, error: null } }));
  };

  const parseLayers = (): {
    ok: boolean;
    values: Record<LayerKey, Record<string, unknown> | null>;
  } => {
    const next: Record<LayerKey, LayerEditState> = { ...layers };
    const values: Record<LayerKey, Record<string, unknown> | null> = {} as Record<
      LayerKey,
      Record<string, unknown> | null
    >;
    let ok = true;
    for (const k of LAYER_KEYS) {
      const t = next[k].text.trim();
      if (t.length === 0) {
        next[k] = { text: '', error: null };
        values[k] = null;
        continue;
      }
      try {
        const parsed: unknown = JSON.parse(t);
        if (parsed === null) {
          values[k] = null;
        } else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          values[k] = parsed as Record<string, unknown>;
        } else {
          throw new Error('Top-level must be an object or null');
        }
        next[k] = { text: t, error: null };
      } catch (err) {
        ok = false;
        next[k] = {
          text: next[k].text,
          error: err instanceof Error ? err.message : 'Invalid JSON',
        };
      }
    }
    setLayers(next);
    return { ok, values };
  };

  const handleSave = async () => {
    setStatus({ type: 'idle', message: '' });

    const { ok, values } = parseLayers();
    if (!ok) {
      setStatus({ type: 'error', message: 'One or more JSONB layers are not valid JSON' });
      return;
    }
    if (name.trim().length === 0) {
      setStatus({ type: 'error', message: 'Name is required' });
      return;
    }

    const payload = {
      name: name.trim(),
      tier,
      fate: fate.length === 0 ? null : fate,
      core_state: coreState.length === 0 ? null : coreState,
      being_name: beingName.trim().length === 0 ? null : beingName.trim(),
      re_entry_phrase: reEntryPhrase.trim().length === 0 ? null : reEntryPhrase.trim(),
      variant_count: Number.isFinite(variantCount) ? Math.max(0, Math.floor(variantCount)) : 0,
      layer_identity: values.layer_identity,
      layer_submodality: values.layer_submodality,
      layer_language: values.layer_language,
      layer_fate_bte: values.layer_fate_bte,
      layer_variance: values.layer_variance,
      layer_personalization: values.layer_personalization,
      layer_protocol: values.layer_protocol,
      research_source: researchSource.trim().length === 0 ? null : researchSource.trim(),
      research_finding: researchFinding.trim().length === 0 ? null : researchFinding.trim(),
      active,
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tao-situations/${encodeURIComponent(initial.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || `Failed to save (${res.status})`);
      }
      setStatus({ type: 'success', message: 'Saved' });
      router.push('/admin/tao-situations');
      router.refresh();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm(`Disable situation "${initial.id}"? This sets active=false (the row is not deleted).`)) {
      return;
    }
    setDisabling(true);
    setStatus({ type: 'idle', message: '' });
    try {
      const res = await fetch(`/api/admin/tao-situations/${encodeURIComponent(initial.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to disable');
      }
      router.push('/admin/tao-situations');
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
        {/* Identity / scalars */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Situation</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>ID</label>
              <input
                type="text"
                className={styles.formInput}
                value={initial.id}
                disabled
                style={{ fontFamily: 'monospace' }}
              />
              <p className={styles.formHint}>Assigned by the studio pipeline.</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Domain ID</label>
              <input
                type="text"
                className={styles.formInput}
                value={initial.domain_id}
                disabled
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Domain name</label>
              <input
                type="text"
                className={styles.formInput}
                value={initial.domain_name}
                disabled
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>Tier</label>
              <select
                className={styles.formInput}
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>Fate</label>
              <select
                className={styles.formInput}
                value={fate}
                onChange={(e) => setFate(e.target.value)}
              >
                <option value="">— (none)</option>
                {FATES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
              <label className={styles.formLabel}>Core state</label>
              <select
                className={styles.formInput}
                value={coreState}
                onChange={(e) => setCoreState(e.target.value)}
              >
                <option value="">— (none)</option>
                {CORE_STATES.map((cs) => (
                  <option key={cs} value={cs}>
                    {cs}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Being name</label>
              <input
                type="text"
                className={styles.formInput}
                value={beingName}
                onChange={(e) => setBeingName(e.target.value)}
                placeholder="e.g., The First Light"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Variant count</label>
              <input
                type="number"
                min={0}
                className={styles.formInput}
                value={variantCount}
                onChange={(e) => setVariantCount(Number(e.target.value))}
              />
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Re-entry phrase</label>
            <input
              type="text"
              className={styles.formInput}
              value={reEntryPhrase}
              onChange={(e) => setReEntryPhrase(e.target.value)}
              placeholder="Not yet. I am here."
            />
          </div>
        </div>

        {/* Research */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Research</h3>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Source / citation</label>
            <input
              type="text"
              className={styles.formInput}
              value={researchSource}
              onChange={(e) => setResearchSource(e.target.value)}
              placeholder="Author (Year). Title. Publisher."
            />
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.formLabel}>Finding summary</label>
            <textarea
              className={`${styles.formInput} ${styles.formTextarea}`}
              value={researchFinding}
              onChange={(e) => setResearchFinding(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Layer editors */}
        {LAYER_KEYS.map((key) => {
          const { title, subtitle } = LAYER_LABELS[key];
          const state = layers[key];
          return (
            <div key={key} className={styles.card}>
              <h3 className={styles.cardTitle} style={{ marginBottom: '0.25rem' }}>{title}</h3>
              <p
                className={styles.formHint}
                style={{ marginTop: 0, marginBottom: '0.75rem' }}
              >
                {subtitle} — stored as <code>{key}</code> JSONB. Leave blank for null.
              </p>
              <textarea
                className={`${styles.formInput} ${styles.formTextarea}`}
                value={state.text}
                onChange={(e) => updateLayer(key, e.target.value)}
                rows={Math.min(20, Math.max(6, state.text.split('\n').length + 1))}
                style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                spellCheck={false}
              />
              {state.error && <p className={styles.formError}>{state.error}</p>}
            </div>
          );
        })}
      </div>

      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '2rem' }}>
        {/* Save */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Save</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || disabling}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link
              href="/admin/tao-situations"
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

        {/* Meta */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '1rem' }}>Meta</h3>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Source version</label>
            <input
              type="text"
              className={styles.formInput}
              value={initial.source_version ?? '—'}
              disabled
              style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
            <p className={styles.formHint}>Set by the last ingest run.</p>
          </div>
          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
            <label className={styles.toggle} style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span className={styles.toggleSlider} />
              <span className={styles.toggleLabel}>Active</span>
            </label>
          </div>
        </div>

        {/* Danger zone */}
        {active && (
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
              {disabling ? 'Disabling…' : 'Disable situation'}
            </button>
            <p className={styles.formHint} style={{ marginTop: '0.5rem' }}>
              Sets <code>active=false</code>. Row is not deleted. The next ingest will
              re-enable it unless the studio also disables it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
