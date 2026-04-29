'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../../admin-layout.module.css';

interface Pillar { id: string; title: string }

export default function NewContentPieceForm({ pillars, defaultFormat }: { pillars: Pillar[]; defaultFormat?: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    pillar_id: '',
    title: '',
    format: defaultFormat || 'ebook',
    audience: '',
    goal: '',
    angle: '',
    tone: 'practical',
    tradition_filter: '',
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedPillar = pillars.find((p) => p.id === form.pillar_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.pillar_id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/studio/pillars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          metadata: {
            pillar_id: form.pillar_id,
            pillar_title: selectedPillar?.title ?? '',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      router.push(`/admin/studio/${data.pillar.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSaving(false);
    }
  }

  return (
    <div className={styles.card} style={{ maxWidth: 680 }}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Content Brief</h2>
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Strategic pillar — required */}
        <div>
          <label className={styles.formLabel}>Strategic Pillar *</label>
          <select
            className={styles.formInput}
            value={form.pillar_id}
            onChange={set('pillar_id')}
            required
          >
            <option value="">Select a pillar…</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <p className={styles.formHint}>
            Every content piece must serve one of the 5 strategic pillars.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className={styles.formLabel}>Format *</label>
            <select className={styles.formInput} value={form.format} onChange={set('format')}>
              <option value="ebook">Ebook</option>
              <option value="whitepaper">Whitepaper</option>
              <option value="ecourse">E-Course</option>
              <option value="webinar">Webinar</option>
            </select>
          </div>
          <div>
            <label className={styles.formLabel}>Tone</label>
            <select className={styles.formInput} value={form.tone} onChange={set('tone')}>
              <option value="practical">Practical</option>
              <option value="inspirational">Inspirational</option>
              <option value="mystical">Mystical</option>
              <option value="academic">Academic</option>
            </select>
          </div>
        </div>

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

        <div>
          <label className={styles.formLabel}>Audience</label>
          <input
            className={styles.formInput}
            placeholder="e.g. Founders who want a practical primer on the waveform model"
            value={form.audience}
            onChange={set('audience')}
          />
        </div>

        <div>
          <label className={styles.formLabel}>Goal</label>
          <input
            className={styles.formInput}
            placeholder="e.g. Route readers toward a Declaration product after reading"
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
            disabled={saving || !form.title.trim() || !form.pillar_id}
          >
            {saving ? 'Creating…' : 'Create Content Piece'}
          </button>
          <Link href="/admin/studio" className={`${styles.btn} ${styles.btnSecondary}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
