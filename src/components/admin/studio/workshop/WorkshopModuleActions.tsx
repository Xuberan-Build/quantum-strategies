'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/admin/admin-layout.module.css';

interface Props {
  workshopId: string;
  workshopStatus: string;
}

export default function WorkshopModuleActions({ workshopId, workshopStatus }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/workshops/${workshopId}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), video_url: videoUrl.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setTitle('');
      setVideoUrl('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (newStatus: string) => {
    setLoading(true);
    try {
      await fetch(`/api/admin/workshops/${workshopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Add Module</h2>
        </div>
        <form onSubmit={handleAddModule} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label style={labelStyle}>Module Title *</label>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Identity Transformation" required style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Vimeo URL</label>
            <input
              type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://vimeo.com/..." style={inputStyle}
            />
          </div>
          {error && <p style={{ fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>{error}</p>}
          <button
            type="submit" disabled={loading || !title.trim()}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            {loading ? 'Adding...' : 'Add Module'}
          </button>
        </form>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Status</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {workshopStatus === 'draft' && (
            <button onClick={() => handlePublish('published')} disabled={loading}
              className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: '100%', justifyContent: 'center' }}>
              Publish Workshop
            </button>
          )}
          {workshopStatus === 'published' && (
            <button onClick={() => handlePublish('draft')} disabled={loading}
              className={`${styles.btn} ${styles.btnSecondary}`} style={{ width: '100%', justifyContent: 'center' }}>
              Unpublish
            </button>
          )}
          {workshopStatus !== 'archived' && (
            <button onClick={() => handlePublish('archived')} disabled={loading}
              className={`${styles.btn} ${styles.btnSecondary}`} style={{ width: '100%', justifyContent: 'center', opacity: 0.7 }}>
              Archive
            </button>
          )}
        </div>
      </div>
    </>
  );
}
