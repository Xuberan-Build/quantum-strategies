'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

export default function NewPillarPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    format: 'ebook',
    audience: '',
    goal: '',
    angle: '',
    tone: 'inspirational',
    tradition_filter: '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/studio/pillars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create pillar');
      router.push(`/admin/studio/${data.pillar.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSaving(false);
    }
  }

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
            ← Studio
          </Link>
          <h1 className={styles.pageTitle} style={{ marginTop: '0.5rem' }}>New Pillar</h1>
        </div>
      </header>

      <div className={styles.card} style={{ maxWidth: 680 }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Content Brief</h2>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className={styles.formLabel}>Title *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. The Mystic's Guide to Ego Dissolution"
              value={form.title}
              onChange={set('title')}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className={styles.formLabel}>Format *</label>
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
            <input
              className={styles.formInput}
              placeholder="e.g. Spiritual practitioners seeking a science-backed framework"
              value={form.audience}
              onChange={set('audience')}
            />
          </div>

          <div>
            <label className={styles.formLabel}>Goal</label>
            <input
              className={styles.formInput}
              placeholder="e.g. Guide readers through a 7-step dissolution of the ego construct"
              value={form.goal}
              onChange={set('goal')}
            />
          </div>

          <div>
            <label className={styles.formLabel}>Angle / Unique Hook</label>
            <textarea
              className={styles.formInput}
              rows={2}
              placeholder="e.g. Weave together Sufi annihilation, Taoist wu wei, and the REBUS model to show ego dissolution is neurologically hardwired"
              value={form.angle}
              onChange={set('angle')}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label className={styles.formLabel}>Tradition Focus (optional)</label>
            <select className={styles.formInput} value={form.tradition_filter} onChange={set('tradition_filter')}>
              <option value="">All traditions</option>
              <option value="taoism">Taoism</option>
              <option value="kabbalah">Kabbalah</option>
              <option value="tantra">Tantra</option>
              <option value="sufism">Sufism</option>
              <option value="christian_mysticism">Christian Mysticism</option>
              <option value="hermeticism">Hermeticism</option>
              <option value="rosicrucianism">Rosicrucianism</option>
              <option value="buddhism">Buddhism</option>
              <option value="hinduism">Hinduism</option>
              <option value="science">Science</option>
            </select>
          </div>

          {error && (
            <div style={{ background: 'var(--admin-danger-bg, #fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 6, padding: '0.75rem 1rem', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={saving || !form.title.trim()}
            >
              {saving ? 'Creating…' : 'Create Pillar'}
            </button>
            <Link href="/admin/studio" className={`${styles.btn} ${styles.btnSecondary}`}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
