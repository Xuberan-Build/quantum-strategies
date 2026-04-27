'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface Pillar {
  id: string; title: string; format: string; audience: string | null;
  goal: string | null; angle: string | null; tone: string;
  tradition_filter: string | null; corpus_query: string | null;
  status: string; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

interface Section {
  id: string; angle_id: string; order_index: number;
  title: string; description: string | null; body: string | null;
  version_history: Array<{ body: string; updated_at: string }>;
  status: string; created_at: string; updated_at: string;
}

interface Piece {
  id: string; angle_id: string; parent_section_id: string | null;
  piece_type: string; title: string | null; body: string | null;
  platform_meta: Record<string, unknown>; version_history: unknown[];
  status: string; created_at: string;
}

interface CorpusLink {
  id: string; similarity: number | null; curated: boolean; created_at: string;
  knowledge_chunks: {
    id: string; tradition: string; text_name: string; author: string | null;
    section: string | null; chapter: string | null; content: string;
    themes: string[]; source_url: string | null; priority: number;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'brief',      label: 'Brief'      },
  { key: 'research',   label: 'Research'   },
  { key: 'outline',    label: 'Outline'    },
  { key: 'draft',      label: 'Draft'      },
  { key: 'distribute', label: 'Distribute' },
] as const;

type Tab = typeof TABS[number]['key'];

const FORMAT_META: Record<string, { label: string; color: string }> = {
  ebook:      { label: 'Ebook',      color: '#8b5cf6' },
  webinar:    { label: 'Webinar',    color: '#3b82f6' },
  ecourse:    { label: 'E-Course',   color: '#10b981' },
  whitepaper: { label: 'Whitepaper', color: '#f59e0b' },
};

const PIECE_LABELS: Record<string, string> = {
  blog:            'Blog Post',
  social_twitter:  'Twitter Thread',
  social_linkedin: 'LinkedIn Post',
  social_ig:       'Instagram Caption',
  email:           'Launch Email',
  email_sequence:  'Email Sequence',
  gpt_product:     'GPT Product Prompt',
};

const TRADITION_META: Record<string, { label: string; color: string }> = {
  taoism:             { label: 'Taoism',             color: '#10b981' },
  kabbalah:           { label: 'Kabbalah',           color: '#8b5cf6' },
  tantra:             { label: 'Tantra',             color: '#ef4444' },
  sufism:             { label: 'Sufism',             color: '#f59e0b' },
  christian_mysticism:{ label: 'Christian Mysticism',color: '#3b82f6' },
  hermeticism:        { label: 'Hermeticism',        color: '#a855f7' },
  rosicrucianism:     { label: 'Rosicrucianism',     color: '#d97706' },
  science:            { label: 'Science',            color: '#06b6d4' },
  buddhism:           { label: 'Buddhism',           color: '#f97316' },
  hinduism:           { label: 'Hinduism',           color: '#fb923c' },
  qs_doctrine:        { label: 'QS Doctrine',        color: '#e11d48' },
};

// ── Main component ─────────────────────────────────────────────────────────

export default function PillarWorkspace({
  pillar: initialPillar,
  initialSections,
  initialPieces,
  initialCorpusLinks,
}: {
  pillar: Pillar;
  initialSections: Section[];
  initialPieces: Piece[];
  initialCorpusLinks: CorpusLink[];
}) {
  const statusToTab: Record<string, Tab> = {
    brief: 'brief', research: 'research', outline: 'outline',
    draft: 'draft', review: 'draft', published: 'distribute',
  };

  const [tab, setTab]               = useState<Tab>(statusToTab[initialPillar.status] ?? 'brief');
  const [pillar, setPillar]         = useState(initialPillar);
  const [sections, setSections]     = useState(initialSections);
  const [pieces, setPieces]         = useState(initialPieces);
  const [corpusLinks, setCorpusLinks] = useState(initialCorpusLinks);

  const fmt = FORMAT_META[pillar.format] ?? { label: pillar.format, color: '#6b7280' };

  async function updatePillar(updates: Partial<Pillar>) {
    const res = await fetch(`/api/admin/studio/pillars/${pillar.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.pillar) setPillar(data.pillar);
    return data;
  }

  return (
    <div>
      {/* Header */}
      <header className={styles.pageHeader}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <Link href="/admin/studio" style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
              ← Studio
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.375rem' }}>
              <h1 className={styles.pageTitle} style={{ margin: 0 }}>{pillar.title}</h1>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: fmt.color }}>{fmt.label}</span>
            </div>
            {pillar.audience && (
              <p className={styles.pageDescription} style={{ marginTop: '0.25rem' }}>
                {pillar.audience}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--admin-primary)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {t.label}
            {t.key === 'research' && corpusLinks.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {corpusLinks.filter((l) => l.curated).length}/{corpusLinks.length}
              </span>
            )}
            {t.key === 'outline' && sections.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {sections.length}
              </span>
            )}
            {t.key === 'draft' && sections.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {sections.filter((s) => s.body).length}/{sections.length}
              </span>
            )}
            {t.key === 'distribute' && pieces.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: '0.75rem', background: 'var(--admin-border)', borderRadius: 10, padding: '1px 6px' }}>
                {pieces.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === 'brief' && (
        <BriefTab pillar={pillar} onSave={updatePillar} />
      )}
      {tab === 'research' && (
        <ResearchTab
          pillar={pillar}
          corpusLinks={corpusLinks}
          onLinksUpdate={setCorpusLinks}
          onPillarUpdate={setPillar}
        />
      )}
      {tab === 'outline' && (
        <OutlineTab
          pillar={pillar}
          sections={sections}
          onSectionsUpdate={setSections}
          onPillarUpdate={setPillar}
        />
      )}
      {tab === 'draft' && (
        <DraftTab
          sections={sections}
          onSectionsUpdate={setSections}
        />
      )}
      {tab === 'distribute' && (
        <DistributeTab
          pillar={pillar}
          sections={sections}
          pieces={pieces}
          onPiecesUpdate={setPieces}
        />
      )}
    </div>
  );
}

// ── Brief Tab ──────────────────────────────────────────────────────────────

function BriefTab({ pillar, onSave }: { pillar: Pillar; onSave: (u: Partial<Pillar>) => Promise<unknown> }) {
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

// ── Research Tab ───────────────────────────────────────────────────────────

function ResearchTab({
  pillar, corpusLinks, onLinksUpdate, onPillarUpdate,
}: {
  pillar: Pillar;
  corpusLinks: CorpusLink[];
  onLinksUpdate: (links: CorpusLink[]) => void;
  onPillarUpdate: (p: Pillar) => void;
}) {
  const [query, setQuery]         = useState(pillar.corpus_query ?? '');
  const [researching, setRes]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [toggling, setToggling]   = useState<Set<string>>(new Set());

  const curated    = corpusLinks.filter((l) => l.curated);
  const uncurated  = corpusLinks.filter((l) => !l.curated);

  async function runResearch() {
    if (!query.trim()) return;
    setRes(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, tradition_filter: pillar.tradition_filter || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLinksUpdate(data.links);
      onPillarUpdate({ ...pillar, corpus_query: query, status: 'research' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run research');
    } finally {
      setRes(false);
    }
  }

  async function toggleCurated(link: CorpusLink) {
    setToggling((prev) => new Set(prev).add(link.id));
    try {
      const res = await fetch(`/api/admin/studio/corpus-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curated: !link.curated }),
      });
      if (res.ok) {
        onLinksUpdate(corpusLinks.map((l) => l.id === link.id ? { ...l, curated: !l.curated } : l));
      }
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(link.id); return s; });
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function renderLink(link: CorpusLink) {
    const chunk = link.knowledge_chunks;
    const meta = TRADITION_META[chunk.tradition] ?? { label: chunk.tradition, color: '#6b7280' };
    const isOpen = expanded.has(link.id);
    return (
      <div key={link.id} style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: meta.color, flexShrink: 0 }} />
          <button type="button" onClick={() => toggleExpand(link.id)}
            style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
            {chunk.text_name.replace(/_/g, ' ')}
            {chunk.section && <span style={{ fontWeight: 400, color: 'var(--admin-text-muted)' }}> · {chunk.section}</span>}
          </button>
          {link.similarity !== null && (
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', flexShrink: 0 }}>
              {(link.similarity * 100).toFixed(0)}%
            </span>
          )}
          <button
            type="button"
            onClick={() => toggleCurated(link)}
            disabled={toggling.has(link.id)}
            style={{
              flexShrink: 0, padding: '0.25rem 0.625rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
              border: link.curated ? '1px solid var(--admin-success)' : '1px solid var(--admin-border)',
              background: link.curated ? 'var(--admin-success-bg, #f0fdf4)' : 'none',
              color: link.curated ? 'var(--admin-success)' : 'var(--admin-text-muted)',
              cursor: 'pointer',
            }}
          >
            {link.curated ? '✓ Curated' : '+ Curate'}
          </button>
          <button type="button" onClick={() => toggleExpand(link.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            {isOpen ? '▲' : '▼'}
          </button>
        </div>
        {isOpen && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--admin-border)', fontSize: '0.8125rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--admin-text-secondary, var(--admin-text))' }}>
            {chunk.content.slice(0, 800)}{chunk.content.length > 800 ? '…' : ''}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Query box */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Corpus Research</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            {curated.length} curated · {corpusLinks.length} total
          </span>
        </div>
        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.formInput}
            rows={2}
            placeholder="Describe what passages to pull — e.g. 'ego dissolution annihilation fana wu wei non-self'"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={researching || !query.trim()}
              onClick={runResearch}
            >
              {researching ? 'Searching…' : corpusLinks.length > 0 ? 'Re-run Research' : 'Run Research'}
            </button>
            {corpusLinks.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                Curate passages below to use them in your outline and drafts
              </span>
            )}
          </div>
          {error && (
            <div style={{ background: 'var(--admin-danger-bg, #fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 6, padding: '0.625rem 0.875rem', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Curated */}
      {curated.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-success)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Curated ({curated.length})
          </div>
          {curated.map(renderLink)}
        </div>
      )}

      {/* All results */}
      {uncurated.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Retrieved ({uncurated.length})
          </div>
          {uncurated.map(renderLink)}
        </div>
      )}
    </div>
  );
}

// ── Outline Tab ────────────────────────────────────────────────────────────

function OutlineTab({
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

// ── Draft Tab ──────────────────────────────────────────────────────────────

function DraftTab({ sections, onSectionsUpdate }: {
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

// ── Distribute Tab ─────────────────────────────────────────────────────────

const DISTRIBUTE_FORMATS: Array<{ type: string; label: string; desc: string; scope: 'section' | 'pillar' }> = [
  { type: 'blog',            label: 'Blog Post',           desc: 'One per section — 800-1200 word article', scope: 'section' },
  { type: 'social_twitter',  label: 'Twitter Thread',      desc: 'One per section — 5-7 tweet thread',     scope: 'section' },
  { type: 'social_linkedin', label: 'LinkedIn Post',       desc: 'One per section — 300-500 words',        scope: 'section' },
  { type: 'social_ig',       label: 'Instagram Caption',   desc: 'One per section — caption + hashtags',   scope: 'section' },
  { type: 'email',           label: 'Launch Email',        desc: 'One for the full pillar',                scope: 'pillar'  },
  { type: 'email_sequence',  label: 'Email Sequence',      desc: '5-email nurture sequence for the pillar',scope: 'pillar'  },
  { type: 'gpt_product',     label: 'GPT Product Prompt',  desc: 'Full system prompt grounded in pillar + corpus', scope: 'pillar' },
];

function DistributeTab({ pillar, sections, pieces, onPiecesUpdate }: {
  pillar: Pillar;
  sections: Section[];
  pieces: Piece[];
  onPiecesUpdate: (p: Piece[]) => void;
}) {
  const [selectedTypes, setSelectedTypes]   = useState<Set<string>>(new Set());
  const [generating, setGenerating]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [expandedPiece, setExpandedPiece]   = useState<string | null>(null);
  const [editingPiece, setEditingPiece]     = useState<string | null>(null);
  const [pieceBodies, setPieceBodies]       = useState<Record<string, string>>({});
  const [publishing, setPublishing]         = useState<Set<string>>(new Set());
  const [publishedSlugs, setPublishedSlugs] = useState<Record<string, string>>({});

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const s = new Set(prev);
      s.has(type) ? s.delete(type) : s.add(type);
      return s;
    });
  }

  async function generatePieces() {
    if (!selectedTypes.size) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: Array.from(selectedTypes) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onPiecesUpdate([...pieces, ...data.pieces]);
      setSelectedTypes(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function savePieceBody(pieceId: string) {
    const body = pieceBodies[pieceId];
    if (body === undefined) return;
    const res = await fetch(`/api/admin/studio/pieces/${pieceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (data.piece) {
      onPiecesUpdate(pieces.map((p) => p.id === pieceId ? data.piece : p));
    }
    setEditingPiece(null);
  }

  async function deletePiece(pieceId: string) {
    await fetch(`/api/admin/studio/pieces/${pieceId}`, { method: 'DELETE' });
    onPiecesUpdate(pieces.filter((p) => p.id !== pieceId));
  }

  async function publishPiece(pieceId: string) {
    setPublishing((prev) => new Set(prev).add(pieceId));
    try {
      const res = await fetch(`/api/admin/studio/pieces/${pieceId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPublishedSlugs((prev) => ({ ...prev, [pieceId]: data.slug }));
      onPiecesUpdate(pieces.map((p) => p.id === pieceId ? { ...p, status: 'published' } : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing((prev) => { const s = new Set(prev); s.delete(pieceId); return s; });
    }
  }

  const draftedSections = sections.filter((s) => s.body);
  const piecesByType    = pieces.reduce<Record<string, Piece[]>>((acc, p) => {
    if (!acc[p.piece_type]) acc[p.piece_type] = [];
    acc[p.piece_type].push(p);
    return acc;
  }, {});

  return (
    <div>
      {draftedSections.length === 0 && (
        <div style={{ background: 'var(--admin-warning-bg, #fffbeb)', border: '1px solid var(--admin-warning)', borderRadius: 8, padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--admin-warning)', marginBottom: '1.5rem' }}>
          Draft at least one section before distributing.
        </div>
      )}

      {/* Format selector */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Generate Distribution Content</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            {draftedSections.length} section{draftedSections.length !== 1 ? 's' : ''} ready
          </span>
        </div>
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {DISTRIBUTE_FORMATS.map((f) => {
              const selected = selectedTypes.has(f.type);
              return (
                <label
                  key={f.type}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.875rem 1rem', borderRadius: 8, cursor: 'pointer',
                    border: selected ? '2px solid var(--admin-primary)' : '1px solid var(--admin-border)',
                    background: selected ? 'var(--admin-primary-bg, #eff6ff)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <input type="checkbox" checked={selected} onChange={() => toggleType(f.type)} style={{ marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>{f.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={generating || !selectedTypes.size || draftedSections.length === 0}
              onClick={generatePieces}
            >
              {generating ? 'Generating…' : `Generate ${selectedTypes.size > 0 ? `(${selectedTypes.size} format${selectedTypes.size > 1 ? 's' : ''})` : ''}`}
            </button>
            {generating && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                This may take a minute — generating content for {draftedSections.length} sections…
              </span>
            )}
          </div>
          {error && (
            <div style={{ marginTop: '0.75rem', background: 'var(--admin-danger-bg, #fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 6, padding: '0.625rem 0.875rem', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Generated pieces by format */}
      {Object.keys(piecesByType).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {DISTRIBUTE_FORMATS.filter((f) => piecesByType[f.type]?.length).map((f) => (
            <div key={f.type} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{f.label}</h2>
                <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                  {piecesByType[f.type].length} piece{piecesByType[f.type].length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {piecesByType[f.type].map((piece) => {
                  const isOpen    = expandedPiece === piece.id;
                  const isEditing = editingPiece === piece.id;
                  const body      = pieceBodies[piece.id] ?? piece.body ?? '';
                  return (
                    <div key={piece.id} style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem' }}>
                        <div style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem' }}>
                          {piece.title || f.label}
                          {piece.parent_section_id && (
                            <span style={{ fontWeight: 400, color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>
                              {' '}· {sections.find((s) => s.id === piece.parent_section_id)?.title}
                            </span>
                          )}
                        </div>
                        <span className={`${styles.badge} ${piece.status === 'published' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                          {piece.status}
                        </span>
                        {piece.piece_type === 'blog' && (
                          piece.status === 'published' && publishedSlugs[piece.id] ? (
                            <a
                              href={`/articles/${publishedSlugs[piece.id]}`}
                              target="_blank"
                              rel="noreferrer"
                              className={`${styles.btn} ${styles.btnSmall}`}
                              style={{ color: 'var(--admin-success)', borderColor: 'var(--admin-success)', textDecoration: 'none' }}
                            >
                              View Live ↗
                            </a>
                          ) : (
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSmall}`}
                              style={{ color: 'var(--admin-success)', borderColor: 'var(--admin-success)' }}
                              disabled={publishing.has(piece.id)}
                              onClick={() => publishPiece(piece.id)}
                            >
                              {publishing.has(piece.id) ? 'Publishing…' : piece.status === 'published' ? 'Re-publish' : 'Publish →'}
                            </button>
                          )
                        )}
                        <button type="button" onClick={() => setExpandedPiece(isOpen ? null : piece.id)}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}>
                          {isOpen ? 'Collapse' : 'View'}
                        </button>
                        <button type="button" onClick={() => deletePiece(piece.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-danger)', fontSize: '0.75rem', padding: '0.25rem' }}>
                          ✕
                        </button>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: '1px solid var(--admin-border)', padding: '1rem' }}>
                          {isEditing ? (
                            <div>
                              <textarea
                                value={body}
                                onChange={(e) => setPieceBodies((prev) => ({ ...prev, [piece.id]: e.target.value }))}
                                className={styles.formInput}
                                rows={20}
                                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.7 }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                                  onClick={() => savePieceBody(piece.id)}>
                                  Save
                                </button>
                                <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                                  onClick={() => setEditingPiece(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.875rem', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
                                {piece.body}
                              </div>
                              <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                                onClick={() => { setEditingPiece(piece.id); setPieceBodies((prev) => ({ ...prev, [piece.id]: piece.body ?? '' })); }}>
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
