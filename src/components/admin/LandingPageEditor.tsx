'use client';

import { useState, useCallback } from 'react';
import styles from '@/app/admin/admin-layout.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Feature {
  id: string;
  icon: string;
  title: string;
  body: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface LandingPageData {
  product_slug: string;
  status: string;
  badge: string;
  hero_headline: string;
  hero_accent: string;
  hero_description: string;
  hero_microcopy: string;
  hero_cta_label: string;
  features: Feature[];
  pricing_headline: string;
  pricing_bullets: string[];
  pricing_cta: string;
  faq: FaqItem[];
  seo_title: string;
  seo_description: string;
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ReactNode> = {
  brain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.07-4.21A3 3 0 0 1 5 9a3 3 0 0 1 1.5-2.6A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.07-4.21A3 3 0 0 0 19 9a3 3 0 0 0-1.5-2.6A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  chart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
    </svg>
  ),
  lightning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  lock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  star: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  target: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  zap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

const ICON_OPTIONS = Object.keys(ICONS);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_DATA: Omit<LandingPageData, 'product_slug' | 'status'> = {
  badge: '',
  hero_headline: '',
  hero_accent: '',
  hero_description: '',
  hero_microcopy: '',
  hero_cta_label: 'Get Started',
  features: [],
  pricing_headline: 'Start Today',
  pricing_bullets: [],
  pricing_cta: 'Get Started',
  faq: [],
  seo_title: '',
  seo_description: '',
};

// ─── Preview ──────────────────────────────────────────────────────────────────

function LandingPagePreview({ data }: { data: LandingPageData }) {
  const dark = '#0f0f11';
  const surface = '#17181c';
  const border = '#2a2b30';
  const accent = '#a78bfa';
  const text = '#e2e8f0';
  const muted = '#94a3b8';

  return (
    <div style={{ background: dark, color: text, fontFamily: 'system-ui, sans-serif', fontSize: '13px', borderRadius: '8px', overflow: 'hidden', minHeight: '100%' }}>
      {/* Hero */}
      <div style={{ padding: '40px 32px 32px', textAlign: 'center', borderBottom: `1px solid ${border}` }}>
        {data.badge && (
          <div style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: accent, border: `1px solid ${accent}`, borderRadius: '4px', padding: '3px 10px', marginBottom: '16px' }}>
            {data.badge.toUpperCase()}
          </div>
        )}
        <h1 style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.2, margin: '0 0 8px', color: text }}>
          {data.hero_headline || <span style={{ color: border }}>Headline</span>}
        </h1>
        {data.hero_accent && (
          <div style={{ fontSize: '16px', color: accent, fontStyle: 'italic', marginBottom: '12px' }}>
            {data.hero_accent}
          </div>
        )}
        {data.hero_description && (
          <p style={{ fontSize: '13px', color: muted, maxWidth: '480px', margin: '0 auto 16px', lineHeight: 1.6 }}>
            {data.hero_description}
          </p>
        )}
        {data.hero_microcopy && (
          <p style={{ fontSize: '11px', color: muted, margin: '0 0 16px' }}>{data.hero_microcopy}</p>
        )}
        <div style={{ display: 'inline-block', background: accent, color: '#fff', padding: '8px 24px', borderRadius: '6px', fontWeight: 600, fontSize: '12px' }}>
          {data.hero_cta_label || 'Get Started'}
        </div>
      </div>

      {/* Features */}
      {data.features.length > 0 && (
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${border}` }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: text }}>
            What You Will Discover
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {data.features.map((f) => (
              <div key={f.id} style={{ background: surface, border: `1px solid ${border}`, borderRadius: '6px', padding: '12px' }}>
                <div style={{ color: accent, marginBottom: '6px' }}>{ICONS[f.icon] ?? ICONS.star}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: text }}>{f.title || 'Feature'}</div>
                <div style={{ fontSize: '10px', color: muted, lineHeight: 1.5 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${border}`, textAlign: 'center' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: text }}>
          {data.pricing_headline || 'Pricing'}
        </h2>
        {data.pricing_bullets.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 auto 16px', maxWidth: '320px', textAlign: 'left' }}>
            {data.pricing_bullets.filter(Boolean).map((b, i) => (
              <li key={i} style={{ fontSize: '11px', color: muted, padding: '3px 0' }}>✓ {b}</li>
            ))}
          </ul>
        )}
        <div style={{ display: 'inline-block', background: accent, color: '#fff', padding: '8px 24px', borderRadius: '6px', fontWeight: 600, fontSize: '12px' }}>
          {data.pricing_cta || 'Get Started'}
        </div>
      </div>

      {/* FAQ */}
      {data.faq.length > 0 && (
        <div style={{ padding: '24px 32px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: text }}>
            Common Questions
          </h2>
          {data.faq.map((item) => (
            <div key={item.id} style={{ borderBottom: `1px solid ${border}`, padding: '10px 0' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: text, marginBottom: '4px' }}>{item.question}</div>
              <div style={{ fontSize: '10px', color: muted, lineHeight: 1.5 }}>{item.answer}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--admin-text-muted)', textTransform: 'uppercase', marginBottom: '12px', marginTop: '24px', paddingBottom: '6px', borderBottom: '1px solid var(--admin-border)' }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--admin-border)',
  borderRadius: '6px',
  fontSize: '13px',
  background: 'var(--admin-bg)',
  color: 'var(--admin-text)',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical' };

// ─── Main editor ──────────────────────────────────────────────────────────────

interface LandingPageEditorProps {
  slug: string;
  initialData: LandingPageData | null;
}

export default function LandingPageEditor({ slug, initialData }: LandingPageEditorProps) {
  const [data, setData] = useState<LandingPageData>({
    product_slug: slug,
    status: initialData?.status ?? 'draft',
    ...DEFAULT_DATA,
    ...initialData,
    features: (initialData?.features ?? []).map((f) => ({ ...f, id: f.id ?? uid() })),
    faq: (initialData?.faq ?? []).map((f) => ({ ...f, id: f.id ?? uid() })),
    pricing_bullets: initialData?.pricing_bullets ?? [],
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const set = useCallback(<K extends keyof LandingPageData>(key: K, value: LandingPageData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${slug}/landing-page`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      const { page } = await res.json();
      setData((d) => ({ ...d, status: page.status }));
      showToast('success', 'Saved as draft');
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      // Save first
      const saveRes = await fetch(`/api/admin/products/${slug}/landing-page`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!saveRes.ok) throw new Error('Save failed before publish');

      const res = await fetch(`/api/admin/products/${slug}/landing-page/publish`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Publish failed');
      setData((d) => ({ ...d, status: 'published' }));
      showToast('success', 'Published — page is now live');
    } catch (e) {
      showToast('error', (e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  // Feature helpers
  function addFeature() {
    set('features', [...data.features, { id: uid(), icon: 'star', title: '', body: '' }]);
  }
  function removeFeature(id: string) {
    set('features', data.features.filter((f) => f.id !== id));
  }
  function updateFeature(id: string, patch: Partial<Feature>) {
    set('features', data.features.map((f) => f.id === id ? { ...f, ...patch } : f));
  }
  function moveFeature(idx: number, dir: -1 | 1) {
    const next = [...data.features];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    set('features', next);
  }

  // FAQ helpers
  function addFaq() {
    set('faq', [...data.faq, { id: uid(), question: '', answer: '' }]);
  }
  function removeFaq(id: string) {
    set('faq', data.faq.filter((f) => f.id !== id));
  }
  function updateFaq(id: string, patch: Partial<FaqItem>) {
    set('faq', data.faq.map((f) => f.id === id ? { ...f, ...patch } : f));
  }

  // Pricing bullets: store as array, edit as textarea (one per line)
  const bulletsText = data.pricing_bullets.join('\n');
  function setBullets(text: string) {
    set('pricing_bullets', text.split('\n'));
  }

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', height: 'calc(100vh - 180px)' }}>
      {/* ── Left: Editor ── */}
      <div style={{ flex: '0 0 55%', overflowY: 'auto', height: '100%', paddingRight: '4px' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'sticky', top: 0, background: 'var(--admin-bg)', zIndex: 10, paddingBottom: '12px', borderBottom: '1px solid var(--admin-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: data.status === 'published' ? '#dcfce7' : '#f1f5f9', color: data.status === 'published' ? '#15803d' : 'var(--admin-text-muted)', fontWeight: 600 }}>
              {data.status === 'published' ? 'Live' : 'Draft'}
            </span>
            {toast && (
              <span style={{ fontSize: '12px', color: toast.type === 'success' ? '#15803d' : '#dc2626' }}>
                {toast.msg}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={saving} className={`${styles.btn} ${styles.btnSecondary}`} style={{ fontSize: '12px', padding: '5px 14px' }}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={publish} disabled={publishing} className={`${styles.btn} ${styles.btnPrimary}`} style={{ fontSize: '12px', padding: '5px 14px' }}>
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>

        {/* SEO */}
        <SectionLabel>SEO</SectionLabel>
        <Field label="Page title">
          <input style={inputStyle} value={data.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder="Overrides hero headline in browser tab" />
        </Field>
        <Field label="Meta description">
          <textarea style={textareaStyle} rows={2} value={data.seo_description} onChange={(e) => set('seo_description', e.target.value)} placeholder="160 chars max" />
        </Field>

        {/* Hero */}
        <SectionLabel>Hero</SectionLabel>
        <Field label="Badge">
          <input style={inputStyle} value={data.badge} onChange={(e) => set('badge', e.target.value)} placeholder="RITE I: PERCEPTION" />
        </Field>
        <Field label="Headline">
          <input style={{ ...inputStyle, fontSize: '15px', fontWeight: 600 }} value={data.hero_headline} onChange={(e) => set('hero_headline', e.target.value)} placeholder="Main headline" />
        </Field>
        <Field label="Accent line">
          <input style={inputStyle} value={data.hero_accent} onChange={(e) => set('hero_accent', e.target.value)} placeholder="Italic colored line under headline" />
        </Field>
        <Field label="Description">
          <textarea style={textareaStyle} rows={3} value={data.hero_description} onChange={(e) => set('hero_description', e.target.value)} placeholder="2–3 sentence description" />
        </Field>
        <Field label="Microcopy">
          <input style={inputStyle} value={data.hero_microcopy} onChange={(e) => set('hero_microcopy', e.target.value)} placeholder="Complete in 15–20 minutes. Instant access." />
        </Field>
        <Field label="CTA button label">
          <input style={inputStyle} value={data.hero_cta_label} onChange={(e) => set('hero_cta_label', e.target.value)} placeholder="Get Started" />
        </Field>

        {/* Features */}
        <SectionLabel>Features</SectionLabel>
        {data.features.map((f, idx) => (
          <div key={f.id} style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => moveFeature(idx, -1)} style={{ ...inputStyle, width: 'auto', padding: '2px 8px', cursor: 'pointer' }}>↑</button>
                <button onClick={() => moveFeature(idx, 1)} style={{ ...inputStyle, width: 'auto', padding: '2px 8px', cursor: 'pointer' }}>↓</button>
              </div>
              <button onClick={() => removeFeature(f.id)} style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '3px' }}>Icon</label>
                <select style={{ ...inputStyle, padding: '5px 8px' }} value={f.icon} onChange={(e) => updateFeature(f.id, { icon: e.target.value })}>
                  {ICON_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '3px' }}>Title</label>
                <input style={inputStyle} value={f.title} onChange={(e) => updateFeature(f.id, { title: e.target.value })} placeholder="Feature name" />
              </div>
            </div>
            <label style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '3px' }}>Description</label>
            <textarea style={textareaStyle} rows={2} value={f.body} onChange={(e) => updateFeature(f.id, { body: e.target.value })} placeholder="What this reveals or delivers" />
          </div>
        ))}
        <button onClick={addFeature} className={`${styles.btn} ${styles.btnSecondary}`} style={{ fontSize: '12px', padding: '5px 14px', marginBottom: '8px' }}>
          + Add Feature
        </button>

        {/* Pricing */}
        <SectionLabel>Pricing</SectionLabel>
        <Field label="Section headline">
          <input style={inputStyle} value={data.pricing_headline} onChange={(e) => set('pricing_headline', e.target.value)} placeholder="Start Today" />
        </Field>
        <Field label="Bullets (one per line)">
          <textarea style={textareaStyle} rows={6} value={bulletsText} onChange={(e) => setBullets(e.target.value)} placeholder={"Identify your signal across four dimensions\nInstant access — complete in 15 minutes"} />
        </Field>
        <Field label="CTA button label">
          <input style={inputStyle} value={data.pricing_cta} onChange={(e) => set('pricing_cta', e.target.value)} placeholder="Get Started" />
        </Field>

        {/* FAQ */}
        <SectionLabel>FAQ</SectionLabel>
        {data.faq.map((item) => (
          <div key={item.id} style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
              <button onClick={() => removeFaq(item.id)} style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
            <Field label="Question">
              <input style={inputStyle} value={item.question} onChange={(e) => updateFaq(item.id, { question: e.target.value })} placeholder="Common question" />
            </Field>
            <Field label="Answer">
              <textarea style={textareaStyle} rows={3} value={item.answer} onChange={(e) => updateFaq(item.id, { answer: e.target.value })} placeholder="Clear, honest answer" />
            </Field>
          </div>
        ))}
        <button onClick={addFaq} className={`${styles.btn} ${styles.btnSecondary}`} style={{ fontSize: '12px', padding: '5px 14px', marginBottom: '32px' }}>
          + Add FAQ
        </button>
      </div>

      {/* ── Right: Preview ── */}
      <div style={{ flex: '0 0 45%', overflowY: 'auto', height: '100%', position: 'sticky', top: 0 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--admin-text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
          Preview
        </div>
        <LandingPagePreview data={data} />
      </div>
    </div>
  );
}
