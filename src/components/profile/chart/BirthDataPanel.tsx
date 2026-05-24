'use client';

import { useState, useEffect, useRef } from 'react';
import type { StoredBirthData } from '@/lib/calculator/compute';
import type { GeocodeSuggestion } from '@/app/api/profile/geocode-search/route';
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

  // Typeahead state
  const [cityConfirmed, setCityConfirmed] = useState(!!initialData);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const searchCity = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/profile/geocode-search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSuggestions(json.results ?? []);
        setShowDropdown((json.results ?? []).length > 0);
        setFocusedIdx(-1);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const handleCityChange = (value: string) => {
    setForm(f => ({ ...f, city: value }));
    setCityConfirmed(false);
    searchCity(value);
  };

  const selectSuggestion = (s: GeocodeSuggestion) => {
    setForm(f => ({ ...f, city: s.displayName }));
    setCityConfirmed(true);
    setSuggestions([]);
    setShowDropdown(false);
    setFocusedIdx(-1);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[focusedIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

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

  const canSave = !!form.date && (timeUnknown || !!form.time) && cityConfirmed;

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

        <div className={styles.formGridFull} style={{ position: 'relative' }} ref={dropdownRef}>
          <label className={styles.formLabel}>Birth City</label>
          <input
            type="text"
            className={styles.formInput}
            placeholder="e.g. San Francisco, CA"
            value={form.city}
            onChange={e => handleCityChange(e.target.value)}
            onKeyDown={handleCityKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            autoComplete="off"
            style={cityConfirmed ? { borderColor: 'rgba(93, 211, 130, 0.6)' } : undefined}
          />
          {searching && (
            <p className={styles.formHint} style={{ marginTop: '0.35rem' }}>Searching…</p>
          )}
          {!cityConfirmed && form.city.trim().length >= 2 && !searching && (
            <p className={styles.formHint} style={{ marginTop: '0.35rem', color: 'rgba(251,191,36,0.7)' }}>
              Select a location from the suggestions to continue.
            </p>
          )}
          {cityConfirmed && (
            <p className={styles.formHint} style={{ marginTop: '0.35rem', color: 'rgba(93,211,130,0.7)' }}>
              Location confirmed.
            </p>
          )}
          {showDropdown && suggestions.length > 0 && (
            <div className={styles.cityDropdown}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.cityOption} ${i === focusedIdx ? styles.cityOptionFocused : ''}`}
                  onMouseDown={() => selectSuggestion(s)}
                >
                  {s.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.formActions}>
        <button
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={saving || !canSave}
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
