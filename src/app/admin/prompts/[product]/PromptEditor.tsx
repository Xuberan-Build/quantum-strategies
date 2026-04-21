'use client';

import { useState } from 'react';
import styles from '../../admin-layout.module.css';

interface Props {
  productSlug: string;
  scope: string;
  initialContent: string;
  currentVersion: number;
}

export default function PromptEditor({ productSlug, scope, initialContent, currentVersion }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = content !== initialContent;
  const charCount = content.length;

  async function handleSave() {
    if (!content.trim() || !isDirty) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_slug: productSlug, scope, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setContent(initialContent);
    setError(null);
  }

  return (
    <div>
      <textarea
        className={styles.formTextarea}
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        rows={12}
        placeholder={`Enter ${scope} prompt...`}
        style={{ fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.6, resize: 'vertical' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {error && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>{error}</span>
          )}
          {saved && (
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-success)' }}>
              Saved as v{currentVersion + 1}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
            {charCount.toLocaleString()} chars
          </span>
          {isDirty && (
            <button
              onClick={handleReset}
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
              disabled={saving}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
            disabled={!isDirty || saving || !content.trim()}
          >
            {saving ? 'Saving…' : `Save as v${currentVersion + 1}`}
          </button>
        </div>
      </div>
    </div>
  );
}
