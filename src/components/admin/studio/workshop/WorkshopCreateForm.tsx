'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/admin/admin-layout.module.css';

export default function WorkshopCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const deriveSlug = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSlug(deriveSlug(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug: slug.trim(), description: description.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create');
      router.push(`/admin/studio/workshop/${json.workshop.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.75rem',
    background: 'var(--admin-bg)', border: '1px solid var(--admin-border)',
    borderRadius: '0.5rem', color: 'var(--admin-text)', fontSize: '0.875rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.375rem',
    fontSize: '0.8125rem', fontWeight: 500, color: 'var(--admin-text-muted)',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Title *</label>
        <input
          type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. Visionary Creator's Activation Protocol"
          required style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Slug *</label>
        <input
          type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
          placeholder="vcap" required
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.8125rem' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={3} style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      {error && <p style={{ fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>{error}</p>}
      <button
        type="submit" disabled={loading || !title.trim() || !slug.trim()}
        className={`${styles.btn} ${styles.btnPrimary}`}
      >
        {loading ? 'Creating...' : 'Create Workshop'}
      </button>
    </form>
  );
}
