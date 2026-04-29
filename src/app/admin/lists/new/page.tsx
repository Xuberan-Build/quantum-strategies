'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default function NewListPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [listType, setListType] = useState<'static' | 'smart'>('static');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), list_type: listType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create list.');
      }
      const data = await res.json();
      router.push(`/admin/lists/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/lists" className={styles.backLink} style={{ padding: 0 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className={styles.pageTitle}>New Contact List</h1>
        </div>
        <p className={styles.pageDescription}>Create a new list to organize your audience</p>
      </header>

      <div className={styles.card} style={{ maxWidth: '560px' }}>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="name">
              List Name <span style={{ color: 'var(--admin-danger)' }}>*</span>
            </label>
            <input
              id="name"
              type="text"
              className={styles.formInput}
              placeholder="e.g. Rite II Completions"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className={`${styles.formInput} ${styles.formTextarea}`}
              placeholder="Optional description of who is in this list"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>List Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="list_type"
                  value="static"
                  checked={listType === 'static'}
                  onChange={() => setListType('static')}
                  disabled={isSubmitting}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--admin-text)' }}>Static</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    Manually manage who is in this list. Add or remove members one at a time.
                  </div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="list_type"
                  value="smart"
                  checked={listType === 'smart'}
                  onChange={() => setListType('smart')}
                  disabled={isSubmitting}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--admin-text)' }}>
                    Smart{' '}
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontWeight: 400 }}>
                      coming soon
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    Automatically includes users matching saved filter criteria.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {error && <p className={styles.formError}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create List'}
            </button>
            <Link href="/admin/lists" className={`${styles.btn} ${styles.btnSecondary}`}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
