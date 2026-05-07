'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';

const TRADITION_OPTIONS = [
  'taoism', 'kabbalah', 'tantra', 'sufism', 'christian_mysticism',
  'hermeticism', 'rosicrucianism', 'science', 'buddhism', 'hinduism', 'qs_doctrine',
];

const TRADITION_LABELS: Record<string, string> = {
  taoism: 'Taoism', kabbalah: 'Kabbalah', tantra: 'Tantra', sufism: 'Sufism',
  christian_mysticism: 'Christian Mysticism', hermeticism: 'Hermeticism',
  rosicrucianism: 'Rosicrucianism', science: 'Science', buddhism: 'Buddhism',
  hinduism: 'Hinduism', qs_doctrine: 'QS Doctrine',
};

const TRADITION_COLORS: Record<string, string> = {
  taoism: '#10b981', kabbalah: '#8b5cf6', tantra: '#ef4444', sufism: '#f59e0b',
  christian_mysticism: '#3b82f6', hermeticism: '#a855f7', rosicrucianism: '#d97706',
  science: '#06b6d4', buddhism: '#f97316', hinduism: '#fb923c', qs_doctrine: '#e11d48',
};

type QueueItem = {
  id: string;
  source_type: string;
  source_url: string | null;
  source_name: string | null;
  tradition_tags: string[];
  quality_score: number | null;
  status: string;
  submitted_at: string;
  evaluator_output: { recommendation?: string; reasoning?: string } | null;
  rejection_reason: string | null;
  ingested_chunk_ids: string[];
};

type Pillar = { id: string; title: string };

interface Props {
  initialItems: QueueItem[];
  pillars: Pillar[];
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--admin-text-muted)';
  if (score >= 0.7) return 'var(--admin-success)';
  if (score >= 0.4) return 'var(--admin-warning)';
  return 'var(--admin-danger)';
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'approved': return styles.badgeSuccess;
    case 'ingested': return styles.badgeSuccess;
    case 'rejected': return styles.badgeDanger;
    case 'evaluating': return styles.badgeWarning;
    default: return styles.badgeNeutral;
  }
}

function sourceLabel(item: QueueItem): string {
  if (item.source_name) return item.source_name;
  if (item.source_url) {
    try {
      const u = new URL(item.source_url);
      return u.hostname + u.pathname.slice(0, 40);
    } catch {
      return item.source_url.slice(0, 60);
    }
  }
  return 'Text paste';
}

export default function IngestionQueueTable({ initialItems, pillars }: Props) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [filter, setFilter] = useState<string>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addTab, setAddTab] = useState<'url' | 'text'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteSourceName, setPasteSourceName] = useState('');
  const [selectedTraditions, setSelectedTraditions] = useState<string[]>([]);
  const [selectedPillar, setSelectedPillar] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);

  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    evaluating: items.filter((i) => i.status === 'evaluating').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    ingested: items.filter((i) => i.status === 'ingested').length,
  };

  function toggleTradition(t: string) {
    setSelectedTraditions((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function updateItem(id: string, updates: Partial<QueueItem>) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...updates } : i));
  }

  async function handleEvaluate(item: QueueItem) {
    setLoadingId(item.id);
    updateItem(item.id, { status: 'evaluating' });
    try {
      // Update status to evaluating in DB
      await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'evaluating' }),
      });

      // Run evaluator agent
      const evalRes = await fetch('/api/admin/studio/agents/source-evaluator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_url: item.source_url,
          raw_text: null,
          tradition_tags: item.tradition_tags,
        }),
      });

      if (!evalRes.ok) {
        // If evaluator agent doesn't exist yet, set back to pending
        await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending' }),
        });
        updateItem(item.id, { status: 'pending' });
        return;
      }

      const evalData = await evalRes.json();
      const patchRes = await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pending',
          evaluator_output: evalData,
          quality_score: evalData.quality_score ?? null,
        }),
      });
      const patchData = await patchRes.json();
      updateItem(item.id, patchData.item);
    } catch {
      updateItem(item.id, { status: 'pending' });
    } finally {
      setLoadingId(null);
    }
  }

  async function handleApprove(item: QueueItem) {
    setLoadingId(item.id);
    const res = await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    const data = await res.json();
    updateItem(item.id, data.item);
    setLoadingId(null);
  }

  async function handleReject(item: QueueItem) {
    const reason = prompt('Rejection reason (optional):') ?? '';
    setLoadingId(item.id);
    const res = await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_reason: reason || null }),
    });
    const data = await res.json();
    updateItem(item.id, data.item);
    setLoadingId(null);
  }

  async function handleIngest(item: QueueItem) {
    if (!confirm(`Ingest "${sourceLabel(item)}" into the corpus? This will embed and store ${item.source_url ? 'the URL content' : 'the text'}.`)) return;
    setLoadingId(item.id);
    const res = await fetch(`/api/admin/corpus/ingest-approved/${item.id}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      updateItem(item.id, { status: 'ingested', ingested_chunk_ids: data.chunk_ids });
    } else {
      alert(`Ingestion failed: ${data.error}`);
    }
    setLoadingId(null);
  }

  async function handleReconsider(item: QueueItem) {
    setLoadingId(item.id);
    const res = await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending', rejection_reason: null }),
    });
    const data = await res.json();
    updateItem(item.id, data.item);
    setLoadingId(null);
  }

  async function handleDelete(item: QueueItem) {
    if (!confirm(`Delete "${sourceLabel(item)}" from the queue?`)) return;
    setLoadingId(item.id);
    const res = await fetch(`/api/admin/corpus/ingestion-queue/${item.id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    setLoadingId(null);
  }

  async function handleAddUrl() {
    if (!urlInput.trim()) { setAddError('URL is required'); return; }
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/corpus/ingestion-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'url',
          source_url: urlInput.trim(),
          source_name: sourceName.trim() || null,
          tradition_tags: selectedTraditions,
          pillar_id: selectedPillar || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error); return; }
      setItems((prev) => [data.item, ...prev]);
      setUrlInput(''); setSourceName(''); setSelectedTraditions([]); setSelectedPillar('');
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleAddText() {
    if (!pasteText.trim()) { setAddError('Text is required'); return; }
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/corpus/ingestion-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'text',
          source_name: pasteSourceName.trim() || null,
          raw_text: pasteText.trim(),
          tradition_tags: selectedTraditions,
          pillar_id: selectedPillar || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error); return; }
      setItems((prev) => [data.item, ...prev]);
      setPasteText(''); setPasteSourceName(''); setSelectedTraditions([]); setSelectedPillar('');
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {/* Quick Add Panel */}
      <div className={styles.card} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Add Source</h2>
        </div>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['url', 'text'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setAddTab(tab); setAddError(''); }}
                className={styles.btn}
                style={{
                  background: addTab === tab ? 'var(--admin-primary)' : 'transparent',
                  color: addTab === tab ? '#fff' : 'var(--admin-text)',
                  border: `1px solid ${addTab === tab ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
                  padding: '0.375rem 0.875rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                {tab === 'url' ? 'URL' : 'Text Paste'}
              </button>
            ))}
          </div>

          {addTab === 'url' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="url"
                placeholder="https://example.com/article"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className={styles.formInput}
                style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
              <input
                type="text"
                placeholder="Source name (optional)"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                className={styles.formInput}
              />
            </div>
          )}

          {addTab === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Source name"
                value={pasteSourceName}
                onChange={(e) => setPasteSourceName(e.target.value)}
                className={styles.formInput}
              />
              <textarea
                placeholder="Paste text content..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className={styles.formInput}
                style={{ minHeight: 120, fontFamily: 'inherit', fontSize: '0.875rem' }}
              />
            </div>
          )}

          {/* Tradition Tags */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tradition Tags
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {TRADITION_OPTIONS.map((t) => {
                const active = selectedTraditions.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTradition(t)}
                    style={{
                      padding: '0.25rem 0.625rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: `1px solid ${active ? TRADITION_COLORS[t] : 'var(--admin-border)'}`,
                      background: active ? `${TRADITION_COLORS[t]}18` : 'transparent',
                      color: active ? TRADITION_COLORS[t] : 'var(--admin-text-muted)',
                    }}
                  >
                    {TRADITION_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pillar */}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Pillar (optional)
              </div>
              <select
                value={selectedPillar}
                onChange={(e) => setSelectedPillar(e.target.value)}
                className={styles.formInput}
              >
                <option value="">No pillar</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <button
              onClick={addTab === 'url' ? handleAddUrl : handleAddText}
              disabled={adding}
              className={styles.btnPrimary}
              style={{ padding: '0.5rem 1.25rem', whiteSpace: 'nowrap' }}
            >
              {adding ? 'Adding…' : addTab === 'url' ? 'Add to Queue' : 'Add to Queue'}
            </button>
          </div>

          {addError && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--admin-danger)' }}>
              {addError}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Pending', key: 'pending', color: 'var(--admin-text)' },
          { label: 'Evaluating', key: 'evaluating', color: 'var(--admin-warning)' },
          { label: 'Approved', key: 'approved', color: 'var(--admin-success)' },
          { label: 'Rejected', key: 'rejected', color: 'var(--admin-danger)' },
        ].map(({ label, key, color }) => (
          <div key={key} className={styles.statCard}>
            <div className={styles.statLabel}>{label}</div>
            <div className={styles.statValue} style={{ color }}>
              {counts[key as keyof typeof counts]}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
        {['all', 'pending', 'approved', 'rejected', 'ingested'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${filter === f ? 'var(--admin-primary)' : 'var(--admin-border)'}`,
              background: filter === f ? 'var(--admin-primary)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--admin-text)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && counts[f as keyof typeof counts] > 0 && (
              <span style={{ marginLeft: '0.375rem', opacity: 0.8 }}>
                {counts[f as keyof typeof counts]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card}>
        {filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            No items in {filter === 'all' ? 'the queue' : `"${filter}" status`}
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th>Traditions</th>
                <th>Score</th>
                <th>Status</th>
                <th>Evaluation</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isLoading = loadingId === item.id;
                const evalOutput = item.evaluator_output;
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sourceLabel(item)}
                      </div>
                      {item.source_url && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.source_url}
                        </div>
                      )}
                      {item.status === 'ingested' && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--admin-success)', marginTop: 2 }}>
                          {item.ingested_chunk_ids?.length ?? 0} chunks ingested
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeNeutral}`} style={{ fontFamily: 'monospace', fontSize: '0.6875rem' }}>
                        {item.source_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: 160 }}>
                        {(item.tradition_tags ?? []).map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: '0.6875rem',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '9999px',
                              background: `${TRADITION_COLORS[t] ?? '#6b7280'}18`,
                              color: TRADITION_COLORS[t] ?? '#6b7280',
                              fontWeight: 500,
                            }}
                          >
                            {TRADITION_LABELS[t] ?? t}
                          </span>
                        ))}
                        {(item.tradition_tags ?? []).length === 0 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: scoreColor(item.quality_score) }}>
                        {item.quality_score !== null ? item.quality_score.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      {evalOutput ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.75rem', color: evalOutput.recommendation === 'approve' ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                            {evalOutput.recommendation?.toUpperCase() ?? ''}
                          </div>
                          {evalOutput.reasoning && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2, lineHeight: 1.4, maxWidth: 220 }}>
                              {evalOutput.reasoning.slice(0, 120)}{evalOutput.reasoning.length > 120 ? '…' : ''}
                            </div>
                          )}
                        </div>
                      ) : item.rejection_reason ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-danger)' }}>
                          {item.rejection_reason}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(item.submitted_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                        {item.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleEvaluate(item)}
                              disabled={isLoading}
                              className={styles.btnSecondary}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                            >
                              {isLoading ? '…' : 'Evaluate'}
                            </button>
                            <button
                              onClick={() => handleApprove(item)}
                              disabled={isLoading}
                              className={styles.btnSuccess}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(item)}
                              disabled={isLoading}
                              className={styles.btnDanger}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {item.status === 'evaluating' && (
                          <>
                            <button
                              onClick={() => handleApprove(item)}
                              disabled={isLoading}
                              className={styles.btnSuccess}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(item)}
                              disabled={isLoading}
                              className={styles.btnDanger}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {item.status === 'approved' && (
                          <button
                            onClick={() => handleIngest(item)}
                            disabled={isLoading}
                            className={styles.btnPrimary}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                          >
                            {isLoading ? 'Ingesting…' : 'Ingest'}
                          </button>
                        )}
                        {item.status === 'rejected' && (
                          <button
                            onClick={() => handleReconsider(item)}
                            disabled={isLoading}
                            className={styles.btnSecondary}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                          >
                            Reconsider
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={isLoading}
                          className={styles.btnDanger}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', opacity: 0.7 }}
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
