'use client';

import { useState } from 'react';
import { Placements, HumanDesignCenters } from '@/lib/utils/placements';
import styles from '@/app/dashboard/dashboard.module.css';

interface PlacementsDisplayProps {
  placements: Placements;
  editMode: boolean;
  onSave: (placements: Placements) => void;
  loading?: boolean;
}

// Serialize any placement value to a display string
function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return 'UNKNOWN';
  if (typeof value === 'string') return value || 'UNKNOWN';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'UNKNOWN';
  if (typeof value === 'object') {
    // Centers object: "Head: defined, Sacral: undefined, ..."
    const entries = Object.entries(value as Record<string, string>)
      .filter(([, v]) => v && v !== 'UNKNOWN')
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
    return entries.length ? entries.join(' · ') : 'UNKNOWN';
  }
  return String(value);
}

export default function PlacementsDisplay({
  placements,
  editMode,
  onSave,
  loading = false,
}: PlacementsDisplayProps) {
  const [editedPlacements, setEditedPlacements] = useState<Placements>(placements);

  const handleFieldChange = (
    section: 'astrology' | 'human_design',
    field: string,
    value: string
  ) => {
    setEditedPlacements((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSave = () => onSave(editedPlacements);
  const handleCancel = () => setEditedPlacements(placements);

  const astroFields = [
    { key: 'sun', label: 'Sun' },
    { key: 'moon', label: 'Moon' },
    { key: 'rising', label: 'Rising' },
    { key: 'mercury', label: 'Mercury' },
    { key: 'venus', label: 'Venus' },
    { key: 'mars', label: 'Mars' },
    { key: 'jupiter', label: 'Jupiter' },
    { key: 'saturn', label: 'Saturn' },
    { key: 'uranus', label: 'Uranus' },
    { key: 'neptune', label: 'Neptune' },
    { key: 'pluto', label: 'Pluto' },
    { key: 'houses', label: 'Houses' },
  ];

  // Editable string fields — manually correctable
  const hdEditableFields = [
    { key: 'type', label: 'Type' },
    { key: 'profile', label: 'Profile' },
    { key: 'authority', label: 'Authority' },
    { key: 'strategy', label: 'Strategy' },
    { key: 'definition', label: 'Definition' },
    { key: 'not_self_theme', label: 'Not-Self Theme' },
    { key: 'incarnation_cross', label: 'Incarnation Cross' },
    { key: 'digestion', label: 'Digestion' },
    { key: 'environment', label: 'Environment' },
    { key: 'sign', label: 'Sign' },
    { key: 'strongest_sense', label: 'Strongest Sense' },
    { key: 'primary_gift', label: 'Primary Gift' },
    { key: 'other_gifts', label: 'Other Gifts' },
  ];

  // Read-only derived fields — set by extraction, not manually editable
  const hdReadOnlyFields = [
    { key: 'centers', label: 'Centers' },
    { key: 'design_gates', label: 'Design Gates' },
    { key: 'personality_gates', label: 'Personality Gates' },
  ];

  const renderEditableField = (
    section: 'astrology' | 'human_design',
    field: { key: string; label: string },
    rawValue: unknown
  ) => {
    const displayValue = toDisplayString(rawValue);
    const isUnknown = displayValue === 'UNKNOWN';
    // Always use string for input value
    const inputValue = typeof rawValue === 'string' ? rawValue : '';

    if (editMode) {
      return (
        <div key={field.key} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: 'rgba(206, 190, 255, 0.9)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {field.label}
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleFieldChange(section, field.key, e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(93, 63, 211, 0.1)', border: '1px solid rgba(206, 190, 255, 0.3)', borderRadius: '10px', color: '#ffffff', fontSize: '0.9375rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
            placeholder={field.label}
          />
        </div>
      );
    }

    return (
      <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.75rem 0', borderBottom: '1px solid rgba(206, 190, 255, 0.1)', gap: '1rem' }}>
        <span style={{ color: 'rgba(206, 190, 255, 0.9)', fontWeight: 600, fontSize: '0.9375rem', flexShrink: 0 }}>
          {field.label}:
        </span>
        <span style={{ color: isUnknown ? 'rgba(252, 165, 165, 0.8)' : '#ffffff', fontSize: '0.9375rem', textAlign: 'right', fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {displayValue}
        </span>
      </div>
    );
  };

  const renderReadOnlyField = (field: { key: string; label: string }, rawValue: unknown) => {
    const displayValue = toDisplayString(rawValue);
    const isUnknown = displayValue === 'UNKNOWN';

    return (
      <div key={field.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.75rem 0', borderBottom: '1px solid rgba(206, 190, 255, 0.1)', gap: '1rem' }}>
        <span style={{ color: 'rgba(206, 190, 255, 0.6)', fontWeight: 600, fontSize: '0.875rem', flexShrink: 0 }}>
          {field.label}:
        </span>
        <span style={{ color: isUnknown ? 'rgba(252, 165, 165, 0.6)' : 'rgba(255,255,255,0.7)', fontSize: '0.8125rem', textAlign: 'right', fontFamily: 'monospace', wordBreak: 'break-word', fontStyle: 'italic' }}>
          {displayValue}
        </span>
      </div>
    );
  };

  const astro = placements.astrology || {};
  const hd = placements.human_design || {};
  const editedHd = editedPlacements.human_design || {};

  return (
    <>
      {/* Astrology Section */}
      <div className={styles.productCard} style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ffffff', fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Astrology</h3>
        </div>
        <div style={{ paddingTop: '0.5rem' }}>
          {astroFields.map((field) =>
            renderEditableField('astrology', field, editMode ? (editedPlacements.astrology || {})[field.key as keyof typeof astro] : astro[field.key as keyof typeof astro])
          )}
        </div>
      </div>

      {/* Human Design Section */}
      <div className={styles.productCard} style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#ffffff', fontSize: '1.375rem', fontWeight: 700, margin: 0 }}>Human Design</h3>
        </div>
        <div style={{ paddingTop: '0.5rem' }}>
          {hdEditableFields.map((field) =>
            renderEditableField('human_design', field, editMode ? editedHd[field.key as keyof typeof editedHd] : hd[field.key as keyof typeof hd])
          )}
          {/* Read-only extracted fields */}
          {hdReadOnlyFields.map((field) =>
            renderReadOnlyField(field, hd[field.key as keyof typeof hd])
          )}
        </div>
        {(editMode || (!editMode && toDisplayString(hd.centers) !== 'UNKNOWN')) && (
          <p style={{ color: 'rgba(206, 190, 255, 0.4)', fontSize: '0.75rem', marginTop: '0.75rem', fontStyle: 'italic' }}>
            Centers, Design Gates, and Personality Gates are extracted automatically and cannot be manually edited.
          </p>
        )}
      </div>

      {editMode && (
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={handleSave} disabled={loading} className={styles.productButton} style={{ flex: 1 }}>
            {loading ? 'Saving...' : '✓ Save Changes'}
          </button>
          <button onClick={handleCancel} disabled={loading} className={styles.secondaryButton} style={{ flex: 1 }}>
            ✕ Cancel
          </button>
        </div>
      )}
    </>
  );
}
