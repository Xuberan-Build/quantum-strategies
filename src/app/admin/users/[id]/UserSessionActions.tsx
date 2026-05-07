'use client';

import { useState } from 'react';
import styles from '../../admin-layout.module.css';

export function RegenerateBriefingButton({ userId, sessionId }: { userId: string; sessionId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleRegenerate() {
    if (!confirm('Regenerate briefing for this session? This will overwrite the existing deliverable.')) return;
    setState('loading');
    try {
      const res = await fetch(`/api/admin/users/${userId}/regenerate-briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      setState('done');
      setTimeout(() => window.location.reload(), 1000);
    } catch (e: any) {
      setError(e.message);
      setState('error');
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      <button
        onClick={handleRegenerate}
        disabled={state === 'loading' || state === 'done'}
        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
      >
        {state === 'loading' ? 'Regenerating…' : state === 'done' ? 'Done ✓' : 'Regenerate Briefing'}
      </button>
      {state === 'error' && (
        <span style={{ fontSize: '0.7rem', color: 'var(--admin-danger)' }}>{error}</span>
      )}
    </div>
  );
}
