'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar, Section, Piece } from './types';

const DISTRIBUTE_FORMATS: Array<{ type: string; label: string; desc: string; scope: 'section' | 'pillar' }> = [
  { type: 'blog',            label: 'Blog Post',           desc: 'One per section — 800-1200 word article', scope: 'section' },
  { type: 'social_twitter',  label: 'Twitter Thread',      desc: 'One per section — 5-7 tweet thread',     scope: 'section' },
  { type: 'social_linkedin', label: 'LinkedIn Post',       desc: 'One per section — 300-500 words',        scope: 'section' },
  { type: 'social_ig',       label: 'Instagram Caption',   desc: 'One per section — caption + hashtags',   scope: 'section' },
  { type: 'email',           label: 'Launch Email',        desc: 'One for the full pillar',                scope: 'pillar'  },
  { type: 'email_sequence',  label: 'Email Sequence',      desc: '5-email nurture sequence for the pillar',scope: 'pillar'  },
  { type: 'gpt_product',     label: 'GPT Product Prompt',  desc: 'Full system prompt grounded in pillar + corpus', scope: 'pillar' },
];

export function DistributeTab({ pillar, sections, pieces, onPiecesUpdate }: {
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
