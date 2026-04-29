'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default function NewCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'manual',
    trigger_product_slug: '',
    from_name: 'Austin at Quantum Strategies',
    from_email: 'austin@quantumstrategies.online',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        description: form.description.trim(),
        trigger_type: form.trigger_type,
        from_name: form.from_name.trim(),
        from_email: form.from_email.trim(),
      };
      if (form.trigger_product_slug.trim()) {
        body.trigger_product_slug = form.trigger_product_slug.trim();
      }
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create campaign');
      router.push(`/admin/campaigns/${json.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const showProductSlug = ['on_purchase', 'on_completion'].includes(form.trigger_type);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: '0.5rem',
    color: 'var(--admin-text)',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.375rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--admin-text-muted)',
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/campaigns" style={{ color: 'var(--admin-text-muted)', display: 'flex' }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className={styles.pageTitle}>New Campaign</h1>
        </div>
        <p className={styles.pageDescription}>Set up an email workflow — add steps after creating it.</p>
      </header>

      <div className={styles.card}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div>
            <label style={labelStyle}>Campaign Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Post-Purchase Rite II Sequence"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does this campaign do?"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Trigger</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { value: 'manual', label: 'Manual', description: 'Enroll users manually from the campaign page or from a list' },
                { value: 'on_signup', label: 'On Signup', description: 'Triggered when a new user registers' },
                { value: 'on_purchase', label: 'On Purchase', description: 'Triggered when a user purchases a specific product' },
                { value: 'on_completion', label: 'On Completion', description: 'Triggered when a user completes a product' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    border: `1px solid ${form.trigger_type === opt.value ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    background: form.trigger_type === opt.value ? 'rgba(99,102,241,0.06)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="trigger_type"
                    value={opt.value}
                    checked={form.trigger_type === opt.value}
                    onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
                    style={{ marginTop: '2px', accentColor: 'var(--admin-primary)', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{opt.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '1px' }}>{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {showProductSlug && (
            <div>
              <label style={labelStyle}>Product Slug</label>
              <input
                type="text"
                value={form.trigger_product_slug}
                onChange={(e) => setForm((f) => ({ ...f, trigger_product_slug: e.target.value }))}
                placeholder="e.g. personal-alignment"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>From Name</label>
              <input
                type="text"
                value={form.from_name}
                onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>From Email</label>
              <input
                type="email"
                value={form.from_email}
                onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-danger)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
            <button type="submit" disabled={saving || !form.name.trim()} className={`${styles.btn} ${styles.btnPrimary}`}>
              {saving ? 'Creating...' : 'Create Campaign'}
            </button>
            <Link href="/admin/campaigns" className={`${styles.btn} ${styles.btnSecondary}`}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
