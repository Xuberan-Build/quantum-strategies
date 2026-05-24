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
  const [timeUnknown, setTimeUnknown] = useState<boolean>(initialData?.timeUnknown ?? false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const effectiveTime = timeUnknown ? '12:00' : form.time;
      const res = await fetch('/api/profile/birth-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, time: effectiveTime, timeUnknown }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setData(json.birth_data);
      setResolvedAddress(json.resolvedAddress ?? null);
      window.location.href = '/dashboard/profile?tab=chart&section=western';
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!editing && data) {
    const displayTime = data.timeUnknown ? '12:00 (time unknown)' : data.time;
    return (
      <>
        <p className={styles.panelTitle}>Birth Data</p>
        <p className={styles.panelSubtitle}>Used for all chart calculations</p>
        <div className={styles.savedRow}>
          <div className={styles.savedInfo}>
            <span className={styles.savedMain}>{data.date} · {displayTime}</span>
            <span className={styles.savedMeta}>{data.city}</span>
            {resolvedAddress && (
              <span className={styles.savedGeo}>Resolved: {resolvedAddress}</span>
            )}
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
            value={timeUnknown ? '12:00' : form.time}
            disabled={timeUnknown}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            style={timeUnknown ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="timeUnknown"
              checked={timeUnknown}
              onChange={e => {
                setTimeUnknown(e.target.checked);
                if (e.target.checked) setForm(f => ({ ...f, time: '12:00' }));
              }}
              style={{ accentColor: '#7c3aed', width: '1rem', height: '1rem', cursor: 'pointer' }}
            />
            <label htmlFor="timeUnknown" style={{ fontSize: '0.8rem', color: 'rgba(206,190,255,0.6)', cursor: 'pointer' }}>
              I don&apos;t know my exact birth time
            </label>
          </div>
          {timeUnknown && (
            <p className={styles.formHint} style={{ marginTop: '0.35rem' }}>
              We&apos;ll use 12:00 noon. Ascendant, houses, and Human Design type/profile may be inaccurate.
            </p>
          )}
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
          disabled={saving || !form.date || (!timeUnknown && !form.time) || !form.city.trim()}
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
