'use client';

import { useState } from 'react';
import styles from './founding.module.css';

export default function FoundingCheckoutButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/founding-member/checkout', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        throw new Error(body.error || 'Something went wrong. Please try again.');
      }
      window.location.href = body.url;
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <button className={styles.button} onClick={handleClick} disabled={busy}>
        {busy ? 'Opening checkout...' : label}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
