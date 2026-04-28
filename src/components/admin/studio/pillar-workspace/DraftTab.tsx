'use client';

import { useState, useRef, useCallback } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Section } from './types';

export function DraftTab({ sections, onSectionsUpdate }: {
  sections: Section[];
  onSectionsUpdate: (s: Section[]) => void;
}) {
  const [selected, setSelected]         = useState<string>(sections[0]?.id ?? '');
  const [generating, setGenerating]     = useState<Set<string>>(new Set());
  const [autoSaveTimers, setTimers]     = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const bodiesRef                       = useRef<Record<string, string>>({});

  const selectedSection = sections.find((s) => s.id === selected);
  const draftedCount    = sections.filter((s) => s.body).length;

  const updateSectionLocally = useCallback((id: string, updates: Partial<Section>) => {
    onSectionsUpdate(sections.map((s) => s.id === id ? { ...s, ...updates } : s));
  }, [sections, onSectionsUpdate]);

  async function generateDraft(sectionId: string) {
    setGenerating((prev) => new Set(prev).add(sectionId));
    try {
      const res = await fetch(`/api/admin/studio/sections/${sectionId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.section) {
        updateSectionLocally(sectionId, { body: data.section.body, status: 'draft' });
        bodiesRef.current[sectionId] = data.section.body ?? '';
      }
    } finally {
      setGenerating((prev) => { const s = new Set(prev); s.delete(sectionId); return s; });
    }
  }

  function handleBodyChange(sectionId: string, value: string) {
    updateSectionLocally(sectionId, { body: value });
    bodiesRef.current[sectionId] = value;

    clearTimeout(autoSaveTimers[sectionId]);
    const timer = setTimeout(async () => {
      await fetch(`/api/admin/studio/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: value }),
      });
    }, 1200);
    setTimers((prev) => ({ ...prev, [sectionId]: timer }));
  }

  if (sections.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No outline yet</p>
          <p className={styles.emptyDescription}>Generate an outline first, then draft each section.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Section list */}
      <div className={styles.card} style={{ position: 'sticky', top: '1rem' }}>
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--admin-border)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-muted)' }}>
          {draftedCount}/{sections.length} drafted
        </div>
        {sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
              background: selected === s.id ? 'var(--admin-bg-subtle, #f8fafc)' : 'none',
              border: 'none', borderBottom: '1px solid var(--admin-border)', cursor: 'pointer',
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', minWidth: 20, paddingTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.4 }}>{s.title}</div>
              <div style={{ marginTop: 3 }}>
                {s.body ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--admin-success)', fontWeight: 600 }}>● Drafted</span>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>○ Pending</span>
                )}
              </div>
            </div>
            {generating.has(s.id) && (
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--admin-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: 2 }} />
            )}
          </button>
        ))}
      </div>

      {/* Editor */}
      {selectedSection && (
        <div className={styles.card}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1rem' }}>{selectedSection.title}</div>
              {selectedSection.description && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                  {selectedSection.description}
                </div>
              )}
            </div>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={generating.has(selectedSection.id)}
              onClick={() => generateDraft(selectedSection.id)}
            >
              {generating.has(selectedSection.id) ? 'Generating…' : selectedSection.body ? 'Regenerate' : 'Generate Draft'}
            </button>
          </div>
          <div style={{ padding: '1rem 1.5rem' }}>
            <textarea
              value={selectedSection.body ?? ''}
              onChange={(e) => handleBodyChange(selectedSection.id, e.target.value)}
              className={styles.formInput}
              rows={28}
              placeholder="Draft will appear here — or write directly…"
              style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9375rem', lineHeight: 1.75 }}
            />
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              {selectedSection.body?.split(/\s+/).filter(Boolean).length ?? 0} words · auto-saves on pause
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
