'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin-layout.module.css';

interface Props {
  productSlug: string;
  scope: string;
  initialContent: string;
  currentVersion: number;
  fallbackContent?: string;
}

export default function PromptEditor({ productSlug, scope, initialContent, currentVersion, fallbackContent }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = content !== initialContent;
  const charCount = content.length;
  const tokenEstimate = Math.round(charCount / 4);
  const isEmpty = !content.trim();

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
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {isEmpty && fallbackContent && (
        <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0.875rem', background: 'var(--admin-bg)', border: '1px dashed var(--admin-border)', borderRadius: 6 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            Start from the built-in default
          </span>
          <button
            type="button"
            onClick={() => setContent(fallbackContent)}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          >
            Load default →
          </button>
        </div>
      )}

      <textarea
        className={styles.formTextarea}
        value={content}
        onChange={(e) => { setContent(e.target.value); setSaved(false); }}
        rows={12}
        placeholder={`Enter ${scope.replace(/_/g, ' ')} prompt…`}
        style={{ fontFamily: 'monospace', fontSize: '0.8125rem', lineHeight: 1.6, resize: 'vertical' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
            {charCount.toLocaleString()} chars · ~{tokenEstimate.toLocaleString()} tokens
          </span>
          {isDirty && (
            <button
              onClick={() => setContent(initialContent)}
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
              disabled={saving}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
            disabled={!isDirty || saving || isEmpty}
          >
            {saving ? 'Saving…' : `Save as v${currentVersion + 1}`}
          </button>
        </div>
      </div>
    </div>
  );
}
