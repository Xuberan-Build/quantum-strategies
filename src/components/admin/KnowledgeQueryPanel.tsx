'use client';

import { useState, useRef } from 'react';
import styles from '@/app/admin/admin-layout.module.css';

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

interface Source {
  id: string;
  tradition: string;
  text_name: string;
  author: string;
  section: string;
  content: string;
  similarity: number | null;
  source_url: string | null;
  priority: number;
}

interface QueryResult {
  answer: string;
  sources: Source[];
  query: string;
  model: string;
}

export default function KnowledgeQueryPanel() {
  const [query, setQuery]         = useState('');
  const [tradition, setTradition] = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<QueryResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setExpanded(new Set());

    try {
      const res = await fetch('/api/admin/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), tradition: tradition || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function toggleSource(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className={styles.card} style={{ marginBottom: '2rem' }}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Query Corpus</h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
          Natural language search · ⌘↵ to submit
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '0 1.5rem 1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the corpus — e.g. 'How do Sufi and Taoist mystics describe the dissolution of self?' or 'What does the science say about gamma waves in meditators?'"
            rows={3}
            className={styles.formInput}
            style={{ flex: 1, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9375rem' }}
            disabled={loading}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            value={tradition}
            onChange={(e) => setTradition(e.target.value)}
            className={styles.formInput}
            style={{ width: 200, flexShrink: 0 }}
            disabled={loading}
          >
            <option value="">All traditions</option>
            {Object.entries(TRADITION_META).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching…' : 'Ask'}
          </button>
          {result && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => { setResult(null); setQuery(''); setTradition(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          <div style={{ background: 'var(--admin-danger-bg, #fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
            {error}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
          <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Embedding query and searching {tradition ? TRADITION_META[tradition]?.label ?? tradition : 'all traditions'}…
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          {/* Answer */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div
              style={{
                background: 'var(--admin-bg-subtle, #f8fafc)',
                border: '1px solid var(--admin-border)',
                borderRadius: 8,
                padding: '1.25rem 1.5rem',
                lineHeight: 1.75,
                fontSize: '0.9375rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {result.answer}
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              {result.sources.length} source{result.sources.length !== 1 ? 's' : ''} retrieved · model: {result.model}
            </div>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Retrieved Sources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {result.sources.map((src) => {
                  const meta = TRADITION_META[src.tradition] ?? { label: src.tradition, color: '#6b7280' };
                  const isOpen = expanded.has(src.id);
                  return (
                    <div
                      key={src.id}
                      style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden' }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSource(src.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.625rem 1rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: meta.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, flex: 1 }}>
                          {src.text_name.replace(/_/g, ' ')}
                          {src.section && <span style={{ fontWeight: 400, color: 'var(--admin-text-muted)' }}> · {src.section}</span>}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', flexShrink: 0 }}>
                          {meta.label}
                          {src.similarity !== null && ` · ${(src.similarity * 100).toFixed(0)}%`}
                        </span>
                        <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {isOpen && (
                        <div
                          style={{
                            padding: '0 1rem 0.875rem',
                            fontSize: '0.875rem',
                            lineHeight: 1.65,
                            color: 'var(--admin-text-secondary, var(--admin-text))',
                            borderTop: '1px solid var(--admin-border)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <div style={{ paddingTop: '0.75rem' }}>{src.content}</div>
                          {src.source_url && (
                            <a
                              href={src.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--admin-primary)', textDecoration: 'none' }}
                            >
                              View source ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
