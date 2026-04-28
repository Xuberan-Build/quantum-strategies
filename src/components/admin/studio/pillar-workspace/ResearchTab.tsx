'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar, CorpusLink } from './types';
import { TRADITION_META } from './constants';

export function ResearchTab({
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
