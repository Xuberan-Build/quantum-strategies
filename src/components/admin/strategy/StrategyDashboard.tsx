'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/app/admin/admin-layout.module.css';

const PLG_STAGES = ['awareness', 'interest', 'consideration', 'conversion', 'expansion'] as const;
type Stage = typeof PLG_STAGES[number];

const STAGE_META: Record<Stage, { label: string; desc: string; color: string }> = {
  awareness:     { label: 'Awareness',     desc: 'Free content',           color: '#10b981' },
  interest:      { label: 'Interest',      desc: 'Lead magnets',           color: '#3b82f6' },
  consideration: { label: 'Consideration', desc: 'Entry products $7–97',   color: '#f59e0b' },
  conversion:    { label: 'Conversion',    desc: 'Core offers $297–1997',  color: '#8b5cf6' },
  expansion:     { label: 'Expansion',     desc: 'High-ticket coaching',   color: '#ef4444' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#f59e0b' },
  drafted:   { label: 'Drafted',   color: '#3b82f6' },
  accepted:  { label: 'Accepted',  color: '#10b981' },
  created:   { label: 'Created',   color: '#8b5cf6' },
  dismissed: { label: 'Dismissed', color: '#6b7280' },
};

interface MatrixRow {
  pillar: { id: string; title: string; tradition_affinity: string[] };
  topics: unknown[];
  totalAngles: number;
  totalPieces: number;
  stages: Array<{ stage: string; hasContent: boolean; hasProduct: boolean; productNames: string[]; hasPending: boolean; postCount: number }>;
}

interface Suggestion {
  id: string;
  pillar_id: string | null;
  funnel_stage: string;
  title: string;
  tagline: string | null;
  rationale: string | null;
  format: string | null;
  status: string;
  corpus_themes: string[];
  content_pillars?: { title: string } | null;
}

interface Product {
  id: string;
  product_slug: string;
  name: string;
  price: number | null;
  plg_stage: string | null;
  pillar_id: string | null;
}

export default function StrategyDashboard({
  matrix, suggestions, products,
}: {
  matrix: MatrixRow[];
  suggestions: Suggestion[];
  products: Product[];
}) {
  const [analyzing, setAnalyzing]         = useState(false);
  const [accepting, setAccepting]         = useState<string | null>(null);
  const [dismissing, setDismissing]       = useState<string | null>(null);
  const [localSuggestions, setSuggestions] = useState(suggestions);
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  const pending = localSuggestions.filter((s) => s.status === 'pending');

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/strategy/analyze', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnalyzeResult(data.narrative ?? '');
      if (data.saved > 0) {
        const refreshed = await fetch('/api/admin/strategy/analyze', { method: 'GET' }).catch(() => null);
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  async function acceptSuggestion(id: string) {
    setAccepting(id);
    try {
      const res = await fetch(`/api/admin/strategy/suggestions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'created' } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setAccepting(null);
    }
  }

  async function dismissSuggestion(id: string) {
    setDismissing(id);
    await fetch(`/api/admin/strategy/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'dismissed' } : s));
    setDismissing(null);
  }

  return (
    <div>
      {/* Coverage Matrix */}
      <div className={styles.card} style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>PLG Coverage Matrix</h2>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={analyzing}
            onClick={runAnalysis}
          >
            {analyzing ? 'Analyzing…' : '⚡ Run Analysis'}
          </button>
        </div>

        {error && (
          <div style={{ margin: '0 1.5rem 1rem', padding: '0.75rem 1rem', background: 'var(--admin-danger-bg,#fef2f2)', border: '1px solid var(--admin-danger)', borderRadius: 6, fontSize: '0.875rem', color: 'var(--admin-danger)' }}>
            {error}
          </div>
        )}

        {analyzeResult && (
          <div style={{ margin: '0 1.5rem 1rem', padding: '1rem 1.25rem', background: 'var(--admin-bg-subtle,#f8fafc)', border: '1px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {analyzeResult}
          </div>
        )}

        <div style={{ padding: '0 1.5rem 1.5rem' }}>
          {/* Stage headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div />
            {PLG_STAGES.map((stage) => {
              const m = STAGE_META[stage];
              return (
                <div key={stage} style={{ textAlign: 'center', padding: '0.5rem', borderRadius: 6, background: 'var(--admin-bg-subtle,#f8fafc)' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: m.color }}>{m.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>{m.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Matrix rows */}
          {matrix.map(({ pillar, topics, totalAngles, totalPieces, stages }) => (
            <div key={pillar.id} style={{ display: 'grid', gridTemplateColumns: '200px repeat(5, 1fr)', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
              <div style={{ padding: '0.75rem 0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{pillar.title}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                  {topics.length} topics · {totalAngles} angles · {totalPieces} pieces
                </div>
              </div>
              {stages.map(({ stage, hasContent, hasProduct, productNames, hasPending, postCount }) => {
                const isAwareness = stage === 'awareness';
                const isGap = !isAwareness && hasContent && !hasProduct;
                const isCovered = !isAwareness && hasContent && hasProduct;
                const isNoContent = !isAwareness && !hasContent && hasProduct;
                const isEmpty = !isAwareness && !hasContent && !hasProduct;

                let bg = 'var(--admin-bg-subtle,#f8fafc)';
                let symbol = '○';
                let label = 'Empty';
                let textColor = 'var(--admin-text-muted)';

                if (isAwareness && hasContent) { bg = '#f0fdf4'; symbol = '●'; label = postCount > 0 ? `${postCount} post${postCount !== 1 ? 's' : ''}` : 'Active'; textColor = '#10b981'; }
                else if (isAwareness) { bg = 'var(--admin-bg-subtle,#f8fafc)'; symbol = '○'; label = 'No content'; textColor = 'var(--admin-text-muted)'; }
                else if (isCovered) { bg = '#f0fdf4'; symbol = '●'; label = productNames[0]?.slice(0, 18) ?? 'Covered'; textColor = '#10b981'; }
                else if (isGap) { bg = '#fffbeb'; symbol = '⚡'; label = hasPending ? 'Gap · pending' : 'Gap'; textColor = '#d97706'; }
                else if (isNoContent) { bg = '#eff6ff'; symbol = '→'; label = 'Needs content'; textColor = '#3b82f6'; }

                return (
                  <div
                    key={stage}
                    style={{
                      padding: '0.625rem 0.5rem', borderRadius: 6, textAlign: 'center',
                      background: bg, border: isGap ? '1px solid #fbbf24' : '1px solid transparent',
                    }}
                    title={productNames.join(', ') || undefined}
                  >
                    <div style={{ fontSize: '1rem' }}>{symbol}</div>
                    <div style={{ fontSize: '0.6875rem', color: textColor, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', display: 'flex', gap: '1.5rem' }}>
            <span>● Covered</span>
            <span style={{ color: '#d97706' }}>⚡ Gap (content exists, no product)</span>
            <span style={{ color: '#3b82f6' }}>→ Needs content (product exists)</span>
            <span>○ Empty</span>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {localSuggestions.filter((s) => s.status !== 'dismissed').length > 0 && (
        <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Product Suggestions</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
              {pending.length} pending
            </span>
          </div>
          <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {localSuggestions.filter((s) => s.status !== 'dismissed').map((s) => {
              const stageMeta = STAGE_META[s.funnel_stage as Stage] ?? { label: s.funnel_stage, color: '#6b7280', desc: '' };
              const statusMeta = STATUS_META[s.status] ?? { label: s.status, color: '#6b7280' };
              const isPending = s.status === 'pending';

              return (
                <div
                  key={s.id}
                  style={{
                    padding: '1rem 1.25rem', borderRadius: 8,
                    border: isPending ? '1px solid var(--admin-border)' : '1px solid var(--admin-border)',
                    background: isPending ? 'var(--admin-bg-subtle,#f8fafc)' : 'none',
                    opacity: s.status === 'created' ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{s.title}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: stageMeta.color }}>{stageMeta.label}</span>
                        {s.format && <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{s.format}</span>}
                        <span style={{ fontSize: '0.75rem', color: statusMeta.color, fontWeight: 500 }}>{statusMeta.label}</span>
                      </div>
                      {s.tagline && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                          {s.tagline}
                        </div>
                      )}
                      {s.rationale && (
                        <div style={{ fontSize: '0.8125rem', lineHeight: 1.65 }}>{s.rationale}</div>
                      )}
                      {(s.content_pillars as { title?: string } | null)?.title && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          Pillar: {(s.content_pillars as { title: string }).title}
                        </div>
                      )}
                    </div>
                    {isPending && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                          disabled={accepting === s.id}
                          onClick={() => acceptSuggestion(s.id)}
                        >
                          {accepting === s.id ? 'Drafting…' : 'Accept → Draft Product'}
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                          disabled={dismissing === s.id}
                          onClick={() => dismissSuggestion(s.id)}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {s.status === 'created' && (
                      <Link
                        href="/admin/products"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                        style={{ flexShrink: 0 }}
                      >
                        View in Products →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unlinked products */}
      {products.filter((p) => !p.pillar_id).length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Products Not Pillar-Linked</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
              Assign these in /admin/products or run <code style={{ fontSize: '0.8125rem' }}>python strategist.py --sync</code>
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr><th>Product</th><th>Price</th><th>PLG Stage</th><th>Pillar</th></tr>
            </thead>
            <tbody>
              {products.filter((p) => !p.pillar_id).map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>{p.product_slug}</div>
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>{p.price != null ? `$${p.price}` : '—'}</td>
                  <td>
                    {p.plg_stage
                      ? <span style={{ fontSize: '0.8125rem', color: STAGE_META[p.plg_stage as Stage]?.color ?? '#6b7280', fontWeight: 600 }}>{p.plg_stage}</span>
                      : <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>Not linked</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
