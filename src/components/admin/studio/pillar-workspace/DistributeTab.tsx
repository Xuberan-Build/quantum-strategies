'use client';

import { useState } from 'react';
import styles from '@/app/admin/admin-layout.module.css';
import type { Pillar, Section, Piece } from './types';
import {
  parseEmailSequence,
  parseSingleEmail,
  textToEmailHtml,
  MIN_EMAIL_BODY_WORDS,
  type ParsedEmail,
} from '@/lib/content/email-sequence';

const DISTRIBUTE_FORMATS: Array<{ type: string; label: string; desc: string; scope: 'section' | 'pillar' }> = [
  { type: 'blog',            label: 'Blog Post',           desc: 'One per section — 800-1200 word article', scope: 'section' },
  { type: 'social_twitter',  label: 'Twitter Thread',      desc: 'One per section — 5-7 tweet thread',     scope: 'section' },
  { type: 'social_linkedin', label: 'LinkedIn Post',       desc: 'One per section — 300-500 words',        scope: 'section' },
  { type: 'social_ig',       label: 'Instagram Caption',   desc: 'One per section — caption + hashtags',   scope: 'section' },
  { type: 'email',           label: 'Launch Email',        desc: 'One for the full pillar',                scope: 'pillar'  },
  { type: 'email_sequence',  label: 'Email Sequence',      desc: '5-email nurture sequence for the pillar',scope: 'pillar'  },
  { type: 'gpt_product',     label: 'GPT Product Prompt',  desc: 'Full system prompt grounded in pillar + corpus', scope: 'pillar' },
];

interface Campaign { id: string; name: string; trigger_type: string; status: string; step_count?: number; }
interface CampaignStep { id: string; step_number: number; delay_hours: number; subject: string; }

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

  // Campaign modal state
  const [campaignModal, setCampaignModal] = useState<{ pieceId: string; body: string } | null>(null);
  const [campaigns, setCampaigns]         = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selCampaignId, setSelCampaignId] = useState('');
  const [campaignSteps, setCampaignSteps] = useState<CampaignStep[]>([]);
  const [stepSubject, setStepSubject]     = useState('');
  const [stepDelay, setStepDelay]         = useState(0);
  const [submitting, setSubmitting]       = useState(false);
  const [addedMap, setAddedMap]           = useState<Record<string, string>>({}); // pieceId → campaign name

  // Create-from-sequence modal state
  const [seqModal, setSeqModal]         = useState<{ pieceId: string; body: string } | null>(null);
  const [seqName, setSeqName]           = useState('');
  const [seqTrigger, setSeqTrigger]     = useState('manual');
  const [seqDelays, setSeqDelays]       = useState([0, 48, 96, 144, 192]);
  const [creatingSeq, setCreatingSeq]   = useState(false);
  const [seqSuccess, setSeqSuccess]     = useState<string | null>(null);
  const [seqEmails, setSeqEmails]       = useState<ParsedEmail[]>([]);
  const [seqError, setSeqError]         = useState<string | null>(null);

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

  async function openCampaignModal(piece: Piece) {
    // Strip the SUBJECT/PREVIEW header lines; the rest is the email that gets sent.
    const email = parseSingleEmail(piece.body ?? '');
    setCampaignModal({ pieceId: piece.id, body: email.body });
    setStepSubject(email.subject);
    setStepDelay(0);
    setSelCampaignId('');
    setCampaignSteps([]);
    setCampaignsLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns');
      const data = await res.json();
      const list: Campaign[] = Array.isArray(data) ? data : [];
      setCampaigns(list);
      if (list.length > 0) {
        setSelCampaignId(list[0].id);
        await fetchCampaignSteps(list[0].id);
      }
    } finally {
      setCampaignsLoading(false);
    }
  }

  async function fetchCampaignSteps(campaignId: string) {
    const res = await fetch(`/api/admin/campaigns/${campaignId}/steps`);
    const steps: CampaignStep[] = await res.json();
    setCampaignSteps(Array.isArray(steps) ? steps : []);
    const nextDelay = steps.length === 0 ? 0 : 48;
    setStepDelay(nextDelay);
  }

  async function handleCampaignSelect(campaignId: string) {
    setSelCampaignId(campaignId);
    if (campaignId) await fetchCampaignSteps(campaignId);
  }

  async function confirmAddToCampaign() {
    if (!campaignModal || !selCampaignId) return;
    const piece = pieces.find(p => p.id === campaignModal.pieceId);
    if (!piece) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${selCampaignId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delay_hours: stepDelay,
          subject: stepSubject || pillar.title,
          html_body: textToEmailHtml(campaignModal.body),
          text_body: campaignModal.body,
          content_angle_id: pillar.id,
          distribute_format: piece.piece_type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const campaignName = campaigns.find(c => c.id === selCampaignId)?.name ?? 'campaign';
      setAddedMap(prev => ({ ...prev, [campaignModal.pieceId]: campaignName }));
      setCampaignModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to campaign');
    } finally {
      setSubmitting(false);
    }
  }

  /** Why a parsed sequence can't become campaign steps, or null if it can. */
  function sequenceProblem(emails: ParsedEmail[]): string | null {
    if (emails.length === 0) {
      return 'Could not find individual emails in this sequence. Regenerate it, or add it to a campaign one email at a time.';
    }
    const short = emails.filter((e) => e.isSummary);
    if (short.length > 0) {
      return `Email ${short.map((e) => e.index).join(', ')} ${short.length === 1 ? 'is' : 'are'} under ${MIN_EMAIL_BODY_WORDS} words, so ${short.length === 1 ? 'it looks' : 'they look'} like a summary, not an email. Regenerate the sequence to get full email bodies.`;
    }
    const noSubject = emails.filter((e) => !e.subject);
    if (noSubject.length > 0) return `Email ${noSubject.map((e) => e.index).join(', ')} has no SUBJECT line.`;
    return null;
  }

  async function openSeqModal(piece: Piece) {
    const emails = parseEmailSequence(piece.body ?? '').slice(0, 5);
    setSeqModal({ pieceId: piece.id, body: piece.body ?? '' });
    setSeqEmails(emails);
    setSeqError(sequenceProblem(emails));
    setSeqName(`${pillar.title} — Nurture Sequence`);
    setSeqTrigger('manual');
    setSeqDelays(emails.map((_, i) => i * 48));
    setSeqSuccess(null);
  }

  async function confirmCreateSequence() {
    if (!seqModal) return;
    const problem = sequenceProblem(seqEmails);
    if (problem) {
      setSeqError(problem);
      return;
    }
    setCreatingSeq(true);
    setSeqError(null);
    try {
      // Create campaign
      const campRes = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: seqName, trigger_type: seqTrigger }),
      });
      const camp = await campRes.json();
      if (!campRes.ok) throw new Error(camp.error);

      // Create steps sequentially; stop at the first failure and say which step.
      for (let i = 0; i < seqEmails.length; i++) {
        const email = seqEmails[i];
        const stepRes = await fetch(`/api/admin/campaigns/${camp.id}/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step_number: i + 1,
            delay_hours: seqDelays[i] ?? i * 48,
            subject: email.subject,
            html_body: textToEmailHtml(email.body),
            text_body: email.body,
            content_angle_id: pillar.id,
            distribute_format: 'email_sequence',
          }),
        });
        if (!stepRes.ok) {
          const data = await stepRes.json().catch(() => ({}));
          throw new Error(`Campaign "${camp.name}" was created, but step ${i + 1} failed: ${data.error ?? stepRes.status}`);
        }
      }

      setSeqSuccess(camp.name);
      setAddedMap(prev => ({ ...prev, [seqModal.pieceId]: camp.name }));
      setTimeout(() => setSeqModal(null), 1500);
    } catch (err) {
      setSeqError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setCreatingSeq(false);
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
                  const isEmailType = piece.piece_type === 'email' || piece.piece_type === 'email_sequence';
                  const addedCampaign = addedMap[piece.id];

                  return (
                    <div key={piece.id} style={{ border: '1px solid var(--admin-border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, fontWeight: 500, fontSize: '0.875rem', minWidth: 0 }}>
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

                        {/* Blog publish */}
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

                        {/* Campaign actions for email types */}
                        {isEmailType && (
                          addedCampaign ? (
                            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-success)', fontWeight: 500 }}>
                              ✓ Added to {addedCampaign}
                            </span>
                          ) : (
                            <>
                              {piece.piece_type === 'email' && (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSmall}`}
                                  style={{ color: 'var(--admin-primary)', borderColor: 'var(--admin-primary)' }}
                                  onClick={() => openCampaignModal(piece)}
                                >
                                  + Add to Campaign
                                </button>
                              )}
                              {piece.piece_type === 'email_sequence' && (
                                <button
                                  type="button"
                                  className={`${styles.btn} ${styles.btnSmall}`}
                                  style={{ color: 'var(--admin-primary)', borderColor: 'var(--admin-primary)' }}
                                  onClick={() => openSeqModal(piece)}
                                >
                                  Create Campaign from Sequence
                                </button>
                              )}
                            </>
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

      {/* Send to Campaign Modal */}
      {campaignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}
          onClick={() => setCampaignModal(null)}
        >
          <div style={{
            background: 'var(--admin-surface)', borderRadius: 12, padding: '1.5rem',
            width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.0625rem', fontWeight: 600 }}>Add to Campaign</h3>

            {campaignsLoading ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>Loading campaigns…</p>
            ) : campaigns.length === 0 ? (
              <p style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No campaigns found. Create one first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>Campaign</label>
                  <select
                    className={styles.formInput}
                    value={selCampaignId}
                    onChange={e => handleCampaignSelect(e.target.value)}
                  >
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>
                      Step {campaignSteps.length > 0 ? `(next: ${campaignSteps.length + 1})` : '1'}
                    </label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={campaignSteps.length + 1}
                      readOnly
                      style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>Delay (hours)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={stepDelay}
                      min={0}
                      onChange={e => setStepDelay(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>Subject line</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={stepSubject}
                    onChange={e => setStepSubject(e.target.value)}
                    placeholder="Email subject…"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>Preview</label>
                  <div style={{
                    background: 'var(--admin-bg)', borderRadius: 6, padding: '0.625rem 0.875rem',
                    fontSize: '0.8125rem', color: 'var(--admin-text-muted)', lineHeight: 1.6,
                    border: '1px solid var(--admin-border)', maxHeight: 80, overflow: 'hidden',
                  }}>
                    {campaignModal.body.replace(/<[^>]+>/g, '').slice(0, 200)}…
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setCampaignModal(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={submitting || !selCampaignId || !stepSubject}
                    onClick={confirmAddToCampaign}
                  >
                    {submitting ? 'Adding…' : 'Add to Campaign'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Campaign from Sequence Modal */}
      {seqModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}
          onClick={() => setSeqModal(null)}
        >
          <div style={{
            background: 'var(--admin-surface)', borderRadius: 12, padding: '1.5rem',
            width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.0625rem', fontWeight: 600 }}>Create Campaign from Sequence</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>Campaign name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={seqName}
                  onChange={e => setSeqName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.375rem' }}>Trigger</label>
                <select className={styles.formInput} value={seqTrigger} onChange={e => setSeqTrigger(e.target.value)}>
                  <option value="manual">Manual enroll</option>
                  <option value="on_signup">On signup</option>
                  <option value="on_purchase">On purchase</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>Email delays (hours after previous)</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(seqDelays.length, 1)}, 1fr)`, gap: '0.5rem' }}>
                  {seqDelays.map((d, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '0.25rem', textAlign: 'center' }} title={seqEmails[i]?.subject}>
                        Email {i + 1}{seqEmails[i] ? ` · ${seqEmails[i].wordCount}w` : ''}
                      </div>
                      <input
                        type="number"
                        className={styles.formInput}
                        value={d}
                        min={0}
                        onChange={e => setSeqDelays(prev => prev.map((v, j) => j === i ? Number(e.target.value) : v))}
                        style={{ textAlign: 'center', padding: '0.375rem' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {seqError && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid var(--admin-danger)', borderRadius: 6, padding: '0.625rem 0.875rem', color: 'var(--admin-danger)', fontSize: '0.875rem' }}>
                  {seqError}
                </div>
              )}

              {seqSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid var(--admin-success)', borderRadius: 6, padding: '0.625rem 0.875rem', color: 'var(--admin-success)', fontSize: '0.875rem', fontWeight: 500 }}>
                  ✓ Campaign &ldquo;{seqSuccess}&rdquo; created with {seqEmails.length} steps
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setSeqModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={creatingSeq || !seqName || sequenceProblem(seqEmails) !== null}
                  onClick={confirmCreateSequence}
                >
                  {creatingSeq ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
