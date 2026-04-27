import { supabaseAdmin } from '@/lib/supabase/server';
import KnowledgeQueryPanel from '@/components/admin/KnowledgeQueryPanel';
import styles from '../admin-layout.module.css';

const TRADITION_META: Record<string, { label: string; color: string; order: number }> = {
  taoism:             { label: 'Taoism',             color: '#10b981', order: 1 },
  kabbalah:           { label: 'Kabbalah',           color: '#8b5cf6', order: 2 },
  tantra:             { label: 'Tantra',             color: '#ef4444', order: 3 },
  sufism:             { label: 'Sufism',             color: '#f59e0b', order: 4 },
  christian_mysticism:{ label: 'Christian Mysticism',color: '#3b82f6', order: 5 },
  hermeticism:        { label: 'Hermeticism',        color: '#a855f7', order: 6 },
  rosicrucianism:     { label: 'Rosicrucianism',     color: '#d97706', order: 7 },
  science:            { label: 'Science',            color: '#06b6d4', order: 8 },
  buddhism:           { label: 'Buddhism',           color: '#f97316', order: 9 },
  hinduism:           { label: 'Hinduism',           color: '#fb923c', order: 10 },
  qs_doctrine:        { label: 'QS Doctrine',        color: '#e11d48', order: 11 },
};

const STATUS_BADGE: Record<string, string> = {
  ingested: styles.badgeSuccess,
  pending:  styles.badgeNeutral,
  error:    styles.badgeDanger,
  skipped:  styles.badgeWarning,
};

const STATUS_LABEL: Record<string, string> = {
  ingested: 'Ingested',
  pending:  'Pending',
  error:    'Error',
  skipped:  'Skipped',
};

const PRIORITY_LABEL: Record<number, string> = {
  1: 'P1',
  2: 'P2',
  3: 'P3',
};

export default async function KnowledgePage() {
  const { data: sources, error } = await supabaseAdmin
    .from('knowledge_sources')
    .select('id, tradition, text_name, display_name, author, source_url, priority, chunk_count, ingested_at, status, notes')
    .order('tradition')
    .order('priority')
    .order('display_name');

  if (error) console.error('Failed to fetch knowledge_sources:', error);

  const all = sources || [];
  const ingested   = all.filter((s) => s.status === 'ingested');
  const pending    = all.filter((s) => s.status === 'pending');
  const errored    = all.filter((s) => s.status === 'error');
  const totalChunks = all.reduce((sum, s) => sum + (s.chunk_count ?? 0), 0);
  const traditions  = [...new Set(all.map((s) => s.tradition))].sort(
    (a, b) => (TRADITION_META[a]?.order ?? 99) - (TRADITION_META[b]?.order ?? 99)
  );
  const p1Pending  = all.filter((s) => s.priority === 1 && s.status === 'pending');

  // Group by tradition for the summary cards
  const byTradition: Record<string, typeof all> = {};
  for (const t of traditions) {
    byTradition[t] = all.filter((s) => s.tradition === t);
  }

  return (
    <div>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Knowledge Corpus</h1>
          <p className={styles.pageDescription}>
            Sacred texts, science papers, and synthesis documents powering the RAG engine
          </p>
        </div>
      </header>

      <KnowledgeQueryPanel />

      {/* Top-level stats */}
      <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Sources</div>
          <div className={styles.statValue}>{all.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Ingested</div>
          <div className={styles.statValue} style={{ color: 'var(--admin-success)' }}>
            {ingested.length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending</div>
          <div className={styles.statValue} style={{ color: ingested.length < all.length ? 'var(--admin-warning)' : undefined }}>
            {pending.length}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Chunks</div>
          <div className={styles.statValue}>{totalChunks.toLocaleString()}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Traditions</div>
          <div className={styles.statValue}>{traditions.length}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>P1 Pending</div>
          <div className={styles.statValue} style={{ color: p1Pending.length > 0 ? 'var(--admin-danger)' : 'var(--admin-success)' }}>
            {p1Pending.length}
          </div>
        </div>
      </div>

      {/* Tradition summary grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {traditions.map((t) => {
          const meta = TRADITION_META[t] ?? { label: t, color: '#6b7280', order: 99 };
          const group = byTradition[t];
          const groupIngested = group.filter((s) => s.status === 'ingested');
          const groupChunks   = group.reduce((sum, s) => sum + (s.chunk_count ?? 0), 0);
          return (
            <div
              key={t}
              className={styles.card}
              style={{ padding: '1rem', borderTop: `3px solid ${meta.color}` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: meta.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{meta.label}</span>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
                {groupChunks.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                chunks
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                {groupIngested.length}/{group.length} sources ingested
              </div>
            </div>
          );
        })}
      </div>

      {/* Full sources table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>All Sources</h2>
          <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>
            {ingested.length} / {all.length} ingested
            {errored.length > 0 && (
              <span style={{ marginLeft: '0.75rem', color: 'var(--admin-danger)' }}>
                {errored.length} error{errored.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 40 }}>P</th>
              <th>Source</th>
              <th>Tradition</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Chunks</th>
              <th>Ingested</th>
            </tr>
          </thead>
          <tbody>
            {all.map((source) => {
              const meta = TRADITION_META[source.tradition] ?? { label: source.tradition, color: '#6b7280', order: 99 };
              return (
                <tr key={source.id}>
                  <td>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: source.priority === 1
                          ? 'var(--admin-danger)'
                          : source.priority === 2
                          ? 'var(--admin-warning)'
                          : 'var(--admin-text-muted)',
                      }}
                    >
                      {PRIORITY_LABEL[source.priority] ?? `P${source.priority}`}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {source.display_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                      {source.text_name}
                    </div>
                    {source.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                        {source.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: meta.color,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: meta.color,
                          flexShrink: 0,
                        }}
                      />
                      {meta.label}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${STATUS_BADGE[source.status] ?? styles.badgeNeutral}`}>
                      {STATUS_LABEL[source.status] ?? source.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                    {source.chunk_count ? source.chunk_count.toLocaleString() : '—'}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                    {source.ingested_at
                      ? new Date(source.ingested_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
