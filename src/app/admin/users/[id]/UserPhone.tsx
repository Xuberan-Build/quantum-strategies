'use client';

import { useState } from 'react';
import { errorMessage } from '@/lib/errors';

/** Inline phone editor on the admin user page. */
export function UserPhone({ userId, initialPhone }: { userId: string; initialPhone: string | null }) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [saved, setSaved] = useState(initialPhone ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');

  async function save() {
    if (phone.trim() === saved) return;
    setStatus('saving');
    try {
      const res = await fetch(`/api/admin/users/${userId}/phone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setSaved(data.phone ?? '');
      setPhone(data.phone ?? '');
      setStatus('idle');
    } catch (e) {
      setError(errorMessage(e));
      setStatus('error');
    }
  }

  return (
    <div>
      <input
        type="tel"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setStatus('idle');
        }}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="Add phone"
        aria-label="Phone"
        style={{ fontSize: '0.875rem', width: '100%', background: 'transparent', border: '1px solid var(--admin-border, #ddd)', borderRadius: 6, padding: '2px 6px', color: 'inherit' }}
      />
      {status === 'saving' && <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Saving…</div>}
      {status === 'error' && <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{error}</div>}
    </div>
  );
}
