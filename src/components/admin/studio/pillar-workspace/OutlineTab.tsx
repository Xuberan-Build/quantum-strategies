'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar, Section } from './types';

function SectionOutlineCard({ section, index, isEditing, onEdit, onSave, onCancel }: {
  section: Section; index: number; isEditing: boolean;
  onEdit: () => void; onSave: (s: Section) => void; onCancel: () => void;
}) {
  const [title, setTitle]       = useState(section.title);
  const [description, setDesc]  = useState(section.description ?? '');

  if (isEditing) {
    return (
      <div className={styles.card} style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--admin-text-muted)', minWidth: 28 }}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <input
            className={styles.formInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontWeight: 600 }}
          />
        </div>
        <textarea
          className={styles.formInput}
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
            onClick={() => onSave({ ...section, title, description })}>
            Save
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
            onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card} style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--admin-border)', minWidth: 32, paddingTop: 2 }}>
        {String(index + 1).padStart(2, '0')}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{section.title}</div>
        {section.description && (
          <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', lineHeight: 1.6 }}>
            {section.description}
          </div>
        )}
      </div>
      {section.body && (
        <span className={`${styles.badge} ${styles.badgeSuccess}`} style={{ flexShrink: 0 }}>Drafted</span>
      )}
      <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
        onClick={onEdit} style={{ flexShrink: 0 }}>
        Edit
      </button>
    </div>
  );
}

export function OutlineTab({
  pillar, sections, onSectionsUpdate, onPillarUpdate,
}: {
  pillar: Pillar;
  sections: Section[];
  onSectionsUpdate: (s: Section[]) => void;
  onPillarUpdate: (p: Pillar) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [editing, setEditing]       = useState<string | null>(null);

  async function generateOutline() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSectionsUpdate(data.sections);
      onPillarUpdate({ ...pillar, status: 'outline' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate outline');
    } finally {
      setGenerating(false);
    }
  }

  async function saveSection(section: Section) {
    const res = await fetch(`/api/admin/studio/sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: section.title, description: section.description }),
    });
    const data = await res.json();
    if (data.section) {
      onSectionsUpdate(sections.map((s) => s.id === section.id ? data.section : s));
    }
    setEditing(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            {sections.length > 0 ? `${sections.length} sections` : 'No outline yet'}
          </h2>
          {sections.length === 0 && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
              Curate corpus passages first, then generate your outline
            </p>
          )}
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={generating}
          onClick={generateOutline}
        >
          {generating ? 'Generating…' : sections.length > 0 ? 'Regenerate Outline' : 'Generate Outline'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'var(--admin-danger-bg, #fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 6, padding: '0.625rem 0.875rem', color: 'var(--admin-danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sections.map((section, i) => (
          <SectionOutlineCard
            key={section.id}
            section={section}
            index={i}
            isEditing={editing === section.id}
            onEdit={() => setEditing(section.id)}
            onSave={saveSection}
            onCancel={() => setEditing(null)}
          />
        ))}
      </div>
    </div>
  );
}
