'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin-layout.module.css';

interface Props {
  productSlug: string;
  scope: string;
  content: string;
  version: number;
}

export default function RestoreButton({ productSlug, scope, content, version }: Props) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRestore() {
    if (!confirm(`Restore v${version}? This will save it as a new active version.`)) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_slug: productSlug, scope, content }),
      });
      if (!res.ok) throw new Error('Restore failed');
      setDone(true);
      router.refresh();
    } catch {
      // silent — restore failing is non-critical
    } finally {
      setRestoring(false);
    }
  }

  if (done) return <span style={{ fontSize: '0.75rem', color: 'var(--admin-success)' }}>Restored</span>;

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={restoring}
      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
      style={{ fontSize: '0.7rem', padding: '2px 8px' }}
    >
      {restoring ? '…' : `Restore v${version}`}
    </button>
  );
}
