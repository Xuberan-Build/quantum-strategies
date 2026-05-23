'use client';

import { useState } from 'react';
import type { StoredBirthData } from '@/lib/calculator/compute';
import styles from './chart.module.css';

interface Props {
  initialData: StoredBirthData | null;
}

export default function BirthDataPanel({ initialData }: Props) {
  const [data, setData] = useState<StoredBirthData | null>(initialData);
  const [editing, setEditing] = useState(!initialData);
  const [form, setForm] = useState({
    date: initialData?.date ?? '',
    time: initialData?.time ?? '',
    city: initialData?.city ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/profile/birth-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setData(json.birth_data);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing && data) {
    return (
      <>
        <p className={styles.panelTitle}>Birth Data</p>
        <p className={styles.panelSubtitle}>Used for all chart calculations</p>
        <div className={styles.savedRow}>
          <div className={styles.savedInfo}>
            <span className={styles.savedMain}>{data.date} · {data.time}</span>
            <span className={styles.savedMeta}>{data.city}</span>
            <span className={styles.savedGeo}>{data.lat.toFixed(4)}, {data.lng.toFixed(4)} · {data.timezone}</span>
          </div>
          <button className={styles.btnGhost} onClick={() => setEditing(true)}>Edit</button>
        </div>
        <div className={styles.panelDivider} />
        <p style={{ color: 'rgba(206,190,255,0.6)', fontSize: '0.875rem' }}>
          Navigate to Western, Human Design, or Vedic in the sidebar to view your computed chart.
        </p>
      </>
    );
  }

  return (
    <>
      <p className={styles.panelTitle}>Birth Data</p>
      <p className={styles.panelSubtitle}>Enter your birth details to compute your chart</p>

      {error && <div className={styles.errorBanner} style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className={styles.formGrid}>
        <div>
          <label className={styles.formLabel}>Date of Birth</label>
          <input
            type="date"
            className={styles.formInput}
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div>
          <label className={styles.formLabel}>Time of Birth</label>
          <input
            type="time"
            className={styles.formInput}
            value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
          />
        </div>
        <div className={styles.formGridFull}>
          <label className={styles.formLabel}>Birth City</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="e.g. San Francisco, CA"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          />
          <p className={styles.formHint}>We geocode this to find coordinates and timezone automatically.</p>
        </div>
      </div>

      <div className={styles.formActions}>
        <button
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={saving || !form.date || !form.time || !form.city.trim()}
        >
          {saving ? 'Saving…' : 'Save & Calculate'}
        </button>
        {data && (
          <button className={styles.btnGhost} onClick={() => setEditing(false)}>Cancel</button>
        )}
      </div>
    </>
  );
}
