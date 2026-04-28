'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar } from './types';
import { TRADITION_META } from './constants';

export function BriefTab({ pillar, onSave }: { pillar: Pillar; onSave: (u: Partial<Pillar>) => Promise<unknown> }) {
  const [form, setForm] = useState({
    title: pillar.title,
    format: pillar.format,
    audience: pillar.audience ?? '',
    goal: pillar.goal ?? '',
    angle: pillar.angle ?? '',
    tone: pillar.tone,
    tradition_filter: pillar.tradition_filter ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className={styles.card} style={{ maxWidth: 680 }}>
      <div className={styles.cardHeader}><h2 className={styles.cardTitle}>Content Brief</h2></div>
      <form onSubmit={handleSave} style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label className={styles.formLabel}>Title</label>
          <input className={styles.formInput} value={form.title} onChange={set('title')} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className={styles.formLabel}>Format</label>
            <select className={styles.formInput} value={form.format} onChange={set('format')}>
              <option value="ebook">Ebook</option>
              <option value="webinar">Webinar</option>
              <option value="ecourse">E-Course</option>
              <option value="whitepaper">Whitepaper</option>
            </select>
          </div>
          <div>
            <label className={styles.formLabel}>Tone</label>
            <select className={styles.formInput} value={form.tone} onChange={set('tone')}>
              <option value="inspirational">Inspirational</option>
              <option value="mystical">Mystical</option>
              <option value="practical">Practical</option>
              <option value="academic">Academic</option>
            </select>
          </div>
        </div>
        <div>
          <label className={styles.formLabel}>Audience</label>
          <input className={styles.formInput} value={form.audience} onChange={set('audience')}
            placeholder="Who is this for?" />
        </div>
        <div>
          <label className={styles.formLabel}>Goal</label>
          <input className={styles.formInput} value={form.goal} onChange={set('goal')}
            placeholder="What transformation does this deliver?" />
        </div>
        <div>
          <label className={styles.formLabel}>Angle / Hook</label>
          <textarea className={styles.formInput} rows={3} value={form.angle} onChange={set('angle')}
            placeholder="The unique perspective that makes this different"
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div>
          <label className={styles.formLabel}>Tradition Focus (optional)</label>
          <select className={styles.formInput} value={form.tradition_filter} onChange={set('tradition_filter')}>
            <option value="">All traditions</option>
            {Object.entries(TRADITION_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Brief'}
          </button>
        </div>
      </form>
    </div>
  );
}
