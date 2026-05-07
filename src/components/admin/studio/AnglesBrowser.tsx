'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { PillarRow } from '@/app/admin/studio/angles/page';

const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  blog_post:      { bg: '#dbeafe', text: '#1d4ed8' },
  thread:         { bg: '#e0f2fe', text: '#0369a1' },
  video_script:   { bg: '#fee2e2', text: '#b91c1c' },
  long_form_essay:{ bg: '#ede9fe', text: '#6d28d9' },
  deep_dive:      { bg: '#e0e7ff', text: '#4338ca' },
  comparison:     { bg: '#fef3c7', text: '#b45309' },
  how_to_guide:   { bg: '#d1fae5', text: '#065f46' },
  email_sequence: { bg: '#ffedd5', text: '#c2410c' },
  gpt_product:    { bg: '#fce7f3', text: '#be185d' },
};

const FORMAT_LABELS: Record<string, string> = {
  blog_post:       'Blog',
  thread:          'Thread',
  video_script:    'Video',
  long_form_essay: 'Long Form',
  deep_dive:       'Deep Dive',
  comparison:      'Comparison',
  how_to_guide:    'How-To',
  email_sequence:  'Email Seq',
  gpt_product:     'GPT',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:    { bg: '#f3f4f6', text: '#6b7280' },
  research: { bg: '#dbeafe', text: '#1d4ed8' },
  outlined: { bg: '#fef3c7', text: '#b45309' },
  writing:  { bg: '#d1fae5', text: '#065f46' },
  complete: { bg: '#a7f3d0', text: '#064e3b' },
};

function FormatBadge({ format }: { format: string | null }) {
  if (!format) return null;
  const color = FORMAT_COLORS[format] ?? { bg: '#f3f4f6', text: '#6b7280' };
  return (
    <span style={{
      padding: '0.2rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: color.bg,
      color: color.text,
    }}>
      {FORMAT_LABELS[format] ?? format}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const color = STATUS_COLORS[status] ?? { bg: '#f3f4f6', text: '#6b7280' };
  return (
    <span style={{
      padding: '0.2rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: color.bg,
      color: color.text,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function PillButton({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: { bg: string; text: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.3rem 0.75rem',
        borderRadius: '20px',
        fontSize: '0.78rem',
        fontWeight: active ? 600 : 400,
        border: active ? '1.5px solid var(--admin-primary)' : '1.5px solid var(--admin-border)',
        background: active
          ? (color ? color.bg : 'var(--admin-primary)')
          : 'var(--admin-card)',
        color: active
          ? (color ? color.text : 'white')
          : 'var(--admin-text-muted)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

const ALL_FORMATS = [
  'blog_post', 'long_form_essay', 'deep_dive', 'how_to_guide',
  'comparison', 'thread', 'video_script', 'email_sequence', 'gpt_product',
];
const ALL_STATUSES = ['draft', 'research', 'outlined', 'writing', 'complete'];

export default function AnglesBrowser({ pillars }: { pillars: PillarRow[] }) {
  const [search, setSearch]           = useState('');
  const [formatFilter, setFormatFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);

  const totalCount = useMemo(
    () => pillars.reduce((n, p) => n + p.topics.reduce((m, t) => m + t.angles.length, 0), 0),
    [pillars],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pillars
      .filter(p => !pillarFilter || p.id === pillarFilter)
      .map(p => ({
        ...p,
        topics: p.topics
          .map(t => ({
            ...t,
            angles: t.angles.filter(a => {
              if (formatFilter && a.format !== formatFilter) return false;
              if (statusFilter && a.status !== statusFilter) return false;
              if (q && !a.title.toLowerCase().includes(q)) return false;
              return true;
            }),
          }))
          .filter(t => t.angles.length > 0),
      }))
      .filter(p => p.topics.length > 0);
  }, [pillars, pillarFilter, formatFilter, statusFilter, search]);

  const visibleCount = useMemo(
    () => filtered.reduce((n, p) => n + p.topics.reduce((m, t) => m + t.angles.length, 0), 0),
    [filtered],
  );

  const filtersActive = !!(search || formatFilter || statusFilter || pillarFilter);

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'var(--admin-bg)',
        borderBottom: '1px solid var(--admin-border)',
        padding: '0.875rem 0',
        marginBottom: '1.5rem',
      }}>
        {/* Search */}
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="Search angles by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '0.5rem 0.875rem',
              borderRadius: '8px',
              border: '1.5px solid var(--admin-border)',
              background: 'var(--admin-card)',
              color: 'var(--admin-text)',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Format pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <PillButton
            label="All Formats"
            active={formatFilter === null}
            onClick={() => setFormatFilter(null)}
          />
          {ALL_FORMATS.map(f => (
            <PillButton
              key={f}
              label={FORMAT_LABELS[f] ?? f}
              active={formatFilter === f}
              onClick={() => setFormatFilter(formatFilter === f ? null : f)}
              color={FORMAT_COLORS[f]}
            />
          ))}
        </div>

        {/* Status + Pillar pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginRight: '0.25rem' }}>Status:</span>
          <PillButton
            label="All"
            active={statusFilter === null}
            onClick={() => setStatusFilter(null)}
          />
          {ALL_STATUSES.map(s => (
            <PillButton
              key={s}
              label={s.charAt(0).toUpperCase() + s.slice(1)}
              active={statusFilter === s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              color={STATUS_COLORS[s]}
            />
          ))}

          <span style={{
            width: '1px', height: '20px', background: 'var(--admin-border)',
            margin: '0 0.4rem', display: 'inline-block', verticalAlign: 'middle',
          }} />

          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginRight: '0.25rem' }}>Pillar:</span>
          <PillButton
            label="All Pillars"
            active={pillarFilter === null}
            onClick={() => setPillarFilter(null)}
          />
          {pillars.map(p => (
            <PillButton
              key={p.id}
              label={p.title.replace(/^The /, '')}
              active={pillarFilter === p.id}
              onClick={() => setPillarFilter(pillarFilter === p.id ? null : p.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Count line ─────────────────────────────────────────────────── */}
      {filtersActive && (
        <p style={{
          fontSize: '0.83rem',
          color: 'var(--admin-text-muted)',
          marginBottom: '1.25rem',
        }}>
          Showing <strong style={{ color: 'var(--admin-text)' }}>{visibleCount}</strong> of {totalCount} angles
          {filtered.length === 0 && ' — no matches'}
        </p>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {filtered.map(pillar => {
        const pillarAngleCount = pillar.topics.reduce((n, t) => n + t.angles.length, 0);
        return (
          <div key={pillar.id} style={{ marginBottom: '2.5rem' }}>
            {/* Pillar header */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: '2px solid var(--admin-primary)',
              paddingBottom: '0.5rem',
              marginBottom: '1.25rem',
            }}>
              <h2 style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--admin-text)',
                margin: 0,
              }}>
                {pillar.title}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', flexShrink: 0 }}>
                {pillar.topics.length} topics · {pillarAngleCount} angles
              </span>
            </div>

            {/* Topics */}
            {pillar.topics.map(topic => (
              <div key={topic.id} style={{ marginBottom: '1.5rem' }}>
                {/* Topic header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.4rem',
                }}>
                  <h3 style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--admin-text)',
                    margin: 0,
                  }}>
                    {topic.title}
                  </h3>
                  <span style={{
                    fontSize: '0.72rem',
                    color: 'var(--admin-text-muted)',
                    background: 'var(--admin-card)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '12px',
                    padding: '0.1rem 0.5rem',
                    flexShrink: 0,
                  }}>
                    {topic.angles.length} angle{topic.angles.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Angle rows */}
                <div style={{
                  border: '1px solid var(--admin-border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  {topic.angles.map((angle, idx) => (
                    <div
                      key={angle.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 1rem',
                        borderTop: idx > 0 ? '1px solid var(--admin-border)' : undefined,
                        background: 'var(--admin-card)',
                      }}
                    >
                      {/* Title + query hint */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'var(--admin-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {angle.title}
                        </div>
                        {angle.corpus_query && (
                          <div style={{
                            fontSize: '0.7rem',
                            color: 'var(--admin-text-muted)',
                            marginTop: '0.15rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            Query: {angle.corpus_query}
                          </div>
                        )}
                      </div>

                      {/* Format + status */}
                      <FormatBadge format={angle.format} />
                      <StatusBadge status={angle.status} />

                      {/* Corpus count */}
                      {angle.corpusLinkCount > 0 ? (
                        <span style={{
                          fontSize: '0.72rem',
                          color: 'var(--admin-success)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          fontWeight: 500,
                        }}>
                          {angle.corpusLinkCount} source{angle.corpusLinkCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.72rem',
                          color: 'var(--admin-text-muted)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          opacity: 0.5,
                        }}>
                          no sources
                        </span>
                      )}

                      {/* Open button */}
                      <Link
                        href={`/admin/studio/${angle.id}`}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: 'var(--admin-primary)',
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          letterSpacing: '0.01em',
                        }}
                      >
                        Open →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          color: 'var(--admin-text-muted)',
          border: '1px dashed var(--admin-border)',
          borderRadius: '12px',
          fontSize: '0.9rem',
        }}>
          No angles match the current filters.
          <br />
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFormatFilter(null);
              setStatusFilter(null);
              setPillarFilter(null);
            }}
            style={{
              marginTop: '1rem',
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              border: '1px solid var(--admin-border)',
              background: 'var(--admin-card)',
              color: 'var(--admin-text)',
              cursor: 'pointer',
              fontSize: '0.83rem',
            }}
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
