'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [query, setQuery]               = useState(pillar.corpus_query ?? '');
  const [researching, setRes]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [message, setMessage]           = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [toggling, setToggling]         = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [loadingSugs, setLoadingSugs]   = useState(false);
  const [corpusTotal, setCorpusTotal]   = useState<number | null>(null);
  const [relevance, setRelevance]       = useState<Record<string, { score: number; reason: string; matched_via: string[] }>>({});
  const [expansionQueries, setExpansionQueries] = useState<string[]>([]);
  const [sendingToStrategy, setSendingToStrategy] = useState(false);
  const [strategyResult, setStrategyResult] = useState<{ id: string; title: string; funnel_stage: string } | null>(null);
  const [strategyError, setStrategyError]   = useState<string | null>(null);

  const curated   = corpusLinks.filter((l) => l.curated);
  const uncurated = corpusLinks.filter((l) => !l.curated);

  const curatedTraditions = [...new Map(
    curated.map((l) => {
      const t    = l.knowledge_chunks.tradition;
      const meta = TRADITION_META[t] ?? { label: t, color: '#6b7280' };
      return [t, { key: t, label: meta.label, color: meta.color }];
    })
  ).values()];

  async function sendToStrategy() {
    setSendingToStrategy(true);
    setStrategyError(null);
    try {
      const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/send-to-strategy`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStrategyResult({ id: data.suggestion_id, title: data.title, funnel_stage: data.funnel_stage });
    } catch (err) {
      setStrategyError(err instanceof Error ? err.message : 'Failed to send to strategy');
    } finally {
      setSendingToStrategy(false);
    }
  }

  const hasRelevance = Object.keys(relevance).length > 0;
  const sortByScore = (links: CorpusLink[]) =>
    hasRelevance
      ? [...links].sort((a, b) =>
          (relevance[b.knowledge_chunks.id]?.score ?? -1) - (relevance[a.knowledge_chunks.id]?.score ?? -1)
        )
      : links;

  // Load AI suggestions on mount; if no corpus links yet, auto-run the first suggestion
  useEffect(() => {
    const load = async () => {
      setLoadingSugs(true);
      try {
        const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/suggest-queries`);
        if (res.ok) {
          const data = await res.json();
          const qs: string[] = data.queries ?? [];
          setSuggestions(qs);
          setCorpusTotal(data.corpusTotal ?? 0);
          // Auto-research from brief if no corpus links exist and brief has enough context
          if (qs.length > 0 && corpusLinks.length === 0 && (pillar.goal || pillar.angle)) {
            setQuery(qs[0]);
            setRes(true);
            setMessage('Auto-researching based on your brief…');
            try {
              const r = await fetch(`/api/admin/studio/pillars/${pillar.id}/deep-research`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: qs[0] }),
              });
              const data = await r.json();
              if (r.ok && data.links?.length > 0) {
                onLinksUpdate(data.links);
                onPillarUpdate({ ...pillar, corpus_query: qs[0], status: 'research' });
                setRelevance(data.relevance ?? {});
                setExpansionQueries(data.expansion_queries ?? []);
                setMessage(null);
              } else {
                setMessage(data.message ?? 'No passages found for the first suggestion. Try a manual search.');
              }
            } catch { setMessage('Auto-research failed. Try running a manual search.'); }
          }
        }
      } catch { /* suggestions are advisory — fail silently */ }
      finally { setLoadingSugs(false); setRes(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillar.id]);

  async function runResearch(overrideQuery?: string) {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setRes(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/deep-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, tradition_filter: pillar.tradition_filter || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLinksUpdate(data.links);
      onPillarUpdate({ ...pillar, corpus_query: q, status: data.links.length > 0 ? 'research' : pillar.status });
      if (data.corpusTotal !== undefined) setCorpusTotal(data.corpusTotal);
      if (data.message) setMessage(data.message);
      setRelevance(data.relevance ?? {});
      setExpansionQueries(data.expansion_queries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed');
    } finally {
      setRes(false);
    }
  }

  function clickSuggestion(q: string) {
    setQuery(q);
    runResearch(q);
  }

  async function refreshSuggestions() {
    setLoadingSugs(true);
    try {
      const res = await fetch(`/api/admin/studio/pillars/${pillar.id}/suggest-queries`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.queries ?? []);
      }
    } catch { /* fail silently */ }
    finally { setLoadingSugs(false); }
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
    const rel = relevance[chunk.id];
    const scoreColor = rel
      ? rel.score >= 8 ? '#16a34a' : rel.score >= 6 ? '#d97706' : '#6b7280'
      : undefined;
    const scoreBg = rel
      ? rel.score >= 8 ? '#f0fdf4' : rel.score >= 6 ? '#fef3c7' : '#f3f4f6'
      : undefined;
    return (
      <div key={link.id} style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: meta.color, flexShrink: 0 }} />
          <button type="button" onClick={() => toggleExpand(link.id)}
            style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
            {chunk.text_name.replace(/_/g, ' ')}
            {chunk.section && <span style={{ fontWeight: 400, color: 'var(--admin-text-muted)' }}> · {chunk.section}</span>}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {meta.label}
          </span>
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
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--admin-border)' }}>
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--admin-text-secondary, var(--admin-text))' }}>
              {chunk.content.slice(0, 800)}{chunk.content.length > 800 ? '…' : ''}
            </div>
            {rel && (
              <div style={{ marginTop: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.125rem 0.5rem', borderRadius: 4, background: scoreBg, color: scoreColor }}>
                    {rel.score}/10
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{rel.reason}</span>
                </div>
                {rel.matched_via.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {rel.matched_via.map((tag) => (
                      <span key={tag} style={{ fontSize: '0.6875rem', color: 'var(--admin-text-muted)', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 3, padding: '0.1rem 0.375rem' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Corpus health warning */}
      {corpusTotal === 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #d97706', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#92400e' }}>
          <strong>Corpus not ingested.</strong> The <code>knowledge_chunks</code> table is empty. Run the ingestion scripts in <code>scripts/ingest/</code> to populate the corpus before running research.
        </div>
      )}

      {/* AI Suggestions */}
      <div className={styles.card} style={{ marginBottom: '1rem' }}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>AI Research Suggestions</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
              Based on your brief — click any suggestion to run it instantly
            </p>
          </div>
          <button
            type="button"
            onClick={refreshSuggestions}
            disabled={loadingSugs}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
          >
            {loadingSugs ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>

        {loadingSugs && suggestions.length === 0 ? (
          <div style={{ padding: '0.75rem 0', fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
            Generating suggestions…
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: '0.75rem 0', fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
            Fill in the Brief tab (title, goal, angle) to get AI-suggested search queries.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem' }}>
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => clickSuggestion(q)}
                disabled={researching}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 20,
                  fontSize: '0.8125rem',
                  border: '1px solid var(--admin-border)',
                  background: query === q ? 'var(--admin-primary)' : 'var(--admin-bg)',
                  color: query === q ? 'white' : 'var(--admin-text)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontWeight: query === q ? 600 : 400,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Query box */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Corpus Research</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            {curated.length} curated · {corpusLinks.length} total
            {corpusTotal !== null && corpusTotal > 0 && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--admin-success)' }}>
                · {corpusTotal.toLocaleString()} chunks in corpus
              </span>
            )}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.formInput}
            rows={2}
            placeholder="Keywords to surface passages — e.g. 'waveform collapse field coherence business alignment'"
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={researching || !query.trim()}
              onClick={() => runResearch()}
            >
              {researching ? 'Searching…' : corpusLinks.length > 0 ? 'Re-run Research' : 'Run Research'}
            </button>
            {corpusLinks.length > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                Curate passages below to use them in your outline and drafts
              </span>
            )}
          </div>

          {expansionQueries.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Searched for:</span>
              {expansionQueries.map((q) => (
                <span key={q} style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)', borderRadius: 20, padding: '0.2rem 0.6rem' }}>
                  {q}
                </span>
              ))}
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--admin-danger-bg, #fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 6, padding: '0.625rem 0.875rem', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          {message && !error && (
            <div style={{ background: '#fef3c7', border: '1px solid #d97706', borderRadius: 6, padding: '0.625rem 0.875rem', color: '#92400e', fontSize: '0.875rem' }}>
              {message}
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
          {sortByScore(curated).map(renderLink)}
        </div>
      )}

      {/* All results */}
      {uncurated.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Retrieved ({uncurated.length})
          </div>
          {sortByScore(uncurated).map(renderLink)}
        </div>
      )}

      {/* Strategy transition zone */}
      {curated.length > 0 && (
        <div style={{ marginTop: '2.5rem', borderTop: '1px dashed var(--admin-border)', paddingTop: '1.5rem' }}>
          {strategyResult ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', padding: '1rem 1.25rem', borderRadius: 8, background: '#f0fdf4', border: '1px solid var(--admin-success)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--admin-success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
                  ✓ Strategy suggestion created
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{strategyResult.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                  {strategyResult.funnel_stage.charAt(0).toUpperCase() + strategyResult.funnel_stage.slice(1)} stage
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>
                <Link href="/admin/strategy">
                  <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}>
                    View on Strategy →
                  </button>
                </Link>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                  onClick={() => { setStrategyResult(null); setStrategyError(null); }}
                >
                  Send another
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                  Research is ready
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                    {curated.length} passage{curated.length !== 1 ? 's' : ''} curated ·
                  </span>
                  {curatedTraditions.map((t) => (
                    <span
                      key={t.key}
                      style={{
                        fontSize: '0.75rem', padding: '1px 8px', borderRadius: 99, fontWeight: 600,
                        background: t.color + '18', color: t.color, border: `1px solid ${t.color}40`,
                      }}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={sendingToStrategy}
                onClick={sendToStrategy}
                style={{ flexShrink: 0 }}
              >
                {sendingToStrategy ? 'Synthesizing…' : 'Develop Strategy →'}
              </button>
            </div>
          )}
          {strategyError && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>
              {strategyError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
