'use client';

import { useState, useCallback } from 'react';
import styles from '@/app/admin/admin-layout.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type SlideType = 'title' | 'statement' | 'content' | 'before_after' | 'formula' | 'insight';

interface Slide {
  id: string;
  module_id: string;
  position: number;
  slide_type: SlideType;
  content: Record<string, any>;
}

interface Module {
  id: string;
  workshop_id: string;
  title: string;
  video_url: string | null;
  description: string | null;
}

interface Props {
  workshopId: string;
  module: Module;
  initialSlides: Slide[];
}

// ─── Slide type config ────────────────────────────────────────────────────────

const SLIDE_TYPES: { value: SlideType; label: string; color: string }[] = [
  { value: 'title',       label: 'Title',        color: '#8b5cf6' },
  { value: 'statement',   label: 'Statement',    color: '#f59e0b' },
  { value: 'content',     label: 'Content',      color: '#3b82f6' },
  { value: 'before_after',label: 'Before/After', color: '#10b981' },
  { value: 'formula',     label: 'Formula',      color: '#ec4899' },
  { value: 'insight',     label: 'Insight',      color: '#06b6d4' },
];

const defaultContent = (type: SlideType): Record<string, any> => ({
  title:        { mainTitle: '', subtitle: '' },
  statement:    { title: '', statement: '', elaboration: '' },
  content:      { title: '', description: '', items: '' },
  before_after: { title: '', beforeTitle: 'Before', afterTitle: 'After', beforeItems: '', afterItems: '' },
  formula:      { title: '', formula: '', description: '' },
  insight:      { title: '', insight: '', description: '' },
}[type]);

function slidePreviewText(slide: Slide): string {
  const c = slide.content;
  if (slide.slide_type === 'title')        return c.mainTitle || '(untitled)';
  if (slide.slide_type === 'statement')    return c.statement || c.title || '(empty)';
  if (slide.slide_type === 'formula')      return c.formula || c.title || '(empty)';
  if (slide.slide_type === 'insight')      return c.insight || c.title || '(empty)';
  if (slide.slide_type === 'before_after') return c.title || 'Before / After';
  return c.title || c.description || '(empty)';
}

// Content serialized for forms: arrays become newline-joined strings
function slideToForm(slide: Slide): Record<string, string> {
  const c = slide.content;
  if (slide.slide_type === 'content') {
    return { ...c, items: Array.isArray(c.items) ? c.items.join('\n') : (c.items ?? '') };
  }
  if (slide.slide_type === 'before_after') {
    return {
      ...c,
      beforeItems: Array.isArray(c.beforeItems) ? c.beforeItems.join('\n') : (c.beforeItems ?? ''),
      afterItems:  Array.isArray(c.afterItems)  ? c.afterItems.join('\n')  : (c.afterItems  ?? ''),
    };
  }
  return c;
}

// Form strings → typed content for DB
function formToContent(type: SlideType, form: Record<string, string>): Record<string, any> {
  if (type === 'content') {
    const items = form.items?.split('\n').map((s) => s.trim()).filter(Boolean) ?? [];
    return { ...form, items };
  }
  if (type === 'before_after') {
    const beforeItems = form.beforeItems?.split('\n').map((s) => s.trim()).filter(Boolean) ?? [];
    const afterItems  = form.afterItems?.split('\n').map((s) => s.trim()).filter(Boolean) ?? [];
    return { ...form, beforeItems, afterItems };
  }
  return form;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.625rem',
  background: 'var(--admin-bg)', border: '1px solid var(--admin-border)',
  borderRadius: '0.375rem', color: 'var(--admin-text)', fontSize: '0.875rem',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: '0.25rem',
  fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

// ─── Slide Preview ────────────────────────────────────────────────────────────

function SlidePreview({ slide }: { slide: Slide }) {
  const c = slide.content;
  const typeColor = SLIDE_TYPES.find((t) => t.value === slide.slide_type)?.color ?? '#6b7280';

  return (
    <div style={{
      background: '#111', color: '#fff', borderRadius: '0.75rem',
      padding: '2rem', minHeight: '200px', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', border: `1px solid ${typeColor}30`,
      boxShadow: `0 0 0 1px ${typeColor}20`,
    }}>
      {slide.slide_type === 'title' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.75rem' }}>
            {c.mainTitle || <span style={{ opacity: 0.3 }}>Main Title</span>}
          </div>
          {c.subtitle && (
            <div style={{ fontSize: '1.1rem', color: typeColor, fontWeight: 500 }}>{c.subtitle}</div>
          )}
        </div>
      )}

      {slide.slide_type === 'statement' && (
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          {c.title && <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.title}</div>}
          <div style={{ fontSize: '1.4rem', fontStyle: 'italic', color: typeColor, lineHeight: 1.5, marginBottom: '1rem' }}>
            "{c.statement || <span style={{ opacity: 0.3 }}>Statement text</span>}"
          </div>
          {c.elaboration && <div style={{ fontSize: '0.9375rem', color: '#c0c0c0', lineHeight: 1.6 }}>{c.elaboration}</div>}
        </div>
      )}

      {slide.slide_type === 'content' && (
        <div style={{ maxWidth: 680, margin: '0 auto', width: '100%' }}>
          {c.title && <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>{c.title}</div>}
          {c.description && <div style={{ fontSize: '1rem', color: '#e0e0e0', marginBottom: '1rem', lineHeight: 1.6 }}>{c.description}</div>}
          {Array.isArray(c.items) && c.items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {c.items.map((item: string, i: number) => (
                <div key={i} style={{ color: typeColor, fontSize: '1rem' }}>• {item}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {slide.slide_type === 'before_after' && (
        <div style={{ maxWidth: 700, margin: '0 auto', width: '100%' }}>
          {c.title && <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', textAlign: 'center' }}>{c.title}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>{c.beforeTitle || 'Before'}</div>
              {(Array.isArray(c.beforeItems) ? c.beforeItems : []).map((item: string, i: number) => (
                <div key={i} style={{ fontSize: '0.9375rem', color: '#ff6b6b', marginBottom: '0.375rem' }}>{item}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#88d8b0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>{c.afterTitle || 'After'}</div>
              {(Array.isArray(c.afterItems) ? c.afterItems : []).map((item: string, i: number) => (
                <div key={i} style={{ fontSize: '0.9375rem', color: '#88d8b0', marginBottom: '0.375rem' }}>{item}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {slide.slide_type === 'formula' && (
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          {c.title && <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.25rem' }}>{c.title}</div>}
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ffd93d', letterSpacing: '0.02em', marginBottom: '1rem' }}>
            {c.formula || <span style={{ opacity: 0.3 }}>Formula text</span>}
          </div>
          {c.description && <div style={{ fontSize: '0.9375rem', color: '#c0c0c0', lineHeight: 1.6 }}>{c.description}</div>}
        </div>
      )}

      {slide.slide_type === 'insight' && (
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          {c.title && <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>{c.title}</div>}
          <div style={{
            padding: '1.25rem 1.75rem', background: `${typeColor}15`,
            border: `2px solid ${typeColor}`, borderRadius: '12px',
            fontSize: '1.2rem', color: typeColor, fontWeight: 600, lineHeight: 1.5,
            marginBottom: '1rem',
          }}>
            {c.insight || <span style={{ opacity: 0.5 }}>Insight text</span>}
          </div>
          {c.description && <div style={{ fontSize: '0.9375rem', color: '#c0c0c0', lineHeight: 1.6 }}>{c.description}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Form fields by type ──────────────────────────────────────────────────────

function SlideForm({
  type, form, onChange,
}: {
  type: SlideType;
  form: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const field = (key: string, label: string, multi = false, rows = 3, required = false) => (
    <div key={key}>
      <label style={LABEL}>{label}{required ? ' *' : ''}</label>
      {multi ? (
        <textarea
          value={form[key] ?? ''} onChange={(e) => onChange(key, e.target.value)}
          rows={rows} style={{ ...INPUT, resize: 'vertical', fontFamily: type === 'formula' ? 'monospace' : 'inherit' }}
        />
      ) : (
        <input
          type="text" value={form[key] ?? ''} onChange={(e) => onChange(key, e.target.value)}
          required={required} style={INPUT}
        />
      )}
    </div>
  );

  if (type === 'title') return (
    <>
      {field('mainTitle', 'Main Title', false, 1, true)}
      {field('subtitle', 'Subtitle')}
    </>
  );

  if (type === 'statement') return (
    <>
      {field('title', 'Label / Context (optional)')}
      {field('statement', 'Statement', true, 3, true)}
      {field('elaboration', 'Elaboration', true, 3)}
    </>
  );

  if (type === 'content') return (
    <>
      {field('title', 'Title')}
      {field('description', 'Description', true, 3)}
      <div>
        <label style={LABEL}>Items (one per line)</label>
        <textarea
          value={form.items ?? ''} onChange={(e) => onChange('items', e.target.value)}
          rows={5} placeholder="First bullet&#10;Second bullet&#10;Third bullet"
          style={{ ...INPUT, resize: 'vertical' }}
        />
      </div>
    </>
  );

  if (type === 'before_after') return (
    <>
      {field('title', 'Slide Title (optional)')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {field('beforeTitle', 'Before Column Header')}
        {field('afterTitle', 'After Column Header')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={LABEL}>Before Items (one per line)</label>
          <textarea
            value={form.beforeItems ?? ''} onChange={(e) => onChange('beforeItems', e.target.value)}
            rows={5} style={{ ...INPUT, resize: 'vertical' }}
          />
        </div>
        <div>
          <label style={LABEL}>After Items (one per line)</label>
          <textarea
            value={form.afterItems ?? ''} onChange={(e) => onChange('afterItems', e.target.value)}
            rows={5} style={{ ...INPUT, resize: 'vertical' }}
          />
        </div>
      </div>
    </>
  );

  if (type === 'formula') return (
    <>
      {field('title', 'Context Label (optional)')}
      {field('formula', 'Formula', false, 1, true)}
      {field('description', 'Supporting Text', true, 3)}
    </>
  );

  if (type === 'insight') return (
    <>
      {field('title', 'Label (optional)')}
      {field('insight', 'Insight', true, 3, true)}
      {field('description', 'Supporting Text', true, 3)}
    </>
  );

  return null;
}

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function SlideEditorClient({ workshopId, module: mod, initialSlides }: Props) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selectedId, setSelectedId] = useState<string | null>(initialSlides[0]?.id ?? null);
  const [form, setForm] = useState<Record<string, string>>(
    initialSlides[0] ? slideToForm(initialSlides[0]) : {}
  );
  const [activeType, setActiveType] = useState<SlideType>(initialSlides[0]?.slide_type ?? 'content');
  const [moduleTitle, setModuleTitle] = useState(mod.title);
  const [moduleVideo, setModuleVideo] = useState(mod.video_url ?? '');
  const [saving, setSaving] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  const [addingType, setAddingType] = useState<SlideType>('content');
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const flash = (msg: string) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(''), 2000); };

  const selectSlide = useCallback((slide: Slide) => {
    setSelectedId(slide.id);
    setActiveType(slide.slide_type);
    setForm(slideToForm(slide));
    setError('');
  }, []);

  const handleTypeChange = (newType: SlideType) => {
    setActiveType(newType);
    setForm(defaultContent(newType) as Record<string, string>);
  };

  const handleFormChange = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
  };

  // ── Save current slide ──
  const handleSaveSlide = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      const content = formToContent(activeType, form);
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/modules/${mod.id}/slides/${selectedId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slide_type: activeType, content }) }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setSlides((prev) => prev.map((s) => s.id === selectedId ? json.slide : s));
      flash('Saved');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Add slide ──
  const handleAddSlide = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/admin/workshops/${workshopId}/modules/${mod.id}/slides`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slide_type: addingType, content: defaultContent(addingType) }) }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add');
      const newSlide: Slide = json.slide;
      setSlides((prev) => [...prev, newSlide]);
      selectSlide(newSlide);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete slide ──
  const handleDelete = async () => {
    if (!selectedId || !confirm('Delete this slide?')) return;
    setSaving(true);
    try {
      await fetch(
        `/api/admin/workshops/${workshopId}/modules/${mod.id}/slides/${selectedId}`,
        { method: 'DELETE' }
      );
      const next = slides.filter((s) => s.id !== selectedId);
      setSlides(next);
      const newSelected = next[next.length - 1] ?? null;
      if (newSelected) selectSlide(newSelected);
      else { setSelectedId(null); setForm({}); }
    } finally {
      setSaving(false);
    }
  };

  // ── Reorder: swap positions ──
  const moveSlide = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[idx], next[target]] = [next[target], next[idx]];
    const reindexed = next.map((s, i) => ({ ...s, position: i }));
    setSlides(reindexed);
    await Promise.all([
      fetch(`/api/admin/workshops/${workshopId}/modules/${mod.id}/slides/${reindexed[idx].id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: reindexed[idx].position }) }),
      fetch(`/api/admin/workshops/${workshopId}/modules/${mod.id}/slides/${reindexed[target].id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: reindexed[target].position }) }),
    ]);
  };

  // ── Save module meta ──
  const handleSaveModule = async () => {
    setSavingModule(true);
    try {
      await fetch(`/api/admin/workshops/${workshopId}/modules/${mod.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: moduleTitle.trim(), video_url: moduleVideo.trim() || null }),
      });
      flash('Module saved');
    } finally {
      setSavingModule(false);
    }
  };

  const selectedSlide = slides.find((s) => s.id === selectedId) ?? null;
  const selectedIdx = slides.findIndex((s) => s.id === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>

      {/* Module meta bar */}
      <div className={styles.card} style={{ padding: '0.875rem 1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <label style={LABEL}>Module Title</label>
            <input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} style={INPUT} />
          </div>
          <div style={{ flex: '2 1 300px', minWidth: 0 }}>
            <label style={LABEL}>Vimeo URL</label>
            <input
              type="url" value={moduleVideo} onChange={(e) => setModuleVideo(e.target.value)}
              placeholder="https://vimeo.com/..."  style={INPUT}
            />
          </div>
          <button
            onClick={handleSaveModule} disabled={savingModule}
            className={`${styles.btn} ${styles.btnSecondary}`} style={{ whiteSpace: 'nowrap' }}
          >
            {savingModule ? 'Saving...' : 'Save Module'}
          </button>
        </div>
      </div>

      {/* Editor layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem', alignItems: 'start' }}>

        {/* Left: Slide list */}
        <div className={styles.card} style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-muted)' }}>
              SLIDES ({slides.length})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
            {slides.map((slide, idx) => {
              const typeMeta = SLIDE_TYPES.find((t) => t.value === slide.slide_type);
              const isSelected = slide.id === selectedId;
              return (
                <div
                  key={slide.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem', cursor: 'pointer',
                    background: isSelected ? 'var(--admin-primary)15' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                    transition: 'all 0.1s',
                  }}
                  onClick={() => selectSlide(slide)}
                >
                  {/* Up/down */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSlide(idx, -1); }}
                      disabled={idx === 0}
                      style={{ all: 'unset', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 0.7, fontSize: '0.6rem', lineHeight: 1 }}
                    >▲</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSlide(idx, 1); }}
                      disabled={idx === slides.length - 1}
                      style={{ all: 'unset', cursor: idx === slides.length - 1 ? 'default' : 'pointer', opacity: idx === slides.length - 1 ? 0.3 : 0.7, fontSize: '0.6rem', lineHeight: 1 }}
                    >▼</button>
                  </div>

                  {/* Number */}
                  <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', width: 16, textAlign: 'center', flexShrink: 0 }}>
                    {idx + 1}
                  </span>

                  {/* Type dot + preview */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeMeta?.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: typeMeta?.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {typeMeta?.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slidePreviewText(slide)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add slide */}
          <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <select
              value={addingType}
              onChange={(e) => setAddingType(e.target.value as SlideType)}
              style={{ ...INPUT, fontSize: '0.8125rem' }}
            >
              {SLIDE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={handleAddSlide} disabled={saving}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}
            >
              + Add Slide
            </button>
          </div>
        </div>

        {/* Right: Editor + preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {selectedSlide ? (
            <>
              {/* Preview */}
              <SlidePreview
                slide={{ ...selectedSlide, slide_type: activeType, content: formToContent(activeType, form) }}
              />

              {/* Edit form */}
              <div className={styles.card}>
                {/* Type selector */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                  {SLIDE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => handleTypeChange(t.value)}
                      style={{
                        padding: '0.375rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem',
                        fontWeight: 600, cursor: 'pointer', border: 'none',
                        background: activeType === t.value ? t.color : 'var(--admin-border)',
                        color: activeType === t.value ? '#fff' : 'var(--admin-text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <SlideForm type={activeType} form={form} onChange={handleFormChange} />
                </div>

                {error && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>{error}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--admin-border)' }}>
                  <button
                    onClick={handleDelete} disabled={saving}
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ color: 'var(--admin-danger)', borderColor: 'var(--admin-danger)' }}
                  >
                    Delete Slide
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {savedMsg && <span style={{ fontSize: '0.8125rem', color: 'var(--admin-success)' }}>{savedMsg}</span>}
                    <button
                      onClick={handleSaveSlide} disabled={saving}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      {saving ? 'Saving...' : 'Save Slide'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.card}>
              <div className={styles.emptyState}>
                <p className={styles.emptyDescription}>
                  {slides.length === 0 ? 'No slides yet. Add one from the list.' : 'Select a slide to edit.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
