'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const HD_TYPES = ['Generator', 'Manifesting Generator', 'Projector', 'Manifestor', 'Reflector'];
const SUN_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const SOURCES = [
  { value: 'affiliates', label: 'Affiliates' },
  { value: 'placements_confirmed', label: 'Placements Confirmed' },
  { value: 'stripe_customers', label: 'Stripe Customers' },
  { value: 'discord_linked', label: 'Discord Linked' },
  { value: 'completed_product', label: 'Completed Product' },
  { value: 'beta_participants', label: 'Beta Participants' },
  { value: 'hd_type', label: 'Human Design Type' },
  { value: 'sun_sign', label: 'Sun Sign (Astrology)' },
];

export function SmartListBuilder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [hdType, setHdType] = useState(HD_TYPES[0]);
  const [sunSign, setSunSign] = useState(SUN_SIGNS[0]);
  const [productSlug, setProductSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setDescription('');
    setSource('');
    setHdType(HD_TYPES[0]);
    setSunSign(SUN_SIGNS[0]);
    setProductSlug('');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !source) {
      setError('Name and source are required.');
      return;
    }
    setSaving(true);
    setError('');

    const filter_criteria: Record<string, string> = { source };
    if (source === 'hd_type') filter_criteria.hd_type = hdType;
    if (source === 'sun_sign') filter_criteria.sun_sign = sunSign;
    if (source === 'completed_product' && productSlug.trim()) {
      filter_criteria.product_slug = productSlug.trim();
    }

    try {
      const res = await fetch('/api/admin/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          list_type: 'smart',
          filter_criteria,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to create list');
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--admin-accent)',
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        + New Smart List
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); reset(); } }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
              borderRadius: '0.75rem',
              padding: '2rem',
              width: '100%',
              maxWidth: '480px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--admin-text)' }}>
              New Smart List
            </h2>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text)' }}>Name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Projector Users"
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '0.375rem',
                  color: 'var(--admin-text)',
                  fontSize: '0.875rem',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text)' }}>Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '0.375rem',
                  color: 'var(--admin-text)',
                  fontSize: '0.875rem',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text)' }}>Segment Type *</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'var(--admin-bg)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '0.375rem',
                  color: 'var(--admin-text)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">Select a segment type…</option>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>

            {source === 'hd_type' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text)' }}>Human Design Type</span>
                <select
                  value={hdType}
                  onChange={(e) => setHdType(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '0.375rem',
                    color: 'var(--admin-text)',
                    fontSize: '0.875rem',
                  }}
                >
                  {HD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            )}

            {source === 'sun_sign' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text)' }}>Sun Sign</span>
                <select
                  value={sunSign}
                  onChange={(e) => setSunSign(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '0.375rem',
                    color: 'var(--admin-text)',
                    fontSize: '0.875rem',
                  }}
                >
                  {SUN_SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}

            {source === 'completed_product' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text)' }}>
                  Product Slug <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>(optional — leave blank for all products)</span>
                </span>
                <input
                  value={productSlug}
                  onChange={(e) => setProductSlug(e.target.value)}
                  placeholder="e.g. quantum-brand-architect"
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'var(--admin-bg)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '0.375rem',
                    color: 'var(--admin-text)',
                    fontSize: '0.875rem',
                  }}
                />
              </label>
            )}

            {error && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#ef4444' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '0.375rem',
                  color: 'var(--admin-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--admin-accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Creating…' : 'Create List'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
